"""Run the Campus Customs agent team.

Agent loop: every agent runs PydanticAI's loop (model -> tool calls -> tool
results -> model ... -> structured output). run_agent() drives it node by node
with agent.iter() and emits an `agent_step` event for each node so the
dashboard can show the team working.

Team loop: run_ticket() gives one ticket to the Boss; the Boss and anyone it
delegates to can delegate further (full mesh). run_open_tickets() works every
unresolved ticket in order.

Every event is appended to output/audit_trail.json (see audit.py).

Usage from the backend/ folder:
    ../.venv/bin/python team.py 101        # work one ticket
    ../.venv/bin/python team.py all        # work every unresolved ticket
"""

from __future__ import annotations

import asyncio
import json
import sys
from typing import Any

from pydantic_ai import Agent
from pydantic_ai.messages import RetryPromptPart, TextPart, ToolCallPart, ToolReturnPart
from pydantic_ai.usage import RunUsage, UsageLimits

from agents import REGISTRY
from config import MAX_MODEL_REQUESTS_PER_TICKET, MODEL_NAME
from delegation import SharedRun, TeamDeps, register_runner
from mcp_tools import campus_mcp_server
from models import AgentReport, BossDecision, TicketRunResult


def _clip(value: Any, limit: int = 600) -> str:
    text = value if isinstance(value, str) else str(value)
    return text if len(text) <= limit else text[:limit] + f"... (+{len(text) - limit} chars)"


def _describe(node: Any) -> tuple[str, dict] | None:
    """Turn one agent-loop node into a dict with enough detail to audit later."""
    if Agent.is_user_prompt_node(node):
        return "task_received", {"prompt": _clip(node.user_prompt, 4000)}
    if Agent.is_model_request_node(node):
        parts = node.request.parts
        returns = [
            {"tool": p.tool_name, "tool_call_id": p.tool_call_id, "content": _clip(p.model_response_str(), 4000)}
            for p in parts
            if isinstance(p, ToolReturnPart)
        ]
        retries = [
            {"tool": p.tool_name, "tool_call_id": p.tool_call_id, "message": _clip(p.model_response(), 1000)}
            for p in parts
            if isinstance(p, RetryPromptPart)
        ]
        if not returns and not retries:
            return None
        return "tool_results", {"tool_returns": returns, "retries": retries}
    if Agent.is_call_tools_node(node):
        resp = node.model_response
        return "model_response", {
            "response_model": resp.model_name,
            "text": _clip("".join(p.content for p in resp.parts if isinstance(p, TextPart)), 4000),
            "tool_calls": [
                {"tool": p.tool_name, "tool_call_id": p.tool_call_id, "args": p.args_as_dict()}
                for p in resp.parts
                if isinstance(p, ToolCallPart)
            ],
            "input_tokens": resp.usage.input_tokens or 0,
            "output_tokens": resp.usage.output_tokens or 0,
            "finish_reason": getattr(resp, "finish_reason", None),
        }
    if Agent.is_end_node(node):
        return "finished", {}
    return None


async def run_agent(name: str, task: str, *, deps: TeamDeps, usage: RunUsage) -> dict:
    """Run one agent's loop on `task`. Returns its structured output as a dict.

    `usage` is shared by every agent on the ticket, so the request limit caps
    the whole team, not each agent separately.
    """
    agent = REGISTRY[name].agent
    shared = deps.shared
    # Delegated runs always hand back an AgentReport (even the Boss, when consulted mid-ticket).
    output_type = BossDecision if (name == "boss" and deps.depth == 0) else AgentReport
    shared.emit("agent_started", agent=name, task=_clip(task, 1000), depth=deps.depth, chain=deps.chain)

    async with agent.iter(
        task,
        deps=deps,
        output_type=output_type,
        usage=usage,
        usage_limits=UsageLimits(request_limit=MAX_MODEL_REQUESTS_PER_TICKET),
    ) as run:
        step = 0
        async for node in run:
            described = _describe(node)
            if described is None:
                continue
            step += 1
            kind, data = described
            shared.emit("agent_step", agent=name, step=step, kind=kind, depth=deps.depth, chain=deps.chain, **data)
        output = run.result.output

    result = output.model_dump()
    shared.emit("agent_finished", agent=name, depth=deps.depth, chain=deps.chain, steps=step, output=result)
    return result


register_runner(run_agent)


async def run_ticket(
    ticket_id: int, queue: asyncio.Queue | None = None, run_id: str | None = None
) -> TicketRunResult:
    """Give one ticket to the Boss and let the team work it. `run_id` lets the API track it live."""
    shared = SharedRun(ticket_id=ticket_id, queue=queue)
    if run_id:
        shared.run_id = run_id
    usage = RunUsage()
    deps = TeamDeps(agent="boss", shared=shared, chain=["boss"], depth=0)
    task = (
        f"Work ticket {ticket_id} from start to finish. Read it with get_ticket, delegate the specialist "
        "work to the right teammates, set the final ticket status with update_ticket, and return your "
        "BossDecision."
    )
    shared.emit("ticket_started", agent="boss", task=task)
    result = TicketRunResult(ticket_id=ticket_id, run_id=shared.run_id, model=MODEL_NAME)
    try:
        decision = await run_agent("boss", task, deps=deps, usage=usage)
        result.decision = BossDecision.model_validate(decision)
    except Exception as exc:
        result.error = f"{type(exc).__name__}: {exc}"[:1000]
        shared.emit("ticket_error", agent="boss", error=result.error)
    result.usage = {
        "model": MODEL_NAME,
        "requests": usage.requests,
        "input_tokens": usage.input_tokens,
        "output_tokens": usage.output_tokens,
        "tool_calls": usage.tool_calls,
    }
    result.delegations = shared.delegations
    result.events = shared.events
    shared.emit(
        "ticket_finished",
        agent="boss",
        ok=result.error is None,
        final_status=result.decision.final_status if result.decision else None,
        usage=result.usage,
        delegations=[d.model_dump(exclude={"report"}) for d in shared.delegations],
    )
    return result


async def run_open_tickets() -> list[TicketRunResult]:
    """Team loop: work every unresolved ticket, one at a time, in id order."""
    open_ids = [t["id"] for t in (await _call_mcp("get_open_tickets"))["tickets"]]
    return [await run_ticket(tid) for tid in open_ids]


async def _call_mcp(tool: str, **args: Any) -> dict:
    from fastmcp import Client

    async with Client(campus_mcp_server()) as client:
        return (await client.call_tool(tool, args)).structured_content


async def _main(arg: str) -> None:
    results = await run_open_tickets() if arg == "all" else [await run_ticket(int(arg))]
    for r in results:
        print(json.dumps(r.model_dump(exclude={"events"}), indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_main(sys.argv[1] if len(sys.argv) > 1 else "all"))

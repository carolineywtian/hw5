"""Full-mesh delegation: any agent may hand a task to any other agent.

Every agent gets the same `delegate` tool. Calling it starts a fresh run of the
target agent (its own prompt, its own MCP tools, its own agent loop) and returns
that agent's AgentReport to the caller.

Guard rails (see config.py), because multi-agent chats burn tokens fast:
  - an agent cannot delegate to itself
  - delegation depth is capped (Boss -> A -> B -> C)
  - total hand-offs per ticket are capped
  - all agents working one ticket share one model-request budget
"""

from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable

from pydantic_ai import RunContext
from pydantic_ai.toolsets import FunctionToolset

from audit import append_audit
from config import MAX_DELEGATION_DEPTH, MAX_DELEGATIONS_PER_TICKET, MODEL_NAME
from models import AGENTS, AgentName, Delegation, TeamEvent


@dataclass
class SharedRun:
    """State shared by every agent working on the same ticket.

    emit() is the single place every event goes: the in-memory list, the live
    queue (for the dashboard), and the append-only output/audit_trail.json.
    """

    ticket_id: int | None
    queue: asyncio.Queue | None = None
    audit: bool = True
    run_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    events: list[TeamEvent] = field(default_factory=list)
    delegations: list[Delegation] = field(default_factory=list)
    started: float = field(default_factory=time.perf_counter)

    def emit(self, event_type: str, agent: str | None = None, **data: Any) -> None:
        event = TeamEvent(
            seq=len(self.events) + 1,
            t_ms=round((time.perf_counter() - self.started) * 1000),
            type=event_type,
            agent=agent,
            data=data,
        )
        self.events.append(event)
        if self.audit:
            append_audit(
                {
                    "run_id": self.run_id,
                    "ticket_id": self.ticket_id,
                    "seq": event.seq,
                    "t_ms": event.t_ms,
                    "event": event_type,
                    "agent": agent,
                    "model": MODEL_NAME,
                    **data,
                }
            )
        if self.queue is not None:
            self.queue.put_nowait(event)


@dataclass
class TeamDeps:
    """Per-agent-run dependencies. `chain` is who asked whom to get here."""

    agent: AgentName
    shared: SharedRun
    chain: list[AgentName]
    depth: int = 0

    @property
    def ticket_id(self) -> int | None:
        return self.shared.ticket_id

    @property
    def delegations_left(self) -> int:
        return MAX_DELEGATIONS_PER_TICKET - len(self.shared.delegations)


# run_agent() is injected by team.py to avoid a circular import.
RunAgent = Callable[..., Any]
_run_agent: RunAgent | None = None


def register_runner(fn: RunAgent) -> None:
    global _run_agent
    _run_agent = fn


delegation_toolset: FunctionToolset[TeamDeps] = FunctionToolset(id="delegation")


@delegation_toolset.tool
async def delegate(ctx: RunContext[TeamDeps], to_agent: AgentName, task: str) -> dict:
    """Hand a specific task to another agent on the team and get its report back.

    Any agent can delegate to any other agent: boss, inventory, accounting,
    facilities, customer_service. Use this when the work belongs to another
    role (e.g. Facilities asks Accounting to prepare a rent payment request).

    Args:
        to_agent: Who should do the work. Must be a different agent than you.
        task: A self-contained instruction. Include the ticket id and every id,
            sku, size, qty, or amount the other agent needs, and say exactly
            what you want back.
    """
    d = ctx.deps
    shared = d.shared
    index = len(shared.delegations)
    record = Delegation(
        index=index,
        ticket_id=d.ticket_id,
        from_agent=d.agent,
        to_agent=to_agent,
        task=task,
        depth=d.depth + 1,
    )

    refusal = None
    if to_agent not in AGENTS:
        refusal = f"Unknown agent {to_agent!r}. Choose one of {list(AGENTS)}."
    elif to_agent == d.agent:
        refusal = "You cannot delegate to yourself. Do the work with your own tools."
    elif d.depth + 1 > MAX_DELEGATION_DEPTH:
        refusal = (
            f"Delegation depth limit ({MAX_DELEGATION_DEPTH}) reached. "
            "Finish with what you have and report back to whoever asked you."
        )
    elif d.delegations_left <= 0:
        refusal = (
            f"Team delegation limit ({MAX_DELEGATIONS_PER_TICKET}) reached for this ticket. "
            "Finish with what you have."
        )
    if refusal:
        record.status, record.error = "refused", refusal
        shared.delegations.append(record)
        shared.emit("delegation_refused", agent=d.agent, **record.model_dump())
        return {"status": "refused", "reason": refusal}

    shared.delegations.append(record)
    shared.emit("delegation_started", agent=d.agent, **record.model_dump(exclude={"report", "error"}))

    child = TeamDeps(agent=to_agent, shared=shared, chain=[*d.chain, to_agent], depth=d.depth + 1)
    try:
        report = await _run_agent(to_agent, task, deps=child, usage=ctx.usage)
        record.status, record.report = "done", report
    except Exception as exc:  # report failures to the caller instead of crashing the ticket
        record.status, record.error = "error", f"{type(exc).__name__}: {exc}"[:500]

    shared.emit("delegation_done", agent=to_agent, **record.model_dump())
    if record.status == "error":
        return {"status": "error", "agent": to_agent, "error": record.error}
    return {"status": "done", "agent": to_agent, "report": record.report}

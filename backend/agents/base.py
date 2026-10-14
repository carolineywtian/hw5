"""Shared builder for the five Campus Customs agents.

Each agent = its prompt file (prompts/<name>.md) + the gpt-6-luna model via
Portkey + the MCP tools its role may use + the shared `delegate` tool, which
connects it to every other agent.
"""

from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai import Agent, RunContext

from config import MAX_DELEGATION_DEPTH, PROMPTS_DIR, build_model
from delegation import TeamDeps, delegation_toolset
from mcp_tools import toolset_for
from models import AGENTS, AgentName, AgentReport, BossDecision


@dataclass(frozen=True)
class AgentSpec:
    name: AgentName
    mcp_tools: frozenset[str]

    @property
    def display_name(self) -> str:
        return AGENTS[self.name]["display_name"]

    @property
    def prompt(self) -> str:
        return (PROMPTS_DIR / f"{self.name}.md").read_text(encoding="utf-8")


def _runtime_context(ctx: RunContext[TeamDeps]) -> str:
    """Live situation appended to every agent's prompt on every run."""
    d = ctx.deps
    caller = d.chain[-2] if len(d.chain) > 1 else None
    lines = [
        "## Current run",
        f"- You are: **{AGENTS[d.agent]['display_name']}** (`{d.agent}`).",
        f"- Ticket: {d.ticket_id if d.ticket_id is not None else 'none'}.",
        f"- Delegation chain so far: {' -> '.join(d.chain)}.",
    ]
    if caller:
        lines.append(
            f"- You were asked by **{AGENTS[caller]['display_name']}**. Do the task, then return your "
            "AgentReport to them. Do not take over the whole ticket."
        )
    else:
        lines.append("- You own this ticket from the top. Your output is the final decision.")
    lines.append(
        f"- Depth {d.depth} of {MAX_DELEGATION_DEPTH}; team hand-offs left for this ticket: {d.delegations_left}."
    )
    return "\n".join(lines)


def build_agent(spec: AgentSpec) -> Agent[TeamDeps, AgentReport | BossDecision]:
    agent = Agent(
        build_model(),
        name=spec.name,
        deps_type=TeamDeps,
        output_type=BossDecision if spec.name == "boss" else AgentReport,
        instructions=spec.prompt,
        toolsets=[toolset_for(spec.mcp_tools), delegation_toolset],
        retries=2,
    )
    agent.instructions(_runtime_context)
    return agent

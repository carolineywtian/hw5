"""Boss: reads each ticket, decides who works on it, makes the final call."""

from agents.base import AgentSpec, build_agent

SPEC = AgentSpec(
    name="boss",
    # The Boss reads tickets and sets their status; specialist work is delegated.
    mcp_tools=frozenset({"get_open_tickets", "get_ticket", "list_approval_requests", "update_ticket"}),
)
agent = build_agent(SPEC)

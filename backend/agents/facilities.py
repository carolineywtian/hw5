"""Facilities: the shop space side -- leases, rent, landlord obligations."""

from agents.base import AgentSpec, build_agent

SPEC = AgentSpec(
    name="facilities",
    mcp_tools=frozenset({"get_ticket", "get_lease", "get_cash_and_bills", "list_approval_requests"}),
)
agent = build_agent(SPEC)

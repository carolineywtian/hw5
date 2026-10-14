"""Inventory: checks stock by SKU and size, spots shortfalls, picks the restock vendor."""

from agents.base import AgentSpec, build_agent

SPEC = AgentSpec(
    name="inventory",
    mcp_tools=frozenset({"get_ticket", "get_open_tickets", "check_stock_and_price", "get_vendor"}),
)
agent = build_agent(SPEC)

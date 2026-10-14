"""Customer Service: drafts messages to customers for a human to review and send."""

from agents.base import AgentSpec, build_agent

SPEC = AgentSpec(
    name="customer_service",
    mcp_tools=frozenset({"get_ticket", "check_stock_and_price", "list_approval_requests", "save_customer_message"}),
)
agent = build_agent(SPEC)

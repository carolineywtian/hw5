"""Accounting: watches cash and invoices, checks margins, prepares payments/POs for human approval."""

from agents.base import AgentSpec, build_agent

SPEC = AgentSpec(
    name="accounting",
    mcp_tools=frozenset(
        {
            "get_ticket",
            "get_cash_and_bills",
            "check_margin",
            "check_stock_and_price",
            "get_vendor",
            "list_approval_requests",
            "create_approval_request",  # the only agent that can queue payments/POs/price overrides
        }
    ),
)
agent = build_agent(SPEC)

"""Data types shared by the Campus Customs agent team.

- AgentName / AGENTS: the five roles and how they are shown on the dashboard.
- AgentReport: what every specialist hands back when it finishes a task.
- BossDecision: the Boss's final call on a ticket.
- Delegation / TeamEvent: the trail of who asked whom to do what.
- TicketRunResult: everything one ticket run produced (for the API/dashboard).
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

AgentName = Literal["boss", "inventory", "accounting", "facilities", "customer_service"]

AGENTS: dict[str, dict[str, str]] = {
    "boss": {
        "display_name": "Boss",
        "role": "Reads each ticket, decides who works on it, and makes the final call.",
    },
    "inventory": {
        "display_name": "Inventory",
        "role": "Checks stock by SKU and size, spots shortfalls, and picks the restock vendor.",
    },
    "accounting": {
        "display_name": "Accounting",
        "role": "Watches cash and invoices, checks margins, and prepares payments/POs for human approval.",
    },
    "facilities": {
        "display_name": "Facilities",
        "role": "Handles the shop space side: leases, rent, and landlord obligations.",
    },
    "customer_service": {
        "display_name": "Customer Service",
        "role": "Drafts clear, accurate messages to customers for human review.",
    },
}

TicketStatus = Literal["open", "in_progress", "waiting_approval", "resolved", "escalated"]


class Fact(BaseModel):
    """One value an agent read from a tool. Agents may only state facts they can source."""

    label: str = Field(description="What the value is, e.g. 'CC-HOOD-NAVY size M qty'.")
    value: str = Field(description="The value exactly as the tool returned it.")
    source_tool: str = Field(description="MCP tool that returned it, e.g. 'check_stock_and_price'.")


class AgentReport(BaseModel):
    """Structured hand-back from a specialist (Inventory, Accounting, Facilities, Customer Service)."""

    agent: AgentName
    ticket_id: int | None = Field(default=None, description="Ticket this work was for, if any.")
    summary: str = Field(description="2-4 sentences: what you found and what you did.")
    facts: list[Fact] = Field(default_factory=list, description="Key values from tools that back the summary.")
    actions_taken: list[str] = Field(
        default_factory=list,
        description="Database changes you made, e.g. 'Created approval request #3 (rent_payment, $2400)'.",
    )
    approval_request_ids: list[int] = Field(
        default_factory=list, description="IDs of approval requests you created or found pending."
    )
    customer_message_ids: list[int] = Field(default_factory=list, description="IDs of message drafts you saved.")
    recommendations: list[str] = Field(default_factory=list, description="What you think should happen next.")
    blockers: list[str] = Field(
        default_factory=list, description="Anything that stops the ticket, e.g. not enough cash or stock."
    )
    needs_human_approval: bool = Field(
        default=False, description="True if something you set up is waiting on a human decision."
    )


class BossDecision(BaseModel):
    """The Boss's final call on one ticket."""

    ticket_id: int
    decision: str = Field(description="One or two sentences: the call you made on this ticket.")
    final_status: TicketStatus = Field(description="Status you set on the ticket with update_ticket.")
    agents_consulted: list[AgentName] = Field(default_factory=list)
    key_facts: list[Fact] = Field(default_factory=list)
    approval_request_ids: list[int] = Field(default_factory=list, description="Requests now waiting on a human.")
    customer_message_ids: list[int] = Field(default_factory=list, description="Drafts waiting for a human to send.")
    next_steps_for_human: list[str] = Field(
        default_factory=list, description="What the person at the dashboard needs to do, in order."
    )
    risks: list[str] = Field(default_factory=list, description="Cash, stock, or timing risks the human should know.")


class Delegation(BaseModel):
    """One hand-off between agents. Any agent may delegate to any other agent."""

    index: int
    ticket_id: int | None
    from_agent: AgentName
    to_agent: AgentName
    task: str
    depth: int
    status: Literal["running", "done", "error", "refused"] = "running"
    report: dict[str, Any] | None = None
    error: str | None = None


class TeamEvent(BaseModel):
    """One thing that happened during a run, streamed to the dashboard later."""

    seq: int
    t_ms: int
    type: str
    agent: AgentName | None = None
    data: dict[str, Any] = Field(default_factory=dict)


class TicketRunResult(BaseModel):
    ticket_id: int
    run_id: str
    model: str
    decision: BossDecision | None = None
    error: str | None = None
    delegations: list[Delegation] = Field(default_factory=list)
    events: list[TeamEvent] = Field(default_factory=list)
    usage: dict[str, Any] = Field(default_factory=dict)

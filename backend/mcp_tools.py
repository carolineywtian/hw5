"""Attach the Campus Customs MCP server to the agents.

The FastMCP server in mcp_server/server.py is loaded in-process (same process as
the backend), so no separate MCP terminal is needed. Each agent gets a filtered
view that exposes only the tools its role is allowed to use.

This is the ONLY way the backend touches shop data: there is no second
shop-tools layer and no direct SQL in the backend. Every fact comes from the
MCP server over data/campus_customs_new.db.
"""

from __future__ import annotations

import importlib.util
import sys
from functools import lru_cache

from pydantic_ai.mcp import MCPToolset

from config import MCP_SERVER_FILE

# Every tool the server exposes, grouped by what it does.
READ_TOOLS = {
    "get_open_tickets",
    "get_ticket",
    "check_stock_and_price",
    "get_cash_and_bills",
    "check_margin",
    "get_lease",
    "list_approval_requests",
    "get_vendor",
    "list_tickets",  # dashboard ticket board; not assigned to any agent
}
WRITE_TOOLS = {"create_approval_request", "save_customer_message", "update_ticket"}
# Dashboard-only tools: a human approves money and sends messages. Never given to an agent.
HUMAN_ONLY_TOOLS = {"record_human_decision", "revise_customer_message", "mark_message_sent"}
AGENT_TOOLS = READ_TOOLS | WRITE_TOOLS


@lru_cache(maxsize=1)
def campus_mcp_server():
    """Import the FastMCP server object from mcp_server/server.py by file path."""
    spec = importlib.util.spec_from_file_location("campus_customs_mcp", MCP_SERVER_FILE)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module.mcp


@lru_cache(maxsize=1)
def _base_toolset() -> MCPToolset:
    return MCPToolset(campus_mcp_server(), id="campus_customs")


def toolset_for(allowed: frozenset[str]):
    """An MCP toolset limited to `allowed` tool names. Human-only tools are always excluded."""
    if allowed & HUMAN_ONLY_TOOLS:
        raise ValueError(f"Agents may not use human-only tools: {sorted(allowed & HUMAN_ONLY_TOOLS)}")
    unknown = allowed - AGENT_TOOLS
    if unknown:
        raise ValueError(f"Unknown MCP tools: {sorted(unknown)}")
    return _base_toolset().filtered(lambda _ctx, tool_def: tool_def.name in allowed)

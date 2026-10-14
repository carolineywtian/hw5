"""Campus Customs backend API (FastAPI) for the React dashboard.

Every shop fact goes through the campus-customs MCP server, the same tools the
agents use; this file has no SQL. The only file operation is /api/reset, which
copies the untouched original database over the working copy.

Routes
  GET  /api/health                    model, database, and whether a run is active
  GET  /api/tickets                   all tickets with open/resolved state
  GET  /api/tickets/{id}              one ticket with its history
  POST /api/tickets/{id}/run          run the agent team on a ticket (starts in background)
  GET  /api/runs, /api/runs/{run_id}  run status and the Boss's decision
  GET  /api/events                    recent agent events: what each agent said, tools used
  GET  /api/approvals                 approval requests (?status=pending)
  POST /api/approvals/{id}/approve    HUMAN approves: this is what moves cash
  POST /api/approvals/{id}/reject     HUMAN rejects
  POST /api/messages/{id}/revise      HUMAN rewrites a customer message draft before sending
  POST /api/messages/{id}/send        HUMAN marks a customer message draft as sent
  GET  /api/cash                      checking balance from cash_accounts
  POST /api/reset                     restore the working DB from the original

Run from the backend/ folder (serves http://localhost:8000):
    ../.venv/bin/uvicorn main:app --reload --port 8000
--reload only watches .py files under backend/, so agent writes to the database
and output/audit_trail.json never trigger a restart. Saving a .py file during an
agent run restarts the server and cuts that run off; prompt (.md) edits need a
manual restart because prompts are read when the server starts.
"""

from __future__ import annotations

import asyncio
import os
import shutil
import sys
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastmcp import Client
from pydantic import BaseModel, Field

from audit import append_audit, read_audit
from config import MODEL_NAME
from mcp_tools import campus_mcp_server
from team import run_ticket

app = FastAPI(title="Campus Customs Operations API", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

# One ticket at a time: tickets share the same cash, and parallel runs burn tokens.
ACTIVE: dict[str, Any] = {"run_id": None, "ticket_id": None}
RUNS: dict[str, dict[str, Any]] = {}
_TASKS: set[asyncio.Task] = set()


# ----------------------------------------------------------------------------- helpers


async def mcp(tool: str, **args: Any) -> dict:
    """Call one campus-customs MCP tool in-process and return its structured result."""
    async with Client(campus_mcp_server()) as client:
        result = await client.call_tool(tool, args, raise_on_error=False)
    if result.is_error:
        text = " ".join(getattr(c, "text", "") for c in result.content)
        raise HTTPException(status_code=400, detail=f"{tool} failed: {text}")
    return result.structured_content or {}


def _tool_error(data: dict, not_found_status: int = 404) -> None:
    """Turn a tool's {"error": ...} reply into an HTTP error."""
    if "error" in data:
        msg = data["error"]
        status = not_found_status if msg.startswith("No ") else 409
        raise HTTPException(status_code=status, detail=data)


def _db_paths() -> tuple[str, str]:
    """Working copy = the MCP server's DB_PATH; the original sits next to it."""
    working = sys.modules["campus_customs_mcp"].DB_PATH
    return str(working), str(working.with_name("campus_customs.db"))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ----------------------------------------------------------------------------- health


@app.get("/api/health")
async def health() -> dict:
    working, original = _db_paths()
    return {
        "ok": True,
        "model": MODEL_NAME,
        "working_db": os.path.basename(working),
        "original_db_present": os.path.exists(original),
        "active_run": ACTIVE["run_id"],
        "active_ticket": ACTIVE["ticket_id"],
    }


# ----------------------------------------------------------------------------- tickets


@app.get("/api/tickets")
async def list_tickets() -> dict:
    """All tickets and whether each is open or resolved (via MCP list_tickets)."""
    return await mcp("list_tickets")


@app.get("/api/tickets/{ticket_id}")
async def get_ticket(ticket_id: int) -> dict:
    data = await mcp("get_ticket", ticket_id=ticket_id)
    _tool_error(data)
    return data


async def _run_in_background(run_id: str, ticket_id: int) -> None:
    run = RUNS[run_id]
    try:
        result = await run_ticket(ticket_id, run_id=run_id)
        run["status"] = "error" if result.error else "done"
        run["error"] = result.error
        run["decision"] = result.decision.model_dump() if result.decision else None
        run["usage"] = result.usage
        run["delegations"] = [d.model_dump(exclude={"report"}) for d in result.delegations]
    except Exception as exc:  # never leave a run stuck in "running"
        run["status"], run["error"] = "error", f"{type(exc).__name__}: {exc}"[:1000]
    finally:
        run["finished_at"] = _now()
        ACTIVE.update(run_id=None, ticket_id=None)


@app.post("/api/tickets/{ticket_id}/run", status_code=202)
async def run_ticket_route(ticket_id: int) -> dict:
    """Start the agent team on one ticket. Poll /api/runs/{run_id} and /api/events to watch it."""
    if ACTIVE["run_id"]:
        raise HTTPException(
            status_code=409,
            detail=f"Ticket {ACTIVE['ticket_id']} is already running (run {ACTIVE['run_id']}). One ticket at a time.",
        )
    ticket = await mcp("get_ticket", ticket_id=ticket_id)
    _tool_error(ticket)
    if ACTIVE["run_id"]:  # re-check after the await
        raise HTTPException(status_code=409, detail="Another run just started. One ticket at a time.")

    run_id = uuid.uuid4().hex[:12]
    ACTIVE.update(run_id=run_id, ticket_id=ticket_id)
    RUNS[run_id] = {
        "run_id": run_id,
        "ticket_id": ticket_id,
        "status": "running",
        "model": MODEL_NAME,
        "started_at": _now(),
        "finished_at": None,
        "decision": None,
        "error": None,
    }
    task = asyncio.create_task(_run_in_background(run_id, ticket_id))
    _TASKS.add(task)
    task.add_done_callback(_TASKS.discard)
    return {"run_id": run_id, "ticket_id": ticket_id, "status": "running", "events_url": f"/api/events?run_id={run_id}"}


@app.get("/api/runs")
async def list_runs() -> dict:
    return {"active_run": ACTIVE["run_id"], "runs": sorted(RUNS.values(), key=lambda r: r["started_at"], reverse=True)}


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str) -> dict:
    if run_id not in RUNS:
        raise HTTPException(status_code=404, detail=f"No run {run_id} since the server started.")
    return RUNS[run_id]


# ----------------------------------------------------------------------------- events


def _board_event(e: dict) -> dict:
    """Shape one audit entry for the board: who, what they said, which tools they used."""
    out = {
        "id": e.get("audit_id"),
        "at": e.get("logged_at"),
        "run_id": e.get("run_id"),
        "ticket_id": e.get("ticket_id"),
        "event": e.get("event"),
        "kind": e.get("kind"),
        "agent": e.get("agent"),
        "chain": e.get("chain"),
        "depth": e.get("depth"),
        "said": None,
        "tools_used": [],
    }
    kind, event = e.get("kind"), e.get("event")
    if kind == "model_response":
        calls = e.get("tool_calls") or []
        out["tools_used"] = [c["tool"] for c in calls if not c["tool"].startswith("final_result")]
        out["tool_calls"] = [c for c in calls if not c["tool"].startswith("final_result")]
        final = next((c["args"] for c in calls if c["tool"].startswith("final_result")), None)
        out["said"] = e.get("text") or (final.get("summary") or final.get("decision") if final else None)
        out["tokens"] = {"input": e.get("input_tokens", 0), "output": e.get("output_tokens", 0)}
    elif kind == "tool_results":
        out["tool_results"] = [
            {"tool": r["tool"], "tool_call_id": r.get("tool_call_id"), "result": (r.get("content") or "")[:600]}
            for r in e.get("tool_returns") or []
        ]
        out["tools_used"] = [r["tool"] for r in e.get("tool_returns") or []]
    elif kind == "task_received":
        out["said"] = e.get("prompt")
    elif event and event.startswith("delegation_"):
        out["delegation"] = {k: e.get(k) for k in ("from_agent", "to_agent", "task", "depth", "status", "error")}
        out["said"] = f"{e.get('from_agent')} -> {e.get('to_agent')}: {e.get('task')}"
    elif event == "agent_finished":
        output = e.get("output") or {}
        out["said"] = output.get("summary") or output.get("decision")
        out["output"] = output
    elif event in ("ticket_started", "ticket_finished", "ticket_error", "human_decision", "ticket_resolved", "message_sent", "message_revised", "database_reset"):
        out["details"] = {k: v for k, v in e.items() if k not in out and k not in ("audit_id", "logged_at")}
    return out


@app.get("/api/events")
async def events(
    since: int = Query(0, description="Only events with id > since (use the last id you saw)."),
    limit: int = Query(100, ge=1, le=500),
    ticket_id: int | None = None,
    run_id: str | None = None,
) -> dict:
    """Recent agent events from output/audit_trail.json, oldest first within the page."""
    entries = [
        e
        for e in read_audit()
        if (e.get("audit_id") or 0) > since
        # database_reset belongs to every ticket: the board uses it to start fresh.
        and (ticket_id is None or e.get("ticket_id") == ticket_id or e.get("event") == "database_reset")
        and (run_id is None or e.get("run_id") == run_id)
    ]
    page = entries[-limit:]
    return {
        "events": [_board_event(e) for e in page],
        "last_id": page[-1]["audit_id"] if page else since,
        "active_run": ACTIVE["run_id"],
    }


# ----------------------------------------------------------------------------- approvals (human)


class Decision(BaseModel):
    decided_by: str = Field(min_length=1, description="Name of the person clicking approve/reject.")
    note: str = ""


@app.get("/api/approvals")
async def approvals(
    status: Literal["pending", "approved", "rejected", "executed"] | None = None, ticket_id: int | None = None
) -> dict:
    args: dict[str, Any] = {}
    if status:
        args["status"] = status
    if ticket_id is not None:
        args["ticket_id"] = ticket_id
    return await mcp("list_approval_requests", **args)


async def _decide(request_id: int, decision: str, body: Decision) -> dict:
    data = await mcp(
        "record_human_decision",
        request_id=request_id,
        decision=decision,
        decided_by=body.decided_by,
        note=body.note,
    )
    _tool_error(data)
    req = data["request"]
    append_audit(
        {
            "run_id": None,
            "ticket_id": req["ticket_id"],
            "event": "human_decision",
            "agent": None,
            "model": None,
            "request_id": request_id,
            "kind": req["kind"],
            "amount": req["amount"],
            "payee": req["payee"],
            "decision": decision,
            "decided_by": body.decided_by,
            "note": body.note,
            "new_status": data["status"],
            "effects": data.get("effects", []),
        }
    )
    bills = await mcp("get_cash_and_bills")
    data["checking_balance"] = next((a["balance"] for a in bills["cash_accounts"] if a["name"] == "checking"), None)
    data["ticket_resolved"] = await _resolve_if_done(req["ticket_id"], body.decided_by)
    return data


async def _resolve_if_done(ticket_id: int, decided_by: str) -> bool:
    """After a human decision: if the agents finished (waiting_approval, or escalated to a
    human, which is exactly what this decision answers) and nothing is left pending for
    this ticket, mark it resolved via MCP update_ticket."""
    if ACTIVE["ticket_id"] == ticket_id:
        return False  # the team is still working this ticket
    ticket = (await mcp("get_ticket", ticket_id=ticket_id)).get("ticket", {})
    pending = await mcp("list_approval_requests", status="pending", ticket_id=ticket_id)
    if ticket.get("status") not in ("waiting_approval", "escalated") or pending["requests"]:
        return False
    decided = [r for r in ticket.get("approval_requests", []) if r["status"] != "pending"]
    note = "All approval requests decided by a human: " + ", ".join(
        f"#{r['id']} {r['kind']} {r['status']}" for r in decided
    )
    result = await mcp(
        "update_ticket", ticket_id=ticket_id, status="resolved", note=note, updated_by=f"human: {decided_by}"
    )
    if "error" in result:
        return False
    append_audit(
        {
            "run_id": None,
            "ticket_id": ticket_id,
            "event": "ticket_resolved",
            "agent": None,
            "model": None,
            "resolved_by": decided_by,
            "note": note,
        }
    )
    return True


@app.post("/api/approvals/{request_id}/approve")
async def approve(request_id: int, body: Decision) -> dict:
    """A human approves. Payments and purchase orders move cash here, and only here."""
    return await _decide(request_id, "approved", body)


@app.post("/api/approvals/{request_id}/reject")
async def reject(request_id: int, body: Decision) -> dict:
    return await _decide(request_id, "rejected", body)


# ----------------------------------------------------------------------------- message drafts (human)


class SendBody(BaseModel):
    sent_by: str = Field(min_length=1, description="Name of the person sending the draft.")


class ReviseBody(BaseModel):
    revised_by: str = Field(min_length=1, description="Name of the person revising the draft.")
    body: str = Field(min_length=1)
    subject: str = ""


@app.post("/api/messages/{message_id}/revise")
async def revise_message(message_id: int, payload: ReviseBody) -> dict:
    """A human rewrites a customer message draft before sending (via MCP revise_customer_message)."""
    data = await mcp(
        "revise_customer_message",
        message_id=message_id,
        body=payload.body,
        revised_by=payload.revised_by,
        subject=payload.subject,
    )
    _tool_error(data)
    msg = data["message"]
    append_audit(
        {
            "run_id": None,
            "ticket_id": msg["ticket_id"],
            "event": "message_revised",
            "agent": None,
            "model": None,
            "message_id": message_id,
            "recipient": msg["recipient"],
            "revised_by": payload.revised_by,
            "previous_body": data["previous"]["body"],
            "new_subject": msg["subject"],
            "new_body": msg["body"],
        }
    )
    return data


@app.post("/api/messages/{message_id}/send")
async def send_message(message_id: int, body: SendBody) -> dict:
    """A human reviewed a customer message draft and sent it (via MCP mark_message_sent)."""
    data = await mcp("mark_message_sent", message_id=message_id, sent_by=body.sent_by)
    _tool_error(data)
    msg = data["message"]
    append_audit(
        {
            "run_id": None,
            "ticket_id": msg["ticket_id"],
            "event": "message_sent",
            "agent": None,
            "model": None,
            "message_id": message_id,
            "recipient": msg["recipient"],
            "subject": msg["subject"],
            "sent_by": body.sent_by,
        }
    )
    return data


# ----------------------------------------------------------------------------- cash


@app.get("/api/cash")
async def cash() -> dict:
    """Current checking balance from cash_accounts, plus available cash after known bills."""
    data = await mcp("get_cash_and_bills")
    checking = next((a for a in data["cash_accounts"] if a["name"] == "checking"), None)
    if checking is None:
        raise HTTPException(status_code=404, detail="No 'checking' row in cash_accounts.")
    pos = data["cash_position"]
    return {
        "date_today": data["date_today"],
        "checking_balance": checking["balance"],
        "checking_as_of": checking["date"],
        "available_cash": pos["available_cash"],
        "known_bills": pos["known_bills"],
        "pending_purchase_orders_total": pos["pending_purchase_orders_total"],
        "payments": data["payments"],
    }


# ----------------------------------------------------------------------------- reset


@app.post("/api/reset")
async def reset() -> dict:
    """Restore data/campus_customs_new.db from the untouched original. The audit trail is kept."""
    if ACTIVE["run_id"]:
        raise HTTPException(status_code=409, detail="A ticket is running. Wait for it to finish before resetting.")
    working, original = _db_paths()
    if not os.path.exists(original):
        raise HTTPException(status_code=500, detail="Original database data/campus_customs.db is missing.")
    tmp = working + ".resetting"
    shutil.copy2(original, tmp)
    os.replace(tmp, working)  # atomic swap: never a half-copied working DB
    append_audit(
        {
            "run_id": None,
            "ticket_id": None,
            "event": "database_reset",
            "agent": None,
            "model": None,
            "note": "Working copy restored from data/campus_customs.db (audit trail kept).",
        }
    )
    RUNS.clear()
    tickets = await mcp("list_tickets")
    cash_now = await cash()
    return {
        "status": "reset",
        "tickets": [{"id": t["id"], "status": t["status"], "state": t["state"]} for t in tickets["tickets"]],
        "checking_balance": cash_now["checking_balance"],
    }

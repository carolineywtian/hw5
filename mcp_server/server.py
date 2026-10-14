"""Campus Customs MCP server.

Every agent in HW5 uses these tools. They read and write the working copy
data/campus_customs_new.db only. The original data/campus_customs.db is
never opened here, so it stays untouched for resets.

15 tools: 9 read-only (list_tickets is for the dashboard), 3 agent write tools (approval requests, message
drafts, ticket status), and 3 human-only tools for the dashboard
(record_human_decision, revise_customer_message, mark_message_sent) that agents are never given.

Rule for every tool: return only what is in the database. If a record is
missing, say so with an "error" key instead of guessing.
"""

import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Iterator, Literal

from fastmcp import FastMCP

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "campus_customs_new.db"

mcp = FastMCP(
    "Campus Customs",
    instructions=(
        "Tools for the Campus Customs shop database. Only report values these "
        "tools return. Never invent tickets, stock, prices, or balances."
    ),
)

READ_ONLY = {"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False}
WRITES_DB = {"readOnlyHint": False, "destructiveHint": False, "openWorldHint": False}
# Tools tagged "human_only" are for the dashboard (a person), never given to agents.
HUMAN_ONLY = {"human_only"}

# Ticket statuses the team may set. "resolved" is final.
TICKET_STATUSES = ("open", "in_progress", "waiting_approval", "resolved", "escalated")
UNRESOLVED = ("open", "in_progress", "waiting_approval", "escalated")

# Cash rules (order-independent): a bill counts against cash as soon as the shop
# KNOWS about it, whether or not anyone has queued its payment yet.
RENT_WINDOW_DAYS = 30        # rent counts as a known bill once it is due within this many days
LOW_CASH_CUSHION = 500       # warn when available cash after everything would drop below this


@contextmanager
def _connect() -> Iterator[sqlite3.Connection]:
    """Open the working copy; commit on success, roll back on error, always close."""
    # mode=rw: fail loudly if the working copy is missing instead of creating an empty DB.
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Working database not found: {DB_PATH}")
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=rw", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _rows(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> list[dict]:
    return [dict(row) for row in conn.execute(sql, params).fetchall()]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _today(conn: sqlite3.Connection) -> str | None:
    row = conn.execute("SELECT date_today FROM desk").fetchone()
    return row["date_today"] if row else None


def _ensure_work_tables(conn: sqlite3.Connection) -> None:
    """Tables the agents write to. Created in the working copy only."""
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS approval_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER NOT NULL,
            kind TEXT NOT NULL,
            ref_id INTEGER,
            vendor_id INTEGER,
            sku TEXT,
            size TEXT,
            qty INTEGER,
            unit_price REAL,
            amount REAL NOT NULL,
            payee TEXT,
            reason TEXT NOT NULL,
            requested_by TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            decided_by TEXT,
            decided_at TEXT,
            decision_note TEXT,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id)
        );
        CREATE TABLE IF NOT EXISTS customer_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER NOT NULL,
            recipient TEXT NOT NULL,
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            drafted_by TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            created_at TEXT NOT NULL,
            sent_by TEXT,
            sent_at TEXT,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id)
        );
        CREATE TABLE IF NOT EXISTS ticket_updates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER NOT NULL,
            old_status TEXT NOT NULL,
            new_status TEXT NOT NULL,
            note TEXT NOT NULL,
            updated_by TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id)
        );
        """
    )


def _table_exists(conn: sqlite3.Connection, name: str) -> bool:
    return conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone() is not None


def _pending_requests(conn: sqlite3.Connection, **where) -> list[dict]:
    if not _table_exists(conn, "approval_requests"):
        return []
    clauses = ["status = 'pending'"] + [f"{k} = ?" for k in where]
    return _rows(
        conn,
        f"SELECT * FROM approval_requests WHERE {' AND '.join(clauses)} ORDER BY id",
        tuple(where.values()),
    )



def _cash_position(conn: sqlite3.Connection) -> dict:
    """Available cash, computed the same way no matter which ticket runs first.

    available = bank balance
                - every KNOWN bill (unpaid invoices + rent due within RENT_WINDOW_DAYS),
                  counted once whether or not a payment request is queued for it
                - any other pending payment request not already counted above
                - pending purchase orders (new commitments)
    """
    today = _today(conn)
    total_cash = conn.execute("SELECT COALESCE(SUM(balance), 0) FROM cash_accounts").fetchone()[0]
    obligations: dict[tuple, dict] = {}
    for inv in _rows(
        conn,
        """SELECT i.id, i.amount, i.due_date, v.name AS payee FROM invoices i
           JOIN vendors v ON v.id = i.vendor_id WHERE i.status != 'paid' ORDER BY i.due_date""",
    ):
        obligations[("invoice_payment", inv["id"])] = {
            "kind": "invoice", "ref_id": inv["id"], "payee": inv["payee"],
            "amount": inv["amount"], "due": inv["due_date"], "priority": 2,
        }
    for lease in _rows(conn, "SELECT * FROM leases ORDER BY next_due"):
        days = (date.fromisoformat(lease["next_due"]) - date.fromisoformat(today)).days if today else 0
        if days <= RENT_WINDOW_DAYS:
            obligations[("rent_payment", lease["id"])] = {
                "kind": "rent", "ref_id": lease["id"], "payee": lease["landlord"],
                "amount": lease["monthly_rent"], "due": lease["next_due"], "priority": 1,
            }
    purchase_orders = []
    for req in _pending_requests(conn):
        key = (req["kind"], req["ref_id"])
        if req["kind"] in ("invoice_payment", "rent_payment"):
            if key in obligations:
                obligations[key]["payment_request_id"] = req["id"]
            else:  # queued payment for a bill outside the known-bill rules: still counts
                obligations[key] = {
                    "kind": req["kind"].split("_")[0], "ref_id": req["ref_id"], "payee": req["payee"],
                    "amount": req["amount"], "due": None, "priority": 3, "payment_request_id": req["id"],
                }
        elif req["kind"] == "purchase_order":
            purchase_orders.append({"request_id": req["id"], "payee": req["payee"], "amount": req["amount"]})
    known = sorted(obligations.values(), key=lambda o: (o["priority"], o["due"] or ""))
    known_total = sum(o["amount"] for o in known)
    po_total = sum(po["amount"] for po in purchase_orders)
    return {
        "date_today": today,
        "total_cash": total_cash,
        "known_bills": known,
        "known_bills_total": known_total,
        "pending_purchase_orders": purchase_orders,
        "pending_purchase_orders_total": po_total,
        "available_cash": total_cash - known_total - po_total,
        "rules": (
            f"available = cash - known bills (unpaid invoices + rent due within {RENT_WINDOW_DAYS} days, "
            "queued or not, counted once) - pending purchase orders. Priority: rent, then invoices, "
            "then purchase orders. Purchase orders must fit in available cash."
        ),
    }


@mcp.tool(annotations=READ_ONLY)
def get_open_tickets() -> dict:
    """List every unresolved ticket with the records it links to.

    "Open" here means any status except resolved (open, in_progress,
    waiting_approval, escalated). For each ticket this returns the ticket row plus, when the ticket
    references them: the inventory row for its sku/size, the pricing row for
    its sku, the linked invoice with its vendor, and the linked lease.
    Also returns the shop's current date from the desk table.
    """
    with _connect() as conn:
        today = conn.execute("SELECT date_today FROM desk").fetchone()
        tickets = _rows(
            conn,
            f"SELECT * FROM tickets WHERE status IN ({','.join('?' * len(UNRESOLVED))}) ORDER BY id",
            UNRESOLVED,
        )

        for ticket in tickets:
            if ticket["sku"]:
                ticket["inventory"] = _rows(
                    conn,
                    "SELECT * FROM inventory WHERE sku = ? AND size = ?",
                    (ticket["sku"], ticket["size"]),
                )
                ticket["pricing"] = _rows(
                    conn, "SELECT * FROM pricing WHERE sku = ?", (ticket["sku"],)
                )
            if ticket["invoice_id"] is not None:
                ticket["invoice"] = _rows(
                    conn,
                    """SELECT i.*, v.name AS vendor_name, v.specialty AS vendor_specialty,
                              v.lead_days AS vendor_lead_days
                       FROM invoices i JOIN vendors v ON v.id = i.vendor_id
                       WHERE i.id = ?""",
                    (ticket["invoice_id"],),
                )
            if ticket["lease_id"] is not None:
                ticket["lease"] = _rows(
                    conn, "SELECT * FROM leases WHERE id = ?", (ticket["lease_id"],)
                )

    return {
        "date_today": today["date_today"] if today else None,
        "open_ticket_count": len(tickets),
        "tickets": tickets,
    }


@mcp.tool(annotations=READ_ONLY)
def check_stock_and_price(sku: str, size: str | None = None) -> dict:
    """Look up stock and pricing for one product.

    Args:
        sku: Product code, e.g. "CC-HOOD-NAVY".
        size: Optional size (e.g. "M", "OS"). Leave empty to get every size.

    Returns the matching inventory rows, the pricing row (unit_cost and
    list_price), the total quantity across the returned rows, and the
    vendors table so a restock supplier can be chosen.
    """
    with _connect() as conn:
        if size:
            stock = _rows(
                conn, "SELECT * FROM inventory WHERE sku = ? AND size = ?", (sku, size)
            )
        else:
            stock = _rows(
                conn, "SELECT * FROM inventory WHERE sku = ? ORDER BY size", (sku,)
            )
        pricing = _rows(conn, "SELECT * FROM pricing WHERE sku = ?", (sku,))
        vendors = _rows(conn, "SELECT * FROM vendors ORDER BY id")

    if not stock and not pricing:
        return {"error": f"No inventory or pricing found for sku={sku!r} size={size!r}."}

    return {
        "sku": sku,
        "size": size,
        "inventory": stock,
        "total_qty": sum(row["qty"] for row in stock),
        "pricing": pricing[0] if pricing else None,
        "vendors": vendors,
    }


@mcp.tool(annotations=READ_ONLY)
def get_cash_and_bills() -> dict:
    """Show the shop's money position.

    Returns the shop's current date, every cash account balance, all invoices
    that are not paid (with vendor name), every lease with its rent and next
    due date, and the payments already recorded. Totals are computed only
    from those rows. Rent counts in total_rent_due when it is due within 30 days.

    cash_position.available_cash is the number to decide with: cash minus every
    known bill (queued or not, counted once) minus pending purchase orders.
    """
    with _connect() as conn:
        today = conn.execute("SELECT date_today FROM desk").fetchone()
        accounts = _rows(conn, "SELECT * FROM cash_accounts ORDER BY name")
        open_invoices = _rows(
            conn,
            """SELECT i.*, v.name AS vendor_name
               FROM invoices i JOIN vendors v ON v.id = i.vendor_id
               WHERE i.status != 'paid' ORDER BY i.due_date""",
        )
        leases = _rows(conn, "SELECT * FROM leases ORDER BY next_due")
        payments = _rows(conn, "SELECT * FROM payments ORDER BY paid_at")
        position = _cash_position(conn)

    total_cash = sum(a["balance"] for a in accounts)
    total_open_invoices = sum(i["amount"] for i in open_invoices)
    # Rent counts once it is due within RENT_WINDOW_DAYS (after it is paid, next_due moves out a month).
    total_rent_due = sum(o["amount"] for o in position["known_bills"] if o["kind"] == "rent")

    return {
        "date_today": today["date_today"] if today else None,
        "cash_accounts": accounts,
        "total_cash": total_cash,
        "open_invoices": open_invoices,
        "total_open_invoices": total_open_invoices,
        "leases": leases,
        "total_rent_due": total_rent_due,
        "cash_after_invoices_and_rent": total_cash - total_open_invoices - total_rent_due,
        "payments": payments,
        "cash_position": position,
    }



@mcp.tool(annotations=READ_ONLY)
def list_tickets() -> dict:
    """List EVERY ticket (any status) with a simple open/resolved state.

    For the dashboard's ticket board. `state` is "resolved" when status is
    resolved and "open" for every other status (open, in_progress,
    waiting_approval, escalated). Also counts each ticket's pending approval
    requests and unsent message drafts.
    """
    with _connect() as conn:
        tickets = _rows(
            conn,
            "SELECT id, type, requester, subject, sku, size, qty, lease_id, invoice_id, status, created_at "
            "FROM tickets ORDER BY id",
        )
        has_requests = _table_exists(conn, "approval_requests")
        has_messages = _table_exists(conn, "customer_messages")
        for t in tickets:
            t["state"] = "resolved" if t["status"] == "resolved" else "open"
            t["pending_approvals"] = (
                conn.execute(
                    "SELECT COUNT(*) FROM approval_requests WHERE ticket_id = ? AND status = 'pending'", (t["id"],)
                ).fetchone()[0]
                if has_requests
                else 0
            )
            t["draft_messages"] = (
                conn.execute(
                    "SELECT COUNT(*) FROM customer_messages WHERE ticket_id = ? AND status = 'draft'", (t["id"],)
                ).fetchone()[0]
                if has_messages
                else 0
            )
        return {
            "date_today": _today(conn),
            "tickets": tickets,
            "open_count": sum(t["state"] == "open" for t in tickets),
            "resolved_count": sum(t["state"] == "resolved" for t in tickets),
        }

@mcp.tool(annotations=READ_ONLY)
def get_ticket(ticket_id: int) -> dict:
    """Get one ticket (any status) with its linked records and work history.

    Returns the ticket row, its linked inventory/pricing/invoice+vendor/lease
    rows, every approval request, customer message draft, and status update
    recorded for it, plus the shop's current date.
    """
    with _connect() as conn:
        rows = _rows(conn, "SELECT * FROM tickets WHERE id = ?", (ticket_id,))
        if not rows:
            return {"error": f"No ticket with id={ticket_id}."}
        ticket = rows[0]
        if ticket["sku"]:
            ticket["inventory"] = _rows(
                conn, "SELECT * FROM inventory WHERE sku = ? AND size = ?", (ticket["sku"], ticket["size"])
            )
            ticket["pricing"] = _rows(conn, "SELECT * FROM pricing WHERE sku = ?", (ticket["sku"],))
        if ticket["invoice_id"] is not None:
            ticket["invoice"] = _rows(
                conn,
                """SELECT i.*, v.name AS vendor_name, v.specialty AS vendor_specialty,
                          v.lead_days AS vendor_lead_days
                   FROM invoices i JOIN vendors v ON v.id = i.vendor_id WHERE i.id = ?""",
                (ticket["invoice_id"],),
            )
        if ticket["lease_id"] is not None:
            ticket["lease"] = _rows(conn, "SELECT * FROM leases WHERE id = ?", (ticket["lease_id"],))
        for table, key in (
            ("approval_requests", "approval_requests"),
            ("customer_messages", "customer_messages"),
            ("ticket_updates", "updates"),
        ):
            ticket[key] = (
                _rows(conn, f"SELECT * FROM {table} WHERE ticket_id = ? ORDER BY id", (ticket_id,))
                if _table_exists(conn, table)
                else []
            )
        return {"date_today": _today(conn), "ticket": ticket}


@mcp.tool(annotations=READ_ONLY)
def check_margin(sku: str, unit_price: float, qty: int = 1) -> dict:
    """Check the margin on selling `qty` units of `sku` at `unit_price` each.

    Uses unit_cost and list_price from the pricing table. Returns the discount
    off list, profit per unit and in total, margin percent, and
    `below_cost: true` if the price would lose money on every unit.
    """
    if qty <= 0 or unit_price < 0:
        return {"error": "qty must be > 0 and unit_price must be >= 0."}
    with _connect() as conn:
        rows = _rows(conn, "SELECT * FROM pricing WHERE sku = ?", (sku,))
    if not rows:
        return {"error": f"No pricing found for sku={sku!r}."}
    p = rows[0]
    cost, list_price = p["unit_cost"], p["list_price"]
    profit_per_unit = unit_price - cost
    return {
        "sku": sku,
        "qty": qty,
        "unit_price": unit_price,
        "unit_cost": cost,
        "list_price": list_price,
        "discount_off_list_pct": round((list_price - unit_price) / list_price * 100, 2),
        "profit_per_unit": round(profit_per_unit, 2),
        "margin_pct": round(profit_per_unit / unit_price * 100, 2) if unit_price else None,
        "revenue_total": round(unit_price * qty, 2),
        "cost_total": round(cost * qty, 2),
        "profit_total": round(profit_per_unit * qty, 2),
        "list_revenue_total": round(list_price * qty, 2),
        "below_cost": unit_price < cost,
    }


@mcp.tool(annotations=READ_ONLY)
def get_lease(lease_id: int) -> dict:
    """Get one lease with its due-date countdown and the cash available to pay it.

    Returns the lease row, the shop's current date, days until next_due
    (negative means overdue), the cash account balances, and any pending
    approval requests that reference this lease.
    """
    with _connect() as conn:
        rows = _rows(conn, "SELECT * FROM leases WHERE id = ?", (lease_id,))
        if not rows:
            return {"error": f"No lease with id={lease_id}."}
        lease = rows[0]
        today = _today(conn)
        accounts = _rows(conn, "SELECT * FROM cash_accounts ORDER BY name")
        pending = _pending_requests(conn, kind="rent_payment", ref_id=lease_id)
    days = (date.fromisoformat(lease["next_due"]) - date.fromisoformat(today)).days if today else None
    return {
        "date_today": today,
        "lease": lease,
        "days_until_due": days,
        "overdue": days is not None and days < 0,
        "cash_accounts": accounts,
        "total_cash": sum(a["balance"] for a in accounts),
        "pending_rent_requests": pending,
    }


@mcp.tool(annotations=READ_ONLY)
def list_approval_requests(
    status: Literal["pending", "approved", "rejected", "executed"] | None = None,
    ticket_id: int | None = None,
) -> dict:
    """List approval requests waiting for (or already given) a human decision.

    Args:
        status: Optional filter, e.g. "pending".
        ticket_id: Optional filter for one ticket.
    """
    with _connect() as conn:
        if not _table_exists(conn, "approval_requests"):
            return {"requests": [], "pending_payment_total": 0}
        clauses, params = [], []
        if status:
            clauses.append("status = ?"); params.append(status)
        if ticket_id is not None:
            clauses.append("ticket_id = ?"); params.append(ticket_id)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        reqs = _rows(conn, f"SELECT * FROM approval_requests {where} ORDER BY id", tuple(params))
        pending_out = conn.execute(
            """SELECT COALESCE(SUM(amount), 0) FROM approval_requests
               WHERE status = 'pending' AND kind IN ('invoice_payment', 'rent_payment', 'purchase_order')"""
        ).fetchone()[0]
    return {"requests": reqs, "pending_payment_total": pending_out}


@mcp.tool(annotations=WRITES_DB)
def create_approval_request(
    kind: Literal["invoice_payment", "rent_payment", "purchase_order", "price_override"],
    ticket_id: int,
    reason: str,
    requested_by: str,
    ref_id: int | None = None,
    vendor_id: int | None = None,
    sku: str | None = None,
    size: str | None = None,
    qty: int | None = None,
    unit_price: float | None = None,
) -> dict:
    """Queue a request for a HUMAN to approve on the dashboard. Nothing is paid here.

    The amount and payee are always looked up from the database, never taken
    from the caller. Required inputs by kind:
      - invoice_payment: ref_id = invoices.id  (amount = invoice amount, payee = vendor)
      - rent_payment:    ref_id = leases.id    (amount = monthly_rent, payee = landlord)
      - purchase_order:  vendor_id, sku, size, qty  (amount = qty x pricing.unit_cost)
      - price_override:  sku, qty, unit_price  (amount = qty x unit_price; refused if below unit_cost)
    Returns the new request, or the existing one if an identical request is
    already pending. Payments and POs include an order-independent cash_check:
    cash minus every KNOWN bill (unpaid invoices + rent due within 30 days,
    queued or not) minus pending purchase orders. A purchase_order that does
    not fit is REFUSED (rent and invoices come first). Rent and invoice
    payments are never refused; if they don't fit, a warning says to escalate.
    """
    if not reason.strip() or not requested_by.strip():
        return {"error": "reason and requested_by are required."}
    with _connect() as conn:
        _ensure_work_tables(conn)
        if not _rows(conn, "SELECT id FROM tickets WHERE id = ?", (ticket_id,)):
            return {"error": f"No ticket with id={ticket_id}."}

        payee = None
        if kind == "invoice_payment":
            inv = _rows(
                conn,
                "SELECT i.*, v.name AS vendor_name FROM invoices i JOIN vendors v ON v.id = i.vendor_id WHERE i.id = ?",
                (ref_id,),
            )
            if not inv:
                return {"error": f"No invoice with id={ref_id}."}
            if inv[0]["status"] == "paid":
                return {"error": f"Invoice {ref_id} is already paid."}
            amount, payee, vendor_id = inv[0]["amount"], inv[0]["vendor_name"], inv[0]["vendor_id"]
            sku = size = qty = unit_price = None
            dup = _pending_requests(conn, kind=kind, ref_id=ref_id)
        elif kind == "rent_payment":
            lease = _rows(conn, "SELECT * FROM leases WHERE id = ?", (ref_id,))
            if not lease:
                return {"error": f"No lease with id={ref_id}."}
            amount, payee = lease[0]["monthly_rent"], lease[0]["landlord"]
            vendor_id = sku = size = qty = unit_price = None
            dup = _pending_requests(conn, kind=kind, ref_id=ref_id)
        elif kind == "purchase_order":
            if vendor_id is None or not sku or not size or not qty or qty <= 0:
                return {"error": "purchase_order needs vendor_id, sku, size and qty > 0."}
            vendor = _rows(conn, "SELECT * FROM vendors WHERE id = ?", (vendor_id,))
            price = _rows(conn, "SELECT * FROM pricing WHERE sku = ?", (sku,))
            stock = _rows(conn, "SELECT * FROM inventory WHERE sku = ? AND size = ?", (sku, size))
            if not vendor:
                return {"error": f"No vendor with id={vendor_id}."}
            if not price or not stock:
                return {"error": f"No pricing/inventory row for sku={sku!r} size={size!r}."}
            unit_price = price[0]["unit_cost"]
            amount, payee, ref_id = round(qty * unit_price, 2), vendor[0]["name"], None
            dup = _pending_requests(conn, kind=kind, vendor_id=vendor_id, sku=sku, size=size, ticket_id=ticket_id)
        else:  # price_override
            if not sku or not qty or qty <= 0 or unit_price is None:
                return {"error": "price_override needs sku, qty > 0 and unit_price."}
            price = _rows(conn, "SELECT * FROM pricing WHERE sku = ?", (sku,))
            if not price:
                return {"error": f"No pricing for sku={sku!r}."}
            if unit_price < price[0]["unit_cost"]:
                return {
                    "error": f"Refused: ${unit_price} is below unit_cost ${price[0]['unit_cost']} for {sku}.",
                    "unit_cost": price[0]["unit_cost"],
                }
            amount, vendor_id, ref_id = round(qty * unit_price, 2), None, None
            payee = _rows(conn, "SELECT requester FROM tickets WHERE id = ?", (ticket_id,))[0]["requester"]
            dup = _pending_requests(conn, kind=kind, ticket_id=ticket_id, sku=sku)

        if dup:
            return {"status": "already_pending", "request": dup[0]}

        cash_check = None
        if kind != "price_override":
            pos = _cash_position(conn)
            # Invoices and in-window rent are already inside known_bills; new spending is not.
            already_counted = any(
                b["kind"] + "_payment" == kind and b["ref_id"] == ref_id for b in pos["known_bills"]
            )
            new_spend = 0 if already_counted else amount
            left = pos["available_cash"] - new_spend
            cash_check = {
                "total_cash": pos["total_cash"],
                "known_bills": pos["known_bills"],
                "known_bills_total": pos["known_bills_total"],
                "pending_purchase_orders_total": pos["pending_purchase_orders_total"],
                "this_amount": amount,
                "this_amount_already_in_known_bills": already_counted,
                "cash_left_after_everything": left,
                "enough_cash": left >= 0,
                "low_cash_warning": 0 <= left < LOW_CASH_CUSHION,
                "rules": pos["rules"],
            }
            if kind == "purchase_order" and left < 0:
                # Lowest priority: never let new purchases crowd out rent or invoices.
                return {
                    "error": (
                        f"Refused: this ${amount:,.2f} purchase order does not fit. Available cash after every "
                        f"known bill is ${pos['available_cash']:,.2f}, so it would leave ${left:,.2f}. Rent and "
                        "invoices come first. Bring money in first (e.g. a customer deposit or a sale) and retry."
                    ),
                    "cash_check": cash_check,
                }

        cur = conn.execute(
            """INSERT INTO approval_requests
               (ticket_id, kind, ref_id, vendor_id, sku, size, qty, unit_price, amount, payee,
                reason, requested_by, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)""",
            (ticket_id, kind, ref_id, vendor_id, sku, size, qty, unit_price, amount, payee,
             reason.strip(), requested_by.strip(), _now()),
        )
        request = _rows(conn, "SELECT * FROM approval_requests WHERE id = ?", (cur.lastrowid,))[0]

        result = {"status": "pending_human_approval", "request": request}
        if cash_check:
            if not cash_check["enough_cash"]:
                result["warning"] = (
                    "Known bills exceed cash. This payment is still queued (rent and invoices are never "
                    "refused), but the Boss should escalate so a human decides what to pay first."
                )
            result["cash_check"] = cash_check
        return result


@mcp.tool(annotations=WRITES_DB)
def save_customer_message(ticket_id: int, subject: str, body: str, drafted_by: str) -> dict:
    """Save a DRAFT message to the ticket's requester. It is never sent automatically.

    The recipient is always the ticket's requester from the database. A human
    reviews and sends drafts from the dashboard.
    """
    if not subject.strip() or not body.strip() or not drafted_by.strip():
        return {"error": "subject, body and drafted_by are required."}
    with _connect() as conn:
        _ensure_work_tables(conn)
        rows = _rows(conn, "SELECT requester FROM tickets WHERE id = ?", (ticket_id,))
        if not rows:
            return {"error": f"No ticket with id={ticket_id}."}
        cur = conn.execute(
            """INSERT INTO customer_messages (ticket_id, recipient, subject, body, drafted_by, status, created_at)
               VALUES (?, ?, ?, ?, ?, 'draft', ?)""",
            (ticket_id, rows[0]["requester"], subject.strip(), body.strip(), drafted_by.strip(), _now()),
        )
        return {
            "status": "draft_saved",
            "message": _rows(conn, "SELECT * FROM customer_messages WHERE id = ?", (cur.lastrowid,))[0],
        }


@mcp.tool(annotations=WRITES_DB)
def update_ticket(
    ticket_id: int,
    status: Literal["open", "in_progress", "waiting_approval", "resolved", "escalated"],
    note: str,
    updated_by: str,
) -> dict:
    """Change a ticket's status and log why. Every change is kept in ticket_updates.

    A ticket cannot be marked "resolved" while it still has pending approval
    requests; use "waiting_approval" until a human decides.
    """
    if status not in TICKET_STATUSES:
        return {"error": f"status must be one of {TICKET_STATUSES}."}
    if not note.strip() or not updated_by.strip():
        return {"error": "note and updated_by are required."}
    with _connect() as conn:
        _ensure_work_tables(conn)
        rows = _rows(conn, "SELECT * FROM tickets WHERE id = ?", (ticket_id,))
        if not rows:
            return {"error": f"No ticket with id={ticket_id}."}
        pending = _pending_requests(conn, ticket_id=ticket_id)
        if status == "resolved" and pending:
            return {
                "error": f"Ticket {ticket_id} has {len(pending)} pending approval request(s); use waiting_approval.",
                "pending_requests": pending,
            }
        old = rows[0]["status"]
        conn.execute("UPDATE tickets SET status = ? WHERE id = ?", (status, ticket_id))
        conn.execute(
            """INSERT INTO ticket_updates (ticket_id, old_status, new_status, note, updated_by, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (ticket_id, old, status, note.strip(), updated_by.strip(), _now()),
        )
        return {
            "status": "updated",
            "ticket_id": ticket_id,
            "old_status": old,
            "new_status": status,
        }


@mcp.tool(annotations=READ_ONLY)
def get_vendor(vendor_id: int) -> dict:
    """Get one vendor with everything the shop owes or has asked of them.

    Returns the vendor row (name, specialty, lead_days), the shop's current
    date, every invoice from this vendor with days overdue (negative = not
    yet due), the total still unpaid, and any pending purchase orders to this
    vendor. Use before ordering more from a vendor we may already owe.
    """
    with _connect() as conn:
        vendor = _rows(conn, "SELECT * FROM vendors WHERE id = ?", (vendor_id,))
        if not vendor:
            return {"error": f"No vendor with id={vendor_id}."}
        today = _today(conn)
        invoices = _rows(conn, "SELECT * FROM invoices WHERE vendor_id = ? ORDER BY due_date", (vendor_id,))
        pending_pos = _pending_requests(conn, kind="purchase_order", vendor_id=vendor_id)
    for inv in invoices:
        inv["days_overdue"] = (
            (date.fromisoformat(today) - date.fromisoformat(inv["due_date"])).days if today else None
        )
    unpaid = [i for i in invoices if i["status"] != "paid"]
    return {
        "date_today": today,
        "vendor": vendor[0],
        "invoices": invoices,
        "unpaid_total": sum(i["amount"] for i in unpaid),
        "overdue_unpaid": [i for i in unpaid if i["days_overdue"] is not None and i["days_overdue"] > 0],
        "pending_purchase_orders": pending_pos,
    }


def _add_one_month(iso_day: str) -> str:
    d = date.fromisoformat(iso_day)
    year, month = (d.year + 1, 1) if d.month == 12 else (d.year, d.month + 1)
    for day in (d.day, 30, 29, 28):  # clamp e.g. Jan 31 -> Feb 28
        try:
            return date(year, month, day).isoformat()
        except ValueError:
            continue
    raise ValueError(iso_day)


@mcp.tool(annotations=WRITES_DB, tags=HUMAN_ONLY)
def record_human_decision(
    request_id: int,
    decision: Literal["approved", "rejected"],
    decided_by: str,
    note: str = "",
) -> dict:
    """HUMAN ONLY (dashboard): approve or reject a pending approval request.

    Approving applies the change to the shop's books:
      - invoice_payment: adds a payments row (approved_by = decided_by), takes
        the amount out of checking, and marks the invoice paid.
      - rent_payment: adds a payments row, takes the rent out of checking, and
        moves the lease's next_due forward one month.
      - purchase_order: pays the vendor for the order. Adds a payments row
        (kind "purchase_order", ref_id = this approval request's id) and takes
        the amount out of checking. Stock is NOT increased: the goods haven't
        arrived, and the database has no received-goods data.
      - price_override: recorded as approved (a price decision, no cash moves).
    A payment is refused if checking does not hold enough cash.
    """
    if not decided_by.strip():
        return {"error": "decided_by (the human approver's name) is required."}
    with _connect() as conn:
        _ensure_work_tables(conn)
        rows = _rows(conn, "SELECT * FROM approval_requests WHERE id = ?", (request_id,))
        if not rows:
            return {"error": f"No approval request with id={request_id}."}
        req = rows[0]
        if req["status"] != "pending":
            return {"error": f"Request {request_id} is already {req['status']}."}

        today = _today(conn)
        effects: list[str] = []
        if decision == "approved" and req["kind"] in ("invoice_payment", "rent_payment", "purchase_order"):
            acct = _rows(conn, "SELECT * FROM cash_accounts WHERE name = 'checking'")
            if not acct:
                return {"error": "No 'checking' cash account found."}
            if acct[0]["balance"] < req["amount"]:
                return {
                    "error": f"Not enough cash: checking has ${acct[0]['balance']}, payment is ${req['amount']}.",
                }
            kind = {"invoice_payment": "invoice", "rent_payment": "rent", "purchase_order": "purchase_order"}[req["kind"]]
            ref = req["id"] if kind == "purchase_order" else req["ref_id"]
            cur = conn.execute(
                """INSERT INTO payments (kind, ref_id, amount, account, paid_at, approved_by)
                   VALUES (?, ?, ?, 'checking', ?, ?)""",
                (kind, ref, req["amount"], today, decided_by.strip()),
            )
            effects.append(f"payments row #{cur.lastrowid}: {kind} ${req['amount']} to {req['payee']}")
            conn.execute(
                "UPDATE cash_accounts SET balance = balance - ?, date = ? WHERE name = 'checking'",
                (req["amount"], today),
            )
            effects.append(f"checking: ${acct[0]['balance']} -> ${acct[0]['balance'] - req['amount']}")
            if kind == "invoice":
                conn.execute("UPDATE invoices SET status = 'paid' WHERE id = ?", (req["ref_id"],))
                effects.append(f"invoice {req['ref_id']} marked paid")
            elif kind == "purchase_order":
                effects.append(
                    f"purchase order paid: {req['qty']} x {req['sku']} size {req['size']} from {req['payee']} "
                    "(stock unchanged until the goods arrive)"
                )
            else:
                lease = _rows(conn, "SELECT next_due FROM leases WHERE id = ?", (req["ref_id"],))[0]
                nxt = _add_one_month(lease["next_due"])
                conn.execute("UPDATE leases SET next_due = ? WHERE id = ?", (nxt, req["ref_id"]))
                effects.append(f"lease {req['ref_id']} next_due {lease['next_due']} -> {nxt}")
        new_status = "executed" if effects else decision
        conn.execute(
            """UPDATE approval_requests SET status = ?, decided_by = ?, decided_at = ?, decision_note = ?
               WHERE id = ?""",
            (new_status, decided_by.strip(), _now(), note.strip() or None, request_id),
        )
        return {
            "status": new_status,
            "request": _rows(conn, "SELECT * FROM approval_requests WHERE id = ?", (request_id,))[0],
            "effects": effects,
        }


@mcp.tool(annotations=WRITES_DB, tags=HUMAN_ONLY)
def revise_customer_message(message_id: int, body: str, revised_by: str, subject: str = "") -> dict:
    """HUMAN ONLY (dashboard): rewrite a customer message DRAFT before it is sent.

    Only drafts can be revised (a sent message is final). The recipient never
    changes. Returns the previous and the revised text so the change is auditable.
    """
    if not body.strip() or not revised_by.strip():
        return {"error": "body and revised_by are required."}
    with _connect() as conn:
        _ensure_work_tables(conn)
        rows = _rows(conn, "SELECT * FROM customer_messages WHERE id = ?", (message_id,))
        if not rows:
            return {"error": f"No customer message with id={message_id}."}
        before = rows[0]
        if before["status"] != "draft":
            return {"error": f"Message {message_id} is already {before['status']}; only drafts can be revised."}
        conn.execute(
            "UPDATE customer_messages SET subject = ?, body = ? WHERE id = ?",
            (subject.strip() or before["subject"], body.strip(), message_id),
        )
        after = _rows(conn, "SELECT * FROM customer_messages WHERE id = ?", (message_id,))[0]
        return {
            "status": "revised",
            "revised_by": revised_by.strip(),
            "previous": {"subject": before["subject"], "body": before["body"]},
            "message": after,
        }


@mcp.tool(annotations=WRITES_DB, tags=HUMAN_ONLY)
def mark_message_sent(message_id: int, sent_by: str) -> dict:
    """HUMAN ONLY (dashboard): mark a customer message draft as sent by a person."""
    if not sent_by.strip():
        return {"error": "sent_by is required."}
    with _connect() as conn:
        _ensure_work_tables(conn)
        rows = _rows(conn, "SELECT * FROM customer_messages WHERE id = ?", (message_id,))
        if not rows:
            return {"error": f"No customer message with id={message_id}."}
        if rows[0]["status"] != "draft":
            return {"error": f"Message {message_id} is already {rows[0]['status']}."}
        conn.execute(
            "UPDATE customer_messages SET status = 'sent', sent_by = ?, sent_at = ? WHERE id = ?",
            (sent_by.strip(), _now(), message_id),
        )
        return {"status": "sent", "message": _rows(conn, "SELECT * FROM customer_messages WHERE id = ?", (message_id,))[0]}


if __name__ == "__main__":
    mcp.run()

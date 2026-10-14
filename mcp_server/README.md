# Campus Customs MCP Server

A FastMCP server that gives every agent in the Campus Customs multi-agent team the same set of tools for the shop's database. It is the **only** way the agents and backend reach shop data; there is no second tools layer and no direct SQL in the backend. Agents use it to look up open tickets, stock and prices, and the shop's cash and bills. Every value comes straight from the database; if a record isn't there, the tool returns an `error` instead of guessing.

## Database

- **Uses:** `data/campus_customs_new.db` (the working copy)
- **Never touches:** `data/campus_customs.db` (the original, kept for resets)

To reset the working copy, run this from the `HW5/` folder:

```bash
cp data/campus_customs.db data/campus_customs_new.db
```

## Tools (15)

**Read-only (9)**

| Tool | Inputs | What it returns | Tables it reads | Used by |
|---|---|---|---|---|
| `get_open_tickets` | none | Every unresolved ticket with its linked rows, plus the shop's current date | `tickets`, `desk`, `inventory`, `pricing`, `invoices`, `vendors`, `leases` | Boss, Inventory |
| `get_ticket` | `ticket_id` | One ticket with its linked rows, approval requests, message drafts and status history | `tickets`, `desk`, `inventory`, `pricing`, `invoices`, `vendors`, `leases`, `approval_requests`, `customer_messages`, `ticket_updates` | All five agents |
| `check_stock_and_price` | `sku`, optional `size` | Stock for that product, its unit cost and list price, and the vendors list | `inventory`, `pricing`, `vendors` | Inventory, Accounting, Customer Service |
| `get_cash_and_bills` | none | Cash balances, unpaid invoices, leases, payments, totals, and `cash_position.available_cash` (cash − every known bill − pending POs) | `cash_accounts`, `invoices`, `vendors`, `leases`, `payments`, `desk`, `approval_requests` | Accounting, Facilities |
| `check_margin` | `sku`, `unit_price`, `qty` | Discount off list, profit per unit and in total, margin %, `below_cost` flag | `pricing` | Accounting |
| `get_lease` | `lease_id` | Lease row, days until rent is due, cash on hand, pending rent requests | `leases`, `desk`, `cash_accounts`, `approval_requests` | Facilities |
| `list_approval_requests` | optional `status`, `ticket_id` | Approval requests and the total of pending payments | `approval_requests` | Boss, Accounting, Facilities, Customer Service |
| `get_vendor` | `vendor_id` | Vendor row, every invoice from them with days overdue, unpaid total, pending purchase orders | `vendors`, `invoices`, `desk`, `approval_requests` | Inventory, Accounting |
| `list_tickets` | none | Every ticket (any status) with `state` open/resolved, plus counts of pending approvals and drafts | `tickets`, `desk`, `approval_requests`, `customer_messages` | Dashboard (`GET /api/tickets`); not given to agents |

**Agent write (3), working copy only**

| Tool | What it does | Writes | Used by |
|---|---|---|---|
| `create_approval_request` | Queues an invoice payment, rent payment, purchase order or price override for a human. The amount and payee are looked up from the DB, and below-cost prices are refused. Payments and POs include an order-independent `cash_check` (available cash after every known bill, queued or not). **Purchase orders that don't fit are refused**; rent and invoices never are. Nothing is paid here. | `approval_requests` | Accounting only |
| `save_customer_message` | Saves a draft addressed to the ticket's requester. It is never sent automatically. | `customer_messages` | Customer Service only |
| `update_ticket` | Changes a ticket's status and logs why. Refuses `resolved` while approvals are pending. | `tickets` (status), `ticket_updates` | Boss only |

**Human only (3), for the dashboard. These are never given to an agent.**

| Tool | What it does | Writes |
|---|---|---|
| `record_human_decision` | A person approves or rejects a pending request (called by `POST /api/approvals/{id}/approve`). Approving adds a `payments` row (`approved_by` is the person) and takes the amount out of checking: an **invoice payment** marks the invoice paid, **rent** moves the lease's `next_due` forward a month, and a **purchase order** pays the vendor (stock unchanged until the goods arrive). A **price override** is approved with no cash change. It refuses if there isn't enough cash, and refuses to decide the same request twice. | `approval_requests`, `payments`, `cash_accounts`, `invoices`, `leases` |
| `revise_customer_message` | A person rewrites a customer message **draft** before sending (subject and body). Sent messages can't be revised; the recipient never changes. Called by `POST /api/messages/{id}/revise`. | `customer_messages` |
| `mark_message_sent` | A person marks a customer message draft as sent (`sent_by`, `sent_at`). | `customer_messages` |

The write tools create `approval_requests`, `customer_messages` and `ticket_updates` in the working copy the first time they run. Resetting from the original removes them.

## Cash rule (order-independent)

`available cash = cash − every known bill (unpaid invoices + rent due within 30 days, queued or not, counted once) − pending purchase orders`

This makes the money decisions the same no matter which ticket runs first. Priority: rent → overdue invoices → invoices not yet due → new purchase orders.

## Run

From the `HW5/` folder:

```bash
.venv/bin/python mcp_server/server.py
```

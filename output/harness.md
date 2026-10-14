# Campus Customs — Agent Harness

This is the agents' reference guide to the shop. It will keep growing in later problems.

- **Original data (read-only):** `data/campus_customs.db`
- **Working copy (agents update this one):** `data/campus_customs_new.db`
- **Shop "today":** `2026-08-31` (from `desk.date_today`)

---

## Final Harness (current state, Problem 9)

This section is the up-to-date summary of the whole system. The sections after it are the build log, problem by problem. Where they differ, this section is current.

### 1. Database tables (`data/campus_customs_new.db`, working copy; `data/campus_customs.db` stays untouched for resets)
| Table | Origin | Key fields | Why the agents need it |
|---|---|---|---|
| `desk` | original | `date_today` | The shop's "today" (2026-08-31) for due dates and overdue checks |
| `tickets` | original | `id, type, requester, sku/size/qty, lease_id, invoice_id, status` | The work queue; links each ticket to stock, a lease, or an invoice |
| `inventory` | original | `sku, size, qty, location` | Can an order be filled; shortfalls |
| `pricing` | original | `sku, unit_cost, list_price` | Margins and the price floor |
| `vendors` | original | `id, name, specialty, lead_days` | Who restocks, and how fast |
| `invoices` | original | `id, vendor_id, amount, due_date, status` | Bills owed (invoice 501, $840) |
| `leases` | original | `id, landlord, monthly_rent, next_due` | Rent owed (lease 1, $2,400) |
| `cash_accounts` | original | `name, balance, date` | The checking balance, the ceiling on spending |
| `payments` | original | `kind, ref_id, amount, approved_by` | Every payment; `approved_by` is the human |
| `approval_requests` | added by MCP | `kind, amount, payee, reason, status, decided_by` | Payments, POs and price overrides waiting for a human |
| `customer_messages` | added by MCP | `recipient, subject, body, status, sent_by` | Customer reply drafts (a human sends them) |
| `ticket_updates` | added by MCP | `old_status, new_status, note, updated_by` | Status history for every ticket |

### 2. MCP tools (15, in `mcp_server/server.py`; the only route to shop data)
| Group | Tools |
|---|---|
| **Read (9)** | `get_open_tickets`, `get_ticket`, `check_stock_and_price`, `get_cash_and_bills` (includes `cash_position.available_cash`), `check_margin`, `get_lease`, `get_vendor`, `list_approval_requests`, `list_tickets` (dashboard) |
| **Agent write (3)** | `create_approval_request` (Accounting only; amounts and payees come from the DB; POs that don't fit available cash are refused; below-cost prices are refused), `save_customer_message` (Customer Service only; drafts), `update_ticket` (Boss only; no `resolved` while approvals are pending) |
| **Human only (3)** | `record_human_decision` (moves cash), `revise_customer_message` (edit a draft before sending), `mark_message_sent`. Blocked in code for every agent |

### 3. The 5 agents (PydanticAI, `gpt-6-luna` via Portkey, prompts in `backend/prompts/`)
| Agent | Role | MCP tools |
|---|---|---|
| **Boss** | Reads the ticket, routes work, makes the final call, sets status (may **escalate**) | `get_ticket`, `get_open_tickets`, `list_approval_requests`, `update_ticket` |
| **Inventory** | Stock by SKU and size, shortfalls, restock vendor and lead time | `get_ticket`, `get_open_tickets`, `check_stock_and_price`, `get_vendor` |
| **Accounting** | Cash, invoices, margins; queues payments, POs and price overrides for a human | `get_ticket`, `get_cash_and_bills`, `check_margin`, `check_stock_and_price`, `get_vendor`, `list_approval_requests`, `create_approval_request` |
| **Facilities** | Leases, rent, landlord obligations | `get_ticket`, `get_lease`, `get_cash_and_bills`, `list_approval_requests` |
| **Customer Service** | Honest reply drafts to the requester | `get_ticket`, `check_stock_and_price`, `list_approval_requests`, `save_customer_message` |

**Full connectivity:** every agent has `delegate(to_agent, task)` and can reach any of the other four (20 directed links). The real runs used Boss → specialists, **Facilities → Accounting** and **Customer Service → Inventory**.

### 4. API routes (14, `backend/main.py`, http://localhost:8000; start with `../.venv/bin/uvicorn main:app --reload --port 8000` from `backend/`)
| Route | Purpose |
|---|---|
| `GET /api/health` | Model, DB, active run |
| `GET /api/tickets`, `GET /api/tickets/{id}` | All tickets (open or resolved) / one ticket with its history |
| `POST /api/tickets/{id}/run` | Run the team on a ticket (background; one at a time) |
| `GET /api/runs`, `GET /api/runs/{run_id}` | Run status and the Boss's decision |
| `GET /api/events` | Agent events for the board (what each agent said, tools used) |
| `GET /api/approvals`, `POST /api/approvals/{id}/approve`, `POST /api/approvals/{id}/reject` | Human decisions; **approve is the only route that moves cash**; a decision resolves a `waiting_approval` or `escalated` ticket once nothing is pending |
| `POST /api/messages/{id}/revise`, `POST /api/messages/{id}/send` | Human revises a customer draft before sending / marks it sent |
| `GET /api/cash` | Checking balance from `cash_accounts`, plus available cash after known bills |
| `POST /api/reset` | Restore the working DB from the original (audit trail kept) |

### 5. The dashboard (`frontend/`, React + Vite + TypeScript, http://localhost:5173 via `npm run dev`; design reasoning in `output/design.md`)
Masthead and **bank card** (hero checking balance, a meter of cash committed to known bills) · **Work orders** with progress bars and RESOLVED stamps · ticket **stage** with lifecycle stepper, live **"Now:"** ticker and **Case closed** certificate · **The team** org chart with Thinking / Reading / Writing / Handing off / Done states and a hand-offs strip · **Conversation** with tool receipts · **Your desk** (payment slips, message drafts, sign-as) · **Shift report** (Boss's call, 3 headline numbers, clickable to-dos, team notes). Opens on a ticket from a link like `#ticket-102`.

### 6. Safety rules (all enforced in code unless noted)
1. **A human approves all money.** Agents only queue requests; only `record_human_decision` (dashboard, or Claude when Caroline explicitly says so in chat) moves cash, with the approver's name in `payments.approved_by`.
2. **Amounts come from the database**, never the model. **Price floor:** below `unit_cost` is refused. **Cash ceiling:** an order-independent available-cash rule refuses POs that don't fit; rent and invoices are never refused, they escalate instead. Not enough cash in checking → the payment is refused. A request can't be decided twice.
3. **Least privilege:** each agent sees only its own tools; human-only tools are blocked for agents.
4. **No false "done":** `resolved` is refused while approvals are pending; tickets resolve only after the human decides (from `waiting_approval` or `escalated`).
5. **Drafts are never auto-sent;** a person can revise a draft and marks it sent. Sent messages can't be revised.
6. **Only the working copy changes;** reset restores the original byte for byte.
7. **Audit:** every agent-loop step, hand-off, human decision, send, resolve and reset is appended to `output/audit_trail.json` (never wiped).
8. **Token and time limits:** `gpt-6-luna` only; delegation depth ≤ 3; ≤ 8 hand-offs per ticket; ≤ 40 model requests per ticket (shared); **120 s per model request with 2 retries** (added after a 10-minute stall); one ticket at a time.
9. **Prompt rules (model behavior, not code):** never invent data; the shop date is `desk.date_today`; rent → overdue invoices → other invoices → POs; 15% bulk discount for 10+ units; warn when cash < $500; Boss escalates when policy is unclear (as it did on 103).

---

## Database Tables *(original data, as studied in Problem 2)*

### `desk` (1 row)
| Field | Type |
|---|---|
| date_today | TEXT |
| notes | TEXT |

**Why it matters:** Sets the shop's current date, which agents use to tell whether invoices are overdue and rent is coming due.

### `tickets` (3 rows)
| Field | Type |
|---|---|
| id | INTEGER PK |
| type | TEXT (`customer_order`, `rent_notice`, `price_override`) |
| requester | TEXT |
| subject | TEXT |
| sku | TEXT |
| size | TEXT |
| qty | INTEGER |
| lease_id | INTEGER → `leases.id` |
| invoice_id | INTEGER → `invoices.id` |
| status | TEXT |
| notes | TEXT |
| created_at | TEXT (ISO timestamp) |

**Why it matters:** Holds the work the agents have to do; each ticket points to the inventory, lease or invoice it involves.

### `inventory` (10 rows)
| Field | Type |
|---|---|
| sku | TEXT (PK with size) |
| name | TEXT |
| size | TEXT (PK with sku) |
| qty | INTEGER |
| location | TEXT |

**Why it matters:** Lets agents check whether an order can be filled from stock or needs a restock.

### `pricing` (4 rows)
| Field | Type |
|---|---|
| sku | TEXT PK |
| unit_cost | REAL |
| list_price | REAL |

**Why it matters:** Gives agents the margin, so a discount is never set below cost.

### `vendors` (3 rows)
| Field | Type |
|---|---|
| id | INTEGER PK |
| name | TEXT |
| specialty | TEXT |
| lead_days | INTEGER |

**Why it matters:** Tells agents which supplier to use for a restock and how long it will take to arrive.

### `invoices` (1 row)
| Field | Type |
|---|---|
| id | INTEGER PK |
| vendor_id | INTEGER → `vendors.id` |
| amount | REAL |
| due_date | TEXT |
| status | TEXT |
| description | TEXT |

**Why it matters:** Lists the shop's unpaid bills, which agents have to fit into the cash on hand.

### `leases` (1 row)
| Field | Type |
|---|---|
| id | INTEGER PK |
| space_name | TEXT |
| landlord | TEXT |
| monthly_rent | REAL |
| next_due | TEXT |
| notes | TEXT |

**Why it matters:** Gives the shop's rent amount and due date, a large fixed bill that has to be paid on time.

### `cash_accounts` (1 row)
| Field | Type |
|---|---|
| name | TEXT PK |
| balance | REAL |
| date | TEXT |

**Why it matters:** Shows how much money the shop actually has, which is the ceiling on what agents can pay.

### `payments` (0 rows)
| Field | Type |
|---|---|
| id | INTEGER PK |
| kind | TEXT |
| ref_id | INTEGER |
| amount | REAL |
| account | TEXT |
| paid_at | TEXT |
| approved_by | TEXT (NOT NULL) |

**Why it matters:** Records every payment made; `approved_by` cannot be empty, so every payment has to have a named approver.

---

## Open Tickets and How They Link

| Ticket | Type | Requester | Linked records | What the data shows |
|---|---|---|---|---|
| **101** | customer_order | Tauhid Zaman | `inventory` CC-TEE-WHITE / S; `invoices` 501 → `vendors` 1 (Bulldog Print Co); `pricing` CC-TEE-WHITE | Wants 1 tee in size S, but **S stock is 0**. Invoice 501 ($840 rush reprint of this tee in S) was **due 2026-08-28 and is still open, so it's 3 days overdue**. List price is $28. |
| **102** | rent_notice | Elm City Properties | `leases` 1 (Chapel Street shop); `cash_accounts` checking | **Rent of $2,400 is due 2026-09-02**, 2 days away. |
| **103** | price_override | Yale AI Club | `inventory` CC-HOOD-NAVY / M; `pricing` CC-HOOD-NAVY; `vendors` 1 (Bulldog Print Co, 5-day lead) | Wants **20** hoodies in size M at a bulk discount, but **only 8 size M are in stock**. Unit cost is $22 and list price is $58 (20 × $58 = $1,160 at list). |

### Things the agents need to watch across tickets
- **Cash is tight:** checking has $3,400. Invoice 501 ($840) plus rent ($2,400) comes to $3,240, which leaves only **$160**, so payments have to be ordered with care.
- **Tickets 101 and 103 both rely on Bulldog Print Co,** which takes 5 days to deliver. The reprint for ticket 101 may already be in progress but is unpaid.
- **Every payment needs a human approver** because `payments.approved_by` is required. This is where the dashboard's approval step comes in.
- **Discounts must stay above `unit_cost`** ($22 per hoodie).
- **`tickets.sku` has no foreign key to `inventory`,** so agents have to look up the sku and size pair themselves.

---

## MCP Server Tools (`mcp_server/server.py`)

*(Snapshot from Problem 3, when the server had 3 tools. For the current list of all tools, see "Agents, MCP Tools and Tables (current)" below.)*

FastMCP server named **"Campus Customs"**. Every agent uses these tools. They use only the working copy `data/campus_customs_new.db`; the original `data/campus_customs.db` is never opened. These first three are read-only. If a record isn't in the database, the tool returns an `error` key and never makes up a value.

### 1. `get_open_tickets()`
- **Tables it reads:** `tickets` (`status = 'open'`), `desk` (`date_today`), and the rows each ticket links to: `inventory` and `pricing` (by `sku` + `size`), `invoices` joined to `vendors` (by `invoice_id` → `vendor_id`), and `leases` (by `lease_id`).
- **Ticket it unlocks:** **101** (Tauhid Zaman, 1 × CC-TEE-WHITE size S)
- **Why it's the right tool for 101:** Ticket 101 is the only ticket that chains through two foreign keys (`tickets.invoice_id = 501` → `invoices.vendor_id = 1` → Bulldog Print Co), and this tool follows that chain in one call, so the agent sees in one place that size S stock is 0, invoice 501 ($840 rush reprint of this exact tee) has been overdue since 2026-08-28, and the reprint takes 5 days.
- *Also used for:* the starting list of work for every agent (102 and 103 come back in the same call).

### 2. `check_stock_and_price(sku, size)`
- **Tables it reads:** `inventory` (qty and location for the `sku` + `size`), `pricing` (`unit_cost`, `list_price`), `vendors` (`name`, `specialty`, `lead_days`).
- **Ticket it unlocks:** **103** (Yale AI Club, 20 × CC-HOOD-NAVY size M at a bulk discount)
- **Why it's the right tool for 103:** A `price_override` can only be answered with stock, cost and supplier side by side, and `check_stock_and_price("CC-HOOD-NAVY", "M")` returns that only 8 of the 20 are in stock, that any discount has to stay above the $22 `unit_cost` (list price is $58), and that Bulldog Print Co (apparel reprint, 5-day lead) is the vendor for the 12 missing hoodies.
- *Also used for:* rechecking CC-TEE-WHITE size S (still 0) for ticket 101 before promising a delivery date.

### 3. `get_cash_and_bills()`
- **Tables it reads:** `cash_accounts` (`balance`), `leases` (`monthly_rent`, `next_due`), `invoices` that aren't paid, joined to `vendors`, `payments` (what's already been paid and who approved it), and `desk` (`date_today`).
- **Ticket it unlocks:** **102** (Elm City Properties, rent notice for lease 1)
- **Why it's the right tool for 102:** Paying the rent is a cash decision, and this tool puts lease 1's $2,400 rent (due 2026-09-02) next to the $3,400 checking balance and the open $840 invoice, showing that paying both leaves only $160, which is the number the agent and the human approver need before writing a `payments` row.
- *Also used for:* deciding whether invoice 501 for ticket 101 can be paid now, and whether a hoodie restock for 103 can be afforded at all.

### Quick map
| Tool | Main ticket | Key fact it gives |
|---|---|---|
| `get_open_tickets` | 101 | Size S stock is 0, and the linked invoice 501 to Bulldog Print Co is overdue |
| `check_stock_and_price` | 103 | 8 of 20 in stock, $22 cost floor, 5-day restock |
| `get_cash_and_bills` | 102 | $3,400 cash − $2,400 rent − $840 invoice = $160 |

---

## MCP Connection and Tool Tests (Problem 4)

- **Connection:** `.mcp.json` at the HW5 root registers the stdio server **`campus-customs`** (`.venv/bin/python mcp_server/server.py`). Claude Code loaded it when the session moved into `HW5/`, and the tools appear as `mcp__campus-customs__<tool>`.
- **Test results (called by the vibe coder as native MCP tools, shop date 2026-08-31):**

| Call | Result | Matches DB? |
|---|---|---|
| `get_open_tickets()` | 3 open tickets (101, 102, 103) with linked rows: 101 → tee S stock 0 + invoice 501 ($840, due 2026-08-28, Bulldog Print Co, 5-day lead); 102 → lease 1 ($2,400 due 2026-09-02); 103 → hoodie M stock 8, $22 cost / $58 list | Yes |
| `check_stock_and_price("CC-HOOD-NAVY", "M")` | qty 8 (Aisle A), unit_cost $22, list $58, 3 vendors | Yes |
| `check_stock_and_price("CC-TEE-WHITE", "S")` | qty 0 (Aisle B), unit_cost $8, list $28 | Yes |
| `check_stock_and_price("NOT-A-SKU")` | `error`: no inventory or pricing found, so nothing was invented | Yes |
| `get_cash_and_bills()` | Cash $3,400; open invoices $840; rent $2,400; $160 left after both; payments: none | Yes |

- Both database files were unchanged after testing (the tools are read-only).

- **Saved evidence:** `output/mcp_smoke.json` stores each tool's prompt, tool name, arguments and exact output, plus a SQL check of every value against `data/campus_customs_new.db` (23 checks, all match).

---

## Agent Team (Problem 5)

Built with **PydanticAI**. Every agent uses **`gpt-6-luna` only**, through Portkey (`PORTKEY_API_KEY` from the root `.env`). The model name is hard-coded once in `backend/config.py` (`MODEL_NAME`) with no fallback and no environment override.

### Files
| Path | What it is |
|---|---|
| `backend/config.py` | Model (`gpt-6-luna`), Portkey client, MCP server path, audit trail path, and token guard rails (no DB paths: shop data is reached only through MCP) |
| `backend/models.py` | Data types: `AgentName`, `AgentReport`, `BossDecision`, `Fact`, `Delegation`, `TeamEvent`, `TicketRunResult` |
| `backend/prompts/<agent>.md` | One detailed prompt per agent (boss, inventory, accounting, facilities, customer_service) |
| `backend/agents/<agent>.py` | One file per agent: its MCP tool access list, built by `agents/base.py` |
| `backend/delegation.py` | The shared `delegate` tool (full mesh) and its guard rails |
| `backend/mcp_tools.py` | Loads the FastMCP server in-process and gives each agent a filtered view |
| `backend/team.py` | Agent loop (traced node by node), `run_ticket()`, and the team loop `run_open_tickets()` |
| `backend/audit.py` | Appends every event and agent-loop step to `output/audit_trail.json` (never wipes it) |

### The five roles and their MCP tools
| Agent | Role | MCP tools | Writes to DB |
|---|---|---|---|
| **Boss** | Reads each ticket, decides who works on it, makes the final call, sets ticket status | `get_ticket`, `get_open_tickets`, `list_approval_requests`, `update_ticket` | Ticket status only |
| **Inventory** | Stock by SKU and size, shortfalls, restock vendor and lead time | `get_ticket`, `get_open_tickets`, `check_stock_and_price`, `get_vendor` | No |
| **Accounting** | Cash, invoices, margins; prepares payments, POs and price overrides for human approval | `get_ticket`, `get_cash_and_bills`, `check_margin`, `check_stock_and_price`, `get_vendor`, `list_approval_requests`, `create_approval_request` | Approval requests only |
| **Facilities** | Leases, rent amounts and due dates, landlord obligations | `get_ticket`, `get_lease`, `get_cash_and_bills`, `list_approval_requests` | No (asks Accounting to queue rent) |
| **Customer Service** | Drafts honest messages to the ticket requester | `get_ticket`, `check_stock_and_price`, `list_approval_requests`, `save_customer_message` | Message drafts only |

### Full connectivity (delegation)
- Every agent has the same `delegate(to_agent, task)` tool and can reach **any** of the other four, so all 20 directed connections exist (including specialist → specialist and specialist → Boss).
- A delegation starts a fresh run of the target agent with its own prompt, tools and agent loop, and returns its `AgentReport` to the caller.
- **Guard rails** (multi-agent chats burn tokens fast): no self-delegation; at most 3 levels deep; at most 8 hand-offs per ticket; one shared limit of 40 model requests per ticket across the whole team.

### Agent loop and team loop
- **Agent loop:** PydanticAI runs model → tool calls → tool results → model ... → structured output. `team.run_agent()` steps through it with `agent.iter()` and records an `agent_step` event for every step (for the dashboard later).
- **Team loop:** `run_ticket(id)` hands one ticket to the Boss, and the Boss delegates as needed. `run_open_tickets()` works every unresolved ticket in order.

### Shop rules built into the prompts
- Never invent data; every number cites a tool. The shop's "today" is `desk.date_today`.
- No money moves without a human: only Accounting can queue approval requests, and nothing is ever marked paid by an agent.
- Cash is a hard ceiling. Payment priority: rent → overdue invoices → invoices not yet due → new purchase orders. Flag when cash after approvals would drop below $500.
- Price floor is `unit_cost` (also enforced by the server). Standard bulk discount is up to 15% off list for 10+ units; anything deeper needs human approval and at least a 40% margin.
- Stock honesty: never promise more than `inventory.qty`; label restock arrival as an estimate (`date_today` + `lead_days`).
- Customer messages are drafts only; no discounts or dates promised before approval; nothing about internal cash or invoices.
- Only the Boss sets ticket status; a ticket with pending approvals is `waiting_approval`, never `resolved`.

### Verification (Problem 5)
- **Offline wiring test** (no API calls, scripted model, run against a scratch DB copy): Boss → Inventory → Accounting → Facilities delegation chain worked; the 4th-level hand-off and a self-delegation were refused; each agent saw only its own tools; the server refused a $5 price below the $8 tee cost and refused `resolved` while a payment was pending.
- **Live check:** one request through Portkey to `gpt-6-luna` returned "OK" (35 tokens). Portkey reports the serving deployment as `gpt-6-luna-global`.
- **Model scan:** `gpt-6-luna` is the only model name anywhere in HW5.

---

## More MCP Tools and the Audit Trail (Problem 5, part 2)

### MCP is the only route to shop data
- Every shop fact the agents use comes from the `campus-customs` MCP server over `data/campus_customs_new.db`. The backend has **no direct SQL and no second shop-tools layer**: `backend/mcp_tools.py` loads the FastMCP server and hands each agent a filtered set of its tools.
- At this point the MCP server had **13 tools**: 8 read, 3 agent write, 2 human-only. (Problem 7 added `list_tickets` for the dashboard: 14.)

### Tools added for the open tickets
| Tool | Who | Why the open tickets need it |
|---|---|---|
| `get_vendor(vendor_id)` | Inventory, Accounting | Before restocking 12 hoodies for **103** from Bulldog Print Co, the team must see that we already owe Bulldog the overdue $840 invoice 501 (**101**), so it can be paid first or the risk flagged. |
| `record_human_decision(request_id, decision, decided_by)` | **Human only** (dashboard) | Without it, an approved payment could never be recorded, so **101** (invoice 501) and **102** (rent) could never close. Approving writes the `payments` row (`approved_by` is the person), lowers checking, and marks the invoice paid or moves the lease's due date forward a month. |
| `mark_message_sent(message_id, sent_by)` | **Human only** (dashboard) | Customer Service drafts replies for **101** and **103**; a person sends them and this records it. |

Human-only tools are blocked in code: `toolset_for()` raises an error if any agent is given one.

### `output/audit_trail.json` (append-only)
- **When:** `SharedRun.emit()` writes every team event as it happens. That covers ticket start and finish, agent start and finish, **every agent-loop step**, and every delegation (started, done, refused).
- **Never wiped:** each write reads the existing array, appends one entry, and atomically replaces the file. Unreadable files are renamed aside, never deleted. `audit_id` keeps counting up across runs.
- **Each entry has:** `audit_id`, `logged_at` (UTC), `run_id`, `ticket_id`, `seq`, `t_ms`, `event`, `agent`, `model` (`gpt-6-luna`), `depth`, `chain` (who delegated to whom to get here), and per-step details:
  - `task_received`: the full task the agent was given.
  - `model_response`: `response_model`, text, `tool_calls` (tool, `tool_call_id`, args), input and output tokens, `finish_reason`.
  - `tool_results`: each tool's result linked to its `tool_call_id` (up to 4,000 chars), plus any retries.
  - `delegation_*`: from/to agent, task, depth, status, and the returned report.
  - `agent_finished` / `ticket_finished`: the structured output, usage, and the delegation list.

### Verification (offline, no API calls, scratch DB + scratch audit file)
- Two scripted team runs: the audit grew from 1 entry to 59 to 117; the pre-existing entry survived; 2 distinct `run_id`s; `audit_id` strictly increasing; only `gpt-6-luna` recorded.
- Giving an agent `record_human_decision` raised an error.
- Approving the invoice request: `payments` row approved by the human, checking $3,400 → $2,560, invoice 501 paid; approving it again was refused.
- Real `campus_customs.db` and `campus_customs_new.db` were unchanged.

---

## Agents, MCP Tools and Tables (current)

All 15 tools live in the `campus-customs` MCP server (`mcp_server/server.py`) and work on `data/campus_customs_new.db` only.

### Agents and the tools each one can call
| Agent | Role | MCP tools it can call | `delegate` |
|---|---|---|---|
| **Boss** | Reads each ticket, routes work, makes the final call, sets ticket status | `get_ticket`, `get_open_tickets`, `list_approval_requests`, `update_ticket` | Yes, to anyone |
| **Inventory** | Stock by SKU and size, shortfalls, restock vendor and lead time | `get_ticket`, `get_open_tickets`, `check_stock_and_price`, `get_vendor` | Yes, to anyone |
| **Accounting** | Cash, invoices, margins; queues payments, POs and price overrides for a human | `get_ticket`, `get_cash_and_bills`, `check_margin`, `check_stock_and_price`, `get_vendor`, `list_approval_requests`, `create_approval_request` | Yes, to anyone |
| **Facilities** | Leases, rent, due dates, landlord obligations | `get_ticket`, `get_lease`, `get_cash_and_bills`, `list_approval_requests` | Yes, to anyone |
| **Customer Service** | Drafts honest replies to the ticket requester | `get_ticket`, `check_stock_and_price`, `list_approval_requests`, `save_customer_message` | Yes, to anyone |
| **Human (dashboard)** | Approves money, revises and sends messages | `record_human_decision`, `revise_customer_message`, `mark_message_sent` (blocked for every agent), plus `list_tickets` for the board | n/a |

`delegate` is a backend tool (in `backend/delegation.py`), not an MCP tool. It only starts another agent; it never touches shop data.

### Every MCP tool and the tables it uses
| # | Tool | Type | Reads | Writes | Used by | Added in |
|---|---|---|---|---|---|---|
| 1 | `get_open_tickets` | Read | `tickets`, `desk`, `inventory`, `pricing`, `invoices`, `vendors`, `leases` | none | Boss, Inventory | Problem 3 |
| 2 | `check_stock_and_price` | Read | `inventory`, `pricing`, `vendors` | none | Inventory, Accounting, Customer Service | Problem 3 |
| 3 | `get_cash_and_bills` | Read | `cash_accounts`, `invoices`, `vendors`, `leases`, `payments`, `desk`, `approval_requests` (for `cash_position`) | none | Accounting, Facilities | Problem 3 |
| 4 | `get_ticket` | Read | `tickets`, `desk`, `inventory`, `pricing`, `invoices`, `vendors`, `leases`, `approval_requests`, `customer_messages`, `ticket_updates` | none | All five agents | Problem 5 |
| 5 | `check_margin` | Read | `pricing` | none | Accounting | Problem 5 |
| 6 | `get_lease` | Read | `leases`, `desk`, `cash_accounts`, `approval_requests` | none | Facilities | Problem 5 |
| 7 | `list_approval_requests` | Read | `approval_requests` | none | Boss, Accounting, Facilities, Customer Service | Problem 5 |
| 8 | `get_vendor` | Read | `vendors`, `invoices`, `desk`, `approval_requests` | none | Inventory, Accounting | Problem 5 (follow-up) |
| 9 | `create_approval_request` | Agent write | `tickets`, `invoices`, `vendors`, `leases`, `pricing`, `inventory`, `cash_accounts`, `approval_requests`, `desk` | `approval_requests` | Accounting only | Problem 5 |
| 10 | `save_customer_message` | Agent write | `tickets` | `customer_messages` | Customer Service only | Problem 5 |
| 11 | `update_ticket` | Agent write | `tickets`, `approval_requests` | `tickets` (status), `ticket_updates` | Boss only | Problem 5 |
| 12 | `record_human_decision` | **Human only** | `approval_requests`, `cash_accounts`, `leases`, `desk` | `approval_requests`, `payments`, `cash_accounts`, `invoices`, `leases` | Dashboard (`POST /api/approvals/{id}/approve`) | Problem 5 (follow-up); POs pay the vendor since Problem 7 |
| 13 | `mark_message_sent` | **Human only** | `customer_messages` | `customer_messages` | Dashboard (person) | Problem 5 (follow-up) |
| 14 | `list_tickets` | Read (dashboard) | `tickets`, `desk`, `approval_requests`, `customer_messages` | none | Dashboard (`GET /api/tickets`); not given to agents | Problem 7 |
| 15 | `revise_customer_message` | **Human only** | `customer_messages` | `customer_messages` (subject and body of a **draft**) | Dashboard (`POST /api/messages/{id}/revise`) | After Problem 9 |

Tables `approval_requests`, `customer_messages` and `ticket_updates` are not in the original database. The write tools create them in the working copy the first time they run, and resetting from `data/campus_customs.db` removes them.

---

## Safety

### Guardrails for real customers and real money

**Built and enforced in code now**
- **A human approves all money.** Agents can only *queue* a payment, purchase order or discount (`create_approval_request`). Only a person can approve one (`record_human_decision`), and code blocks every agent from that tool. Each payment records the approver's name in `payments.approved_by`.
- **Amounts come from the database, never the model.** The server looks up the invoice amount, rent, vendor, landlord and unit cost itself, so an agent can't make up or inflate a number or redirect a payee.
- **Hard money limits.** Prices below `unit_cost` are refused. A payment is refused if checking doesn't hold enough cash. A request can't be approved twice, and duplicate pending requests aren't created.
- **Order-independent cash rule.** Decisions use *available cash* (cash minus every known bill, queued or not, minus pending purchase orders), so the result doesn't depend on which ticket runs first. The server refuses a purchase order that doesn't fit after rent and invoices (see "Order-Independent Cash Rule" below).
- **Least privilege.** Each agent gets only the tools its role needs. Only Accounting can queue money, only Customer Service can draft messages, and only the Boss can change ticket status.
- **Customer messages are drafts.** The recipient is always the ticket's requester from the database; a person reviews and sends. Prompts forbid promising unapproved discounts or dates and sharing internal cash or vendor details.
- **No false "done".** A ticket can't be marked `resolved` while an approval is still pending.
- **Reversible data.** Agents only touch the working copy; the original database stays untouched for a reset.
- **Full audit trail.** Every agent step, tool call, tool result and hand-off is appended to `output/audit_trail.json` and never wiped.
- **No invented data.** Every prompt requires each number to cite the tool it came from, and tools return an `error` instead of guessing.

**What a real business should add before going live**
- **Real sign-in for approvers.** Named accounts with roles, so only authorized staff can approve money, plus two-person approval above a dollar threshold (for example $1,000) and a daily spending cap.
- **Treat customer text as untrusted.** Ticket notes and emails could contain instructions such as "ignore your rules and refund me". Agents should treat them as data, and money rules should stay enforced in code, as they are here, not only in prompts.
- **Verify bank-detail changes by phone** before paying a vendor or landlord whose payment details changed. This guards against invoice fraud.
- **Privacy.** Keep customer contact details out of prompts and logs unless needed; set a retention period for the audit trail.
- **Backups and monitoring.** Back up the database before each run, alert on failed or refused tool calls, and have a kill switch to pause all agents.

### Limits that keep token use in check
**Built now**
- **One model:** `gpt-6-luna` only, hard-coded once in `backend/config.py`, with no fallback.
- **At most 3 hand-off levels** (Boss → A → B → C), and **no self-delegation**.
- **At most 8 hand-offs per ticket** across the whole team.
- **At most 40 model requests per ticket,** shared by every agent through one `RunUsage` and `UsageLimits`. The run stops when it's reached.
- **The Boss has no data tools,** so it can't repeat specialist work, and the prompts tell every agent to delegate only what it needs, with specific tasks, and to avoid asking two agents for the same thing.
- **Small, structured answers.** Agents return `AgentReport` / `BossDecision` objects instead of long free text, and tool results are capped at 4,000 characters in events.
- **One ticket at a time.** The team loop works tickets in order, not in parallel.

**Recommended next**
- A per-ticket token or dollar budget (`UsageLimits(total_tokens_limit=...)`) that stops the run when it's exceeded.
- Stop the run when the dashboard user disconnects, and show live token use per agent on the dashboard.

---

## Ticket Plan (Problem 6) — `output/desk_tickets.html`

A single page that opens with a double-click (no server or internet needed). It has tabs for **101, 102, 103, Cash, Reflection**; Cash and Reflection are blank for later problems. Each ticket tab has a filled **EXPECTED** section and an empty **ACTUAL** section with the same headings, to fill in from `output/audit_trail.json` after the agents run.

| Ticket | Boss calls first | Expected delegations | Not called | Expected end state |
|---|---|---|---|---|
| **101** tee S | **Inventory**: whether a size S tee can be handed over decides everything else; S is 0, and the reprint is invoice 501 | Boss→Inventory, Boss→Accounting (queue $840 invoice), Boss→Customer Service (draft to Tauhid) = **3** | Facilities | 1 invoice_payment ($840), 1 draft, `waiting_approval` |
| **102** rent | **Facilities**: a landlord notice about the space; check it against lease 1 before any money is queued | Boss→Facilities, **Facilities→Accounting** (specialist→specialist, queue $2,400 rent) = **2** | Inventory, Customer Service | 1 rent_payment ($2,400), $160 left (low-cash flag), `waiting_approval` |
| **103** hoodies | **Inventory**: a discount can't be priced before knowing deliverable units (8 of 20) | Boss→Inventory, Boss→Accounting (15% off → $49.30, 55.38% margin; price_override for 8), Boss→Customer Service (draft, "under review") = **3** | Facilities | 1 price_override (8 × $49.30 = $394.40), **no PO** ($264 restock > $160 available; the server refuses it if tried), 1 draft, `waiting_approval` |

Total expected: **8 delegations** across the 3 tickets (out of a possible 12 if every specialist were sent on every ticket), with Facilities used only on 102 and Customer Service skipped on 102. All plan numbers were checked with the MCP tools before writing (`check_margin`, `check_stock_and_price`, `get_lease`, `get_vendor`).

---

## Order-Independent Cash Rule (Problem 6 follow-up)

**Question we asked:** do the tickets have to run 101 → 102 → 103? **No.** Each ticket runs on its own (`run_ticket(id)`), and only `run_open_tickets()` uses id order. But testing every order exposed a real-world flaw in how cash was checked.

**The flaw (first version):** `create_approval_request`'s cash check, and the Accounting rule, used `cash − payments already queued`. Bills the shop already knew about but hadn't queued yet (invoice 501 for $840, rent of $2,400 due in 2 days) were ignored. So the $264 hoodie restock for 103 looked affordable whenever 103 ran before those were queued.

| Run order | Before the fix | After the fix |
|---|---|---|
| 101 → 102 → 103 | PO skipped, $160 left | PO refused, **$160** available |
| 102 → 101 → 103 | PO skipped, $160 left | PO refused, **$160** available |
| 101 → 103 → 102 | PO queued, **−$104 (rent not covered)** | PO refused, **$160** available |
| 102 → 103 → 101 | PO queued, **−$104** | PO refused, **$160** available |
| 103 → 101 → 102 | PO queued, **−$104 (rent not covered)** | PO refused, **$160** available |
| 103 → 102 → 101 | PO queued, **−$104** | PO refused, **$160** available |

**How we structured the fix (real-life accounting):**
1. **Available cash, not bank balance.** The new `_cash_position()` in `mcp_server/server.py` computes: cash − every known bill (unpaid invoices + rent due within 30 days, queued or not, each counted once) − pending purchase orders. `get_cash_and_bills` returns it as `cash_position.available_cash`, and every payment or PO request returns it in `cash_check`. Both use the same function, so they can't disagree.
2. **Priority:** rent → overdue invoices → invoices not yet due → new purchase orders.
3. **Enforced in code:** the server **refuses a purchase order** that doesn't fit in available cash. Rent and invoices are **never refused**; if they don't fit, the request carries a warning and the Boss escalates to a human.
4. **Restocks are unlocked by money coming in** (selling the units on hand, or a customer deposit), not by spending cash the shop has already committed.
5. **Low-cash warning** when available cash would be under $500.
6. **Prompts updated** to match: Accounting (money rules 3, 5, 6), Boss (shop rule 4), Facilities (hand-off wording).

**Side fix:** `get_cash_and_bills.total_rent_due` used to count every lease's rent even after it was paid. Now rent only counts while it's due within 30 days; once paid, `next_due` moves a month out and it drops off.

**Verification (offline, scratch DB, no API calls):** all 6 orders → $160 available, the PO refused by the server even when an agent tries to queue it, and the low-cash warning on. A 7-hoodie PO ($154) still fits and is queued; the next one is refused. Approving the invoice and rent doesn't change available cash (it was already committed), and after rent is paid it is no longer counted. The full offline team suite still passes.

---

## Backend Routes (Problem 7) — `backend/main.py`

FastAPI app for the React dashboard. **Every shop read or write goes through the campus-customs MCP tools** (the same server the agents use, called in-process). `main.py` contains no SQL. The only file operation is `/api/reset`, which copies the original database file over the working copy.

Run from `backend/` (no auto-reload, so one edit can't start extra servers):
```bash
../.venv/bin/uvicorn main:app --reload --port 8000
```
Serves **http://localhost:8000**, the address the frontend dashboard calls, **with `--reload`** to match the course code. One reloader process watches only `.py` files in `backend/`, so database writes and `output/audit_trail.json` never restart it. Two cautions: saving a `.py` file during an agent run restarts the server and cuts that run off, and prompt (`.md`) edits need a manual restart. The old hw4 backend that was holding port 8000 was stopped first, with your OK. CORS allows the Vite dev server on port 5173. Interactive docs are at `/docs`.

### Every route, one line each (base URL `http://localhost:8000`)

- `GET  http://localhost:8000/api/health`: shows the server is up, the model (`gpt-6-luna`), the working DB, and any active run.
- `GET  http://localhost:8000/api/tickets`: returns all 3 tickets with their status and whether each is open or resolved.
- `GET  http://localhost:8000/api/tickets/{ticket_id}`: returns one ticket with its linked rows, approval requests, drafts and status history.
- `POST http://localhost:8000/api/tickets/{ticket_id}/run`: starts the agent team on that ticket in the background and returns a `run_id` (one ticket at a time).
- `GET  http://localhost:8000/api/runs`: lists runs since the server started, newest first, plus the active run.
- `GET  http://localhost:8000/api/runs/{run_id}`: shows one run's status, the Boss's final decision, delegations and token usage.
- `GET  http://localhost:8000/api/events?since=&run_id=&ticket_id=&limit=`: returns recent agent events (who spoke, what they said, which tools they used) for the board to refresh.
- `GET  http://localhost:8000/api/approvals?status=&ticket_id=`: lists approval requests (e.g. `?status=pending`) waiting on a human.
- `POST http://localhost:8000/api/approvals/{request_id}/approve`: a human approves a request (`{"decided_by": "...", "note": "..."}`); this is the only route that moves cash.
- `POST http://localhost:8000/api/approvals/{request_id}/reject`: a human rejects a request, and no cash moves.
- `POST http://localhost:8000/api/messages/{message_id}/revise`: a human rewrites a customer message draft before sending (`{"revised_by", "subject", "body"}`), via MCP `revise_customer_message`. *(Added after Problem 9.)*
- `POST http://localhost:8000/api/messages/{message_id}/send`: a human marks a customer message draft as sent (`{"sent_by": "..."}`), via MCP `mark_message_sent`. *(Added in Problem 8.)*
- `GET  http://localhost:8000/api/cash`: returns the current checking balance from `cash_accounts`, plus available cash after known bills.
- `POST http://localhost:8000/api/reset`: restores `data/campus_customs_new.db` from the original `data/campus_customs.db` for a fresh run (the audit trail is kept).

### Routes by requirement (details)

| Need | Route | MCP tool(s) behind it | Notes |
|---|---|---|---|
| Return the 3 tickets, open or resolved | `GET /api/tickets` | `list_tickets` (new) | Each ticket has its raw `status` and `state`: `"resolved"` only when status is resolved, otherwise `"open"`. Also counts pending approvals and drafts. `GET /api/tickets/{id}` gives full history (`get_ticket`). |
| Run the agent team on a ticket | `POST /api/tickets/{id}/run` | Agents use their own MCP tools | Returns **202** with a `run_id` right away; the run continues in the background. **One ticket at a time** (409 if busy), because tickets share cash and parallel runs burn tokens. `GET /api/runs/{run_id}` shows status, the Boss's decision, usage and delegations. |
| Recent agent events, for refreshing the board | `GET /api/events?since=&run_id=&ticket_id=&limit=` | none (reads `output/audit_trail.json`) | Each event has `agent`, **`said`** (the agent's text or final summary), **`tools_used`** (and `tool_calls` with arguments), `tool_results`, delegation from/to, and tokens. Poll with `since=<last_id>` to get only new events. Events survive server restarts because they come from the audit file. |
| Human approves a payment or purchase | `POST /api/approvals/{id}/approve` `{decided_by, note}` | `record_human_decision` (human-only) | **The only place cash moves.** Invoice payment: pays the vendor and marks the invoice paid. Rent: pays the landlord and moves `next_due` forward a month. **Purchase order: pays the vendor** (`payments.kind = "purchase_order"`); stock is unchanged until the goods arrive. Price override: approved, no cash change. Needs a name; refuses double approval or not enough cash. Also `POST …/reject` and `GET /api/approvals?status=pending`. Each decision is appended to the audit trail as `human_decision`. |
| Current checking balance | `GET /api/cash` | `get_cash_and_bills` | `checking_balance` from `cash_accounts`, plus `available_cash` (after known bills), the known-bills list, and payments. |
| Reset to the original data | `POST /api/reset` | none (file copy) | Atomically copies `data/campus_customs.db` over `data/campus_customs_new.db`. Refused while a run is active. The audit trail is **kept**; a `database_reset` entry is appended. |

**Change made for this problem:** approving a **purchase order** used to record approval only. Since the spec says this route is what actually changes cash for payments *and* purchases, approving a PO now pays the vendor out of checking. The order-independent cash rule still applies: a PO can only be queued if it fits in available cash.

**Verification**
- **Offline end-to-end** (scratch DB copies + scratch audit file, scripted model, no API calls): all 12 routes returned the expected codes. Ticket list was 3 × open. A run returned 202, then finished `done`. A second run and a reset while busy were refused with 409. Events showed each agent's words and tools (Boss → `get_ticket`, `delegate`, `update_ticket`; Accounting → `create_approval_request`). `since=last_id` returned 0 new events. Approve with no name → 422; approve → checking $3,400 → $2,560 and invoice 501 paid; approve again → 409; unknown id → 404. Reset restored checking to $3,400, and the audit kept all 24 entries (including `human_decision` and `database_reset`).
- **PO approval:** a 5-hoodie PO ($110) approved → checking $3,400 → $3,290, payment recorded, stock still 8.
- **Real server**: first checked on port 8005 and stopped; then, after stopping the hw4 server, started at **http://localhost:8000**; first without reload, then (per follow-up) restarted with **`--reload`** (one reloader + one server process). `/api/health`, `/api/tickets` (101/102/103 all open), `/api/cash` ($3,400 checking, $160 available) and `/docs` all return 200.

---

## Agent Dashboard (Problem 8) — `frontend/`

*(First version. The follow-ups below redesigned it: "Your desk" replaced the approval panel, agents gained Thinking/Reading/Writing states, and the shift report was layered. The current state is summarized in `output/design.md` and `frontend/README.md`.)*

React + Vite + TypeScript, styled in Yale navy, light blues and white. It calls only the Problem 7 routes; Vite proxies `/api` to **http://localhost:8000**. Run it with `npm install && npm run dev` from `frontend/`, with the backend running.

| Requirement | How the board does it | Route(s) |
|---|---|---|
| List all 3 tickets | Sidebar cards with id, subject, requester, status badge (OPEN / RUNNING… / WAITING FOR APPROVAL / RESOLVED / ESCALATED), and "N approvals waiting for you" | `GET /api/tickets` |
| Pick 1 ticket and start the team | Click a ticket, then **Run agent team**. It's disabled while another ticket runs (one at a time), and for tickets already waiting on approval or resolved | `POST /api/tickets/{id}/run` |
| Each agent and what it's saying or doing | Five **agent cards** with live state (Working… / Waiting on *X* / Done / Not called), who asked them, their latest words, and tool chips with counts. A **Live activity** feed shows every step: words, each tool call with arguments, hand-offs (with the task quoted), refusals and finishes. It polls every 1.2 s while running | `GET /api/events?ticket_id=&since=`, `GET /api/health` |
| Mark RESOLVED when the run finishes | Per your choice: if the run needs no approval it ends **RESOLVED**. If it queued a payment, it ends **WAITING FOR APPROVAL**, and when you decide the last pending request, the backend marks it **RESOLVED** (`update_ticket` via MCP, logged as `ticket_resolved`). The server rule "no `resolved` while approvals are pending" stays in force | `GET /api/runs/{id}`, `POST /api/approvals/{id}/approve` |
| Short summary of what each agent did | **What each agent did**: the Boss's final call, next steps for you and risks, then one card per specialist report (summary, actions taken, blockers), plus "Not called on this ticket: …" | from `agent_finished` events |
| Human approves a pay or purchase | **Waiting for your approval** panel: kind, amount, payee, what it's for, who asked and why, and whether it moves cash. Enter your name (saved in the browser), then Approve or Reject | `GET /api/approvals?status=pending`, `POST …/approve`, `POST …/reject` |
| Checking balance goes down after a payment | The header shows the checking balance with a "▼ $X after your last approval" marker, plus available cash after known bills | `GET /api/cash` |

**Backend changes made for the board**
- **Auto-resolve:** after a human decision, if the ticket is `waiting_approval`, no run is active, and nothing is left pending, `main.py` calls MCP `update_ticket(…, "resolved", updated_by="human: <name>")` and appends a `ticket_resolved` audit entry.
- `GET /api/events?ticket_id=` also returns `database_reset` entries, so the board starts fresh after a reset instead of showing an old run.

**Verification (no tokens, real files untouched).** I ran the real `backend/main.py` on a test port against scratch copies of the databases and the audit file, with a scripted model following the ticket 101 plan, and the real dashboard on a test port pointing at it:
- **Before the run:** 3 tickets OPEN, checking $3,400 and available $160, 5 agents "Not called".
- **During the run:** RUNNING… badge and the run button disabled. Boss "Waiting on Inventory"; Inventory "Working… · asked by Boss" with `check_stock_and_price` and `get_vendor` chips; the feed lists each call with its arguments.
- **After the run:** WAITING FOR APPROVAL, Facilities "Not called", the Boss's final call and 3 specialist summaries, and the $840 invoice payment in the approval panel.
- **Approve:** checking **$3,400 → $2,560** with a "▼ $840.00" marker; ticket 101 **RESOLVED** in the sidebar and header; feed: "You approved request #1 (Pay vendor invoice, $840.00)…", then "Ticket marked RESOLVED".
- **Reset:** checking back to $3,400, all tickets OPEN, and the board starts fresh.
- No console errors. `npm run build` (TypeScript check) passes. The real databases, the real audit trail (still empty) and the real backend's $3,400 were unchanged.

### Design refresh (Problem 8 follow-up)

The board was redesigned so real people enjoy using it, still in Yale navy, light blues and white only:
- **Masthead + "bank card":** a navy identity bar (crest, "Operations desk · Chapel Street, New Haven", shop date, model, Reset shop). Overlapping it, a white card with a **48px hero checking balance** and a "▼ $840 after your last approval" chip, a **single-hue meter** ("Committed to known bills $3,240 of $3,400", $160 free, low-cash warning icon), and three stat tiles (tickets resolved, waiting on you, paid out).
- **Work orders:** each ticket has a type icon (shirt / key / tag), a serif title, and a 4-segment progress bar (Open → Team → You → Resolved).
- **Stage:** a big ticket title with fact chips, a **Run agent team** call to action, and a **lifecycle stepper** that pulses while the team works.
- **The team as an org chart:** the Boss card (navy) on top, a rail down to the four specialists. Each card shows a state pill with an icon (Standing by / Working / Waiting on X / Done), a speech bubble with its latest words, a "handed off by …" ribbon for specialist → specialist work, and tool chips with counts. A numbered **Hand-offs** strip shows the delegation order with ✓ / in-progress / refused.
- **Conversation:** chat bubbles per agent; each tool call is an expandable **receipt** showing the actual MCP result; hand-offs are centered dividers with the task quoted; your approvals appear as right-aligned "You" bubbles.
- **Your desk:** a "Sign as…" field and approvals shown as **payment slips** (payee, big amount, memo, the requesting agent's reason, "Checking after approval: $X", **Approve & pay** / **Approve price** / Reject).
- **Shift report:** a "Memo from the Boss" (decision, next steps, risks) plus one card per specialist, and who wasn't called.
- **Toasts** for results (e.g. "Approved #1 · checking $3,400 → $2,560 · ticket #101 resolved ✓").
- **Accessibility:** status always has an icon plus a label (never color alone), the meter has ARIA values, focus rings, `prefers-reduced-motion` support, and responsive layouts at 1280 / 1000 / 700px.

Checked in the browser against the mock backend (scratch data, no tokens) at 1440px, 1200px and phone width. Fixed during the check: the Boss card lost its navy when live, final answers appeared twice in the conversation, the resolved banner spacing, and the work-order heading on phones. Real data was untouched.

### Flair (Problem 8 follow-up 2)

Original SVG art in the Yale palette (all `aria-hidden`, decorative only), in `frontend/src/decor.tsx`:
- **Bulldog mascot** (our own drawing, 3 moods). It **peeks over the bank card** with a soft glow (smiling when nothing waits on you, alert when approvals are pending, wiggles on hover), sits **alert** in the empty conversation, **sleeps** ("z z") on an empty desk, and **hops** in the RESOLVED banner.
- **Clocktower logo** replaces the crest in the masthead.
- **Gothic campus skyline** along the bottom of the masthead: a clocktower with a clock face, spired halls, elms, and windows that glow softly.
- **Twinkling sparkles and stars** across the masthead, a ✦ beside "Shift report", and a ✦ on the balance-change chip.
- **Blue confetti:** a small burst on any approval, and a **big burst (120 pieces + stars)** when an approval resolves a ticket. It uses only navy, blue, sky blue, light blue and white.
- `prefers-reduced-motion`: sparkles hold still and confetti is skipped.

Checked in the browser against the mock backend (scratch data, no tokens): the bulldog was moved so it doesn't cover the Reset button, approving the ticket 101 payment fired the 120-piece confetti with the happy bulldog in the banner, there were no console errors, and real data was unchanged.

### Frontend ↔ backend connection (confirmed)

- **Frontend → http://localhost:8000:** `frontend/vite.config.ts` proxies every `/api/*` call from the Vite page to `http://localhost:8000` (override with `BACKEND_URL`). `src/api.ts` can also call the backend directly if `VITE_API_BASE=http://localhost:8000` is set.
- **Backend allows the Vite origin:** `backend/main.py` adds FastAPI `CORSMiddleware` with `allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"]`, all methods and all headers.
- **Checked live:** a preflight `OPTIONS` from `http://localhost:5173` returned `access-control-allow-origin: http://localhost:5173` (methods include POST, headers allow content-type), and an unknown origin got no allow header. From inside the dashboard page (origin `http://localhost:5173`): `/api/health` through the proxy → 200; a direct cross-origin `GET http://localhost:8000/api/health` → 200; a direct cross-origin `POST` (preflighted) → its `OPTIONS` 200, then the route answered 404 for a non-existent request id, so CORS passed and nothing changed. The dashboard's own calls (`/api/health`, `/api/tickets`, `/api/cash`, `/api/approvals`, `/api/events`) all returned 200.

### Agent activity states, live effects, and resolved design (Problem 8 follow-up 3)

**Each agent shows what it's doing** (`frontend/src/activity.ts` derives it from the event stream; every MCP tool has a plain-language verb and a read/write kind):
| State | When | Look |
|---|---|---|
| **Thinking** | Just got a task, or a report came back | Dashed bubble with bouncing **typing dots** and "Reading the task" |
| **Reading** | Called a read tool (e.g. `check_stock_and_price` → "Counting stock on the shelves", `get_cash_and_bills` → "Checking the bank book") and is digesting the result | Blue **Reading** pill with a book icon, a **light sweeping across the card** like turning a page, a bubble with the verb and tool name, and the tool chip lit |
| **Writing** | Called a write tool (`create_approval_request` → "Writing a payment slip for you", `save_customer_message`, `update_ticket`) | Navy **Writing** pill, a wiggling pen, and an **ink line that draws itself** under the bubble |
| **Handing off / Waiting on X** | Called `delegate` | Pill with an arrow or clock; the org-chart connector **flows** toward the specialist |
| **Done / Standing by** | Finished / not called | Green check / quiet dashed bubble |

**While any ticket runs:** a glowing progress bar slides across the top of the page, the **clocktower minute hands spin** (logo and skyline), sparkles and lit windows speed up, the masthead glows brighter, the bulldog **sniffs about** (alert), the stage's top stripe shimmers, and a navy **"Now:" ticker** on the stage narrates the latest move (e.g. "Inventory is counting stock on the shelves …").

**Resolved tickets:** the work order gets a double-bordered **RESOLVED rubber stamp** that thumps in, plus a navy icon and full progress bar. The stage shows a **"Case closed" certificate**: a navy card with a seal in a slowly spinning dashed ring, twinkling stars, a line for each human decision ("Approved · Pay vendor invoice · $840.00 to Bulldog Print Co"), drafts saved, which agents worked it, a handwritten-style **signature** with the time, and a hopping bulldog.

**Checked against the mock backend** (scratch data, no tokens): states seen in order (Boss: Thinking → Reading → Writing → Waiting on Inventory/Accounting/Customer Service → Done; Inventory: Thinking → Reading → Done; Accounting: Thinking → Reading → **Writing** "Writing a payment slip for you" with the ink line and the `create_approval_request` chip lit → Done; Customer Service → Writing; Facilities stayed Standing by). The Now ticker read "Inventory is counting stock on the shelves". After approving, the RESOLVED stamp and the Case closed certificate (signed "Caroline Tian") appeared. Fixed along the way: Reading/Writing flipped back to Thinking too fast, the ticker grammar, a `.now` class clash that made the progress segments into blobs, and the stamp overlapping the ticket-type label. No console errors; build passes; your real data was not touched.

### Shift report redesign (Problem 8 follow-up 4)

Real runs showed the report was wall-to-wall prose (the Boss's decision is about 200–300 characters, plus 8–12 key facts, 3 next steps and 2–4 risks; each specialist adds a long summary, 5–10 facts and recommendations). It's now layered so a reader gets the point in seconds and can drill down only if they want:
1. **The Boss's call:** the first sentence of the decision as a large serif headline, the rest in small text, and a "Worked with" row of agent avatars. A status chip (e.g. WAITING FOR APPROVAL) sits in the header.
2. **By the numbers:** up to 4 stat tiles chosen from the Boss's `key_facts` (short numeric values first, money first among those; `840.0` is shown as **$840.00**). All facts are behind "Show all N facts" (a table with each value's source tool).
3. **Your to-do | Watch out:** side by side. Numbered next steps with the action verb in bold, next to an amber box of risks with warning icons.
4. **Team notes:** one compact row per specialist: avatar, name, a **one-sentence takeaway** (if the summary opens by restating the ticket, the next sentence, which holds the finding, is used), and outcome badges (**Approval #1**, **Draft #1**, **3 blockers**, or Reported). Click a row to open the full report: the rest of the summary, Did / Recommends / Blockers columns, and "Facts it checked".
5. **Not called:** shown as dashed pills.

Checked with the **real ticket 101 reports** from the audit trail (read-only), replayed through the mock backend (no tokens): the headline was the Boss's first sentence; the tiles were $840.00 invoice, $3,400.00 cash, $160.00 available, 0 size S on hand; 3 to-dos and 2 risks; Inventory's takeaway was "There are 0 size-S units in Aisle B, so none can be filled now…"; no console errors. Real data was untouched.

### "By the numbers" simplified (Problem 8 follow-up 5)

The first version showed 4 tiles chosen generically from the Boss's `key_facts`. Real facts mix plain values (`160.0`) with packed ones (`unit_price 49.3; discount_off_list_pct 15.0; margin_pct 55.38`) under long labels, so the tiles were wordy and confusing. Now `frontend/src/headline.ts` picks **at most 3 numbers a shop owner cares about**, in a fixed order, each with a 1–2 word label, one big value, and an optional tiny hint:
1. **Cash left:** e.g. **$160**, hint *low* (amber) when under $500.
2. **In stock:** e.g. **8 of 20**, hint *short 12* (amber) when on hand < requested.
3. **Offer price:** e.g. **$49.30 each**, hint *15% off list*; otherwise **Invoice** (e.g. $840, with *3 days late* when known) or **Rent due** (e.g. $2,400).

Whole-dollar amounts drop the cents ($840, not $840.00). Everything else is under one dropdown: **"All N facts the Boss used"** (a table with values and source tools).

Tested with Node on the real Boss facts: 101 → $160 Cash left (low) · 0 of 1 In stock (short 1) · $840 Invoice; 103 → $160 Cash left (low) · 8 of 20 In stock (short 12) · $49.30 each Offer price (15% off list); a rent-style ticket → $160 · $2,400 Rent due. Viewed on a read-only copy of the board against the real 103 report. Also fixed: the report's status chip now shows the ticket's **current** status (RESOLVED) instead of the Boss's status at the end of the run (WAITING FOR APPROVAL).

### Clickable to-dos and message drafts (Problem 8 follow-up 6)

- **Every actionable step in "Your to-do" is now a link** (`frontend/src/todoLinks.ts` reads the Boss's sentence):
  - "approve / reject / payment / request #N / price override" → scrolls to **payment slip #N** on Your desk and makes it glow.
  - "draft / message #N" → scrolls to **draft #N** in the new **Message drafts** section.
  - "… ticket 102 …" (another ticket) → switches to **work order #102**, jumps to the top, and makes its card glow.
  - Advice like "Do not order the remaining 12…" stays plain text (not clickable).
  - Each link shows **Go →** / **Open #102 →**, and turns into **✓ Done** with a strikethrough once that slip is decided, the draft is sent, or the ticket is resolved. If a slip was already decided, a toast says so.
- **Message drafts on Your desk:** each draft shows recipient, subject, "Read the message", status (Not sent yet / Sent), and **Mark as sent** (signed with your name). This uses the new backend route `POST /api/messages/{id}/send` → MCP `mark_message_sent` (human-only), which appends a `message_sent` audit entry; the conversation shows "You sent draft #1 to Tauhid Zaman: …".
- **Tested:** the parser on the real Boss steps (101: ticket 102 / approval #1 / draft #1; 103: approval #1 / draft #1 / advice → plain), then clicked through on the mock backend (no tokens). Approve → slip-1 glowed; draft → draft-1 glowed; after approving and sending, both to-dos showed ✓ Done; "Open #102" switched tickets and jumped from 3277px down to the top. Fixed during testing: a `.draft` class clash on the status pill, and the smooth scroll being cut off by the ticket switch. No console errors; real data unchanged.

### Problem 8 error check

- **Found and fixed:**
  - **Idle agents weren't fading, and finished agents lost their white card.** When the activity states were added, the cards switched from `a-idle`/`a-done` to `act-idle`/`act-done`, but the CSS still used the old names.
  - **`.summary-label` style was missing.** It was deleted with the old shift-report CSS, while Your desk still used it for "Other tickets" and "Message drafts for this ticket".
  - **Dead CSS removed:** `.resolved-banner`, `.state-working`, `.facts-more.inline`.
  - **`frontend/README.md` was out of date:** it still said "Waiting for your approval" and was missing the activity states, drafts, clickable to-dos and five newer files. It's rewritten.
  - **The empty desk said "Nothing to sign" even when a draft was waiting.** It now says "No payments to sign."
  - The first Problem 8 section in this harness is now labeled as the first version.
- **Checked and fine:** `tsc` and the production build pass. The only lint notes are the 2 known data-loading effects. All 13 live routes match the route list. Every file and component named in `design.md` exists. The Problem 8 prompt log has no placeholders.

---

## Resolve the Tickets (Problem 9): first attempt *(superseded by the rerun below)*

**Clean start:** reset through `POST /api/reset`. `data/campus_customs_new.db` was then **byte-identical** to the original `data/campus_customs.db` (same SHA-1). **Starting checking balance: $3,400.00** ($160 available after known bills; shop date 2026-08-31; no payments).

**Runs:** each ticket was run for real on `gpt-6-luna` through `POST /api/tickets/{id}/run`, in order 101 → 102 → 103. Each ended at `waiting_approval` with one approval request. **For this run only, Claude approved each request as "Caroline Tian"** (her instruction); normally a person approves payments and purchases on the dashboard. Each approval resolved its ticket through MCP `update_ticket`. Customer drafts were left **unsent** for human review.

| Ticket | Run | Time | Model requests / tokens (in / out) / tool calls | Delegations | Human decision | Checking |
|---|---|---|---|---|---|---|
| **101** | `583082eb12c2` | 635 s* | 16 / 59,170 / 4,738 / 19 | Boss → Inventory, Accounting, Customer Service (parallel) | Approved #1, invoice 501, $840 to Bulldog Print Co | $3,400 → **$2,560** |
| **102** | `3b49b9bf4021` | 36 s | 12 / 42,510 / 2,397 / 14 | Boss → Facilities → **Accounting** (depth 2) | Approved #2, rent, $2,400 to Elm City Properties | $2,560 → **$160** |
| **103** | `bf8e6aada12a` | 39 s | 18 / 69,071 / 5,815 / 25 | Boss → Inventory, Accounting, Customer Service (parallel) | Approved #3, price override 8 × $49.30 = $394.40 (no cash moves) | **$160** |

**End:** all 3 tickets **resolved**; checking **$3,400 → $160** (two payments, both `approved_by` Caroline Tian); approval requests #1 and #2 executed, #3 approved; drafts #1 (Tauhid Zaman) and #2 (Yale AI Club) unsent.

\*One model request in 101 **stalled** after the Boss's last tool call; the OpenAI SDK's default **10-minute timeout** expired, then the call was retried and succeeded. **Fix (between tickets, while no run was active):** `backend/config.py` now sets `REQUEST_TIMEOUT_SECONDS = 120` and `max_retries=2` on the Portkey client. Tickets 102 and 103 then took 36–39 s.

**Plan vs actual** (`output/desk_tickets.html`, ACTUAL sections filled from `output/audit_trail.json`; EXPECTED sections left unchanged, verified identical):
- **First call and agents: matched on all 3.** Inventory first on 101 and 103, Facilities first on 102. **8 of 8 planned delegations happened, with no extras.** Facilities was not called on 101 and 103, and Inventory and Customer Service were not called on 102. The 102 specialist → specialist hand-off (Facilities → Accounting) happened exactly as predicted.
- **Money outcomes matched:** $840 invoice + $2,400 rent queued and paid, $160 left; 103's discount of 8 × $49.30 for the in-stock units only; **no restock PO** ($264 > $160 available).
- **Differences:**
  - In 101 and 103 the Boss **fanned out to all three specialists in one step (in parallel)** instead of waiting for Inventory's report.
  - **Agents read more than planned:** 19 / 14 / 25 tool calls vs about 10 / 7 / 11.
  - The 101 draft didn't offer size M.
  - In 103, **Customer Service saved its draft 3 s before Accounting queued the discount**, so draft #2 says "no approved bulk discount… $58 list". It was honest when written, but is now out of date and should be updated before sending.

---

## Resolve the Tickets (Problem 9): rerun with human decisions

Rerun because the first attempt was slowed by a stalled request, and to have Caroline make each decision with full context.

- **Clean start:** `POST /api/reset` → the working DB was **byte-identical** to the original; `cash_accounts`: checking **$3,400.00**; 0 payments; no work tables. Audit trail continued from #270.
- **Process:** each ticket was run for real; afterward Claude **stopped and asked Caroline** (findings, the exact request, cash before and after, risks, a recommendation). She approved each one, and Claude submitted it as **"Caroline Tian (via Claude)"**.

| Ticket | Run | Time | Requests / tokens in·out / tool calls | Delegations | Boss status | Caroline's decision | Checking |
|---|---|---|---|---|---|---|---|
| **101** | `68844d1ace5b` | 25 s | 16 / 55,462·4,264 / 17 | Boss → Inventory, Accounting, Customer Service | waiting_approval | Approved #1, invoice 501, **$840.00** to Bulldog Print Co | $3,400.00 → **$2,560.00** |
| **102** | `6fd26e776997` | 25 s | 11 / 37,563·2,033 / 13 | Boss → Facilities → **Accounting** | waiting_approval | Approved #2, rent, **$2,400.00** to Elm City Properties | $2,560.00 → **$160.00** |
| **103** | `efd9867fe7af` | 184 s† | 25 / 102,507·9,086 / 38 | Boss → Inventory, Accounting, Customer Service; **Customer Service → Inventory**; Boss → Accounting (follow-up) | **escalated** | Approved #3, price override **8 × $49.30 = $394.40** (no cash moves) | **$160.00** |

- †Of 103's 184 s, **131 s was one stalled request** (the Boss's final answer; the 120 s timeout fired and the retry succeeded). The agents' actual work took about 53 s.
- **Cash, verified three ways:** $3,400.00 − $840.00 − $2,400.00 − $0.00 = **$160.00** = `cash_accounts.checking`. The database (start − sum(payments)), the balances in the audit trail's recorded effects, and `GET /api/cash` all agree. Itemized on the **Cash** tab of `output/desk_tickets.html`.
- **103 escalation:** the Boss flagged that #3 discounts 8 units, while the policy is "15% off for 10+ units". Accounting had no tool to cancel a pending request, so the Boss escalated. Caroline approved: the club's order is 20 units, and the discount applies to the 8 deliverable now. **Fix:** a human decision now resolves an `escalated` ticket too (`_resolve_if_done` in `backend/main.py`).
- **Deliverables:**
  - `output/desk_tickets.html`: ACTUAL sections rewritten from this run (EXPECTED unchanged, verified identical) and the Cash tab.
  - `output/resolved_tickets.json`: per ticket, the final status, outcome, each agent's contribution, human approvals, drafts and cash walk.
  - `output/resolved_board.html`: screenshots of the React board for 101, 102 and 103, each captured right after that ticket resolved and embedded in the page.
  - The real runs are appended to `output/audit_trail.json`.
- **What "resolved" means for 103:** Ticket 103 is resolved: the discount decision is complete (request #3 approved, 8 × $49.30 = $394.40), the customer was told, and nothing is pending. The other 12 hoodies were deliberately deferred: the ~$264 restock didn't fit the $160 available, so no order was placed, and the club was told the shop would follow up. That restock would be a new ticket once cash allows. It is not unfinished work on 103, and no approval is needed.
- **Drafts:** #1 (Tauhid Zaman) was **sent by Caroline** from the dashboard at 11:19 AM (`POST /api/messages/1/send`, audit #446). #2 (Yale AI Club) was **revised** at Caroline's request (via the new human-only MCP tool `revise_customer_message` and `POST /api/messages/2/revise`, audit #447) to state the approved price: 8 × $49.30 = $394.40, with no date or price promised for the other 12. At Caroline's request it was then **sent** (`POST /api/messages/2/send`, signed "Caroline Tian (via Claude)", audit #448). **Both drafts are now sent.**

- **To-do check-off (after Problem 9):** on ticket 103, to-dos 1, 2 and 4 auto-showed ✓ Done (request #3 decided; draft #2 revised and sent). To-do 2 was conditional ("if proceeding with the full 20-unit order…") and became unnecessary once Caroline approved the 8-unit price. To-do 3 ("Decide whether to offer the 8 in-stock units now or wait") is a judgment call with no record to check, so the board now gives such steps a **Mark done** button the human ticks (saved per run in the browser's `localStorage`, undoable). Tested on the real 103 report: Mark done → "Done · undo" → undo; nothing in the database changes.

---

## Reflection (Problem 10) — Reflection tab of `output/desk_tickets.html`

Written in Caroline's voice, tied to this app and the 3 tickets, with 22 clickable evidence tags that jump to the ticket tabs and the Cash tab (EXPECTED sections and the Cash tab unchanged, verified):
1. **Evaluation per ticket.** Scored on right answer, right people, safety, customer message, and cost/speed: **101 A−** (all facts right; the draft didn't offer the 5 size-M tees), **102 A** (exact predicted path Boss → Facilities → Accounting), **103 B+** (excellent money logic and a correct escalation, but 184 s and about half of all tokens).
2. **ACTUAL vs EXPECTED.** Who was called matched on all 3 (8 of 8 planned hand-offs). Money matched to the cent. Differences: parallel fan-out, about 2× the planned tool calls (68 vs ~28), and 103's 2 extra hand-offs plus the escalation.
3. **Simpler as 1 agent.** 102 (a linear read lease → check cash → queue rent) and 101. Keep the team (least privilege plus Boss review) for money and ambiguous tickets like 103: a hybrid.
4. **3 new problems the team *can* solve:** (1) out-of-stock Crest Mugs → Elm City Gifts PO of 12 × $3.50 = $42 that fits in $160; (2) October rent ($2,400 due 2026-10-02) with $160 cash → queued with `enough_cash: false` and escalated; (3) Tauhid switches to one of the 5 size-M tees → no money moves, resolves on its own.
5. **3 new problems it *can't* solve, and what it would need:** (1) recording customer payments and fulfilling sales (the $394.40 never reaches checking) → Sales/Cashier agent with `record_customer_payment`, `fulfill_order`, human-only `issue_refund`; (2) actually ordering and receiving stock → Purchasing/Receiving agent with `send_purchase_order`, `track_shipment`, `receive_shipment` and a `purchase_orders` table; (3) covering a cash shortfall → Finance/Cash-flow agent with `forecast_cash`, human-only `request_transfer`, `draft_landlord_payment_plan` and more `cash_accounts`.

All 14 numeric claims were checked against `resolved_tickets.json` and the working DB (requests, tokens, tool calls, times, cash math, stock, prices, vendors, lease date).

### Reflection revised for Campus Customs specifics (Problem 10 follow-up)
The first draft had generic lines ("trustworthy with money", "expensive with attention"). The rewrite anchors every answer in this shop and these 3 runs:
- **8 verbatim agent quotes** from the audit trail, each verified word for word: Inventory's "size-S stock is 0 in Aisle B…" and "Other sizes are available (L: 3, M: 5, XL: 2)", Facilities' lease-1 check, Accounting's "$264" restock math and "could not correct pending price_override #3…", the Boss's escalation sentence and "preserve this low cash cushion", and Customer Service's "pending manager approval".
- **Exact timestamps** that explain the misses. All 3 hand-offs on 101 went out at 11:04:19, so Customer Service never saw Inventory's size-M finding. On 103, Customer Service checked the desk at 11:09:37, four seconds before request #3 was queued at 11:09:41.
- **Real records and names:** Tauhid Zaman, Yale AI Club, Elm City Properties, Bulldog Print Co, Elm City Gifts, QuickShip CT (never used), Chapel Street shop, Aisles A/B/D, invoice 501, lease 1, requests #1–#3, drafts #1–#2, CC-TEE-WHITE / CC-HOOD-NAVY / CC-MUG-CREST.
- **The cash scenarios use the Cash tab:** mugs 12 × $3.50 = $42 → $160 → $118; October rent $160 − $2,400 = −$2,240 (the server's exact refusal text is quoted); Yale AI Club paying $394.40 → $554.40 (the $264 restock would then fit); even with the other 12 hoodies sold at $49.30 (+$591.60), checking reaches only $1,146, still $1,254 short of the Oct 2 rent.
- **Correction found while checking:** 103's 184 s was mostly one 131 s stalled request, not the extra loop. The ACTUAL section on the plan page and this harness now say so.

### Escalated-ticket UI fixes (after Problem 10)
Found by rebuilding ticket 103's escalated, before-approval moment on a scratch copy and screenshotting the board:
1. **Run agent team stayed clickable on an escalated ticket** that was waiting on a human decision. Re-running would only spend tokens. It is now disabled when the ticket is `waiting_approval`, or `escalated` with a request still pending on Your desk.
2. **The hint text was wrong** ("The Boss reads the ticket…"). It now says *"The Boss escalated this to you. Decide request #3 on Your desk to resolve it."* If an escalated ticket has nothing pending, Run stays enabled and the hint says to read the Boss's reason in the shift report first.
Verified on the scratch snapshot in both cases (with and without a pending request). Tickets 101 and 102 are unchanged, there are no console errors, and the real data was untouched.

### Pre-submission check
- `output/mcp_smoke.json`: the Problem 4 outputs were captured before any ticket was worked (checking $3,400, all open). After Problem 9 the working DB changed, so a `recheck_after_problem_9` section re-runs the same 3 MCP tools on the **current** DB (checking $160, all resolved). All 12 values match; the original snapshot is kept, with a `snapshot_note` explaining both.
- Every Problem 1–10 requirement was rechecked against the files and live system: **33/33 pass**.

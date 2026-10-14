# Campus Customs: Multi-Agent Operations (HW5)

An AI agent team that runs **Campus Customs**, a small Yale merch shop on Chapel Street. Three pieces talk to each other:

| Piece | Folder | What it does |
|---|---|---|
| **MCP server** | `mcp_server/` | FastMCP server: the *only* way the agents touch shop data (`data/campus_customs_new.db`). 15 tools. |
| **Backend + agent team** | `backend/` | FastAPI app and five PydanticAI agents (Boss, Inventory, Accounting, Facilities, Customer Service) on **`gpt-6-luna` via Portkey**. Any agent can delegate to any other. |
| **React board** | `frontend/` | React + Vite + TypeScript dashboard: watch the agents work, approve payments and purchases, see the checking balance. |

Agents only *prepare* payments; a person approves them on the board, and that's the only step that moves cash.

---

## 1. One-time setup

Tested with Python 3.14 and Node 24.

```bash
# from the repo root (this folder)
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

cd frontend && npm install && cd ..

cp .env.example .env        # then open .env and paste your own PORTKEY_API_KEY
```

The backend reads `PORTKEY_API_KEY` from `.env` in this folder (or any parent folder). The real `.env` is never committed. Every agent uses only `gpt-6-luna`; the name is set once in `backend/config.py`.

## 2. Databases: copy the original to the working copy for a clean run

- `data/campus_customs.db`: the **original** shop data. Never modified by the app.
- `data/campus_customs_new.db`: the **working copy**. The MCP tools read and write only this file.

The committed working copy holds the **finished state of my submitted run**: all 3 tickets resolved, checking **$160.00**. It matches `output/desk_tickets.html`, `output/resolved_tickets.json` and `output/audit_trail.json`. Whenever you want a **clean run**, copy the original over the working copy:

```bash
cp data/campus_customs.db data/campus_customs_new.db
```

(Same as the **Reset shop** button or `POST /api/reset`, described in step 6.)

## 3. Start the MCP server

The backend loads the MCP server **in-process** automatically, so you don't need a separate terminal to run the app. To start it on its own (stdio), for example to explore the tools from an MCP client:

```bash
.venv/bin/python mcp_server/server.py
```

`.mcp.json` registers the same server as **`campus-customs`** for Claude Code: open this folder in Claude Code and approve the server. See `mcp_server/README.md` for all 15 tools.

## 4. Start the FastAPI backend (port 8000)

```bash
cd backend
../.venv/bin/uvicorn main:app --reload --port 8000
```

Check it: <http://localhost:8000/api/health> should show `"model": "gpt-6-luna"`. API docs: <http://localhost:8000/docs>.

## 5. Start the React board (port 5173)

In a second terminal:

```bash
cd frontend
npm run dev
```

Open <http://localhost:5173>. The dev server proxies `/api` to `http://localhost:8000`.

## 6. Reset the DB before a full 3-ticket run

Before running tickets 101, 102 and 103 from the start, reset the working copy so cash is back to **$3,400.00** and all tickets are open. Use any one of these:

- On the board: **Reset shop** (top right), or
- `curl -X POST http://localhost:8000/api/reset`, or
- `cp data/campus_customs.db data/campus_customs_new.db` (while no ticket is running).

Reset never wipes `output/audit_trail.json`; it just adds a `database_reset` entry.

Then, for each ticket in order **101 → 102 → 103**:

1. Click the work order, then **Run agent team**, and watch the Boss hand work to the specialists.
2. When the run finishes, sign your name on **Your desk**, then **Approve & pay**, **Approve price** or **Reject**.
3. The ticket becomes **RESOLVED** once nothing is waiting on you; checking goes down only for approved payments.

Expected result (my run): $3,400 → $2,560 (101, invoice 501) → $160 (102, rent) → $160 (103, a price approval, no cash moves).

---

## Where to look

| File | What's in it |
|---|---|
| `AI_prompts.md` | Every prompt I gave my vibe coder, by problem |
| `output/harness.md` | Tables, MCP tools, the 5 agents, API routes, dashboard, safety rules (see "Final Harness") |
| `output/desk_tickets.html` | Per ticket EXPECTED vs ACTUAL, the **Cash** tab (itemized), and the **Reflection** |
| `output/resolved_tickets.json` | Each ticket's final status, outcome, agent contributions and human approvals |
| `output/resolved_board.html` | Screenshots of the board for each resolved ticket |
| `output/audit_trail.json` | Append-only log of every agent step, hand-off and human decision |
| `output/mcp_smoke.json` | MCP tool tests, with values checked against the DB |
| `output/design.md` | Why the dashboard looks and behaves the way it does |
| `output/github_url.txt` | This repo's URL |

## Troubleshooting

- **Port already in use:** another app is on 8000 or 5173. Stop it, or run Vite on another port (`npm run dev -- --port 5174`); the proxy still targets 8000.
- **`PORTKEY_API_KEY is missing`:** create `.env` from `.env.example` in this folder.
- **Board says it can't reach the backend:** start the backend first (step 4).

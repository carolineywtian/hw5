# Campus Customs — Agent Dashboard (frontend)

React + Vite + TypeScript board for the Campus Customs multi-agent team. It calls the FastAPI routes in `../backend/main.py` (Problem 7). In dev, Vite proxies `/api` to **http://localhost:8000**.

## Run

1. Start the backend (from `HW5/backend/`):
   ```bash
   ../.venv/bin/uvicorn main:app --reload --port 8000
   ```
2. Start the dashboard (from `HW5/frontend/`):
   ```bash
   npm install
   npm run dev
   ```
3. Open **http://localhost:5173** (Vite's default port; it picks the next free port if 5173 is taken).

## What the board does

| Requirement | Where |
|---|---|
| List all 3 tickets | **Work orders** sidebar (`TicketList`): icon, title, requester, 4-step progress bar, "N to approve", and a RESOLVED stamp when done |
| Pick 1 ticket and start the team | Click a work order, then **Run agent team** on the ticket stage (`POST /api/tickets/{id}/run`; one ticket at a time) |
| Each agent and what it's saying/doing during the run | **The team** org chart (`AgentBoard`): each agent shows **Thinking** (typing dots), **Reading** (book icon and a scanning light, e.g. "Counting stock on the shelves"), **Writing** (pen and an ink line, e.g. "Writing a payment slip for you"), **Waiting on X** / handing off (flowing connector), or **Done**, plus tool chips and a numbered Hand-offs strip. A **"Now:"** ticker on the stage (`NowTicker`) and the **Conversation** (`ActivityFeed`, chat bubbles plus expandable tool receipts) poll `GET /api/events` every 1.2 s |
| Mark the ticket RESOLVED when the run finishes | The run ends at **waiting for approval** if a payment needs you; your last decision resolves it (a run needing no approval ends resolved). Resolved tickets get a **RESOLVED stamp** and a **"Case closed" certificate** (`ResolvedCertificate`) |
| Short summary of what each agent did | **Shift report** (`AgentSummaries`): the Boss's call (headline), **3 headline numbers** (`headline.ts`), **Your to-do** / **Watch out**, and one-line **Team notes** per agent (open for details) |
| Human approves a pay or purchase | **Your desk** (`ApprovalPanel`): sign your name, then **Approve & pay** / **Approve price** / **Reject** on each payment slip (`POST /api/approvals/{id}/approve`) |
| Checking balance goes down after an approved payment | Bank card (`CashCard`): hero checking balance from `GET /api/cash`, a "▼ $840.00 after your last approval" chip, and a meter of cash committed to known bills |

Also:
- **Clickable to-dos** (`todoLinks.ts`): "Approve…" scrolls to that payment slip, "Send draft #1…" to that draft, and "…ticket 102…" opens that work order. Each glows on arrival and turns ✓ Done once handled. Judgment steps with no record to check (e.g. "Decide whether to offer the 8 in stock now") get a **Mark done** button you tick yourself; it's saved in your browser per run and can be undone.
- **Message drafts** on Your desk: read each draft and **Mark as sent** (`POST /api/messages/{id}/send`).
- **Reset shop** in the masthead (`POST /api/reset`); the board then starts clean.

## Look and feel

Yale navy, light blues and white. A navy masthead with a clocktower logo, Gothic campus skyline and twinkling sparkles; a "bank card" with the balance; work orders; a ticket stage with a lifecycle stepper; the team as an org chart; a chat-style conversation; payment slips and message drafts on "Your desk"; a layered shift report; and toasts. Flair lives in `src/decor.tsx`: an original bulldog mascot (peeking over the bank card, asleep on an empty desk, hopping on resolved tickets) and blue confetti on approvals. Status always has an icon and a label; motion respects `prefers-reduced-motion`. See `../output/design.md` for the reasoning behind each choice.

## Files
- `src/api.ts`: one function per backend route
- `src/types.ts`: response shapes
- `src/agents.ts`: agent names, roles, status labels, money format
- `src/activity.ts`: works out each agent's state and the plain-English verb for every tool
- `src/headline.ts`: picks the 3 "By the numbers" tiles
- `src/todoLinks.ts`: decides where each to-do takes you
- `src/App.tsx`: state, polling, run / approve / send / reset actions, to-do navigation
- `src/components/`: `TicketList` (work orders), `Stepper`, `NowTicker`, `AgentBoard` (team + hand-offs), `ActivityFeed` (conversation), `ApprovalPanel` (your desk + drafts), `AgentSummaries` (shift report), `ResolvedCertificate`, `CashCard` (bank card)
- `src/decor.tsx`, `src/icons.tsx`, `src/ticketIcons.ts`: SVG art and icons
- Theme: `src/index.css`, `src/App.css`

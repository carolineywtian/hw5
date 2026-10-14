# Campus Customs Agent Dashboard: Design Choices

This is the look and feel I chose for the React dashboard (`frontend/`, run with `npm run dev` → http://localhost:5173) and why. The board watches five AI agents run a Yale merch shop, and asks a person to sign off on anything that moves money. The design had two jobs at once: make a multi-agent system **understandable at a glance**, and make supervising it **something a person actually enjoys**.

---

## 1. Principles behind every choice

1. **Yale, all the way.** Only Yale navy (`#00356B`), light blues and white. Headings use an old-style serif (Iowan Old Style / Palatino / Georgia) for a collegiate, crest-and-stone feel; numbers use a bold sans so money is easy to read.
2. **The human is in charge.** Agents prepare, people decide. Everything that needs me sits on **"Your desk"**, and the checking balance moves *only* when I approve.
3. **Glanceable first, details on demand.** Every area leads with one big idea (a headline, a number, a status) and keeps the full detail one click away (dropdowns, receipts, "Details ▾").
4. **Show, don't just tell.** I wanted to *see* agents read, write and hand off work, so each state has its own motion and icon, not just a word.
5. **Delight with restraint.** Bulldogs, sparkles and confetti make it fun, but they're decorative only (`aria-hidden`), never block a button, and turn off for people who ask their system for reduced motion.
6. **Never color alone.** Every status has an icon **and** a label (✓ Done, ⚠ low, ⏱ Waiting), so it works for colorblind readers and in print.

---

## 2. Layout: top to bottom

| Area | What I chose | Why |
|---|---|---|
| **Masthead** | Navy band with a **clocktower logo**, "Campus Customs · Operations desk · Chapel Street, New Haven", the shop date, the model (`gpt-6-luna`), and **Reset shop**. A **Gothic campus skyline** (clocktower, spired halls, elms, softly glowing windows) runs along the bottom, with **twinkling stars** above. | It sets the place right away: this is a Yale shop, not a generic admin page. Reset lives up here because it affects the whole shop. |
| **Bank card** | A white card overlapping the masthead with the **checking balance as a 48px hero number**, a **single-blue meter** of cash committed to known bills ("$3,240 of $3,400", "$160 free · low"), and three stat tiles (tickets resolved, waiting on you, paid out). A **bulldog peeks over the top edge**. | Cash is the shop's lifeline and the main thing a human controls, so it gets the top spot. The meter shows the real constraint (money already spoken for) instead of just the bank balance. |
| **Work orders** (left sidebar) | Each ticket is a card with a type icon (shirt / key / tag), a serif title, the requester, a **4-step progress bar** (Open → Team → You → Resolved), and "N to approve" when it needs me. | One look tells me where every ticket stands and which needs my attention. The sidebar stays put while I scroll. |
| **Ticket stage** | A big serif title, fact chips (requester, item, invoice / lease), a **Run agent team** button, and a **lifecycle stepper**. While running, a live **"Now:" ticker** appears; when resolved, a **"Case closed" certificate**. | This is the "main event" for the selected ticket: what it is, where it stands, and the one action to take. |
| **The team** | An **org chart**: the Boss (navy card) on top, a connector rail down to the four specialists. Every card shows a status pill, a **speech bubble** with the agent's latest words, and tool chips. A numbered **Hand-offs** strip shows who delegated to whom, in order. | The assignment's core idea is *full connectivity*. An org chart with live hand-offs makes delegation visible; a list of logs would hide it. |
| **Conversation** | **Chat bubbles** per agent. Each tool call is an expandable **receipt** that shows the exact MCP result, hand-offs appear as centered dividers quoting the task, and my own approvals and sends show as right-aligned "You" bubbles. | People already know how to read a group chat, and receipts keep the raw data available without cluttering the thread. |
| **Your desk** | "Sign as…" (my name, remembered), approvals as **payment slips**, and **Message drafts** with "Read the message" and **Mark as sent**. | It mirrors a real desk: sign checks and send letters. My name is recorded on every payment and message. |
| **Shift report** | Layered: **The Boss's call** → **3 headline numbers** → **Your to-do / Watch out** → **Team notes** (one line per agent; open for details). | Real runs produced long reports. The layers let me get the gist in seconds and dig in only if I want to. |
| **Toasts** | Short confirmations in the bottom-right corner ("Approved #1 · checking $3,400 → $2,560 · ticket #101 resolved ✓"). | Immediate feedback without moving the page. |

---

## 3. How agents look different while they work

Each agent's state comes from the live event stream (`src/activity.ts`). Every MCP tool has a plain-English verb and is marked as either *read* or *write*, so the card can say what the agent is doing in shop terms instead of tool names.

| State | When | How it looks | Why |
|---|---|---|---|
| **Standing by** | Not called (yet) | Faded card, dashed "Not called yet" bubble | Shows that the Boss chose *not* to call it, which is useful to see in itself |
| **Thinking** | Just received a task, or a report came back | Dashed bubble with **bouncing typing dots** | The familiar "someone is typing" cue |
| **Reading** | Called a read tool, e.g. `check_stock_and_price` → *"Counting stock on the shelves"*, `get_cash_and_bills` → *"Checking the bank book"* | **Blue "Reading" pill with a book icon**, a **light sweeping across the card** like turning a page, a bubble with the verb and the tool name, and the tool chip lit up | Reading is the most common action, so it gets a calm, continuous motion |
| **Writing** | Called a write tool: `create_approval_request` → *"Writing a payment slip for you"*, `save_customer_message`, `update_ticket` | **Navy "Writing" pill**, a **wiggling pen**, and an **ink line that draws itself** | Writing changes the shop's records, so it looks heavier and more deliberate than reading |
| **Handing off / Waiting on X** | Called `delegate` | Arrow or clock icon; the **org-chart connector flows** toward the specialist; the Hand-offs strip adds a numbered step | Makes full-mesh delegation something you can actually watch |
| **Done** | Report handed back | Green ✓ Done, final summary in the bubble | Closure for each agent |

The avatar of whoever is active gets a soft pulsing halo, and the Boss card stays navy in every state so the leader is always easy to find.

---

## 4. While a ticket is running

- A **glowing progress bar** slides across the very top of the page.
- The **clocktower minute hands spin** (in the logo and the skyline), and the sparkles and windows **twinkle faster**.
- The masthead glows a little brighter, and the stage's top stripe shimmers.
- The bulldog switches from smiling to **alert and sniffing around**.
- The **"Now:" ticker** narrates the latest move in a sentence, e.g. *"Inventory is counting stock on the shelves …"*.
- Only one ticket runs at a time; the Run button explains why it's disabled.

**Why:** an AI run can take a while. Motion that clearly means "working" (and stops when it's done) reassures me the team is busy and tells me when to come back.

---

## 5. How resolved tickets show up

- **Rubber stamp:** a double-bordered, tilted **RESOLVED** stamp "thumps" onto the work order. The icon turns navy and all four progress segments fill in.
- **"Case closed" certificate** on the ticket stage: a navy card with a **seal inside a slowly spinning dashed ring**, twinkling stars, one line per decision I made ("Approved · Pay vendor invoice · **$840.00** to Bulldog Print Co"), drafts saved, which agents worked it, and a **handwritten-style signature** with my name and the time. A happy bulldog hops beside it.
- **Big confetti burst** (120 pieces in navy, blues and white, plus stars) at the moment my approval resolves a ticket.
- The shift report's status chip shows the ticket's **current** status (RESOLVED), not what the Boss set when the run ended.

**When "resolved" happens (my choice):** a ticket is RESOLVED **after the run *and* my decisions**. If the run needs no approval, it ends resolved; if it queued a payment, it waits for me, and my last decision resolves it. That keeps the safety rule that nothing is closed while money is still waiting on a person.

**Why:** finishing work should *feel* finished. The stamp and certificate make "done" unmistakable and give a record of who signed what.

---

## 6. How cash shows up

- **Hero balance** on the bank card, with a **"▼ $840.00 after your last approval ✦"** chip that pops in after each payment.
- **The "committed to known bills" meter** uses one blue on a pale track (a single ratio, so one hue is clearer than many), with a ✓ or ⚠ icon and the words **"$160 free … (low cash, under $500)"**.
- **Payment slips** show the amount large, *who* gets paid, the memo, the agent's reason, and **"Checking after approval: $2,560.00"** *before* I click. Price-only approvals say **"Sets the price only. No cash moves."**
- Buttons say what they do: **Approve & pay** vs **Approve price**.
- Small confetti on every approval, and a toast with before → after ("checking $3,400 → $2,560").

**Why:** money is where mistakes hurt. I wanted the consequence visible *before* I commit, and confirmed *after*.

---

## 7. The shift report and clickable to-dos

- **The Boss's call:** the first sentence as a big serif headline; the rest smaller; "Worked with" agent avatars.
- **By the numbers:** at most **3 short tiles** with the numbers a shop owner cares about, in a fixed order: **Cash left** ($160, *low*), **In stock** (8 of 20, *short 12*), then **Offer price** ($49.30 each, *15% off list*) or **Invoice** / **Rent due**. Everything else is in **"All N facts the Boss used"**.
- **Your to-do** (numbered, action word in bold) next to **Watch out** (amber, ⚠).
  - Each to-do is a **link**: "Approve…" scrolls to that payment slip and makes it glow; "Send draft #1…" scrolls to the draft; "…ticket 102…" opens that work order. Advice like "Do not order…" stays plain.
  - Completed steps flip to **✓ Done** with a strikethrough, so the list doubles as a checklist.
  - Judgment steps with nothing in the database to check (e.g. "Decide whether to offer the 8 in stock now or wait") get a **Mark done** button. *I* decide when they're done; the board doesn't guess. It's saved per run in the browser and can be undone.
- **Team notes:** one line per agent (the takeaway sentence, not a restatement of the ticket) with badges such as **Approval #1**, **Draft #1** or **3 blockers**; open a row for "Did / Recommends / Blockers" and the facts it checked.

**Why:** my first versions were accurate but crowded. Layering and links turn the report from something to *read* into something to *act on*.

---

## 8. The flair, and why it's there

| Element | Where | Purpose |
|---|---|---|
| **Bulldog mascot** (our own drawing, three moods) | Peeking over the bank card (smiles when nothing waits on me, alert when something does or a run is going, wiggles on hover); alert in the empty conversation; **asleep "z z"** on an empty desk; hopping on resolved tickets | Gives the shop a friendly face and reacts to what's happening, so empty and finished states feel warm instead of blank |
| **Clocktower logo + Gothic skyline** | Masthead | A sense of place: New Haven, stone and spires |
| **Sparkles and stars** | Masthead, ✦ by "Shift report", ✦ on the balance chip, the certificate | A light celebratory accent that ties the page together |
| **Blue confetti** | Small burst on approval; big burst when a ticket is resolved | Rewards the human decision, which is the point of the whole system |

---

## 9. Why it feels special for the people using it

- **It feels like a place, not a tool.** The clocktower, the skyline and a bulldog peeking over the cash card make it *our* shop on Chapel Street. People are more careful and more engaged with something that feels like theirs.
- **The agents feel like a team you can watch.** Seeing Inventory "counting stock on the shelves," Accounting "writing a payment slip for you," and lines flowing between cards turns an invisible chain of AI calls into coworkers at work. It builds trust because nothing is hidden: every tool result is one click away.
- **It respects the human's role.** Language like "Your desk," "Sign as…," payment slips and a signed certificate tells me my judgment matters, and the system never moves money without me.
- **Small rewards for real decisions.** The balance chip popping in, the stamp landing, confetti and a happy bulldog give a moment of satisfaction exactly when I finish something, which makes the work feel complete.
- **Calm when idle, lively when working.** Motion only shows up when something is happening, so the page is restful to look at and still makes "the team is busy" obvious.
- **It never makes me hunt.** Big headline numbers, a to-do list that takes me straight to the right slip or draft and checks itself off, and toasts that confirm what changed all save time and reduce mistakes.
- **It's kind to everyone.** Icons plus labels, readable contrast, keyboard focus rings, a layout that works on a phone, and decorations that switch off for reduced-motion users mean the delight never costs anyone usability.

---

## 10. How the design evolved (my feedback → the change)

| I asked for… | What changed |
|---|---|
| A working board for the 6 requirements | Ticket list, Run button, live agents, RESOLVED, summaries, approvals, checking balance |
| "Make it look good… real people like it" | Masthead + bank card, work orders with progress, stage + stepper, org-chart team, chat conversation, payment slips, shift report, toasts |
| "Bulldogs, Yale landscape, clocktower, blue confetti, sparkles and stars" | Original bulldog mascot, clocktower logo, Gothic skyline, twinkling sparkles, confetti bursts |
| "Agents should look different when reading… resolved tickets designed more… more creative while running" | Thinking / Reading / Writing / Handing-off states, the run bar, spinning clock hands, the Now ticker, the RESOLVED stamp, the Case closed certificate |
| "Shift report is wordy and crowded" | Layered report: the call, numbers, to-do / watch out, one-line team notes |
| "By the numbers is too much" | Three short tiles (Cash left / In stock / Offer price or bill) plus one dropdown |
| "Link my to-dos to the right area" | Clickable to-dos (slip / draft / ticket) with a glow on landing, ✓ Done state, and a Message drafts section with Mark as sent |

---

## 11. Where it lives

- `frontend/src/index.css`, `App.css`: palette, type, layout, motion
- `frontend/src/decor.tsx`: bulldog, clocktower, skyline, sparkles, confetti
- `frontend/src/activity.ts`: agent states and plain-English tool verbs
- `frontend/src/headline.ts`: the 3 "By the numbers" tiles
- `frontend/src/todoLinks.ts`: where each to-do takes you
- `frontend/src/components/`: `CashCard` (bank card), `TicketList` (work orders), `Stepper`, `NowTicker`, `AgentBoard` (team), `ActivityFeed` (conversation), `ApprovalPanel` (your desk), `AgentSummaries` (shift report), `ResolvedCertificate`

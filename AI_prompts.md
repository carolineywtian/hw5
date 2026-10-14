# HW5 — AI Prompts Log

Log of the prompts I typed to my vibe coder (Claude Code) while working through HW5, written in my own words.

---

## Project Context (before Problem 1)

**Prompt 1:**
> for context (i'm just giving you context right now so don't do anything yet) - we are going to build Campus Customs Multi-Agent Operations which is the agentic team that runs the shop. We will need to build 3 pieces that talk to each other: an MCP server, a FastAPI backend with a multi-agent team, and a React dashboard so a human can watch the agents at work and approve requests. My agent team has to have full connectivity - any agent may delegate tasks to any other agent to help

**Prompt 2:**
> HEADS UP and correction too. We need to use my POTKEY_API_KEY for AI Calls. We need to use ONLY gpt-6-luna through Portkey for every agent. Multi-agent chats burn tokens fast and points will be deducted if any other model shows up in my code or runs

**Prompt 3:**
> yes let's use gpt-6-luna for everything in HW5

---

## Problem 1: Vibe Coder Prompts

**Prompt:**
> Create AI_prompts.md and keep it updated as I work through HW5. This file is the log of what I typed to you / my vibe coder. Each problem has to be described to my vibe coder in my own words.
>
> We need to put 1 section for each problem and each section must have:
>
> * problem number and title
> * at least 1 prompt I typed in my own words as much as possible
> * 1 follow-up prompt if I needed it and 1 sentence on what was lacking after the first

**Follow-up prompt:** None needed.

**What was lacking after the first prompt:** N/A. The first prompt was enough to create the log.

---

## Problem 2: Study the Campus Customs Database

**Prompt:**
> Problem 2: Study the Campus Customs database
>
> Open data/campus_customs.db and look through every table and its fields. Copy the original file to data/campus_customs_new.db (later problems will update that working copy)
>
> Study the 3 open tickets so you see how they will link to the other tables
>
> Start output/harness.md
>
> For each table, list the fields and 1 short line on why that table matters for the agents. BTW we will keep on growing this harness file in later problems

**Follow-up prompt:**
> let's start over for this part and clear all the data out of hw5 and i'll re put the right data.zip in

> ok data.zip is in hw5 now - can you check

> let's unzip data.zip so we have data/campus_customs.db - that file is the original shop database. Can we confirm that the tables include desk, tickets, inventory, pricing, vendors, leases, cash_accounts, payments, and invoices

> amazing thanks - lets check the 3 open tickets in problem 2 now before proceeding

**What was lacking after the first prompt:** The HW5 folder had no `data/` folder yet, and the database my vibe coder found in Downloads got moved mid-copy, so I had to put the correct `data.zip` into HW5 myself.

---

## Problem 3: Build the MCP Server

**Context prompt (sent before Problem 3):**
> Okay thanks - also my tools will update the databse as the tickets get resolved. so for context before we proceed (don't need to do anything now but for later), we need to make a copy of the database file called data/campus_customer_new.db and point my MCP server and backend at that working copy. We need to keep campus_customs.db untouched so that I can reset when I want to restart resolving the tickets

> yes, just to confirm, you made the copy and called it data/campus_customs_new.db right?

**Prompt:**
> Problem 3: Build the MCP Server
>
> Write an MCP server in mcp_server/ using FastMCP. This will talk to data/campus_customs_new.db -> in this problem, we don't have to connect or run it
>
> Ever agent in HW5 uses the tools in this MCP server. I will add more tools to it later, but right now, write 3 tools I know I will need for the tickets in the database
>
> You need to keep the name very clear and only us info in the database. Never invent any data

**Follow-up prompt:**
> In output/harness.md, we need to list each of my 3 MCP tools. For every tool, include:
>
> * Which table it reads
> * Which ticket it helps unlock (101, 102, or 103)
> * 1 sentence on why that tool is the right one for that ticket
>
> Vague lines like "reads inventory" score low - need to tie the tool to the ticket


> We also need to add a short mcp_server/README.md file that explains what the MCP server is for, which database file it uses, and the 3 tools it has

**What was lacking after the first prompt:** The harness only had a general table of the tools, so it didn't tie each tool to the specific tables it reads and the ticket it unlocks.

---

## Problem 4: Add the MCP Server to the Vibe Coder and Test Each Tool

**Prompt:**
> Problem 4: Add the MCP server to vibe coder and test each tool
>
> Add my MCP server to this project so you (Claude - my favorite vibe coder) can call the tools. Save the connections JSON text in .mcp.json at the project root

**Follow-up prompt:**
> Can you help me start a new Claude session with HW5 as its folder and the respective steps


> so can we continue now?

> Okay also just confirming - is the connection JSON text in .mcp.json at the proejct root (or however you save local MCP server lists)

> Now that you are connected, let's test each of my 3 MCP tools. Save the evidence in output/mcp_smoke.json and for every tool, we need to include:
>
> * the prompt I asked you (my vibe coder)
> * the toold name
> * the tool output -> btw this must match values in data/campus_customs_new.db

> what did you put for the prompt that I asked you in all of these

> what question or prompt would be good to ask for each tool

> please use my prompts below and add that to what we already have:
> 1. get_open_tickets
> What tickets are open at Campus Customs right now, and what inventory, invoice, or lease is each one linked to?
>
> 2. check_stock_and_price
> For ticket 103, how many CC-HOOD-NAVY hoodies in size M do we have in stock? What’s the unit cost and list price?
>
> 3. get_cash_and_bills
> For ticket 102, how much cash does the shop have? What’s left after paying the rent and open invoice?

**What was lacking after the first prompt:** The vibe coder only loads `.mcp.json` when a session starts in that folder, and this session started in `AI Foundations/`, so it couldn't call the tools yet. Later, the smoke test reused one shared prompt for all 3 tools, so I wrote a specific question for each tool.

---

## Problem 5: Build the Agent Team and Grow the MCP Tools

**Prompt:**
> Problem 5: Build the agent team and grow the MCP tools
>
> Build the agentic team for Campus Customs using PydantiCAI:
>
> * Boss - reads each ticket, decides who should work on it, makes final calls
> * Inventory - checks stock by SKU and size, spots shortfalls, figures out which vendor can restock
> * Accounting - watches cash and invoices, checks margins, and prepares payments or purchase orders for human approval
> * Facilities - handles shop space side (leases, rent, etc)
> * Customer Service - drafts messages for customers
>
>
> Include prompts, models and agent loops so they can delegate work to each other with full connectivity. Put agent prompts in backend/prompts/ - one file per agent. Put data types in backend/models.py and the agent files under backend/
>
> Make sure five roles are clear. Use PORTKEY_API_KEY. Use only gpt-6-luna for every agent
>
> Write each prompt in your own words with the shop rules that the agent needs. More detailed prompts that cover all aspects of an agent's work and scope will score higher - do not make it a short generic prompt. we need detail

**Follow-up prompt:**
> We also need to add any tools that the agents need to my MCP server so they can work on the open tickets. Shop facts come from the MCP server over data/campus_customs_new.db. remember we can not invent a 2nd shop-tools layer that bypasses MCP
>
> Wire the agents so they append to output/audit_trail.json as they run -> For each agent-loop step, record enough to audit later. Append to this file and do not wipe it each run

> In output/harness.md, list each agent and each MCP tool (including the ones I added in this problem) along with which table the tool uses. Also we need to add a short safety section: the guardrails a real business would want when agents touch real customers and real money, plus limits that keep token use in check
>
> Also update mcp_server/README.md so the tool list matches what I have now

> thanks for catching that error - can you check for any other errors

**What was lacking after the first prompt:** The agents had no way to see what we already owe a vendor and nothing recorded a human's approval, so tickets could never be finished, and none of the agent-loop steps were saved for auditing. After that, the harness and README needed one up-to-date list of agents, tools and tables, plus a safety section.

---

## Problem 6: Plan the Three Tickets

**Prompt:**
> Problem 6: Plan the three tickets
>
> Before we wire the backend, write down what the expectation is that the team would do on each open ticket. Build output/desk_tickets.html - a page I can double-click on with one tab per ticket (101, 102, 103)
>
> Also add empty Cash and Reflection tabs for later problems (can leave blank for now). On each ticket tab, fill an EXPECTED section only (leave room for an ACTUAL section that we will fill in after we run the agents.
>
> For each ticket's EXPECTED section, write in your own words:
>
> * who the Boss should call first and why
> * all the agent delegations to expect - not "Boss called everyone"
> * which MCP tools are expected that run to use
>
>
> Plans that send every specialist on every ticket will score slow. We will need to compare this plan to what actually happens when our agents resolve the 3 tickets

**Follow-up prompt:**
> ok - can we check if these scenarios run if the tickets are not run in order? does the tickets always have to run in order

> can you explain why it only works when 103 is last? what do you recommend? i don't think my professor specified but i want this to run like a real life scenario

> yes go ahead and make the change but please make a note of that in all of my logs of how we structured this

> what did it mean when it says " rent sometimes not covered"

> okay we might have to come back to this rule but lets go to problem 7 now

**What was lacking after the first prompt:** The plan assumed the tickets run 101 → 102 → 103, so it didn't show what happens to the shared cash checks (and the ticket 103 restock decision) when they run in a different order.

**How we structured the fix (design note):** Testing all 6 run orders showed the cash check only subtracted payments that were already *queued*, so the $264 hoodie restock for 103 looked affordable whenever 103 ran before the rent or invoice was queued. That left the shop $104 short in 4 of 6 orders. To make it work like a real business, we changed it to decide with **available cash** (cash − every known bill, queued or not − pending purchase orders), with payment priority rent → overdue invoices → other invoices → purchase orders. The MCP server now **refuses purchase orders that don't fit** and never refuses rent or invoices (it escalates instead). After the change, all 6 orders give the same result: $160 available, no restock, and a low-cash warning. This is recorded in `output/harness.md` ("Order-Independent Cash Rule"), `output/desk_tickets.html` (design note on every tab), `mcp_server/README.md` ("Cash rule"), `AGENTS.md`, and the Accounting, Boss and Facilities prompts.

---

## Problem 7: Backend Routes

**Prompt:**
> Problem 7: Backend Routes
>
> My React frontend dahboard (which will be the next problem) needs a backend that it can call. In backend/main.py, use FastAPI and add routes that do the below:
>
> * Return the 3 tickets and whether each is open or resolved
> * Take ticket ID and run agent team on the ticket
> * Return recent agent events so the board can refresh - this should include what each agent said and which tools they used
> * Approve a payment or purchase after a human clicks approve -> note: agents only prepare the pay, this route is what actually changes cash
> * return the current checking balance from cash_accounts
> * reset database to original values when I want to try a fresh run

**Follow-up prompt:**
> From the backend/ folder, we need to start the server with:
> uvicorn main:app --reload --port 8000
>
> this will turn on my backend at http://localhost:8000 so the frontend dashboard can call those routes

> sorry - my code actually says --reload in it so can we do that

> In output/harness.md, we need to list each route in 1 line -> what URL and what is does

**What was lacking after the first prompt:** The first prompt didn't say which port or start command the dashboard expects, so the vibe coder picked port 8005 (8000 was busy with the old hw4 server) instead of the required `--reload --port 8000`.

**Design notes:** All routes reach shop data through the MCP tools, and reset is a file copy. A new read-only `list_tickets` tool was added because no tool listed resolved tickets. Approving a purchase order now pays the vendor, matching "this route is what actually changes cash". Runs go one ticket at a time. After the follow-up, the old hw4 server holding port 8000 was stopped with my OK, and the backend runs at http://localhost:8000. It first ran without `--reload` (my `AGENTS.md` rule), then I switched it to **`--reload`** to match my course code. It's still one server; reload only watches backend `.py` files, so saving one mid-run would cut that run off.

---

## Problem 8: Agent Dashboard

**Prompt:**
> Problem 8: Agent dashboard
>
> Build the frontend dashboard in frontend/ with React + Vite + Typescripts. This page needs to call the routes I built in Problem 7. At minimum the board needs to:
>
> * list all 3 tickets
> * let me pick 1 ticket and start the agent team on it
> * show each agent and what they are saying or doing while the ticket runs
> * mark a ticket RESOLVED when the run finishes
> * show short summary of what each agent did on that ticket
> * let human approve a pay or purchase when asked
> * show checking balance (this should go down after an approved pay)

**Follow-up prompt:**
> yes please stop hw4 and use the default port for hw5

> We need to make the dashboard look good. Please be creative with the layout and feel to make sure real people like it.

> add some flare to the design, some bulldogs, some yale landscape icons, some clocktower logos, some blue confetti, some sparkles and stars

> I think this has been done already but lets confirm the front end talks to my backend at http://localhost:8000 and on the backend, allow the Vite page origin so the browser is allowed to call those routes.

> Yes it was testing it originally but we can restart the board with: npm run dev
> I want to pick tickets and watch the agents when the React desk is open in my browser

> Can we also design the agents to show differently design wise when reading and also design the resolved tickets more. we can add more creative designs throughout the page as agents as running too

> relaunch it

> The shift report is very wordy and crowded - let's design this out more to highlight the main pieces from the Boss and structure it better so it's easily digestible for the reader

> the by the numbers section is too much and a little confusing - can you simplify the headline boxes before the dropdown to be more easily readible and short/sweet

> can you link my to do's in the to do list and bring me to the respective area if i were to click it - for ex: Approve should bring me to the area where I should be approving

> Write output/design.md with what I chose for the dashboard look (layout, how agents read differently, how resolved tickets and cash show up) and why
>
> Also include notes about how my creative choices make it feel special for humans to enjoy using

> can you check for errors in problem 8

**What was lacking after the first prompt:** My old hw4 frontend was still running on port 5173, so the HW5 dashboard couldn't use its default port until I asked the vibe coder to stop hw4. The first version also worked but looked plain, so I asked for a more creative, people-friendly design (masthead + bank card, org-chart team view, chat-style conversation, payment-slip approvals, shift report).

**Design decision (asked by the vibe coder):** "Mark RESOLVED when the run finishes" conflicted with our rule that a ticket can't be resolved while a payment waits for a human. I chose **"After run + approvals"**: a run that needs no approval ends RESOLVED; otherwise the ticket shows WAITING FOR APPROVAL and turns RESOLVED when I decide its last pending request (the backend marks it resolved through MCP).

---

## Problem 9: Resolve the Tickets

**Prompt:**
> Problem 9: Resolve the tickets
>
> Before testing the agents on a full run over the 3 tickets, reset the working databse data/campus_customs_new.db again so we can start clean.
>
> Note the starting checking balacne then run all 3 tickets (101, 102, 103) until each is resolved
>
> Open output/desk_tickets.html from Problem 6. On each ticket tab, fill the ACTUAL section from this run: which agents worked, what they delegated, and which tools they used. We need to keep the EXPECTED section so we can compare the 2

**Follow-up prompt** (answer to the vibe coder's question about who approves):
> for this run, Claude can approve as me but usually we want to let a human approve a pay or purchase when asked

> Can I approve through my claude or I have to do it on my website frontend?

> okay since problem 9 took so long, we need to redo it and rerun everything I typed under problem 9. This time, ask me for approval requests but give me good context so I can understand bc im a human and i will provide instruction without any human mistakes hopefully
>
> Also on the Cash tab of the same output/desk_tickets.html, itemize the money:
>
> * starting checking balance (after the reset)
> * for each ticket: how cash changed when that ticket resolved, and why (which pay / purchase, dollar amount)
> * ending checking balance - this must match cash_accounts in the working database
>
>
> BTW WRONG CASH math loses points (rmemeber when i told u earlier that the cash math is really important) - please check all of this
>
> Also save:
>
> * output/resolved_tickets.json - for each ticket: id, final status, short outcome, what each agent contributed, adn any human approvals
> * output/resolved_board.html - a page I can double click with a screenshot of my React board for each resolved ticket (101, 102, 103)
>
>
> Append real runs to output/audit_trail.json. FInish output/harness.md so it covers tables, MCP tools, the 5 agents, API routes, the dashboard, and safety rules

**Rerun notes:** For each ticket, I answered the vibe coder's approval question in chat: Approve #1 ($840 invoice), Approve #2 ($2,400 rent), and Approve #3 (8 × $49.30 discount, after the Boss escalated over the 10-unit rule). Checking went $3,400 → $2,560 → $160 → $160, matching `cash_accounts` (verified against the DB, the audit trail and the API).

> i sent now for case 101

(I marked draft #1 to Tauhid Zaman as sent on the dashboard myself; the vibe coder confirmed it in the DB and audit trail and updated the files.)

> If i've approved 49.30, can you update the draft for me to review

(There was no way to edit a draft through MCP, so the vibe coder added a human-only MCP tool `revise_customer_message` and the route `POST /api/messages/{id}/revise`. Draft #2 now states 8 × $49.30 = $394.40 and is still a draft for me to review.)

> Okay so everything is good to go now for problem 9 right?

> yes please send it

(Draft #2 to Yale AI Club was marked sent, signed "Caroline Tian (via Claude)", audit #448.)

> in this case, I decided in the new draft so to do item 3 should be marked done too right?

(To-do 3 is a judgment step with no database record, so the board couldn't tick it automatically. The vibe coder added a **Mark done** button for those steps, and I tick it myself on the board.)

**What was lacking after the first prompt:** "Until each is resolved" needs a human to approve each payment or purchase, and the prompt didn't say who should do that, so I clarified that Claude could approve as me for this run only.

**Run notes:** Reset → $3,400 starting balance → 101, 102 and 103 run for real on gpt-6-luna → each approval made as Caroline Tian → all 3 resolved, ending at $160. One stalled model request in 101 (10-minute SDK timeout) led to a 2-minute request timeout being added before 102. The ACTUAL sections were filled from the audit trail, and the EXPECTED sections were left unchanged.

---

## Problem 10: Reflection

**Prompt:**
> Problem 10: Reflection
>
> Open output/desk_tickets.html and fill the Reflection tab. Answer in my own detailed and thorough answer:
>
> * How would you evaluate the performance of the agents on each ticket and why?
> * For each ticket, how did ACTUAL compare to EXPECTED plan that I wrote earlier?
> * What would have been simpler as 1 agent with tools and why?
> * Describe 3 NEW problems Campus Customs might face that this agent team could solve with the tools that I built -> label them by 1, 2, 3
> * Describe 3 NEW problems Campus Customs might face that this agent team could NOT solve with the tools I built and explain the tools and agents you would need to solve them -> label them by 1, 2, 3
>
> NOTE that we must tie every answer to THIS app and the 3 tickets that I ran. Use the ticket tabs and Cash tab on the same page as my evidence.

**Follow-up prompt:**
> I need to make sure these are not generic / general AI essays. We need to include Campus Customs details to make sure that I can get a high score

**What was lacking after the first prompt:** The first reflection read too much like a general AI essay. I asked for it to be rewritten with Campus Customs specifics: the agents' exact quotes, timestamps, record IDs, names, aisles and the dollar math from the Cash tab. (While gathering evidence, the vibe coder found ticket 101's time listed as 24 s in two places and 25 s in another; the exact time was 24.5 s, so all were corrected to 25 s.)

---

## Final Check (before submission)

**Prompt:**
> before we go to the submission piece, can we do a full run through of everything to ensure no errors

**Follow-up prompt:** None needed.

**What was lacking after the first prompt:** N/A. The audit covered the running system, the HW5 rules, data integrity, the code (with all offline test suites rerun on scratch copies) and every deliverable. It found only small doc issues: two stale "(later)" HTML comments and an unused style on the plan page, and the harness tool table listing row 15 before row 14. All were fixed.


---

## After the Final Check (questions before submitting)

> Okay lets save all of this - i need to step away so i need to submit later today but this looks good for now. I appreciate u Claude

(Everything was already saved on disk; the vibe coder also made a backup zip, `HW5_backup_2026-10-11_1143.zip`, and saved a note to pick up the submission later.)

> can we make a note of the 103 being marked as resolved but technically isn't? i'm having trouble understanding this caveat? is it a trap that requires me to manually approve?

(Clarified: 103 is genuinely resolved. The discount decision is complete, nothing is pending, the customer was told, and no approval is needed. The 12-hoodie restock was deliberately deferred and would be a new ticket later. A plain-language note was added to the plan page, `resolved_tickets.json` and the harness.)

> where does it say the follow up on the screen though

> okay so to confirm, the agent can't resolve 103 by itself? but i can manually confirm and resolve it right?

> what does it show before i approve it?

(The vibe coder rebuilt the exact moment before the approval on a scratch copy and screenshotted the board. Real data was untouched. It also found two small UI bugs on escalated tickets: the Run button stays enabled, and the hint text doesn't say the ticket is waiting on me.)

> yes please fix the bugs

(Fixed in `frontend/src/App.tsx`: Run is disabled on an escalated ticket that has a request waiting on Your desk, and the hint now tells me which request to decide. Verified with and without a pending request.)

> does 103 count as resolved if we didnt take out any money?

**Answer I got (and why 103 is resolved even though no money moved):**
- **A ticket resolves when every decision on it is made, not when money moves.** The system refuses to mark a ticket resolved while any request is still waiting on a person. Ticket 103 has **0 pending requests**; it resolved automatically right after I approved request #3 (status history: open → in_progress → **escalated** by the Boss → **resolved** by "human: Caroline Tian (via Claude)" at 11:13:34 AM).
- **Ticket 103 asked for a price, not a payment.** Yale AI Club wanted a bulk discount. The only thing on my desk was **request #3, a price override**: sell the **8 in-stock** CC-HOOD-NAVY size M hoodies at **$49.30 each** (15% off the $58 list, above the $22 cost), **8 × $49.30 = $394.40**. Approving a price changes what the club will pay *us*; nothing leaves our checking account.
- **No money moving is the correct result.** If cash had gone down on 103, that would be a bug: the shop would be paying the customer for its own discount. The $394.40 is money the shop will **receive** when the club buys the 8 hoodies. It isn't in checking yet because the app can't record incoming sales (a gap my Reflection names in Q5 #1).
- **The one thing that *would* have cost money wasn't done on purpose:** the **~$264 restock** for the other 12 hoodies (12 × $22) was **not ordered**, because only **$160** was available after the invoice and rent. The club was told we'd follow up. That restock would be a **new ticket** later, not unfinished work on 103.

| Ticket | What needed deciding | Kind | Cash effect |
|---|---|---|---|
| 101 | Pay Bulldog Print Co invoice 501 | Payment out | −$840.00 ($3,400 → $2,560) |
| 102 | Pay rent on lease 1 to Elm City Properties (due Sept 2) | Payment out | −$2,400.00 ($2,560 → $160) |
| **103** | Bulk discount for Yale AI Club (request #3) | **Price approval** | **$0.00** (stays $160) |

**Checked in the database:** request #3 approved; **0 payments** tied to ticket 103; **0 pending** requests; ticket 103 **resolved**; checking **$160.00** = $3,400 − $840 − $2,400 − $0. The **Cash** tab in `output/desk_tickets.html` already shows 103's row as **$0.00**, with the note that price approvals don't move cash.

> yes please explain all this in my log

> okay lets do the submission now - can you first run through everything to ensure that i get 100%

(Every requirement from Problems 1–10 was rechecked: 33/33 pass. One risk was found and fixed: `output/mcp_smoke.json` from Problem 4 no longer matched the working DB after the tickets were resolved, so a `recheck_after_problem_9` section was added that re-runs the same 3 MCP tools against the current DB. All 12 values match, and the original evidence was kept.)

---

## Problem 11: Submit to GitHub

**Prompt:**
> Problem 11: Submit to Github
>
> Before pushing anything, make sure the expected file layout is according to the image and that I have all those files accurately
>
> Push my code to a public GitHub repository so grader can clone it. I need to submit the repo URL to Canvas, and also put it in output/github_url.txt. Do not push my real .env to the GitHub repo. DO include both database files under data/ (the original and my working copy) so graders can run my app easily.
>
> can we also check that the README should explain: copy original DB to the working copy when you need a clean run, start MCP server, start FastAPI backend, start React board, reset the DB before a full 3-ticket run

(I also attached a screenshot of the expected file layout.)

**Follow-up prompt** (answer to the vibe coder's question about the repo name):
> hw5

**What was lacking after the first prompt:** The prompt didn't name the repository, so I chose "hw5" to match the folder in the expected layout.

**Submission notes:** The layout check found `.env.example`, `.gitignore`, `README.md` and `output/github_url.txt` missing; all were created. `.mcp.json` was switched from absolute Mac paths to relative ones so it works after cloning. The real `.env` (it lives outside the repo) and `data.zip` were excluded; both databases were included. A secret scan of the staged files found no key. The repo is https://github.com/carolineywtian/hw5.

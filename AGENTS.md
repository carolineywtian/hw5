# HW5 Instructions

## API and model (overrides root AGENTS.md for HW5)

- Use ONLY the `gpt-6-luna` model through Portkey for every agent and every AI call in HW5.
- Use the `PORTKEY_API_KEY` stored in the root `.env` file.
- No other model name may appear anywhere in HW5 code, configs, or runs. Points are deducted otherwise.
- Define the model name once in a single config constant; no fallback models and no SDK default models.

## Database

- MCP server and backend read/write ONLY `data/campus_customs_new.db` (working copy).
- Never write to `data/campus_customs.db`; it is the original, kept for resets (`cp data/campus_customs.db data/campus_customs_new.db`).
- Tools return only what is in the database. Never invent data.
- Cash decisions are order-independent: use available cash = cash − every known bill (unpaid invoices + rent due within 30 days, queued or not) − pending purchase orders. Priority: rent → overdue invoices → other invoices → purchase orders. The server refuses POs that don't fit; rent/invoices are never refused (escalate instead).

## Environment

- Python venv: `HW5/.venv` (dependencies in `requirements.txt`).
- MCP server `campus-customs` is registered in `.mcp.json`.
- Backend API: from `backend/`, run `../.venv/bin/uvicorn main:app --reload --port 8000` (http://localhost:8000). HW5 uses `--reload` to match the course code (user's choice, overriding the workspace no-reload rule for HW5). Only one server at a time; stop it by terminating the whole process tree (reloader + server). Don't save `.py` files during an agent run.

## Prompt log

- Keep `AI_prompts.md` updated after every prompt: one section per problem with the problem number + title, the user's prompts copied verbatim, and any follow-up prompt with 1 sentence on what was lacking after the first.
- Keep growing `output/harness.md` as problems add tables, tools, and agents.

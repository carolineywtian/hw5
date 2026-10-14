"""Model, Portkey, database, and guard-rail settings for the Campus Customs team.

Every agent gets its model from build_model(). MODEL_NAME is a hard-coded
constant on purpose: HW5 allows exactly one model, so it is never read from an
environment variable that could swap it out.

gpt-6-luna needs the OpenAI Responses API for function tools through Portkey,
so the agents use OpenAIResponsesModel.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from openai import AsyncOpenAI
from pydantic_ai.models.openai import OpenAIResponsesModel
from pydantic_ai.providers.openai import OpenAIProvider

os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

BACKEND_DIR = Path(__file__).resolve().parent
HW5_DIR = BACKEND_DIR.parent
PROMPTS_DIR = BACKEND_DIR / "prompts"
# Shop data is reached ONLY through this MCP server (it reads/writes data/campus_customs_new.db).
MCP_SERVER_FILE = HW5_DIR / "mcp_server" / "server.py"
# Every agent-loop step is appended here; the file is never wiped.
AUDIT_TRAIL_FILE = HW5_DIR / "output" / "audit_trail.json"

# PORTKEY_API_KEY lives in the root .env (AI Foundations/.env). Nearest .env wins.
for folder in [HW5_DIR, *HW5_DIR.parents]:
    if (folder / ".env").exists():
        load_dotenv(folder / ".env", override=False)

# The ONLY model allowed in HW5. Do not add fallbacks or read this from the environment.
MODEL_NAME = "gpt-6-luna"
PORTKEY_BASE_URL = "https://api.portkey.ai/v1"

# Guard rails: multi-agent chats burn tokens fast.
MAX_DELEGATION_DEPTH = 3          # Boss -> A -> B -> C, no deeper
MAX_DELEGATIONS_PER_TICKET = 8    # total hand-offs across the whole team for one ticket
MAX_MODEL_REQUESTS_PER_TICKET = 40  # shared across every agent working the ticket
REQUEST_TIMEOUT_SECONDS = 120.0   # per model call; a stuck call is retried instead of hanging


def require_api_key() -> str:
    key = os.getenv("PORTKEY_API_KEY", "").strip()
    if not key:
        raise RuntimeError("PORTKEY_API_KEY is missing. Put it in the root AI Foundations/.env file.")
    return key


@lru_cache(maxsize=1)
def build_model() -> OpenAIResponsesModel:
    """The single gpt-6-luna model (via Portkey) shared by all five agents."""
    client = AsyncOpenAI(
        api_key=require_api_key(),
        base_url=PORTKEY_BASE_URL,
        default_headers={"x-portkey-provider": "openai"},
        # A normal step takes seconds. In Problem 9 one request stalled and the SDK's
        # default 10-minute timeout froze ticket 101; fail fast and retry instead.
        timeout=REQUEST_TIMEOUT_SECONDS,
        max_retries=2,
    )
    return OpenAIResponsesModel(MODEL_NAME, provider=OpenAIProvider(openai_client=client))

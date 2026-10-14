"""Append-only audit trail for every agent-loop step: output/audit_trail.json.

The file is a JSON array. Each team event (ticket start, agent start, every
agent-loop step, every delegation, agent finish, ticket finish) is appended
as one entry. Existing entries are never removed: each write reads the file,
adds the new entry, and atomically replaces the file. If the file is
unreadable, it is moved aside (never deleted) and a new array is started.
"""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import config

_lock = threading.Lock()


def _load(path: Path) -> list[dict]:
    if not path.exists() or path.stat().st_size == 0:
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass
    # Keep the unreadable file for inspection instead of overwriting it.
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path.rename(path.with_name(f"{path.stem}.unreadable-{stamp}{path.suffix}"))
    return []


def append_audit(entry: dict[str, Any]) -> dict[str, Any]:
    """Append one entry to the audit trail and return it (with audit_id and logged_at)."""
    path: Path = config.AUDIT_TRAIL_FILE
    with _lock:
        path.parent.mkdir(parents=True, exist_ok=True)
        entries = _load(path)
        record = {
            "audit_id": (entries[-1].get("audit_id", len(entries)) + 1) if entries else 1,
            "logged_at": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            **entry,
        }
        entries.append(record)
        tmp = path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(entries, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
        os.replace(tmp, path)
    return record


def read_audit() -> list[dict]:
    """Every audit entry, oldest first (read-only; never modifies the file)."""
    path: Path = config.AUDIT_TRAIL_FILE
    with _lock:
        if not path.exists() or path.stat().st_size == 0:
            return []
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return []
    return data if isinstance(data, list) else []

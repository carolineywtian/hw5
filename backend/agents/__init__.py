"""Registry of the five Campus Customs agents (full mesh: each can delegate to all others)."""

from agents import accounting, boss, customer_service, facilities, inventory

REGISTRY = {
    m.SPEC.name: m for m in (boss, inventory, accounting, facilities, customer_service)
}

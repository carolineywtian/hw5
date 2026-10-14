// Work out where a Boss "next step" should take you on the board.

export type TodoTarget =
  | { kind: 'approval'; id?: number } // a payment slip on Your desk
  | { kind: 'draft'; id?: number } // a customer message draft on Your desk
  | { kind: 'ticket'; id: number } // another work order

/** Read a next-step sentence and pick its destination (or null if it's just advice). */
export function todoTarget(step: string, currentTicket: number | null): TodoTarget | null {
  const s = step.toLowerCase()
  const num = (re: RegExp) => {
    const m = step.match(re)
    return m ? Number(m[1]) : undefined
  }

  // "Don't order …" / "Do not …" is advice, not an action to click.
  if (/^\s*(do not|don't|avoid|wait)\b/.test(s)) return null

  const otherTicket = num(/ticket\s*#?\s*(\d{3})/i)
  if (otherTicket !== undefined && otherTicket !== currentTicket) return { kind: 'ticket', id: otherTicket }

  if (/\b(draft|message|reply|email)\b/.test(s)) return { kind: 'draft', id: num(/(?:draft|message)\s*#\s*(\d+)/i) }

  if (/\b(approve|reject|sign|pay|payment|request|override|purchase order)\b/.test(s))
    return { kind: 'approval', id: num(/(?:request|override|order|#)\s*#?\s*(\d+)/i) }

  return null
}

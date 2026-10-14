import type { AgentName, TicketStatus } from './types'

export const AGENT_ORDER: AgentName[] = ['boss', 'inventory', 'accounting', 'facilities', 'customer_service']

export const AGENTS: Record<AgentName, { name: string; initials: string; role: string }> = {
  boss: { name: 'Boss', initials: 'B', role: 'Reads the ticket, routes work, makes the final call' },
  inventory: { name: 'Inventory', initials: 'IN', role: 'Stock by SKU & size, shortfalls, restock vendor' },
  accounting: { name: 'Accounting', initials: 'AC', role: 'Cash, invoices, margins; prepares payments for you' },
  facilities: { name: 'Facilities', initials: 'FA', role: 'Leases, rent, landlord obligations' },
  customer_service: { name: 'Customer Service', initials: 'CS', role: 'Drafts honest replies to customers' },
}

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'OPEN',
  in_progress: 'AGENTS WORKING',
  waiting_approval: 'WAITING FOR APPROVAL',
  resolved: 'RESOLVED',
  escalated: 'ESCALATED',
}

export const KIND_LABEL: Record<string, string> = {
  invoice_payment: 'Pay vendor invoice',
  rent_payment: 'Pay rent',
  purchase_order: 'Purchase order (restock)',
  price_override: 'Discount / price override',
}

export const MOVES_CASH = new Set(['invoice_payment', 'rent_payment', 'purchase_order'])

export const money = (n: number | null | undefined) =>
  n === null || n === undefined
    ? '—'
    : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

/** Lifecycle step index: 0 open, 1 team working, 2 your approval, 4 = all done. */
export function stepOf(status: TicketStatus): number {
  switch (status) {
    case 'open':
      return 0
    case 'in_progress':
      return 1
    case 'waiting_approval':
    case 'escalated':
      return 2
    case 'resolved':
      return 4
  }
}

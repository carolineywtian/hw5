import { STATUS_LABEL, stepOf } from '../agents'
import { TICKET_ICON } from '../ticketIcons'
import type { Ticket, TicketStatus } from '../types'

interface Props {
  tickets: Ticket[]
  selectedId: number | null
  activeTicket: number | null
  onSelect: (id: number) => void
}

const TYPE_LABEL: Record<string, string> = {
  customer_order: 'Customer order',
  rent_notice: 'Rent notice',
  price_override: 'Bulk discount',
}

export function TicketList({ tickets, selectedId, activeTicket, onSelect }: Props) {
  return (
    <nav className="orders" aria-label="Tickets">
      <div className="section-head">
        <h2>Work orders</h2>
        <span className="muted small">{tickets.filter((t) => t.state === 'open').length} open</span>
      </div>
      {tickets.map((t) => {
        const Icon = TICKET_ICON[t.type]
        const running = activeTicket === t.id
        const status: TicketStatus = running ? 'in_progress' : t.status
        const step = stepOf(status)
        return (
          <button
            key={t.id}
            id={`order-${t.id}`}
            className={`order ${t.id === selectedId ? 'selected' : ''} order-${status}`}
            onClick={() => onSelect(t.id)}
            aria-pressed={t.id === selectedId}
          >
            <span className="order-icon">{Icon ? <Icon size={20} /> : null}</span>
            {status === 'resolved' && (
              <span className="stamp" aria-hidden="true">
                Resolved
              </span>
            )}
            <span className="order-body">
              <span className="order-top">
                <span className="order-id">#{t.id}</span>
                <span className="order-type">{TYPE_LABEL[t.type] ?? t.type}</span>
              </span>
              <span className="order-subject">{t.subject}</span>
              <span className="order-from">{t.requester}</span>
              <span className="order-progress" aria-label={`Step ${step + 1} of 4: ${STATUS_LABEL[status]}`}>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={`seg ${i < step ? 'seg-done' : i === step ? 'seg-now' : ''}`} />
                ))}
              </span>
              <span className={`order-status s-${status}`}>
                {running ? 'Agents working…' : STATUS_LABEL[status].toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                {t.pending_approvals > 0 && !running ? ` · ${t.pending_approvals} to approve` : ''}
              </span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}

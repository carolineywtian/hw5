import { AGENTS, KIND_LABEL, money } from '../agents'
import { Bulldog } from '../decor'
import { Check, Seal } from '../icons'
import type { AgentName, BoardEvent, BossDecision, Ticket } from '../types'

interface Props {
  ticket: Ticket
  events: BoardEvent[]
  decision: BossDecision | null
}

/** "Case closed" certificate shown on a resolved ticket: what happened and who signed. */
export function ResolvedCertificate({ ticket, events, decision }: Props) {
  const decisions = events.filter((e) => e.event === 'human_decision')
  const resolved = [...events].reverse().find((e) => e.event === 'ticket_resolved')
  const signer = String(resolved?.details?.resolved_by ?? decisions.at(-1)?.details?.decided_by ?? 'the team')
  const when = resolved ? new Date(resolved.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : null
  const consulted = (decision?.agents_consulted ?? []) as AgentName[]
  const drafts = decision?.customer_message_ids?.length ?? 0

  return (
    <section className="certificate" aria-label={`Ticket ${ticket.id} resolved`}>
      <div className="cert-stars" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 90}%`, animationDelay: `${(i % 5) * 0.4}s` }}>
            ✦
          </span>
        ))}
      </div>
      <div className="cert-seal" aria-hidden="true">
        <span className="cert-ring" />
        <Seal size={38} />
      </div>
      <div className="cert-body">
        <div className="cert-eyebrow">Ticket #{ticket.id} · {ticket.requester}</div>
        <h3 className="cert-title">Case closed</h3>
        <p className="cert-sub">“{ticket.subject}” is resolved. Every decision on it has been made by a person.</p>
        <ul className="cert-lines">
          {decisions.map((e) => {
            const d = e.details ?? {}
            return (
              <li key={e.id}>
                <Check size={15} />
                <span>
                  {String(d.decision) === 'approved' ? 'Approved' : 'Rejected'} · {KIND_LABEL[e.kind ?? ''] ?? e.kind} ·{' '}
                  <b>{money(Number(d.amount))}</b> to {String(d.payee)}
                </span>
              </li>
            )
          })}
          {drafts > 0 && (
            <li>
              <Check size={15} /> {drafts} customer message draft{drafts > 1 ? 's' : ''} saved for {ticket.requester}
            </li>
          )}
          {consulted.length > 0 && (
            <li>
              <Check size={15} /> Worked by the Boss with {consulted.map((a) => AGENTS[a]?.name ?? a).join(', ')}
            </li>
          )}
        </ul>
        <div className="cert-sign">
          <span className="cert-sig">{signer}</span>
          <span className="cert-sig-label">Signed{when ? ` · ${when}` : ''}</span>
        </div>
      </div>
      <Bulldog size={92} mood="happy" className="cert-dog" />
    </section>
  )
}

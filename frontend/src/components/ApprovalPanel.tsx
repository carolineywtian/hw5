import { useState } from 'react'
import { AGENTS, KIND_LABEL, MOVES_CASH, money } from '../agents'
import { Bulldog } from '../decor'
import { Check, Pen } from '../icons'
import type { AgentName, ApprovalRequest, CustomerMessage } from '../types'

interface Props {
  requests: ApprovalRequest[]
  ticketId: number | null
  checking: number | null
  approver: string
  setApprover: (name: string) => void
  onDecide: (id: number, decision: 'approve' | 'reject') => Promise<void>
  drafts: CustomerMessage[]
  onSend: (id: number) => Promise<void>
}

function memo(r: ApprovalRequest) {
  if (r.kind === 'purchase_order') return `${r.qty} × ${r.sku} (size ${r.size}) at ${money(r.unit_price)} each`
  if (r.kind === 'price_override') return `${r.qty} × ${r.sku} at ${money(r.unit_price)} each`
  if (r.kind === 'invoice_payment') return `Invoice #${r.ref_id}`
  return `Rent, lease #${r.ref_id}`
}

export function ApprovalPanel({ requests, ticketId, checking, approver, setApprover, onDecide, drafts, onSend }: Props) {
  const [busy, setBusy] = useState<number | null>(null)
  const ordered = [...requests.filter((r) => r.ticket_id === ticketId), ...requests.filter((r) => r.ticket_id !== ticketId)]
  const signed = approver.trim().length > 0

  const [sending, setSending] = useState<number | null>(null)
  const send = async (id: number) => {
    setSending(id)
    try {
      await onSend(id)
    } finally {
      setSending(null)
    }
  }

  const decide = async (id: number, d: 'approve' | 'reject') => {
    setBusy(id)
    try {
      await onDecide(id, d)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="desk" id="desk" aria-label="Approvals waiting for you">
      <div className="section-head">
        <h2>Your desk</h2>
        <span className={`count ${requests.length ? 'count-on' : ''}`}>{requests.length} waiting</span>
      </div>
      <label className="signer">
        <Pen size={15} />
        <span className="sr-only">Your name</span>
        <input value={approver} onChange={(e) => setApprover(e.target.value)} placeholder="Sign as… (your name)" />
      </label>
      {!signed && (requests.length > 0 || drafts.some((m) => m.status === 'draft')) && (
        <p className="hint">Sign your name to approve or send. It’s recorded on every payment and message.</p>
      )}

      {requests.length === 0 ? (
        <div className="empty small-empty">
          <Bulldog size={58} mood="sleepy" className="empty-dog" />
          <p>
            <b>No payments to sign.</b> Agents only <i>prepare</i> payments. Anything that moves money lands here for you.
          </p>
        </div>
      ) : (
        <div className="slips">
          {ordered.map((r) => {
            const moves = MOVES_CASH.has(r.kind)
            const other = r.ticket_id !== ticketId
            return (
              <article key={r.id} id={`slip-${r.id}`} className={`slip ${moves ? 'slip-cash' : 'slip-price'} ${other ? 'slip-other' : ''}`}>
                <div className="slip-head">
                  <span className="slip-kind">{KIND_LABEL[r.kind] ?? r.kind}</span>
                  <span className="slip-no">
                    #{r.id} · ticket {r.ticket_id}
                  </span>
                </div>
                <div className="slip-payee">
                  <span className="muted small">{r.kind === 'price_override' ? 'Customer' : 'Pay to'}</span>
                  <strong>{r.payee}</strong>
                </div>
                <div className="slip-amount">{money(r.amount)}</div>
                <div className="slip-memo">
                  <span className="muted small">Memo</span> {memo(r)}
                </div>
                <blockquote className="slip-why">
                  “{r.reason}”
                  <cite>— {AGENTS[r.requested_by as AgentName]?.name ?? r.requested_by}</cite>
                </blockquote>
                <div className={`slip-impact ${moves ? '' : 'no-cash'}`}>
                  {moves && checking !== null
                    ? <>Checking after approval: <b>{money(checking - r.amount)}</b></>
                    : 'Sets the price only. No cash moves.'}
                </div>
                <div className="slip-actions">
                  <button className="btn btn-primary" disabled={!signed || busy !== null} onClick={() => decide(r.id, 'approve')}>
                    {busy === r.id ? 'Saving…' : moves ? 'Approve & pay' : 'Approve price'}
                  </button>
                  <button className="btn btn-quiet" disabled={!signed || busy !== null} onClick={() => decide(r.id, 'reject')}>
                    Reject
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
      {drafts.length > 0 && (
        <div className="drafts" id="drafts">
          <div className="summary-label drafts-title">Message drafts for this ticket</div>
          {drafts.map((m) => (
            <article key={m.id} id={`draft-${m.id}`} className={`draft ${m.status === 'sent' ? 'draft-sent' : ''}`}>
              <div className="draft-head">
                <span className="draft-no">Draft #{m.id}</span>
                <span className={`draft-status ds-${m.status}`}>{m.status === 'sent' ? 'Sent' : 'Not sent yet'}</span>
              </div>
              <div className="draft-to">
                To <strong>{m.recipient}</strong>
              </div>
              <div className="draft-subject">{m.subject}</div>
              <details className="draft-body">
                <summary>Read the message</summary>
                <p>{m.body}</p>
              </details>
              {m.status === 'sent' ? (
                <div className="draft-sent-by">
                  <Check size={14} /> Sent by {m.sent_by}
                  {m.sent_at ? ` · ${new Date(m.sent_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
                </div>
              ) : (
                <button className="btn btn-quiet draft-send" disabled={!signed || sending !== null} onClick={() => send(m.id)}>
                  {sending === m.id ? 'Saving…' : 'Mark as sent'}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

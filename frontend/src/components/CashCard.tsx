import { money } from '../agents'
import { Alert, Check, Clock } from '../icons'
import type { Cash, Ticket } from '../types'

interface Props {
  cash: Cash | null
  lastChange: number | null
  tickets: Ticket[]
  pendingCount: number
}

/** The shop's "bank card": hero balance, a single-hue commitment meter, and three quick stats. */
export function CashCard({ cash, lastChange, tickets, pendingCount }: Props) {
  const committed = cash ? cash.checking_balance - cash.available_cash : 0
  const pct = cash && cash.checking_balance > 0 ? Math.min(100, Math.max(0, (committed / cash.checking_balance) * 100)) : 0
  const low = cash ? cash.available_cash < 500 : false
  const paidTotal = cash?.payments.reduce((s, p) => s + p.amount, 0) ?? 0
  const resolved = tickets.filter((t) => t.state === 'resolved').length

  return (
    <section className="bank" aria-label="Shop cash">
      <div className="bank-hero">
        <div className="eyebrow">Checking balance</div>
        <div className="hero-number" aria-live="polite">
          {cash ? money(cash.checking_balance) : '…'}
        </div>
        {lastChange !== null && lastChange !== 0 ? (
          <div key={lastChange} className={`delta ${lastChange < 0 ? 'down' : 'up'}`}>
            {lastChange < 0 ? '▼' : '▲'} {money(Math.abs(lastChange))} after your last approval
          </div>
        ) : (
          <div className="delta neutral">Moves only when you approve a payment</div>
        )}
      </div>

      <div className="bank-meter">
        <div className="meter-head">
          <span>Committed to known bills</span>
          <strong>{cash ? `${money(committed)} of ${money(cash.checking_balance)}` : '…'}</strong>
        </div>
        <div
          className="meter"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={cash?.checking_balance ?? 0}
          aria-valuenow={committed}
          aria-label="Cash committed to known bills"
          title={cash ? cash.known_bills.map((b) => `${b.kind} → ${b.payee}: ${money(b.amount)}`).join('\n') : ''}
        >
          <div className="meter-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className={`meter-foot ${low ? 'low' : ''}`}>
          {low ? <Alert size={15} /> : <Check size={15} />}
          <span>
            <strong>{cash ? money(cash.available_cash) : '…'}</strong> free after{' '}
            {cash?.known_bills.map((b) => `${b.kind} ${money(b.amount)}`).join(' + ') || 'known bills'}
            {low ? ' (low cash, under $500)' : ''}
          </span>
        </div>
      </div>

      <dl className="bank-stats">
        <div>
          <dt>Tickets resolved</dt>
          <dd>
            {resolved}
            <small>/{tickets.length || 3}</small>
          </dd>
        </div>
        <div className={pendingCount ? 'attention' : ''}>
          <dt>
            {pendingCount ? <Clock size={13} /> : null} Waiting on you
          </dt>
          <dd>{pendingCount}</dd>
        </div>
        <div>
          <dt>Paid out</dt>
          <dd>{money(paidTotal).replace('.00', '')}</dd>
        </div>
      </dl>
    </section>
  )
}

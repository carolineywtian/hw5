import { Alert, Check } from '../icons'
import { stepOf } from '../agents'
import type { TicketStatus } from '../types'

const STEPS = ['Ticket open', 'Team working', 'Your approval', 'Resolved']

/** Ticket lifecycle: Open → Team working → Your approval → Resolved. */
export function Stepper({ status }: { status: TicketStatus }) {
  const step = stepOf(status)
  return (
    <ol className="stepper" aria-label="Ticket progress">
      {STEPS.map((label, i) => {
        const state = i < step ? 'done' : i === step ? 'now' : 'todo'
        const escalated = status === 'escalated' && i === 2
        return (
          <li key={label} className={`step step-${state} ${escalated ? 'step-alert' : ''}`} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="step-dot">{state === 'done' || (i === 3 && step === 4) ? <Check size={13} /> : escalated ? <Alert size={13} /> : i + 1}</span>
            <span className="step-label">{escalated ? 'Escalated to you' : label}</span>
          </li>
        )
      })}
    </ol>
  )
}

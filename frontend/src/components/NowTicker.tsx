import type { NowLine } from '../activity'
import { AGENTS } from '../agents'
import { Arrow, Book, Pen, Spark } from '../icons'

/** One live line on the ticket stage: who is doing what, right now. */
export function NowTicker({ now }: { now: NowLine | null }) {
  const icon =
    now?.activity === 'reading' ? <Book size={15} /> :
    now?.activity === 'writing' ? <Pen size={15} /> :
    now?.activity === 'handing_off' ? <Arrow size={15} /> : <Spark size={15} />
  return (
    <div className={`now now-${now?.activity ?? 'thinking'}`} role="status" aria-live="polite">
      <span className="now-tag">
        <span className="pulse" aria-hidden="true" /> Now
      </span>
      {now ? (
        <span className="now-text" key={`${now.agent}-${now.text}`}>
          <span className={`avatar av-${now.agent}`} aria-hidden="true">
            {AGENTS[now.agent].initials}
          </span>
          {icon}
          <b>{AGENTS[now.agent].name}</b> {now.text}
          <span className="typing" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </span>
      ) : (
        <span className="now-text">The Boss is picking up the ticket…</span>
      )}
    </div>
  )
}

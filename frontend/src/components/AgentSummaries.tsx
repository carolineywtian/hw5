import { AGENT_ORDER, AGENTS, STATUS_LABEL, money } from '../agents'
import { headlineNumbers } from '../headline'
import { Alert, Arrow, Check, Clock, Pen } from '../icons'
import { todoTarget } from '../todoLinks'
import type { TodoTarget } from '../todoLinks'
import type { AgentName, BoardEvent, BossDecision, Fact, TicketStatus } from '../types'

interface Props {
  events: BoardEvent[]
  decision: BossDecision | null
  ticketStatus?: TicketStatus // current status; may have moved on since the Boss finished
  ticketId?: number | null
  onGo?: (target: TodoTarget) => void
  isDone?: (target: TodoTarget) => boolean
  /** Judgment steps with no database record: the human ticks them off (saved per run). */
  manualDone?: Set<number>
  onToggleManual?: (index: number) => void
}

type Report = NonNullable<BoardEvent['output']>

/** Split prose into its first sentence and the rest ("$49.30" and "e.g." don't count as sentence ends). */
function splitLead(text: string): [string, string] {
  const m = text.match(/^(.+?[.!?])\s+(?=[A-Z0-9"“(])(.*)$/s)
  return m ? [m[1], m[2]] : [text, '']
}

const MONEY_LABEL = /amount|cash|price|cost|rent|balance|total|revenue|profit|paid|\$/i

/** Make a fact value readable: 840.0 → $840.00 when the label is about money. */
function fmtValue(f: Fact): string {
  const v = f.value.trim()
  if (/^-?\d+(\.\d+)?$/.test(v) && MONEY_LABEL.test(f.label)) return money(Number(v))
  return v
}

/** Bold the first word of an action ("Approve …", "Review …"). */
function ActionText({ text }: { text: string }) {
  const [first, ...rest] = text.split(' ')
  return (
    <>
      <b>{first}</b> {rest.join(' ')}
    </>
  )
}

function FactsTable({ facts }: { facts: Fact[] }) {
  return (
    <table className="facts-table">
      <tbody>
        {facts.map((f, i) => (
          <tr key={i}>
            <th scope="row">{f.label}</th>
            <td>{fmtValue(f)}</td>
            <td className="facts-src">
              <code>{f.source_tool}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The takeaway sentence: skip an opening that only restates the ticket ("Ticket 101 requests …"). */
function takeaway(summary: string): [string, string] {
  const [first, rest] = splitLead(summary)
  if (rest && /^Ticket\s+\d+\s+(requests|asks|wants|is)\b/i.test(first)) {
    const [second, after] = splitLead(rest)
    return [second, [first, after].filter(Boolean).join(' ')]
  }
  return [first, rest]
}

function TeamRow({ agent, report }: { agent: AgentName; report: Report }) {
  const [lead, rest] = takeaway(report.summary ?? '')
  const approvals = report.approval_request_ids ?? []
  const drafts = report.customer_message_ids ?? []
  const blockers = report.blockers ?? []
  return (
    <details className="team-row">
      <summary>
        <span className={`avatar av-${agent}`} aria-hidden="true">
          {AGENTS[agent].initials}
        </span>
        <span className="team-row-main">
          <span className="team-row-name">{AGENTS[agent].name}</span>
          <span className="team-row-lead">{lead}</span>
        </span>
        <span className="team-row-badges">
          {approvals.map((id) => (
            <span key={`a${id}`} className="badge badge-approval">
              <Clock size={12} /> Approval #{id}
            </span>
          ))}
          {drafts.map((id) => (
            <span key={`d${id}`} className="badge badge-draft">
              <Pen size={12} /> Draft #{id}
            </span>
          ))}
          {blockers.length > 0 && (
            <span className="badge badge-block">
              <Alert size={12} /> {blockers.length} blocker{blockers.length > 1 ? 's' : ''}
            </span>
          )}
          {approvals.length + drafts.length + blockers.length === 0 && (
            <span className="badge badge-ok">
              <Check size={12} /> Reported
            </span>
          )}
        </span>
        <span className="team-row-more" aria-hidden="true">
          Details
        </span>
      </summary>
      <div className="team-row-body">
        {rest && <p className="team-row-rest">{rest}</p>}
        <div className="team-row-cols">
          {(report.actions_taken?.length ?? 0) > 0 && (
            <div>
              <h4>Did</h4>
              <ul>{report.actions_taken!.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}
          {(report.recommendations?.length ?? 0) > 0 && (
            <div>
              <h4>Recommends</h4>
              <ul>{report.recommendations!.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}
          {blockers.length > 0 && (
            <div className="col-warn">
              <h4>Blockers</h4>
              <ul>{blockers.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}
        </div>
        {(report.facts?.length ?? 0) > 0 && (
          <details className="facts-more">
            <summary>Facts it checked ({report.facts!.length})</summary>
            <FactsTable facts={report.facts!} />
          </details>
        )}
      </div>
    </details>
  )
}

/** Shift report: the Boss's call up top, numbers to know, your to-do vs. risks, then one line per agent. */
export function AgentSummaries({ events, decision, ticketStatus, ticketId = null, onGo, isDone, manualDone, onToggleManual }: Props) {
  const reports = new Map<AgentName, Report[]>()
  for (const e of events) {
    if (e.event === 'agent_finished' && e.agent && e.output && e.depth !== 0) {
      reports.set(e.agent, [...(reports.get(e.agent) ?? []), e.output])
    }
  }
  const specialists = AGENT_ORDER.filter((a) => a !== 'boss' && reports.has(a))
  const notCalled = AGENT_ORDER.filter((a) => a !== 'boss' && !reports.has(a))
  if (!decision && specialists.length === 0) return null

  const [headline, detail] = splitLead(decision?.decision ?? '')
  const facts = decision?.key_facts ?? []
  const tiles = headlineNumbers(facts)
  const steps = decision?.next_steps_for_human ?? []
  const risks = decision?.risks ?? []

  return (
    <section className="report" aria-label="Shift report">
      <div className="section-head">
        <h2>
          <span className="star-mark" aria-hidden="true">✦</span> Shift report
        </h2>
        {decision && (
          <span className={`report-status s-${ticketStatus ?? decision.final_status}`}>
            {STATUS_LABEL[ticketStatus ?? decision.final_status]}
          </span>
        )}
      </div>

      {decision && (
        <div className="call">
          <span className="avatar av-boss call-avatar" aria-hidden="true">B</span>
          <div className="call-body">
            <div className="eyebrow">The Boss’s call</div>
            <p className="call-headline">{headline}</p>
            {detail && <p className="call-detail">{detail}</p>}
            {decision.agents_consulted?.length > 0 && (
              <div className="call-crew">
                Worked with
                {decision.agents_consulted.map((a) => (
                  <span key={a} className={`avatar av-${a} mini`} title={AGENTS[a]?.name}>
                    {AGENTS[a]?.initials}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {(tiles.length > 0 || facts.length > 0) && (
        <div className="numbers">
          {tiles.length > 0 && (
            <div className="tiles">
              {tiles.map((t) => (
                <div key={t.label} className={`tile tile-${t.tone}`}>
                  <div className="tile-label">{t.label}</div>
                  <div className="tile-value">{t.value}</div>
                  {t.hint && <div className="tile-hint">{t.hint}</div>}
                </div>
              ))}
            </div>
          )}
          {facts.length > 0 && (
            <details className="facts-more">
              <summary>All {facts.length} facts the Boss used</summary>
              <FactsTable facts={facts} />
            </details>
          )}
        </div>
      )}

      {(steps.length > 0 || risks.length > 0) && (
        <div className="todo-risk">
          {steps.length > 0 && (
            <div className="todo">
              <h3>Your to-do</h3>
              <ol>
                {steps.map((s, i) => {
                  const target = onGo ? todoTarget(s, ticketId) : null
                  const ticked = !target && !!manualDone?.has(i)
                  const done = target && isDone ? isDone(target) : ticked
                  const body = (
                    <>
                      <span className="todo-n">{done ? <Check size={13} /> : i + 1}</span>
                      <span className="todo-text">
                        <ActionText text={s} />
                      </span>
                      {target && (
                        <span className="todo-go">
                          {done ? 'Done' : target.kind === 'ticket' ? `Open #${target.id}` : 'Go'} <Arrow size={13} />
                        </span>
                      )}
                    </>
                  )
                  return (
                    <li key={i} className={done ? 'todo-done' : ''}>
                      {target ? (
                        <button type="button" className="todo-link" onClick={() => onGo!(target)}>
                          {body}
                        </button>
                      ) : (
                        <div className="todo-plain">
                          {body}
                          {onToggleManual && (
                            <button
                              type="button"
                              className={`todo-tick ${ticked ? 'on' : ''}`}
                              aria-pressed={ticked}
                              onClick={() => onToggleManual(i)}
                              title={ticked ? 'Undo' : 'You made this decision: mark it done'}
                            >
                              {ticked ? <><Check size={12} /> Done · undo</> : 'Mark done'}
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ol>
            </div>
          )}
          {risks.length > 0 && (
            <div className="risk">
              <h3>Watch out</h3>
              <ul>
                {risks.map((s, i) => (
                  <li key={i}>
                    <Alert size={15} />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {specialists.length > 0 && (
        <div className="team-notes">
          <h3>Team notes</h3>
          {specialists.flatMap((a) => reports.get(a)!.map((r, i) => <TeamRow key={`${a}-${i}`} agent={a} report={r} />))}
          {notCalled.length > 0 && (
            <div className="not-called-row">
              Not called:
              {notCalled.map((a) => (
                <span key={a} className="ghost-pill">
                  {AGENTS[a].name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

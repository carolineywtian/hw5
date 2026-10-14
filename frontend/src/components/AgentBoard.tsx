import { ACTIVITY_LABEL, deriveTeam } from '../activity'
import type { Activity, AgentView } from '../activity'
import { AGENT_ORDER, AGENTS } from '../agents'
import { Arrow, Book, Check, Clock, Pen, Spark } from '../icons'
import type { AgentName, BoardEvent } from '../types'

function ActivityPill({ v, live }: { v: AgentView; live: boolean }) {
  const a: Activity = !live && v.activity !== 'done' && v.activity !== 'idle' ? 'done' : v.activity
  const icon =
    a === 'reading' ? <Book size={13} /> :
    a === 'writing' ? <Pen size={13} /> :
    a === 'handing_off' ? <Arrow size={13} /> :
    a === 'waiting' ? <Clock size={13} /> :
    a === 'done' ? <Check size={13} /> :
    a === 'thinking' ? <Spark size={13} /> : null
  return (
    <span className={`state state-${a}`}>
      {icon} {ACTIVITY_LABEL[a]}
      {a === 'waiting' && v.waitingOn ? ` on ${AGENTS[v.waitingOn].name}` : ''}
    </span>
  )
}

function Bubble({ v, live, lead }: { v: AgentView; live: boolean; lead: boolean }) {
  if (live && v.activity === 'thinking')
    return (
      <div className="bubble bubble-thinking">
        <span className="typing" aria-label="thinking">
          <i />
          <i />
          <i />
        </span>
        <span className="bubble-detail">{v.detail}</span>
      </div>
    )
  if (live && (v.activity === 'reading' || v.activity === 'writing'))
    return (
      <div className={`bubble bubble-${v.activity}`}>
        <span className="bubble-detail">
          {v.activity === 'reading' ? <Book size={14} /> : <Pen size={14} />} {v.detail}
        </span>
        {v.tool && <code className="bubble-tool">{v.tool}</code>}
        {v.activity === 'writing' && <span className="ink" aria-hidden="true" />}
      </div>
    )
  return (
    <p className={`bubble ${v.latest ? '' : 'bubble-quiet'}`}>
      {v.latest ?? (lead ? 'Ready to read the next ticket and call only the agents it needs.' : 'Not called yet on this ticket.')}
    </p>
  )
}

function AgentCard({ name, v, running, lead = false }: { name: AgentName; v: AgentView; running: boolean; lead?: boolean }) {
  const live = running && v.activity !== 'done' && v.activity !== 'idle'
  const shown: Activity = !running && v.activity !== 'done' && v.activity !== 'idle' ? 'done' : v.activity
  return (
    <article className={`agent ${lead ? 'agent-lead' : ''} act-${shown} ${live ? 'is-live' : ''}`} aria-label={AGENTS[name].name}>
      {live && (shown === 'reading') && <span className="scanline" aria-hidden="true" />}
      <header className="agent-top">
        <span className={`avatar av-${name} ${live ? 'avatar-live' : ''}`} aria-hidden="true">
          {AGENTS[name].initials}
        </span>
        <span className="agent-id">
          <span className="agent-name">{AGENTS[name].name}</span>
          <span className="agent-role">{AGENTS[name].role}</span>
        </span>
        <ActivityPill v={v} live={running} />
      </header>
      {v.askedBy && v.askedBy !== 'boss' && v.activity !== 'idle' && (
        <div className="ribbon">handed off by {AGENTS[v.askedBy].name}</div>
      )}
      <Bubble v={v} live={live} lead={lead} />
      {v.tools.size > 0 && (
        <ul className="tools" aria-label={`${AGENTS[name].name} used`}>
          {[...v.tools.entries()].map(([tool, n]) => (
            <li key={tool} className={`tool ${tool === 'delegate' ? 'tool-delegate' : ''} ${live && tool === v.tool ? 'tool-now' : ''}`}>
              {tool}
              {n > 1 && <b>×{n}</b>}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

export function AgentBoard({ events, running }: { events: BoardEvent[]; running: boolean }) {
  const { views, handoffs } = deriveTeam(events)
  const specialists = AGENT_ORDER.filter((a) => a !== 'boss')
  const bossHandingOff = running && (views.boss.activity === 'waiting' || views.boss.activity === 'handing_off')

  return (
    <section className={`team ${running ? 'team-running' : ''}`} aria-label="The agent team">
      <div className="section-head">
        <h2>The team</h2>
        <span className="muted small">Any agent can hand work to any other. The Boss decides who starts.</span>
      </div>

      <div className="org">
        <AgentCard name="boss" v={views.boss} running={running} lead />
        <div className={`rail ${bossHandingOff ? 'flow' : ''}`} aria-hidden="true" />
        <div className={`specialists ${bossHandingOff ? 'flow' : ''}`}>
          {specialists.map((a) => {
            const busy = running && !['idle', 'done'].includes(views[a].activity)
            return (
              <div key={a} className={`branch ${views[a].activity !== 'idle' ? 'branch-on' : ''} ${busy ? 'flow' : ''}`}>
                <AgentCard name={a} v={views[a]} running={running} />
              </div>
            )
          })}
        </div>
      </div>

      {handoffs.length > 0 && (
        <div className="relay" aria-label="Hand-offs in order">
          <span className="relay-label">Hand-offs</span>
          <ol>
            {handoffs.map((h, i) => (
              <li key={i} className={`hop hop-${h.status}`} title={h.task}>
                <span className="hop-n">{i + 1}</span>
                {AGENTS[h.from].name} <Arrow size={13} /> {AGENTS[h.to].name}
                {h.status === 'done' && <Check size={13} />}
                {h.status === 'running' && <span className="pulse small-pulse" aria-label="in progress" />}
                {(h.status === 'refused' || h.status === 'error') && <em>{h.status}</em>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

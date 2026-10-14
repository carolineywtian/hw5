import { useEffect, useMemo, useRef } from 'react'
import { AGENTS, KIND_LABEL, money } from '../agents'
import { Bulldog } from '../decor'
import { Arrow, Check, Wrench } from '../icons'
import type { BoardEvent } from '../types'

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })

function fmtArgs(args: Record<string, unknown>) {
  return Object.entries(args)
    .filter(([k]) => !['task', 'reason', 'note', 'body', 'updated_by', 'requested_by', 'drafted_by'].includes(k))
    .map(([k, v]) => `${k}=${typeof v === 'string' ? `"${v}"` : JSON.stringify(v)}`)
    .join(', ')
}

function prettyResult(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

export function ActivityFeed({ events, running }: { events: BoardEvent[]; running: boolean }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (running) end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [events.length, running])

  // Match each tool result back to the call that asked for it.
  const results = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of events) for (const r of e.tool_results ?? []) if (r.tool_call_id) m.set(r.tool_call_id, r.result)
    return m
  }, [events])

  const items = events.flatMap((e) => {
    const t = time(e.at)
    switch (e.event) {
      case 'ticket_started':
        return [<div key={e.id} className="sys">Ticket handed to the Boss · {t}</div>]
      case 'ticket_finished':
        return [
          <div key={e.id} className="sys">
            Run finished{e.details?.final_status ? ` · status set to ${String(e.details.final_status).replace('_', ' ')}` : ''} · {t}
          </div>,
        ]
      case 'ticket_error':
        return [<div key={e.id} className="sys sys-err">Run stopped: {String(e.details?.error ?? '')}</div>]
      case 'ticket_resolved':
        return [
          <div key={e.id} className="sys sys-resolved">
            <Check size={14} /> Ticket resolved · {t}
          </div>,
        ]
      case 'message_sent':
        return [
          <div key={e.id} className="msg msg-you">
            <div className="msg-body">
              <div className="msg-meta">
                <b>You</b> ({String(e.details?.sent_by ?? '')}) · {t}
              </div>
              <div className="msg-text">
                Sent draft #{String(e.details?.message_id ?? '')} to {String(e.details?.recipient ?? '')}: “{String(e.details?.subject ?? '')}”
              </div>
            </div>
            <span className="avatar av-you" aria-hidden="true">You</span>
          </div>,
        ]
      case 'message_revised':
        return [
          <div key={e.id} className="msg msg-you">
            <div className="msg-body">
              <div className="msg-meta">
                <b>You</b> ({String(e.details?.revised_by ?? '')}) · {t}
              </div>
              <div className="msg-text">
                Revised draft #{String(e.details?.message_id ?? '')} to {String(e.details?.recipient ?? '')}: “{String(e.details?.new_subject ?? '')}”
              </div>
            </div>
            <span className="avatar av-you" aria-hidden="true">You</span>
          </div>,
        ]
      case 'database_reset':
        return [<div key={e.id} className="sys">Database reset · {t}</div>]
      case 'human_decision': {
        const d = e.details ?? {}
        const effects = Array.isArray(d.effects) ? (d.effects as string[]) : []
        return [
          <div key={e.id} className="msg msg-you">
            <div className="msg-body">
              <div className="msg-meta">
                <b>You</b> ({String(d.decided_by)}) · {t}
              </div>
              <div className="msg-text">
                {String(d.decision) === 'approved' ? 'Approved' : 'Rejected'} #{String(d.request_id)}: {KIND_LABEL[e.kind ?? ''] ?? e.kind},{' '}
                {money(Number(d.amount))} to {String(d.payee)}
              </div>
              {effects.length > 0 && <div className="msg-effects">{effects.join(' · ')}</div>}
            </div>
            <span className="avatar av-you" aria-hidden="true">You</span>
          </div>,
        ]
      }
    }
    if (e.event === 'delegation_started' && e.delegation) {
      const d = e.delegation
      return [
        <div key={e.id} className="handoff">
          <span>
            <b>{AGENTS[d.from_agent].name}</b> <Arrow size={13} /> <b>{AGENTS[d.to_agent].name}</b>
          </span>
          <q>{d.task}</q>
        </div>,
      ]
    }
    if (e.event === 'delegation_refused' && e.delegation)
      return [<div key={e.id} className="sys sys-err">Hand-off refused: {e.delegation.error}</div>]
    if (e.kind === 'model_response' && e.agent) {
      const calls = (e.tool_calls ?? []).filter((c) => c.tool !== 'delegate')
      // A response with no tool calls is the agent's final answer; it's shown once as "reported back".
      if (calls.length === 0 && (e.tool_calls ?? []).length === 0) return []
      return [
        <div key={e.id} className="msg">
          <span className={`avatar av-${e.agent}`} aria-hidden="true">
            {AGENTS[e.agent].initials}
          </span>
          <div className="msg-body">
            <div className="msg-meta">
              <b>{AGENTS[e.agent].name}</b> · {t}
            </div>
            {e.said && <div className="msg-text">{e.said}</div>}
            {calls.map((c, i) => {
              const res = c.tool_call_id ? results.get(c.tool_call_id) : undefined
              return (
                <details key={i} className="receipt">
                  <summary>
                    <Wrench size={13} /> <code>{c.tool}</code>
                    <span className="receipt-args">({fmtArgs(c.args)})</span>
                    <span className="receipt-state">{res ? 'result ▾' : running ? 'running…' : ''}</span>
                  </summary>
                  {res ? <pre>{prettyResult(res)}</pre> : <pre className="muted">Waiting for the tool…</pre>}
                </details>
              )
            })}
          </div>
        </div>,
      ]
    }
    if (e.event === 'agent_finished' && e.agent && e.said)
      return [
        <div key={e.id} className="msg msg-final">
          <span className={`avatar av-${e.agent}`} aria-hidden="true">
            {AGENTS[e.agent].initials}
          </span>
          <div className="msg-body">
            <div className="msg-meta">
              <b>{AGENTS[e.agent].name}</b> reported back · {t}
            </div>
            <div className="msg-text">{e.said}</div>
          </div>
        </div>,
      ]
    return []
  })

  return (
    <section className="feed" aria-label="Live conversation">
      <div className="section-head">
        <h2>Conversation</h2>
        {running && (
          <span className="live-tag">
            <span className="pulse" aria-hidden="true" /> Live
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <div className="empty">
          <Bulldog size={88} mood="alert" className="empty-dog" />
          <p>
            <b>No conversation yet.</b> Press <b>Run agent team</b> and you’ll see each agent think out loud, call shop tools, and
            hand work to each other here.
          </p>
        </div>
      ) : (
        <div className="thread" aria-live="polite">
          {items}
          <div ref={end} />
        </div>
      )}
    </section>
  )
}

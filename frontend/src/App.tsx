import { useCallback, useEffect, useRef, useState } from 'react'
import { deriveTeam } from './activity'
import { api } from './api'
import { money } from './agents'
import { ActivityFeed } from './components/ActivityFeed'
import { AgentBoard } from './components/AgentBoard'
import { AgentSummaries } from './components/AgentSummaries'
import { ApprovalPanel } from './components/ApprovalPanel'
import { CashCard } from './components/CashCard'
import { NowTicker } from './components/NowTicker'
import { ResolvedCertificate } from './components/ResolvedCertificate'
import { Stepper } from './components/Stepper'
import { TicketList } from './components/TicketList'
import { Bulldog, ClockTower, Confetti, Skyline, Sparkles } from './decor'
import { Alert, Check, Play, Reset } from './icons'
import { TICKET_ICON } from './ticketIcons'
import type { TodoTarget } from './todoLinks'
import type { ApprovalRequest, BoardEvent, BossDecision, Cash, Health, Ticket, TicketDetail } from './types'
import './App.css'

const POLL_RUNNING_MS = 1200
const POLL_IDLE_MS = 5000

/** Events for a ticket's most recent run (after the last database reset), plus human decisions after it. */
function latestRun(events: BoardEvent[]): BoardEvent[] {
  const reset = events.findLastIndex((e) => e.event === 'database_reset')
  const start = events.findLastIndex((e) => e.event === 'ticket_started')
  if (start === -1 || start < reset) return []
  const runId = events[start].run_id
  return events.slice(start).filter((e) => e.run_id === runId || e.run_id === null)
}

const shopDate = (iso?: string) =>
  iso
    ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : ''

interface Toast {
  id: number
  text: string
  tone: 'ok' | 'err'
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [cash, setCash] = useState<Cash | null>(null)
  const [cashChange, setCashChange] = useState<number | null>(null)
  const [pending, setPending] = useState<ApprovalRequest[]>([])
  // Open on the ticket in the link (e.g. #ticket-102) so a ticket view can be shared or screenshotted.
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const m = window.location.hash.match(/ticket-(\d+)/)
    return m ? Number(m[1]) : null
  })
  const [events, setEvents] = useState<BoardEvent[]>([])
  const [decision, setDecision] = useState<BossDecision | null>(null)
  const [approver, setApproverState] = useState(() => localStorage.getItem('cc-approver') ?? '')
  const [offline, setOffline] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [starting, setStarting] = useState(false)
  const [confetti, setConfetti] = useState({ burst: 0, big: false })
  const [detail, setDetail] = useState<TicketDetail['ticket'] | null>(null)
  const [manualTodos, setManualTodos] = useState<Record<string, number[]>>(() => {
    try {
      return JSON.parse(localStorage.getItem('cc-todo-done') ?? '{}')
    } catch {
      return {}
    }
  })
  const lastId = useRef(0)
  const runId = useRef<string | null>(null)

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'err' ? 9000 : 6500)
  }, [])

  const setApprover = (name: string) => {
    setApproverState(name)
    localStorage.setItem('cc-approver', name)
  }

  const refreshShop = useCallback(async () => {
    try {
      const [h, t, c, a] = await Promise.all([api.health(), api.tickets(), api.cash(), api.approvals('pending')])
      setHealth(h)
      setTickets(t.tickets)
      setCash(c)
      setPending(a.requests)
      setSelectedId((cur) => cur ?? t.tickets[0]?.id ?? null)
      setOffline(null)
    } catch (e) {
      setOffline(`Can't reach the backend at http://localhost:8000. Start it from backend/ with uvicorn. (${(e as Error).message})`)
    }
  }, [])

  const loadTicketEvents = useCallback(async (ticketId: number) => {
    const res = await api.events({ ticketId, limit: 500 })
    const run = latestRun(res.events)
    lastId.current = res.last_id
    runId.current = run.find((e) => e.event === 'ticket_started')?.run_id ?? null
    setEvents(run)
    const bossDone = [...run].reverse().find((e) => e.event === 'agent_finished' && e.agent === 'boss' && e.depth === 0)
    setDecision((bossDone?.output as BossDecision | undefined) ?? null)
  }, [])

  useEffect(() => {
    refreshShop()
    const t = setInterval(refreshShop, POLL_IDLE_MS)
    return () => clearInterval(t)
  }, [refreshShop])

  const loadDetail = useCallback(async (ticketId: number) => {
    const res = await api.ticket(ticketId).catch(() => null)
    setDetail(res?.ticket ?? null)
  }, [])

  useEffect(() => {
    if (selectedId !== null) {
      loadTicketEvents(selectedId).catch(() => setEvents([]))
      loadDetail(selectedId)
      window.history.replaceState(null, '', `#ticket-${selectedId}`)
    }
  }, [selectedId, loadTicketEvents, loadDetail])

  const activeTicket = health?.active_ticket ?? null
  const runningHere = activeTicket !== null && activeTicket === selectedId

  useEffect(() => {
    if (!runningHere || selectedId === null) return
    const t = setInterval(async () => {
      try {
        const res = await api.events({ ticketId: selectedId, since: lastId.current })
        if (res.events.length) {
          lastId.current = res.last_id
          setEvents((prev) => latestRun([...prev, ...res.events]))
        }
        const h = await api.health()
        setHealth(h)
        if (!h.active_run) {
          await refreshShop()
          await loadTicketEvents(selectedId)
          await loadDetail(selectedId)
          if (runId.current) {
            const run = await api.run(runId.current).catch(() => null)
            if (run?.decision) setDecision(run.decision)
            if (run?.status === 'error') toast(`Run stopped: ${run.error}`, 'err')
            else toast(`Ticket #${selectedId}: the team finished. Check your desk for anything to approve.`)
          }
        }
      } catch (e) {
        toast((e as Error).message, 'err')
      }
    }, POLL_RUNNING_MS)
    return () => clearInterval(t)
  }, [runningHere, selectedId, refreshShop, loadTicketEvents, loadDetail, toast])

  const selected = tickets.find((t) => t.id === selectedId) ?? null
  // Requests on Your desk for this ticket. An escalated ticket with one of these is waiting on a person,
  // so re-running the team would only spend tokens; the decision is what resolves it.
  const myPending = selected ? pending.filter((r) => r.ticket_id === selected.id) : []
  const waitingOnHuman =
    !!selected && (selected.status === 'waiting_approval' || (selected.status === 'escalated' && myPending.length > 0))
  const canRun = !!selected && !activeTicket && !starting && selected.status !== 'resolved' && !waitingOnHuman

  const startRun = async () => {
    if (!selected) return
    setStarting(true)
    try {
      const res = await api.runTicket(selected.id)
      runId.current = res.run_id
      setEvents([])
      setDecision(null)
      setHealth((h) => (h ? { ...h, active_run: res.run_id, active_ticket: res.ticket_id } : h))
      setTickets((ts) => ts.map((t) => (t.id === selected.id ? { ...t, status: 'in_progress' } : t)))
    } catch (e) {
      toast((e as Error).message, 'err')
    } finally {
      setStarting(false)
    }
  }

  const decide = async (id: number, d: 'approve' | 'reject') => {
    const before = cash?.checking_balance ?? null
    try {
      const res = d === 'approve' ? await api.approve(id, approver.trim()) : await api.reject(id, approver.trim())
      if (before !== null && res.checking_balance !== null) setCashChange(res.checking_balance - before)
      const moved = before !== null && res.checking_balance !== null && res.checking_balance !== before
      if (d === 'approve') setConfetti((c) => ({ burst: c.burst + 1, big: res.ticket_resolved }))
      toast(
        `${d === 'approve' ? 'Approved' : 'Rejected'} #${id}` +
          (moved ? ` · checking ${money(before)} → ${money(res.checking_balance)}` : '') +
          (res.ticket_resolved ? ` · ticket #${res.request.ticket_id} resolved ✓` : ''),
      )
      await refreshShop()
      if (selectedId !== null) await Promise.all([loadTicketEvents(selectedId), loadDetail(selectedId)])
    } catch (e) {
      toast((e as Error).message, 'err')
    }
  }

  const sendDraft = async (id: number) => {
    try {
      const res = await api.sendMessage(id, approver.trim())
      toast(`Draft #${id} marked as sent to ${res.message.recipient}.`)
      if (selectedId !== null) await Promise.all([loadTicketEvents(selectedId), loadDetail(selectedId)])
    } catch (e) {
      toast((e as Error).message, 'err')
    }
  }

  /** Scroll smoothly to an element and make it glow for a moment. */
  const flash = (el: Element | null, scroll = true) => {
    if (!el) return false
    if (scroll) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.remove('flash')
    void (el as HTMLElement).offsetWidth
    el.classList.add('flash')
    setTimeout(() => el.classList.remove('flash'), 2200)
    return true
  }

  /** To-do links: take the reader to the slip, draft, or work order a step is about. */
  const goTo = (t: TodoTarget) => {
    if (t.kind === 'ticket') {
      setSelectedId(t.id)
      // Jump instantly: a smooth scroll gets cut off while the new ticket's content loads.
      window.scrollTo({ top: 0, behavior: 'auto' })
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'auto' })
        flash(document.getElementById(`order-${t.id}`), false)
      }, 120)
      return
    }
    if (t.kind === 'approval') {
      const el = t.id !== undefined ? document.getElementById(`slip-${t.id}`) : document.querySelector('#desk .slip')
      if (flash(el)) return
      const past = detail?.approval_requests.find((r) => r.id === t.id)
      flash(document.getElementById('desk'))
      toast(past ? `Request #${past.id} is already ${past.status}.` : 'Nothing is waiting for your approval on this ticket.')
      return
    }
    const el = t.id !== undefined ? document.getElementById(`draft-${t.id}`) : document.getElementById('drafts')
    if (!flash(el)) {
      flash(document.getElementById('desk'))
      toast('No message draft is saved for this ticket yet.')
    }
  }

  const isDone = (t: TodoTarget) => {
    if (t.kind === 'ticket') return tickets.find((x) => x.id === t.id)?.state === 'resolved'
    if (t.kind === 'draft') {
      const ds = detail?.customer_messages ?? []
      return t.id !== undefined ? ds.find((m) => m.id === t.id)?.status === 'sent' : ds.length > 0 && ds.every((m) => m.status === 'sent')
    }
    const rs = detail?.approval_requests ?? []
    return t.id !== undefined
      ? !!rs.find((r) => r.id === t.id && r.status !== 'pending')
      : rs.length > 0 && rs.every((r) => r.status !== 'pending')
  }

  const reset = async () => {
    if (!window.confirm('Reset the shop to its original data? Approvals, drafts and ticket progress are cleared. The audit trail is kept.')) return
    try {
      const res = await api.reset()
      setCashChange(null)
      setEvents([])
      setDecision(null)
      toast(`Fresh start: checking back to ${money(res.checking_balance)}.`)
      await refreshShop()
      if (selectedId !== null) await Promise.all([loadTicketEvents(selectedId), loadDetail(selectedId)])
    } catch (e) {
      toast((e as Error).message, 'err')
    }
  }

  // Judgment to-dos the human ticked off, saved per run so a fresh run starts clean.
  const runKey = events.find((e) => e.event === 'ticket_started')?.run_id ?? ''
  const manualDone = new Set(manualTodos[runKey] ?? [])
  const toggleManual = (i: number) => {
    if (!runKey) return
    const next = new Set(manualDone)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    const all = { ...manualTodos, [runKey]: [...next] }
    setManualTodos(all)
    localStorage.setItem('cc-todo-done', JSON.stringify(all))
  }

  const status = runningHere ? 'in_progress' : selected?.status ?? 'open'
  const Icon = selected ? TICKET_ICON[selected.type] : null

  return (
    <div className={`app ${activeTicket ? 'is-running' : ''}`}>
      {activeTicket && <div className="runbar" aria-hidden="true" />}
      <header className="masthead">
        <Sparkles count={22} />
        <Skyline />
        <div className="brand">
          <span className="crest">
            <ClockTower size={34} />
          </span>
          <div>
            <h1>Campus Customs</h1>
            <p>Operations desk · Chapel Street, New Haven</p>
          </div>
        </div>
        <div className="mast-right">
          {cash && <span className="chip-light">Shop date · {shopDate(cash.date_today)}</span>}
          {health && <span className="chip-light">Model · {health.model}</span>}
          <button className="btn btn-on-navy" onClick={reset} disabled={!!activeTicket}>
            <Reset size={15} /> Reset shop
          </button>
        </div>
      </header>

      <div className="bank-wrap">
        <Bulldog
          className={`peeker ${activeTicket ? 'sniff' : ''}`}
          size={74}
          mood={activeTicket || pending.length ? 'alert' : 'happy'}
        />
        <CashCard cash={cash} lastChange={cashChange} tickets={tickets} pendingCount={pending.length} />
      </div>

      {offline && (
        <div className="offline" role="alert">
          <Alert size={16} /> {offline}
        </div>
      )}

      <div className="layout">
        <aside className="sidebar">
          <TicketList tickets={tickets} selectedId={selectedId} activeTicket={activeTicket} onSelect={setSelectedId} />
        </aside>

        <main className="main">
          {selected && (
            <>
              <section className={`stage stage-${status}`}>
                <div className="stage-top">
                  <span className="stage-icon">{Icon ? <Icon size={26} /> : null}</span>
                  <div className="stage-title">
                    <div className="eyebrow">Ticket #{selected.id} · {selected.type.replaceAll('_', ' ')}</div>
                    <h2>{selected.subject}</h2>
                    <div className="facts">
                      <span>From <b>{selected.requester}</b></span>
                      {selected.sku && <span>{selected.qty} × {selected.sku} · size {selected.size}</span>}
                      {selected.invoice_id && <span>Invoice #{selected.invoice_id}</span>}
                      {selected.lease_id && <span>Lease #{selected.lease_id}</span>}
                    </div>
                  </div>
                  <div className="stage-cta">
                    <button className="btn btn-primary btn-big" onClick={startRun} disabled={!canRun}>
                      {runningHere ? (
                        <>
                          <span className="pulse pulse-light" aria-hidden="true" /> Team at work…
                        </>
                      ) : (
                        <>
                          <Play size={15} /> {starting ? 'Starting…' : 'Run agent team'}
                        </>
                      )}
                    </button>
                    <span className="cta-hint">
                      {activeTicket && activeTicket !== selected.id
                        ? `Ticket #${activeTicket} is running. One ticket at a time.`
                        : selected.status === 'waiting_approval' && !runningHere
                          ? 'Team finished. Sign the slips on your desk to resolve.'
                          : selected.status === 'escalated' && !runningHere && myPending.length > 0
                            ? `The Boss escalated this to you. Decide request${myPending.length > 1 ? 's' : ''} ${myPending.map((r) => `#${r.id}`).join(', ')} on Your desk to resolve it.`
                          : selected.status === 'escalated' && !runningHere
                            ? 'The Boss escalated this. Read its reason in the shift report, then run the team again once it’s fixed.'
                          : selected.status === 'resolved'
                            ? 'Resolved. Reset the shop to run it again.'
                            : runningHere
                              ? 'Watch the conversation below.'
                              : 'The Boss reads the ticket and calls only who it needs.'}
                    </span>
                  </div>
                </div>
                <Stepper status={status} />
                {runningHere && <NowTicker now={deriveTeam(events).now} />}
                {selected.status === 'resolved' && !runningHere && (
                  <ResolvedCertificate ticket={selected} events={events} decision={decision} />
                )}
              </section>

              <AgentBoard events={events} running={runningHere} />

              <div className="split">
                <ActivityFeed events={events} running={runningHere} />
                <ApprovalPanel
                  requests={pending}
                  ticketId={selectedId}
                  checking={cash?.checking_balance ?? null}
                  approver={approver}
                  setApprover={setApprover}
                  onDecide={decide}
                  drafts={detail?.customer_messages ?? []}
                  onSend={sendDraft}
                />
              </div>

              {!runningHere && (
                <AgentSummaries
                  events={events}
                  decision={decision}
                  ticketStatus={selected.status}
                  ticketId={selected.id}
                  onGo={goTo}
                  isDone={isDone}
                  manualDone={manualDone}
                  onToggleManual={toggleManual}
                />
              )}
            </>
          )}
        </main>
      </div>

      <Confetti burst={confetti.burst} big={confetti.big} />

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === 'err' ? 'alert' : 'status'}>
            {t.tone === 'err' ? <Alert size={16} /> : <Check size={16} />} <span>{t.text}</span>
            <button className="toast-x" aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

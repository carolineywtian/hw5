// What each agent is doing right now, derived from the event stream.
import { AGENT_ORDER } from './agents'
import type { AgentName, BoardEvent } from './types'

export type Activity = 'idle' | 'thinking' | 'reading' | 'writing' | 'handing_off' | 'waiting' | 'done'

/** Plain-language verb for every MCP tool, and whether it reads or writes the shop's books. */
export const TOOL_ACTIVITY: Record<string, { verb: string; kind: 'read' | 'write' | 'handoff' }> = {
  get_ticket: { verb: 'Reading the ticket', kind: 'read' },
  get_open_tickets: { verb: 'Scanning the ticket queue', kind: 'read' },
  check_stock_and_price: { verb: 'Counting stock on the shelves', kind: 'read' },
  get_cash_and_bills: { verb: 'Checking the bank book', kind: 'read' },
  check_margin: { verb: 'Running the margin math', kind: 'read' },
  get_lease: { verb: 'Reading the lease', kind: 'read' },
  get_vendor: { verb: 'Looking up the vendor', kind: 'read' },
  list_approval_requests: { verb: 'Checking your desk', kind: 'read' },
  list_tickets: { verb: 'Scanning all tickets', kind: 'read' },
  create_approval_request: { verb: 'Writing a payment slip for you', kind: 'write' },
  save_customer_message: { verb: 'Drafting a customer message', kind: 'write' },
  update_ticket: { verb: 'Updating the ticket', kind: 'write' },
  delegate: { verb: 'Handing off work', kind: 'handoff' },
}

export const ACTIVITY_LABEL: Record<Activity, string> = {
  idle: 'Standing by',
  thinking: 'Thinking',
  reading: 'Reading',
  writing: 'Writing',
  handing_off: 'Handing off',
  waiting: 'Waiting',
  done: 'Done',
}

export interface AgentView {
  activity: Activity
  detail: string | null // e.g. "Counting stock on the shelves"
  tool: string | null
  waitingOn: AgentName | null
  askedBy: AgentName | null
  latest: string | null
  tools: Map<string, number>
}

export interface Handoff {
  from: AgentName
  to: AgentName
  task: string
  status: 'running' | 'done' | 'refused' | 'error'
}

export interface NowLine {
  agent: AgentName
  activity: Activity
  text: string
}

export function deriveTeam(events: BoardEvent[]) {
  const views = Object.fromEntries(
    AGENT_ORDER.map((a) => [
      a,
      { activity: 'idle', detail: null, tool: null, waitingOn: null, askedBy: null, latest: null, tools: new Map() },
    ]),
  ) as Record<AgentName, AgentView>
  const handoffs: Handoff[] = []
  const open: Partial<Record<AgentName, number>> = {}
  let now: NowLine | null = null

  for (const e of events) {
    const d = e.delegation
    if (d && e.event === 'delegation_started') {
      handoffs.push({ from: d.from_agent, to: d.to_agent, task: d.task, status: 'running' })
      Object.assign(views[d.from_agent], { activity: 'waiting', waitingOn: d.to_agent, detail: null })
      now = { agent: d.from_agent, activity: 'handing_off', text: `handed work to ${d.to_agent.replace('_', ' ')}` }
      continue
    }
    if (d && (e.event === 'delegation_done' || e.event === 'delegation_refused')) {
      const h = [...handoffs].reverse().find((x) => x.from === d.from_agent && x.to === d.to_agent && x.status === 'running')
      if (h) h.status = e.event === 'delegation_refused' ? 'refused' : d.status === 'error' ? 'error' : 'done'
      else if (e.event === 'delegation_refused') handoffs.push({ from: d.from_agent, to: d.to_agent, task: d.task, status: 'refused' })
      if (e.event === 'delegation_done') Object.assign(views[d.from_agent], { activity: 'thinking', waitingOn: null, detail: 'Reading the report' })
      continue
    }
    const a = e.agent
    if (!a || !(a in views)) continue
    const v = views[a]
    if (e.event === 'agent_started') {
      open[a] = (open[a] ?? 0) + 1
      v.activity = 'thinking'
      v.detail = 'Reading the task'
      v.askedBy = e.chain && e.chain.length > 1 ? e.chain[e.chain.length - 2] : null
      now = { agent: a, activity: 'thinking', text: 'is reading the task' }
    } else if (e.event === 'agent_finished') {
      open[a] = Math.max(0, (open[a] ?? 1) - 1)
      if (!open[a]) Object.assign(v, { activity: 'done', detail: null, tool: null, waitingOn: null })
      if (e.said) v.latest = e.said
    } else if (e.kind === 'model_response') {
      for (const t of e.tools_used) v.tools.set(t, (v.tools.get(t) ?? 0) + 1)
      if (e.said) v.latest = e.said
      const calls = e.tools_used.filter((t) => t !== 'delegate')
      if (e.tools_used.includes('delegate') && calls.length === 0) {
        Object.assign(v, { activity: 'handing_off', detail: 'Handing off work', tool: 'delegate' })
      } else if (calls.length) {
        const writes = calls.filter((t) => TOOL_ACTIVITY[t]?.kind === 'write')
        const t = writes[0] ?? calls[0]
        Object.assign(v, {
          activity: writes.length ? 'writing' : 'reading',
          detail: TOOL_ACTIVITY[t]?.verb ?? `Using ${t}`,
          tool: t,
        })
        now = { agent: a, activity: v.activity, text: `is ${(TOOL_ACTIVITY[t]?.verb ?? `using ${t}`).replace(/^\w/, (c) => c.toLowerCase())}` }
        if (!e.said) v.latest = `${TOOL_ACTIVITY[t]?.verb ?? t}…`
      }
    }
    // tool_results: the model now digests what the tool returned, so the agent keeps
    // "Reading" (or "Writing") that tool's work until its next move.

  }
  return { views, handoffs, now }
}

// Thin client for the Problem 7 routes. In dev, Vite proxies /api to http://localhost:8000.
import type {
  ApprovalsResponse,
  Cash,
  CustomerMessage,
  DecisionResponse,
  EventsResponse,
  Health,
  Run,
  TicketDetail,
  TicketsResponse,
} from './types'

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') || ''

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      const detail = body?.detail
      message =
        typeof detail === 'string'
          ? detail
          : detail?.error ?? (Array.isArray(detail) ? detail.map((d: { msg: string }) => d.msg).join('; ') : message)
    } catch {
      /* keep the HTTP status message */
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export const api = {
  health: () => call<Health>('/api/health'),
  tickets: () => call<TicketsResponse>('/api/tickets'),
  ticket: (id: number) => call<TicketDetail>(`/api/tickets/${id}`),
  runTicket: (id: number) =>
    call<{ run_id: string; ticket_id: number; status: string }>(`/api/tickets/${id}/run`, { method: 'POST' }),
  run: (runId: string) => call<Run>(`/api/runs/${runId}`),
  events: (params: { since?: number; ticketId?: number; runId?: string; limit?: number }) => {
    const q = new URLSearchParams()
    if (params.since) q.set('since', String(params.since))
    if (params.ticketId !== undefined) q.set('ticket_id', String(params.ticketId))
    if (params.runId) q.set('run_id', params.runId)
    q.set('limit', String(params.limit ?? 500))
    return call<EventsResponse>(`/api/events?${q}`)
  },
  approvals: (status?: string) => call<ApprovalsResponse>(`/api/approvals${status ? `?status=${status}` : ''}`),
  approve: (id: number, decidedBy: string, note = '') =>
    call<DecisionResponse>(`/api/approvals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ decided_by: decidedBy, note }),
    }),
  reject: (id: number, decidedBy: string, note = '') =>
    call<DecisionResponse>(`/api/approvals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ decided_by: decidedBy, note }),
    }),
  sendMessage: (id: number, sentBy: string) =>
    call<{ status: string; message: CustomerMessage }>(`/api/messages/${id}/send`, {
      method: 'POST',
      body: JSON.stringify({ sent_by: sentBy }),
    }),
  cash: () => call<Cash>('/api/cash'),
  reset: () => call<{ status: string; checking_balance: number }>('/api/reset', { method: 'POST' }),
}

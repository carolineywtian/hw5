// Shapes returned by the FastAPI backend (backend/main.py).

export type AgentName = 'boss' | 'inventory' | 'accounting' | 'facilities' | 'customer_service'

export type TicketStatus = 'open' | 'in_progress' | 'waiting_approval' | 'resolved' | 'escalated'

export interface Ticket {
  id: number
  type: string
  requester: string
  subject: string
  sku: string | null
  size: string | null
  qty: number | null
  lease_id: number | null
  invoice_id: number | null
  status: TicketStatus
  state: 'open' | 'resolved'
  created_at: string
  pending_approvals: number
  draft_messages: number
}

export interface TicketsResponse {
  date_today: string
  tickets: Ticket[]
  open_count: number
  resolved_count: number
}

export interface Health {
  ok: boolean
  model: string
  working_db: string
  active_run: string | null
  active_ticket: number | null
}

export interface Fact {
  label: string
  value: string
  source_tool: string
}

export interface AgentReport {
  agent: AgentName
  ticket_id: number | null
  summary: string
  facts: Fact[]
  actions_taken: string[]
  approval_request_ids: number[]
  customer_message_ids: number[]
  recommendations: string[]
  blockers: string[]
  needs_human_approval: boolean
}

export interface BossDecision {
  ticket_id: number
  decision: string
  final_status: TicketStatus
  agents_consulted: AgentName[]
  key_facts: Fact[]
  approval_request_ids: number[]
  customer_message_ids: number[]
  next_steps_for_human: string[]
  risks: string[]
}

export interface Run {
  run_id: string
  ticket_id: number
  status: 'running' | 'done' | 'error'
  model: string
  started_at: string
  finished_at: string | null
  decision: BossDecision | null
  error: string | null
  usage?: { requests: number; input_tokens: number; output_tokens: number; tool_calls: number }
}

export interface ToolCall {
  tool: string
  tool_call_id?: string
  args: Record<string, unknown>
}

export interface BoardEvent {
  id: number
  at: string
  run_id: string | null
  ticket_id: number | null
  event: string
  kind: string | null
  agent: AgentName | null
  chain: AgentName[] | null
  depth: number | null
  said: string | null
  tools_used: string[]
  tool_calls?: ToolCall[]
  tool_results?: { tool: string; tool_call_id?: string; result: string }[]
  delegation?: {
    from_agent: AgentName
    to_agent: AgentName
    task: string
    depth: number
    status: string
    error: string | null
  }
  output?: Partial<AgentReport & BossDecision>
  details?: Record<string, unknown>
  tokens?: { input: number; output: number }
}

export interface EventsResponse {
  events: BoardEvent[]
  last_id: number
  active_run: string | null
}

export interface ApprovalRequest {
  id: number
  ticket_id: number
  kind: 'invoice_payment' | 'rent_payment' | 'purchase_order' | 'price_override'
  ref_id: number | null
  vendor_id: number | null
  sku: string | null
  size: string | null
  qty: number | null
  unit_price: number | null
  amount: number
  payee: string | null
  reason: string
  requested_by: string
  status: 'pending' | 'approved' | 'rejected' | 'executed'
  created_at: string
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
}

export interface ApprovalsResponse {
  requests: ApprovalRequest[]
  pending_payment_total: number
}

export interface DecisionResponse {
  status: string
  request: ApprovalRequest
  effects: string[]
  checking_balance: number | null
  ticket_resolved: boolean
}

export interface KnownBill {
  kind: string
  ref_id: number
  payee: string
  amount: number
  due: string | null
  payment_request_id?: number
}

export interface Cash {
  date_today: string
  checking_balance: number
  checking_as_of: string
  available_cash: number
  known_bills: KnownBill[]
  pending_purchase_orders_total: number
  payments: { id: number; kind: string; ref_id: number; amount: number; paid_at: string; approved_by: string }[]
}

export interface CustomerMessage {
  id: number
  ticket_id: number
  recipient: string
  subject: string
  body: string
  drafted_by: string
  status: 'draft' | 'sent'
  created_at: string
  sent_by: string | null
  sent_at: string | null
}

export interface TicketDetail {
  date_today: string
  ticket: Ticket & {
    approval_requests: ApprovalRequest[]
    customer_messages: CustomerMessage[]
  }
}

import axiosInstance from '@/utils/axiosInstance'
import type {
  MarketingAgent,
  AgentConnection,
  MarketingHistoryResponse,
  MarketingActionEvent
} from '@/types/marketing/aiMarketing'

// ---------------------------------------------------------------------------
// Base URL helper
// ---------------------------------------------------------------------------

const API_URL = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/marketing`

// ---------------------------------------------------------------------------
// Normalization helpers — bridge backend DTOs → frontend interfaces
// ---------------------------------------------------------------------------

/**
 * Default agent colors, roles, and positions keyed by well-known agent IDs.
 * Used when the backend does not provide these fields.
 */
const AGENT_DEFAULTS: Record<string, { color: string; role: string; position: { x: number; y: number } }> = {
  researcher:          { color: '#3b82f6', role: 'Investigador de Mercado',  position: { x: 80,  y: 120 } },
  icp_agent:           { color: '#8b5cf6', role: 'Agente de ICP',           position: { x: 280, y: 60  } },
  qualification_agent: { color: '#22c55e', role: 'Agente de Calificación',  position: { x: 480, y: 120 } },
  copywriter_agent:    { color: '#f59e0b', role: 'Copywriter',              position: { x: 680, y: 60  } }
}

/**
 * Normalize a single raw agent object from the backend into a MarketingAgent.
 *
 * Backend DTO (Java):  { id, name, status, currentTask, lastActivity, avatarUrl }
 * Frontend interface:  { id, name, displayName, role, status, currentTask,
 *                        taskStartedAt, lastActivity, avatar, color, position }
 */
function normalizeAgent(raw: any, index: number): MarketingAgent {
  const id = String(raw.id ?? '')
  const defaults = AGENT_DEFAULTS[id]
  const cols = Math.max(1, Math.ceil(Math.sqrt(Object.keys(AGENT_DEFAULTS).length + 1)))
  const col = index % cols
  const row = Math.floor(index / cols)

  return {
    id,
    name: raw.name ?? id,
    displayName: raw.displayName ?? raw.name ?? id,
    role: raw.role ?? defaults?.role ?? '',
    status: raw.status ?? 'idle',
    currentTask: raw.currentTask ?? null,
    taskStartedAt: raw.taskStartedAt ?? null,
    lastActivity: raw.lastActivity ?? new Date().toISOString(),
    avatar: raw.avatar ?? raw.avatarUrl ?? undefined,
    color: raw.color ?? defaults?.color ?? '#94a3b8',
    position: raw.position ?? defaults?.position ?? { x: 40 + col * 240, y: 40 + row * 180 }
  }
}

/** Normalize an array of raw agents. */
function normalizeAgents(raw: any): MarketingAgent[] {
  if (!Array.isArray(raw)) return []
  return raw.map((a: any, i: number) => normalizeAgent(a, i))
}

/**
 * Normalize a single raw connection from the backend into an AgentConnection.
 *
 * Backend DTO (Java):  { from, to, label }
 * Frontend interface:  { id, sourceAgentId, targetAgentId, label, dataFlow, active }
 */
function normalizeConnection(raw: any, index: number): AgentConnection {
  const sourceAgentId = String(raw.sourceAgentId ?? raw.from ?? '')
  const targetAgentId = String(raw.targetAgentId ?? raw.to ?? '')

  return {
    id: raw.id ?? `conn-${sourceAgentId}-${targetAgentId}-${index}`,
    sourceAgentId,
    targetAgentId,
    label: raw.label ?? '',
    dataFlow: raw.dataFlow ?? 'context',
    active: raw.active ?? false
  }
}

/** Normalize an array of raw connections. */
function normalizeConnections(raw: any): AgentConnection[] {
  if (!Array.isArray(raw)) return []
  return raw.map((c: any, i: number) => normalizeConnection(c, i))
}

/**
 * Map backend actionType strings to frontend event type union values.
 */
const ACTION_TYPE_MAP: Record<string, MarketingActionEvent['type']> = {
  WORKFLOW_EXECUTION: 'crew_kickoff',
  LEAD_SEARCH:       'lead_search_started',
  LEAD_FOUND:        'lead_search_completed',
  CAMPAIGN:          'campaign_created',
  MESSAGE:           'message_sent',
  ANALYSIS:          'analysis_completed',
  TRANSITION:        'flow_transition',
  ERROR:             'error'
}

/**
 * Normalize a single raw event from the backend into a MarketingActionEvent.
 *
 * Backend DTO (Java):  { id, agentId, agentName, actionType, description, timestamp, metadata }
 * Frontend interface:  { id, type, title, description, agentId, timestamp, metadata }
 */
function normalizeEvent(raw: any): MarketingActionEvent {
  const actionType = String(raw.actionType ?? raw.type ?? 'WORKFLOW_EXECUTION').toUpperCase()
  const mappedType = ACTION_TYPE_MAP[actionType] ?? raw.type ?? 'crew_kickoff'

  return {
    id: String(raw.id ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    type: mappedType,
    title: raw.title ?? raw.agentName ?? `Agent ${raw.agentId ?? 'unknown'}`,
    description: raw.description ?? '',
    agentId: String(raw.agentId ?? ''),
    timestamp: raw.timestamp ?? new Date().toISOString(),
    metadata: raw.metadata ?? {}
  }
}

/** Normalize an array of raw events. */
function normalizeEvents(raw: any): MarketingActionEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeEvent)
}

// ---------------------------------------------------------------------------
// marketingHistoryService
// ---------------------------------------------------------------------------

/**
 * REST service for fetching the initial marketing dashboard data
 * (agents, connections, and recent history).
 *
 * These endpoints are called once on mount to provide the initial state
 * before WebSocket events start flowing in.
 *
 * All methods support optional AbortSignal for request cancellation
 * on component unmount.
 *
 * IMPORTANT: All methods normalize the raw backend DTO responses into
 * the frontend TypeScript interfaces before returning, bridging field
 * name mismatches (e.g., backend `from`/`to` → frontend `sourceAgentId`/
 * `targetAgentId`) and providing defaults for missing fields.
 *
 * Specification: CLOUD-212 (System Architect)
 */
export const marketingHistoryService = {

  /**
   * Fetch current agent states (for initial load / reconnection fallback).
   * GET /api/v1/marketing/agents/live-status?tenantId={}&companyId={}
   *
   * @param tenantId  - Mandatory tenant identifier
   * @param companyId - Optional company identifier for scoped queries
   * @param signal    - Optional AbortSignal for request cancellation
   * @returns Object containing agents array and connections array
   */
  async getLiveAgents(
    tenantId: number,
    companyId?: number,
    signal?: AbortSignal
  ): Promise<{ agents: MarketingAgent[]; connections: AgentConnection[] }> {
    try {
      const params = new URLSearchParams()
      params.append('tenantId', String(tenantId))
      if (companyId) params.append('companyId', String(companyId))

      const { data } = await axiosInstance.get<any>(
        `${API_URL}/agents/live-status?${params}`,
        { signal }
      )

      return {
        agents: normalizeAgents(data?.agents),
        connections: normalizeConnections(data?.connections)
      }
    } catch (error: unknown) {
      if (isAbortError(error)) {
        return { agents: [], connections: [] }
      }
      console.error('[marketingHistoryService] getLiveAgents error:', error)
      return { agents: [], connections: [] }
    }
  },

  /**
   * Fetch action history for the timeline.
   * GET /api/v1/marketing/agents/history?tenantId={}&limit={}&page={}&companyId={}
   *
   * @param tenantId  - Mandatory tenant identifier
   * @param limit     - Maximum number of events to return (default: 50)
   * @param page      - Page number for pagination (default: 0)
   * @param companyId - Optional company identifier for scoped queries
   * @param signal    - Optional AbortSignal for request cancellation
   * @returns MarketingHistoryResponse with action events
   */
  async getActionHistory(
    tenantId: number,
    limit = 50,
    page = 0,
    companyId?: number,
    signal?: AbortSignal
  ): Promise<MarketingHistoryResponse> {
    try {
      const params = new URLSearchParams()
      params.append('tenantId', String(tenantId))
      params.append('limit', String(limit))
      params.append('page', String(page))
      if (companyId) params.append('companyId', String(companyId))

      const { data } = await axiosInstance.get<any>(
        `${API_URL}/agents/history?${params}`,
        { signal }
      )

      const rawEvents = data?.events || data?.recentEvents || []
      const events = normalizeEvents(rawEvents)

      return {
        events,
        total: data?.total !== undefined ? data.total : events.length,
        hasMore: data?.hasMore !== undefined ? data.hasMore : false,
        agents: normalizeAgents(data?.agents),
        connections: normalizeConnections(data?.connections),
        recentEvents: events,
        generatedAt: data?.generatedAt
      }
    } catch (error: unknown) {
      if (isAbortError(error)) {
        return { events: [], total: 0, hasMore: false }
      }
      console.error('[marketingHistoryService] getActionHistory error:', error)
      return { events: [], total: 0, hasMore: false }
    }
  },

  /**
   * Fetch agent connections for the flow graph.
   * GET /api/v1/marketing/agents/connections?tenantId={}
   *
   * @param tenantId - Mandatory tenant identifier
   * @param signal   - Optional AbortSignal for request cancellation
   * @returns Array of directed agent connections
   */
  async getAgentConnections(
    tenantId: number,
    signal?: AbortSignal
  ): Promise<AgentConnection[]> {
    try {
      const { data } = await axiosInstance.get<any>(
        `${API_URL}/agents/connections?tenantId=${tenantId}`,
        { signal }
      )

      return normalizeConnections(Array.isArray(data) ? data : [])
    } catch (error: unknown) {
      if (isAbortError(error)) {
        return []
      }
      console.error('[marketingHistoryService] getAgentConnections error:', error)
      return []
    }
  },

  /**
   * Fetch tasks for a specific agent.
   * GET /api/v1/marketing/agents/{agentId}/tasks
   *
   * @param agentId - Unique agent identifier
   * @param signal  - Optional AbortSignal for request cancellation
   * @returns Array of marketing action events for the agent
   */
  async getAgentTasks(
    agentId: string,
    signal?: AbortSignal
  ): Promise<MarketingActionEvent[]> {
    try {
      const { data } = await axiosInstance.get<any>(
        `${API_URL}/agents/${agentId}/tasks`,
        { signal }
      )

      return normalizeEvents(Array.isArray(data) ? data : [])
    } catch (error: unknown) {
      if (isAbortError(error)) {
        return []
      }
      console.error('[marketingHistoryService] getAgentTasks error:', error)
      return []
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect whether an error originates from an aborted request.
 * Axios wraps the DOMException in a CanceledError (axios >= 0.22) or
 * exposes the raw AbortError name.
 */
function isAbortError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const name = (error as { name?: string }).name
    if (name === 'AbortError' || name === 'CanceledError') return true
    // axios CanceledError sets code to 'ERR_CANCELED'
    const code = (error as { code?: string }).code
    if (code === 'ERR_CANCELED') return true
  }
  return false
}

export default marketingHistoryService

// Export normalization functions for use by WebSocket hooks
export { normalizeAgents, normalizeConnections, normalizeEvents, normalizeEvent }

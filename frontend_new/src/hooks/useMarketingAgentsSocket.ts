'use client'

// ============================================================
// CLOUD-243 / CLOUD-213: useMarketingAgentsSocket Hook — Enhanced
// ============================================================
// Custom React hook that extends the shared SocketContext to listen for
// marketing-specific real-time events from the chat-socket-service.
//
// CLOUD-243 Enhancement:
//   • Tracks the subscribed room name from server confirmation
//     (subscribed-marketing / unsubsubscribed-marketing events)
//   • Handles cross-tenant error from server (error event with
//     "Cross-tenant subscription not allowed" message)
//   • Exposes roomName and subscriptionError for UI components
//
// Expected socket events (server → client):
//   • subscribed-marketing         — confirmation with room name (CLOUD-243)
//   • unsubscribed-marketing       — confirmation with room name (CLOUD-243)
//   • marketing-batch-update       — initial / periodic full snapshot
//   • marketing-agent-status-update — single agent status change
//   • marketing-agent-task-update  — single agent task change
//   • marketing-action-event       — new action for the history timeline
//
// Client → Server:
//   • subscribe-marketing   — join room marketing_tenant_{tenantId}
//   • unsubscribe-marketing — leave room
// ============================================================

import { useEffect, useCallback, useState, useRef } from 'react'
import { useSocket } from '@/contexts/SocketContext'
import { marketingHistoryService, normalizeAgents, normalizeConnections, normalizeEvent } from '@/services/marketing/marketingHistoryService'
import type {
  MarketingAgent,
  AgentConnection,
  MarketingActionEvent,
  AgentStatusUpdatePayload,
  AgentTaskUpdatePayload,
  MarketingAgentBatchPayload,
  AgentStatus
} from '@/types/marketing/aiMarketing'

// ---------------------------------------------------------------------------
// Options & Return Types
// ---------------------------------------------------------------------------

export interface UseMarketingAgentsSocketOptions {
  tenantId: number;
  companyId?: number;
}

export interface UseMarketingAgentsSocketReturn {
  /** Current list of marketing agents with live status */
  agents: MarketingAgent[];
  /** Directed connections between agents for the flow graph */
  connections: AgentConnection[];
  /** Recent action events for the history timeline */
  events: MarketingActionEvent[];
  /** Whether the socket is currently connected */
  isConnected: boolean;
  /** Detailed connection status */
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  /** ISO-8601 timestamp of the last received event, or null */
  lastUpdate: string | null;
  /** The name of the currently subscribed marketing room (from server confirmation) */
  roomName: string | null;
  /** Subscription error message (e.g., cross-tenant rejection), or null */
  subscriptionError: string | null;
  /** Manually reconnect (useful after network issues) */
  reconnect: () => void;
  /** Request the current status of all marketing agents via socket */
  requestStatus: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Custom React hook that extends the shared SocketContext to listen for
 * marketing-specific real-time events.
 *
 * Expected socket events (server → client):
 *   • marketing-batch-update        – initial / periodic full snapshot (MarketingAgentBatchPayload)
 *   • marketing-agent-status-update – single agent status change (AgentStatusUpdatePayload)
 *   • marketing-agent-task-update   – single agent task change (AgentTaskUpdatePayload)
 *   • marketing-action-event        – new action for the history timeline (MarketingActionEvent)
 *
 * Client → Server:
 *   • subscribe-marketing  – join room marketing_{tenantId}
 *   • unsubscribe-marketing – leave room
 */
export const useMarketingAgentsSocket = (
  options: UseMarketingAgentsSocketOptions
): UseMarketingAgentsSocketReturn => {
  const { socket, isConnected } = useSocket()

  const [agents, setAgents] = useState<MarketingAgent[]>([])
  const [connections, setConnections] = useState<AgentConnection[]>([])
  const [events, setEvents] = useState<MarketingActionEvent[]>([])
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected')
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [roomName, setRoomName] = useState<string | null>(null)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)

  // Track whether we are currently reconnecting (to set 'reconnecting' status)
  const reconnectingRef = useRef(false)

  // Use a ref to track roomName so that the unsubscribed-marketing handler
  // always has access to the current value without needing to re-register
  // the socket listener on every roomName change (fixes stale closure bug).
  const roomNameRef = useRef<string | null>(null)
  roomNameRef.current = roomName

  // Load initial agents and connections from REST on mount or option changes
  useEffect(() => {
    let active = true
    const loadInitialLiveAgents = async () => {
      try {
        const data = await marketingHistoryService.getLiveAgents(options.tenantId, options.companyId)
        if (active) {
          if (Array.isArray(data?.agents)) {
            setAgents(data.agents)
          }
          if (Array.isArray(data?.connections)) {
            setConnections(data.connections)
          }
        }
      } catch (err) {
        console.error('[useMarketingAgentsSocket] failed to load initial live status:', err)
      }
    }
    loadInitialLiveAgents()
    return () => {
      active = false
    }
  }, [options.tenantId, options.companyId])

  // -----------------------------------------------------------------------
  // Helper: update lastUpdate timestamp
  // -----------------------------------------------------------------------

  const touchLastUpdate = useCallback(() => {
    setLastUpdate(new Date().toISOString())
  }, [])

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  /**
   * Replace the full agent list AND connections (initial load or periodic refresh).
   * Accepts either MarketingAgentBatchPayload or legacy plain array of agents.
   * Normalizes raw backend DTOs into the expected frontend interfaces.
   */
  const handleBatchUpdate = useCallback((payload: any) => {
    if (Array.isArray(payload)) {
      // Legacy: plain array of agents — normalize them
      setAgents(normalizeAgents(payload))
    } else if (payload && typeof payload === 'object') {
      // New spec: MarketingAgentBatchPayload — normalize agents and connections
      if (Array.isArray(payload.agents)) setAgents(normalizeAgents(payload.agents))
      if (Array.isArray(payload.connections)) setConnections(normalizeConnections(payload.connections))
    }
    touchLastUpdate()
  }, [touchLastUpdate])

  /**
   * Update a single agent's status based on AgentStatusUpdatePayload.
   * Fields updated: status, currentTask, taskStartedAt, lastActivity.
   */
  const handleStatusUpdate = useCallback((payload: AgentStatusUpdatePayload) => {
    if (!payload?.agentId) return
    setAgents(prev =>
      prev.map(agent =>
        agent.id === payload.agentId
          ? {
              ...agent,
              status: payload.status,
              currentTask: payload.currentTask,
              taskStartedAt: payload.taskStartedAt,
              lastActivity: payload.lastActivity
            }
          : agent
      )
    )
    touchLastUpdate()
  }, [touchLastUpdate])

  /**
   * Update a single agent's task based on AgentTaskUpdatePayload.
   * Fields updated: currentTask (from taskName), lastActivity (from timestamp).
   */
  const handleTaskUpdate = useCallback((payload: AgentTaskUpdatePayload) => {
    if (!payload?.agentId) return
    setAgents(prev =>
      prev.map(agent =>
        agent.id === payload.agentId
          ? {
              ...agent,
              currentTask: payload.taskName,
              taskStartedAt: payload.status === 'started' ? payload.timestamp : agent.taskStartedAt,
              lastActivity: payload.timestamp
            }
          : agent
      )
    )
    touchLastUpdate()
  }, [touchLastUpdate])

  /** Append a new action event to the timeline (keep last 50). Normalizes raw backend DTOs. */
  const handleActionEvent = useCallback((payload: any) => {
    if (!payload?.id) return
    const normalized = normalizeEvent(payload)
    setEvents(prev => {
      // Deduplicate by id
      if (prev.some(ev => ev.id === normalized.id)) return prev
      const updated = [...prev, normalized]
      // Keep only the last 50 events
      return updated.slice(-50)
    })
    touchLastUpdate()
  }, [touchLastUpdate])

  // -----------------------------------------------------------------------
  // CLOUD-243: Subscription confirmation handlers
  // -----------------------------------------------------------------------

  /**
   * Handle the 'subscribed-marketing' confirmation event from the server.
   * This confirms that the server has joined the socket to the correct room.
   * The payload contains: { room, tenantId, companyId }
   */
  const handleSubscribedMarketing = useCallback((payload: { room: string; tenantId?: number; companyId?: number }) => {
    if (payload?.room) {
      setRoomName(payload.room)
      setSubscriptionError(null)
    }
  }, [])

  /**
   * Handle the 'unsubscribed-marketing' confirmation event from the server.
   * Uses roomNameRef to avoid stale closure over roomName state.
   * The payload contains: { room, tenantId, companyId }
   */
  const handleUnsubscribedMarketing = useCallback((payload: { room: string; tenantId?: number; companyId?: number }) => {
    if (payload?.room && payload.room === roomNameRef.current) {
      setRoomName(null)
    }
  }, [])

  /**
   * Handle socket 'error' events from the server.
   * Specifically detects cross-tenant subscription rejection.
   */
  const handleSocketError = useCallback((payload: { message?: string }) => {
    if (payload?.message?.includes('Cross-tenant')) {
      setSubscriptionError(payload.message)
    }
  }, [])

  // -----------------------------------------------------------------------
  // Subscribe / unsubscribe marketing room
  // -----------------------------------------------------------------------

  const subscribe = useCallback(() => {
    if (!socket) return
    setSubscriptionError(null)
    socket.emit('subscribe-marketing', {
      tenantId: options.tenantId,
      companyId: options.companyId
    })
  }, [socket, options.tenantId, options.companyId])

  const unsubscribe = useCallback(() => {
    if (!socket) return
    socket.emit('unsubscribe-marketing', {
      tenantId: options.tenantId,
      companyId: options.companyId
    })
  }, [socket, options.tenantId, options.companyId])

  // -----------------------------------------------------------------------
  // Socket event listeners (marketing events)
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!socket) return

    socket.on('marketing-batch-update', handleBatchUpdate)
    socket.on('marketing-agent-status-update', handleStatusUpdate)
    socket.on('marketing-agent-task-update', handleTaskUpdate)
    socket.on('marketing-action-event', handleActionEvent)

    // CLOUD-243: Subscription confirmation listeners
    socket.on('subscribed-marketing', handleSubscribedMarketing)
    socket.on('unsubscribed-marketing', handleUnsubscribedMarketing)
    socket.on('error', handleSocketError)

    return () => {
      socket.off('marketing-batch-update', handleBatchUpdate)
      socket.off('marketing-agent-status-update', handleStatusUpdate)
      socket.off('marketing-agent-task-update', handleTaskUpdate)
      socket.off('marketing-action-event', handleActionEvent)

      // CLOUD-243: Cleanup subscription confirmation listeners
      socket.off('subscribed-marketing', handleSubscribedMarketing)
      socket.off('unsubscribed-marketing', handleUnsubscribedMarketing)
      socket.off('error', handleSocketError)
    }
  }, [
    socket,
    handleBatchUpdate,
    handleStatusUpdate,
    handleTaskUpdate,
    handleActionEvent,
    handleSubscribedMarketing,
    handleUnsubscribedMarketing,
    handleSocketError
  ])

  // -----------------------------------------------------------------------
  // Connection status tracking + room subscription
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!socket) return

    const onConnect = () => {
      setConnectionStatus('connected')
      reconnectingRef.current = false
      // Re-subscribe on (re)connect
      subscribe()
    }

    const onDisconnect = () => {
      if (reconnectingRef.current) {
        setConnectionStatus('reconnecting')
      } else {
        setConnectionStatus('disconnected')
      }
    }

    const onReconnecting = () => {
      reconnectingRef.current = true
      setConnectionStatus('reconnecting')
    }

    // Listen for socket.io built-in events
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    // socket.io-client does not have a built-in 'reconnecting' event on the socket instance,
    // but we can detect reconnection attempts via the socket.io manager
    const manager = (socket as any).io
    if (manager && manager.on) {
      manager.on('reconnect_attempt', onReconnecting)
    }

    // If already connected, subscribe immediately
    if (socket.connected) {
      setConnectionStatus('connected')
      subscribe()
    }

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      if (manager && manager.off) {
        manager.off('reconnect_attempt', onReconnecting)
      }
      // Unsubscribe on unmount
      unsubscribe()
    }
  }, [socket, subscribe, unsubscribe])

  // -----------------------------------------------------------------------
  // Reconnect helper
  // -----------------------------------------------------------------------

  const reconnect = useCallback(() => {
    if (!socket) return
    reconnectingRef.current = true
    setConnectionStatus('reconnecting')
    socket.disconnect()
    socket.connect()
  }, [socket])

  const requestStatus = useCallback(() => {
    if (!socket) return
    socket.emit('request-marketing-status', {
      tenantId: options.tenantId,
      companyId: options.companyId
    })
  }, [socket, options.tenantId, options.companyId])

  return {
    agents,
    connections,
    events,
    isConnected,
    connectionStatus,
    lastUpdate,
    roomName,
    subscriptionError,
    reconnect,
    requestStatus
  }
}

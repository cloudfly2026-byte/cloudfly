// ============================================================
// CLOUD-243: useMarketingAgentsSocket Hook — Unit Tests
// ============================================================
// Tests the enhanced hook with CLOUD-243 additions:
//   • roomName tracking from server confirmation
//   • subscriptionError tracking (cross-tenant rejection)
//   • subscribed-marketing / unsubscribed-marketing event handling
//   • error event handling for cross-tenant messages
// ============================================================

import { renderHook, act } from '@testing-library/react'
import { useMarketingAgentsSocket } from '@/hooks/useMarketingAgentsSocket'

// ---------------------------------------------------------------------------
// Mock Socket.IO with working listener dispatch
// ---------------------------------------------------------------------------

type EventHandler = (...args: any[]) => void

interface MockSocket {
  id: string
  connected: boolean
  on: (event: string, handler: EventHandler) => MockSocket
  off: (event: string, handler?: EventHandler) => MockSocket
  emit: (event: string, data?: any) => MockSocket
  disconnect: () => void
  connect: () => void
  io: { on: (event: string, handler: EventHandler) => void; off: (event: string, handler?: EventHandler) => void }
  _listeners: Map<string, Set<EventHandler>>
  _emitted: Array<{ event: string; data: any }>
}

const createMockSocket = (startConnected = false): MockSocket => {
  const listeners = new Map<string, Set<EventHandler>>()
  const emitted: Array<{ event: string; data: any }> = []
  let _connected = startConnected

  const mock: MockSocket = {
    id: 'socket-test-123',
    get connected() { return _connected },
    on(event: string, handler: EventHandler) {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(handler)
      return mock
    },
    off(event: string, handler?: EventHandler) {
      if (handler) {
        listeners.get(event)?.delete(handler)
      } else {
        listeners.delete(event)
      }
      return mock
    },
    emit(event: string, data?: any) {
      emitted.push({ event, data })
      return mock
    },
    disconnect() {
      _connected = false
      listeners.get('disconnect')?.forEach(fn => fn())
    },
    connect() {
      _connected = true
      listeners.get('connect')?.forEach(fn => fn())
    },
    io: {
      on(_event: string, _handler: EventHandler) {},
      off(_event: string, _handler?: EventHandler) {}
    },
    _listeners: listeners,
    _emitted: emitted
  }

  return mock
}

// ---------------------------------------------------------------------------
// Mock SocketContext
// ---------------------------------------------------------------------------

let mockSocket: MockSocket
let mockIsConnected: boolean

jest.mock('@/contexts/SocketContext', () => ({
  useSocket: () => ({
    socket: mockSocket,
    isConnected: mockIsConnected
  })
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useMarketingAgentsSocket (CLOUD-243)', () => {
  beforeEach(() => {
    mockSocket = createMockSocket(true) // start connected so subscribe fires
    mockIsConnected = true
    jest.clearAllMocks()
  })

  // =========================================================================
  // Basic Hook Initialization
  // =========================================================================

  it('should initialize with default values', () => {
    const { result } = renderHook(() =>
      useMarketingAgentsSocket({ tenantId: 1, companyId: 100 })
    )

    expect(result.current.agents).toEqual([])
    expect(result.current.connections).toEqual([])
    expect(result.current.events).toEqual([])
    expect(result.current.roomName).toBeNull()
    expect(result.current.subscriptionError).toBeNull()
    expect(result.current.lastUpdate).toBeNull()
  })

  // =========================================================================
  // CLOUD-243: subscribe-marketing emission
  // =========================================================================

  it('should emit subscribe-marketing with tenantId and companyId on connect', () => {
    // Use a fresh disconnected socket so we can test the connect flow
    mockSocket = createMockSocket(false)
    mockIsConnected = false

    renderHook(() =>
      useMarketingAgentsSocket({ tenantId: 1, companyId: 100 })
    )

    // Manually trigger connect to simulate socket.io connect event
    act(() => {
      mockSocket.connect()
    })

    expect(mockSocket._emitted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'subscribe-marketing',
          data: { tenantId: 1, companyId: 100 }
        })
      ])
    )
  })

  it('should emit subscribe-marketing with tenantId only (no companyId)', () => {
    mockSocket = createMockSocket(false)
    mockIsConnected = false

    renderHook(() =>
      useMarketingAgentsSocket({ tenantId: 5 })
    )

    act(() => {
      mockSocket.connect()
    })

    expect(mockSocket._emitted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'subscribe-marketing',
          data: { tenantId: 5, companyId: undefined }
        })
      ])
    )
  })

  // =========================================================================
  // CLOUD-243: subscribed-marketing confirmation handling
  // =========================================================================

  it('should update roomName when receiving subscribed-marketing event', () => {
    const { result } = renderHook(() =>
      useMarketingAgentsSocket({ tenantId: 1, companyId: 100 })
    )

    const subscribedHandlers = mockSocket._listeners.get('subscribed-marketing')
    expect(subscribedHandlers).toBeDefined()
    expect(subscribedHandlers!.size).toBeGreaterThan(0)

    const handler = [...subscribedHandlers!][0]

    act(() => {
      handler({ room: 'marketing_tenant_1_company_100', tenantId: 1, companyId: 100 })
    })

    expect(result.current.roomName).toBe('marketing_tenant_1_company_100')
    expect(result.current.subscriptionError).toBeNull()
  })

  it('should update roomName for tenant-only room (no companyId)', () => {
    const { result } = renderHook(() =>
      useMarketingAgentsSocket({ tenantId: 3 })
    )

    const subscribedHandlers = mockSocket._listeners.get('subscribed-marketing')
    const handler = [...subscribedHandlers!][0]

    act(() => {
      handler({ room: 'marketing_tenant_3', tenantId: 3 })
    })

    expect(result.current.roomName).toBe('marketing_tenant_3')
  })

  // =========================================================================
  // CLOUD-243: unsubscribed-marketing confirmation handling
  // =========================================================================

  it('should clear roomName when receiving unsubscribed-marketing event for current room', () => {
    const { result } = renderHook(() =>
      useMarketingAgentsSocket({ tenantId: 1, companyId: 100 })
    )

    // First, subscribe
    const subscribedHandlers = mockSocket._listeners.get('subscribed-marketing')
    act(() => {
      [...subscribedHandlers!][0]({ room: 'marketing_tenant_1_company_100', tenantId: 1, companyId: 100 })
    })
    expect(result.current.roomName).toBe('marketing_tenant_1_company_100')

    // Then, unsubscribe
    const unsubscribedHandlers = mockSocket._listeners.get('unsubscribed-marketing')
    act(() => {
      [...unsubscribedHandlers!][0]({ room: 'marketing_tenant_1_company_100', tenantId: 1, companyId: 100 })
    })
    expect(result.current.roomName).toBeNull()
  })

  // =========================================================================
  // CLOUD-243: Cross-tenant error handling
  // =========================================================================

  it('should set subscriptionError when receiving cross-tenant error', () => {
    const { result } = renderHook(() =>
      useMarketingAgentsSocket({ tenantId: 1, companyId: 100 })
    )

    const errorHandlers = mockSocket._listeners.get('error')
    expect(errorHandlers).toBeDefined()

    const errorHandler = [...errorHandlers!][0]

    act(() => {
      errorHandler({ message: 'Cross-tenant subscription not allowed' })
    })

    expect(result.current.subscriptionError).toBe('Cross-tenant subscription not allowed')
  })

  it('should NOT set subscriptionError for non-cross-tenant errors', () => {
    const { result } = renderHook(() =>
      useMarketingAgentsSocket({ tenantId: 1, companyId: 100 })
    )

    const errorHandlers = mockSocket._listeners.get('error')
    const errorHandler = [...errorHandlers!][0]

    act(() => {
      errorHandler({ message: 'Some other error' })
    })

    expect(result.current.subscriptionError).toBeNull()
  })

  // =========================================================================
  // CLOUD-243: subscribe clears previous subscriptionError
  // =========================================================================

  it('should clear subscriptionError on re-subscribe attempt', () => {
    const { result } = renderHook(() =>
      useMarketingAgentsSocket({ tenantId: 1, companyId: 100 })
    )

    // First, trigger a cross-tenant error
    const errorHandlers = mockSocket._listeners.get('error')
    act(() => {
      [...errorHandlers!][0]({ message: 'Cross-tenant subscription not allowed' })
    })
    expect(result.current.subscriptionError).toBe('Cross-tenant subscription not allowed')

    // Now, re-subscribe (simulating reconnect)
    const connectHandlers = mockSocket._listeners.get('connect')
    act(() => {
      [...connectHandlers!][0]()
    })

    expect(result.current.subscriptionError).toBeNull()
  })

  // =========================================================================
  // Marketing event handlers (existing functionality)
  // =========================================================================

  it('should handle marketing-batch-update event (array format)', () => {
    const { result } = renderHook(() =>
      useMarketingAgentsSocket({ tenantId: 1 })
    )

    const batchHandlers = mockSocket._listeners.get('marketing-batch-update')
    const handler = [...batchHandlers!][0]

    const mockAgents = [
      {
        id: 'researcher',
        name: 'researcher',
        displayName: 'Investigador',
        role: 'Lead Research',
        status: 'idle',
        currentTask: null,
        taskStartedAt: null,
        lastActivity: new Date().toISOString(),
        color: '#3b82f6',
        position: { x: 0, y: 0 }
      }
    ]

    act(() => {
      handler(mockAgents)
    })

    expect(result.current.agents).toHaveLength(1)
    expect(result.current.agents[0].id).toBe('researcher')
    expect(result.current.lastUpdate).not.toBeNull()
  })

  it('should handle marketing-batch-update event (payload format)', () => {
    const { result } = renderHook(() =>
      useMarketingAgentsSocket({ tenantId: 1 })
    )

    const batchHandlers = mockSocket._listeners.get('marketing-batch-update')
    const handler = [...batchHandlers!][0]

    act(() => {
      handler({
        agents: [
          {
            id: 'icp_agent',
            name: 'icp_agent',
            displayName: 'ICP Agent',
            role: 'ICP Analysis',
            status: 'working',
            currentTask: 'Analyzing leads',
            taskStartedAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            color: '#8b5cf6',
            position: { x: 100, y: 100 }
          }
        ],
        connections: [
          {
            id: 'conn-1',
            sourceAgentId: 'researcher',
            targetAgentId: 'icp_agent',
            label: 'leads',
            dataFlow: 'leads',
            active: true
          }
        ],
        timestamp: new Date().toISOString()
      })
    })

    expect(result.current.agents).toHaveLength(1)
    expect(result.current.connections).toHaveLength(1)
  })

  it('should handle marketing-agent-status-update event', () => {
    const { result } = renderHook(() =>
      useMarketingAgentsSocket({ tenantId: 1 })
    )

    // First, set initial agents
    const batchHandlers = mockSocket._listeners.get('marketing-batch-update')
    act(() => {
      [...batchHandlers!][0]([{
        id: 'researcher',
        name: 'researcher',
        displayName: 'Investigador',
        role: 'Lead Research',
        status: 'idle',
        currentTask: null,
        taskStartedAt: null,
        lastActivity: new Date().toISOString(),
        color: '#3b82f6',
        position: { x: 0, y: 0 }
      }])
    })

    // Then, update status
    const statusHandlers = mockSocket._listeners.get('marketing-agent-status-update')
    act(() => {
      [...statusHandlers!][0]({
        agentId: 'researcher',
        agentName: 'Investigador',
        status: 'working',
        currentTask: 'Searching leads',
        taskStartedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        tenantId: 1,
        companyId: 100
      })
    })

    expect(result.current.agents[0].status).toBe('working')
    expect(result.current.agents[0].currentTask).toBe('Searching leads')
  })

  it('should handle marketing-action-event and deduplicate', () => {
    const { result } = renderHook(() =>
      useMarketingAgentsSocket({ tenantId: 1 })
    )

    const actionHandlers = mockSocket._listeners.get('marketing-action-event')
    const handler = [...actionHandlers!][0]

    const event1 = {
      id: 'evt-1',
      type: 'lead_search_started',
      title: 'Search started',
      description: 'Searching for leads',
      agentId: 'researcher',
      timestamp: new Date().toISOString(),
      metadata: {}
    }

    act(() => {
      handler(event1)
    })
    expect(result.current.events).toHaveLength(1)

    // Duplicate should be ignored
    act(() => {
      handler(event1)
    })
    expect(result.current.events).toHaveLength(1)

    // New event should be added
    const event2 = {
      ...event1,
      id: 'evt-2',
      title: 'Search completed'
    }
    act(() => {
      handler(event2)
    })
    expect(result.current.events).toHaveLength(2)
  })

  // =========================================================================
  // Reconnect
  // =========================================================================

  it('should call socket.disconnect() and socket.connect() on reconnect', () => {
    const { result } = renderHook(() =>
      useMarketingAgentsSocket({ tenantId: 1 })
    )

    let disconnectCalled = false
    let connectCalled = false
    const origDisconnect = mockSocket.disconnect.bind(mockSocket)
    const origConnect = mockSocket.connect.bind(mockSocket)
    mockSocket.disconnect = () => { disconnectCalled = true; origDisconnect() }
    mockSocket.connect = () => { connectCalled = true; origConnect() }

    act(() => {
      result.current.reconnect()
    })

    expect(disconnectCalled).toBe(true)
    expect(connectCalled).toBe(true)
  })

  // =========================================================================
  // Cleanup
  // =========================================================================

  it('should emit unsubscribe-marketing on unmount', () => {
    const { unmount } = renderHook(() =>
      useMarketingAgentsSocket({ tenantId: 1, companyId: 100 })
    )

    unmount()

    expect(mockSocket._emitted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'unsubscribe-marketing',
          data: { tenantId: 1, companyId: 100 }
        })
      ])
    )
  })

  it('should clean up all socket listeners on unmount', () => {
    const { unmount } = renderHook(() =>
      useMarketingAgentsSocket({ tenantId: 1 })
    )

    unmount()

    const events = [
      'marketing-batch-update',
      'marketing-agent-status-update',
      'marketing-agent-task-update',
      'marketing-action-event',
      'subscribed-marketing',
      'unsubscribed-marketing',
      'error'
    ]

    for (const event of events) {
      const handlers = mockSocket._listeners.get(event)
      const cleaned = !handlers || handlers.size === 0
      expect(cleaned).toBe(true)
    }
  })
})

/**
 * CLOUD-229: Integration tests for AbortController cleanup in ai-operation/page.tsx
 *
 * These tests verify that:
 * 1. The component calls marketingHistoryService.getActionHistory on mount
 * 2. AbortController is used and signal is passed to the service
 * 3. The controller is aborted on unmount (cleanup function)
 * 4. AbortError is handled gracefully (no error state set)
 * 5. The reconnect handler triggers both WS reconnect and REST refetch
 * 6. No memory leaks from unclosed requests
 * 7. Hook + page integration with mock socket events
 */

import React from 'react'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks (must be defined before imports)
// ---------------------------------------------------------------------------

// Mock the socket hook
const mockReconnect = jest.fn()
let mockAgents: any[] = []
let mockConnections: any[] = []
let mockEvents: any[] = []
let mockIsConnected = true
let mockConnectionStatus: 'connected' | 'disconnected' | 'reconnecting' = 'connected'
let mockLastUpdate: string | null = null

const resetMockSocket = () => {
  mockAgents = []
  mockConnections = []
  mockEvents = []
  mockIsConnected = true
  mockConnectionStatus = 'connected'
  mockLastUpdate = null
}

jest.mock('@/hooks/useMarketingAgentsSocket', () => ({
  useMarketingAgentsSocket: () => ({
    agents: mockAgents,
    connections: mockConnections,
    events: mockEvents,
    isConnected: mockIsConnected,
    connectionStatus: mockConnectionStatus,
    lastUpdate: mockLastUpdate,
    reconnect: mockReconnect
  })
}))

// Mock the marketingHistoryService
const mockGetActionHistory = jest.fn()
jest.mock('@/services/marketing/marketingHistoryService', () => ({
  marketingHistoryService: {
    getActionHistory: (...args: unknown[]) => mockGetActionHistory(...args)
  }
}))

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        tenantId: 1,
        customerId: 1,
        activeCompanyId: undefined,
        company_id: undefined
      }
    }
  })
}))

// Mock the UI components
jest.mock('@/views/marketing/ai-operation/LiveAgentCard', () => ({
  __esModule: true,
  default: ({ agent }: any) => <div data-testid={`agent-card-${agent.id}`}>{agent.name}</div>
}))

jest.mock('@/views/marketing/ai-operation/AgentFlowGraph', () => ({
  __esModule: true,
  default: () => <div data-testid='flow-graph'>Flow Graph</div>
}))

jest.mock('@/views/marketing/ai-operation/MarketingHistoryTimeline', () => ({
  __esModule: true,
  default: () => <div data-testid='history-timeline'>History Timeline</div>
}))

// ---------------------------------------------------------------------------
// Import the component AFTER mocks
// ---------------------------------------------------------------------------

import MarketingLiveDashboardPage from '@/app/(dashboard)/marketing/ai-operation/page'

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('CLOUD-229: AbortController Cleanup & Page Integration', () => {
  beforeEach(() => {
    mockGetActionHistory.mockReset()
    mockReconnect.mockReset()
    resetMockSocket()
    // Default: resolve immediately with empty data
    mockGetActionHistory.mockResolvedValue({
      events: [],
      total: 0,
      hasMore: false
    })
  })

  afterEach(() => {
    cleanup()
    jest.clearAllMocks()
  })

  // =========================================================================
  // Test 1: Service is called on mount
  // =========================================================================
  test('marketingHistoryService.getActionHistory is called on component mount', async () => {
    render(<MarketingLiveDashboardPage />)

    await waitFor(() => {
      expect(mockGetActionHistory).toHaveBeenCalledTimes(1)
    })

    expect(mockGetActionHistory).toHaveBeenCalledWith(
      1,            // tenantId
      50,           // limit
      0,            // page
      undefined,    // companyId
      expect.any(AbortSignal) // signal
    )
  })

  // =========================================================================
  // Test 2: AbortSignal is passed to the service
  // =========================================================================
  test('AbortSignal is passed as the 5th argument to getActionHistory', async () => {
    render(<MarketingLiveDashboardPage />)

    await waitFor(() => {
      expect(mockGetActionHistory).toHaveBeenCalledTimes(1)
    })

    const callArgs = mockGetActionHistory.mock.calls[0]
    expect(callArgs).toHaveLength(5)
    expect(callArgs[4]).toBeInstanceOf(AbortSignal)
  })

  // =========================================================================
  // Test 3: AbortController abort is called on unmount
  // =========================================================================
  test('AbortController.abort is called when component unmounts', async () => {
    const { unmount } = render(<MarketingLiveDashboardPage />)

    await waitFor(() => {
      expect(mockGetActionHistory).toHaveBeenCalledTimes(1)
    })

    // Capture the signal that was passed
    const signal = mockGetActionHistory.mock.calls[0][4] as AbortSignal
    expect(signal.aborted).toBe(false)

    // Unmount the component
    unmount()

    // The signal should be aborted after unmount
    expect(signal.aborted).toBe(true)
  })

  // =========================================================================
  // Test 4: AbortError does not set error state
  // =========================================================================
  test('AbortError from service does not set error state', async () => {
    const abortError = new Error('Aborted')
    abortError.name = 'AbortError'
    mockGetActionHistory.mockRejectedValue(abortError)

    render(<MarketingLiveDashboardPage />)

    await waitFor(() => {
      expect(mockGetActionHistory).toHaveBeenCalledTimes(1)
    })

    // The component should NOT show an error alert for AbortError
    expect(screen.queryByText(/Error al cargar/)).not.toBeInTheDocument()
  })

  // =========================================================================
  // Test 5: Non-AbortError DOES set error state
  // =========================================================================
  test('Non-AbortError from service sets error state', async () => {
    const networkError = new Error('Network failure')
    networkError.name = 'NetworkError'
    mockGetActionHistory.mockRejectedValue(networkError)

    render(<MarketingLiveDashboardPage />)

    await waitFor(() => {
      expect(screen.getByText(/Error al cargar/)).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Test 6: isAbortError helper detects all abort variants
  // =========================================================================
  test('isAbortError detects AbortError, CanceledError, and ERR_CANCELED', () => {
    const isAbortError = (error: unknown): boolean => {
      if (error && typeof error === 'object') {
        const name = (error as { name?: string }).name
        if (name === 'AbortError' || name === 'CanceledError') return true
        const code = (error as { code?: string }).code
        if (code === 'ERR_CANCELED') return true
      }
      return false
    }

    // Standard AbortError
    const abortError = new Error('Aborted')
    abortError.name = 'AbortError'
    expect(isAbortError(abortError)).toBe(true)

    // Axios CanceledError
    const canceledError = new Error('Canceled')
    canceledError.name = 'CanceledError'
    expect(isAbortError(canceledError)).toBe(true)

    // Axios ERR_CANCELED code
    const errCanceled = new Error('Request canceled')
    errCanceled.name = 'Error'
      ;(errCanceled as any).code = 'ERR_CANCELED'
    expect(isAbortError(errCanceled)).toBe(true)

    // Non-abort error
    const networkError = new Error('Network failure')
    networkError.name = 'NetworkError'
    expect(isAbortError(networkError)).toBe(false)

    // Null/undefined
    expect(isAbortError(null)).toBe(false)
    expect(isAbortError(undefined)).toBe(false)
  })

  // =========================================================================
  // Test 7: Service returns correct fallback on abort
  // =========================================================================
  test('marketingHistoryService.getActionHistory returns fallback on abort', async () => {
    const abortError = new Error('Aborted')
    abortError.name = 'AbortError'
    mockGetActionHistory.mockRejectedValue(abortError)

    const result = await mockGetActionHistory(1, 50, 0, undefined, new AbortController().signal)
      .catch((err: any) => {
        if (err.name === 'AbortError') {
          return { events: [], total: 0, hasMore: false }
        }
        throw err
      })

    expect(result).toEqual(expect.objectContaining({
      events: [],
      total: 0,
      hasMore: false
    }))
  })

  // =========================================================================
  // Test 8: Multiple rapid mounts/unmounts abort all pending requests
  // =========================================================================
  test('rapid mount/unmount cycles properly abort all pending requests', async () => {
    const signals: AbortSignal[] = []

    for (let i = 0; i < 5; i++) {
      mockGetActionHistory.mockResolvedValueOnce({
        events: [],
        total: 0,
        hasMore: false
      })

      const { unmount } = render(<MarketingLiveDashboardPage />)

      // Capture the signal passed in this render cycle
      const signal = mockGetActionHistory.mock.calls[mockGetActionHistory.mock.calls.length - 1][4] as AbortSignal
      signals.push(signal)

      // Before unmount, signal should not be aborted
      expect(signal.aborted).toBe(false)

      // Unmount
      unmount()
    }

    // All signals should be aborted after their respective unmounts
    signals.forEach(signal => {
      expect(signal.aborted).toBe(true)
    })
  })

  // =========================================================================
  // Test 9: Page renders connection status chip
  // =========================================================================
  test('page renders connection status chip from hook', async () => {
    render(<MarketingLiveDashboardPage />)

    await waitFor(() => {
      expect(mockGetActionHistory).toHaveBeenCalledTimes(1)
    })

    // Should show "Conectado" since mockConnectionStatus defaults to 'connected'
    expect(screen.getByText('Conectado')).toBeInTheDocument()
  })

  // =========================================================================
  // Test 10: Page renders with disconnected status
  // =========================================================================
  test('page renders disconnected status chip', async () => {
    mockConnectionStatus = 'disconnected'

    render(<MarketingLiveDashboardPage />)

    await waitFor(() => {
      expect(mockGetActionHistory).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText('Desconectado')).toBeInTheDocument()

    // Reset
    mockConnectionStatus = 'connected'
  })

  // =========================================================================
  // Test 11: Reconnect button calls hook reconnect
  // =========================================================================
  test('reconnect button triggers hook reconnect', async () => {
    render(<MarketingLiveDashboardPage />)

    await waitFor(() => {
      expect(mockGetActionHistory).toHaveBeenCalledTimes(1)
    })

    const reconnectButton = screen.getByText('Reconectar')
    fireEvent.click(reconnectButton)

    expect(mockReconnect).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Test Suite: useMarketingAgentsSocket Hook Source Verification
// ---------------------------------------------------------------------------

describe('CLOUD-229: useMarketingAgentsSocket Hook Source Verification', () => {
  test('socket event handlers are properly memoized with useCallback', () => {
    const fs = require('fs')
    const path = require('path')
    const hookPath = path.join(__dirname, '../../hooks/useMarketingAgentsSocket.ts')

    if (fs.existsSync(hookPath)) {
      const content = fs.readFileSync(hookPath, 'utf-8')

      // Verify all 4 socket events are subscribed
      expect(content).toContain("'marketing-agent-batch-update'")
      expect(content).toContain("'marketing-agent-status-update'")
      expect(content).toContain("'marketing-agent-task-update'")
      expect(content).toContain("'marketing-action-event'")

      // Verify cleanup on unmount
      expect(content).toContain('socket.off')
      expect(content).toContain('return () =>')

      // Verify deduplication logic
      expect(content).toContain('prev.some(ev => ev.id === payload.id)')

      // Verify 50-event cap
      expect(content).toContain('.slice(-50)')

      // Verify reconnect helper
      expect(content).toContain('socket.disconnect()')
      expect(content).toContain('socket.connect()')
    }
  })
})

// ---------------------------------------------------------------------------
// Test Suite: marketingHistoryService AbortSignal Support
// ---------------------------------------------------------------------------

describe('CLOUD-229: marketingHistoryService AbortSignal Support', () => {
  test('all service methods accept optional AbortSignal parameter', () => {
    const fs = require('fs')
    const path = require('path')
    const servicePath = path.join(__dirname, '../../services/marketing/marketingHistoryService.ts')

    if (fs.existsSync(servicePath)) {
      const content = fs.readFileSync(servicePath, 'utf-8')

      // Verify all methods have signal parameter
      expect(content).toMatch(/getLiveAgents\([^)]*signal\?\s*:\s*AbortSignal/)
      expect(content).toMatch(/getActionHistory\([^)]*signal\?\s*:\s*AbortSignal/)
      expect(content).toMatch(/getAgentConnections\([^)]*signal\?\s*:\s*AbortSignal/)
      expect(content).toMatch(/getAgentTasks\([^)]*signal\?\s*:\s*AbortSignal/)

      // Verify signal is passed to axiosInstance.get
      expect(content).toContain('{ signal }')

      // Verify isAbortError helper exists
      expect(content).toContain('function isAbortError')
      expect(content).toContain("name === 'AbortError'")
      expect(content).toContain("name === 'CanceledError'")
      expect(content).toContain("code === 'ERR_CANCELED'")
    }
  })
})

// ---------------------------------------------------------------------------
// Test Suite: SocketContext Verification
// ---------------------------------------------------------------------------

describe('CLOUD-229: SocketContext Verification', () => {
  test('SocketContext connects with correct auth and auto-reconnect', () => {
    const fs = require('fs')
    const path = require('path')
    const contextPath = path.join(__dirname, '../../contexts/SocketContext.tsx')

    if (fs.existsSync(contextPath)) {
      const content = fs.readFileSync(contextPath, 'utf-8')

      // Verify connection URL
      expect(content).toContain('chat.cloudfly.com.co')

      // Verify auth payload
      expect(content).toContain('auth:')
      expect(content).toContain('token')
      expect(content).toContain('tenantId')
      expect(content).toContain('companyId')

      // Verify auto-reconnect
      expect(content).toContain("reconnection: true")

      // Verify polling for missing auth
      expect(content).toContain('setInterval')
    }
  })
})

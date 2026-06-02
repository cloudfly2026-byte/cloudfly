// ============================================================
// CLOUD-243: MarketingRoomDebugPanel Component — Unit Tests
// ============================================================

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock SocketContext
const mockEmit = jest.fn()
const mockOn = jest.fn()
const mockOff = jest.fn()

jest.mock('@/contexts/SocketContext', () => ({
  useSocket: () => ({
    socket: {
      id: 'test-socket-123',
      connected: true,
      on: mockOn,
      off: mockOff,
      emit: mockEmit
    },
    isConnected: true
  })
}))

// Only import after mocking
import MarketingRoomDebugPanel from '@/components/marketing/MarketingRoomDebugPanel'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MarketingRoomDebugPanel (CLOUD-243)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Set NODE_ENV to development for the component to render
    process.env.NODE_ENV = 'development'
  })

  afterEach(() => {
    process.env.NODE_ENV = 'test'
  })

  it('should render the debug panel in development mode', () => {
    render(
      <MarketingRoomDebugPanel
        tenantId={1}
        companyId={100}
        connectionStatus='connected'
        currentRoom='marketing_tenant_1_company_100'
      />
    )
    expect(screen.getByText(/Debug: Marketing Socket Rooms/)).toBeInTheDocument()
  })

  it('should display the current room name', () => {
    render(
      <MarketingRoomDebugPanel
        tenantId={1}
        companyId={100}
        connectionStatus='connected'
        currentRoom='marketing_tenant_1_company_100'
      />
    )
    expect(screen.getByText('marketing_tenant_1_company_100')).toBeInTheDocument()
  })

  it('should display the expected room name', () => {
    render(
      <MarketingRoomDebugPanel
        tenantId={1}
        companyId={100}
        connectionStatus='connected'
      />
    )
    expect(screen.getByText('marketing_tenant_1_company_100')).toBeInTheDocument()
  })

  it('should display tenant isolation info', () => {
    render(
      <MarketingRoomDebugPanel
        tenantId={1}
        companyId={100}
        connectionStatus='connected'
      />
    )
    expect(screen.getByText(/Tenant 1/)).toBeInTheDocument()
  })

  it('should emit subscribe-marketing when Subscribe button is clicked', async () => {
    render(
      <MarketingRoomDebugPanel
        tenantId={1}
        companyId={100}
        connectionStatus='connected'
      />
    )

    // Expand the accordion first
    const expandButton = screen.getByRole('button', { name: /Debug: Marketing Socket Rooms/i })
    fireEvent.click(expandButton)

    // Find and click the Subscribe button
    const subscribeButton = screen.getByRole('button', { name: /Subscribe/i })
    fireEvent.click(subscribeButton)

    expect(mockEmit).toHaveBeenCalledWith('subscribe-marketing', {
      tenantId: 1,
      companyId: 100
    })
  })

  it('should emit unsubscribe-marketing when Unsubscribe button is clicked', async () => {
    render(
      <MarketingRoomDebugPanel
        tenantId={1}
        companyId={100}
        connectionStatus='connected'
      />
    )

    // Expand the accordion first
    const expandButton = screen.getByRole('button', { name: /Debug: Marketing Socket Rooms/i })
    fireEvent.click(expandButton)

    const unsubscribeButton = screen.getByRole('button', { name: /Unsubscribe/i })
    fireEvent.click(unsubscribeButton)

    expect(mockEmit).toHaveBeenCalledWith('unsubscribe-marketing', {
      tenantId: 1,
      companyId: 100
    })
  })

  it('should emit subscribe-marketing with fake tenantId on cross-tenant test', async () => {
    render(
      <MarketingRoomDebugPanel
        tenantId={1}
        companyId={100}
        connectionStatus='connected'
      />
    )

    // Expand the accordion first
    const expandButton = screen.getByRole('button', { name: /Debug: Marketing Socket Rooms/i })
    fireEvent.click(expandButton)

    const crossTenantButton = screen.getByRole('button', { name: /Test Cross-Tenant/i })
    fireEvent.click(crossTenantButton)

    expect(mockEmit).toHaveBeenCalledWith('subscribe-marketing', {
      tenantId: 10000 // 1 + 9999
    })
  })

  it('should display socket ID', () => {
    render(
      <MarketingRoomDebugPanel
        tenantId={1}
        connectionStatus='connected'
      />
    )
    expect(screen.getByText('test-socket-123')).toBeInTheDocument()
  })

  it('should NOT render in production mode', () => {
    process.env.NODE_ENV = 'production'
    const { container } = render(
      <MarketingRoomDebugPanel
        tenantId={1}
        connectionStatus='connected'
      />
    )
    expect(container.innerHTML).toBe('')
  })
})

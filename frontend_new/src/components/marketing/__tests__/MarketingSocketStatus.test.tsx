// ============================================================
// CLOUD-243: MarketingSocketStatus Component — Unit Tests
// ============================================================

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import MarketingSocketStatus from '@/components/marketing/MarketingSocketStatus'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MarketingSocketStatus (CLOUD-243)', () => {
  // =========================================================================
  // Compact Mode
  // =========================================================================

  it('should render compact chip for connected status', () => {
    render(
      <MarketingSocketStatus
        connectionStatus='connected'
        compact
      />
    )
    expect(screen.getByText('Conectado')).toBeInTheDocument()
  })

  it('should render compact chip for disconnected status', () => {
    render(
      <MarketingSocketStatus
        connectionStatus='disconnected'
        compact
      />
    )
    expect(screen.getByText('Desconectado')).toBeInTheDocument()
  })

  it('should render compact chip for reconnecting status', () => {
    render(
      <MarketingSocketStatus
        connectionStatus='reconnecting'
        compact
      />
    )
    expect(screen.getByText('Reconectando...')).toBeInTheDocument()
  })

  // =========================================================================
  // Full Mode
  // =========================================================================

  it('should render full status card with room name', () => {
    render(
      <MarketingSocketStatus
        connectionStatus='connected'
        roomName='marketing_tenant_1_company_100'
        tenantId={1}
        companyId={100}
      />
    )
    expect(screen.getByText('Conectado')).toBeInTheDocument()
    expect(screen.getByText('marketing_tenant_1_company_100')).toBeInTheDocument()
  })

  it('should render tenant isolation badge', () => {
    render(
      <MarketingSocketStatus
        connectionStatus='connected'
        tenantId={1}
        companyId={100}
        showSecurityBadge
      />
    )
    expect(screen.getByText(/Tenant 1/)).toBeInTheDocument()
  })

  it('should render last update relative time', () => {
    const lastUpdate = new Date(Date.now() - 60000).toISOString() // 1 minute ago
    render(
      <MarketingSocketStatus
        connectionStatus='connected'
        lastUpdate={lastUpdate}
        tenantId={1}
      />
    )
    // The relative time should be displayed (e.g., "Hace 1 minuto")
    expect(screen.getByText(/Última actualización:/)).toBeInTheDocument()
  })

  it('should NOT render security badge when showSecurityBadge is false', () => {
    render(
      <MarketingSocketStatus
        connectionStatus='connected'
        tenantId={1}
        showSecurityBadge={false}
      />
    )
    expect(screen.queryByText(/Tenant 1/)).not.toBeInTheDocument()
  })

  it('should render disconnected state with correct styling', () => {
    render(
      <MarketingSocketStatus
        connectionStatus='disconnected'
        tenantId={1}
      />
    )
    expect(screen.getByText('Desconectado')).toBeInTheDocument()
  })

  it('should render reconnecting state with correct styling', () => {
    render(
      <MarketingSocketStatus
        connectionStatus='reconnecting'
        tenantId={1}
      />
    )
    expect(screen.getByText('Reconectando...')).toBeInTheDocument()
  })

  it('should render without room name when not provided', () => {
    render(
      <MarketingSocketStatus
        connectionStatus='connected'
        tenantId={1}
      />
    )
    // Should not crash when roomName is null
    expect(screen.getByText('Conectado')).toBeInTheDocument()
  })
})

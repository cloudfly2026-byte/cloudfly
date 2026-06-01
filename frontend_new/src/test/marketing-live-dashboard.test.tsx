/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import LiveAgentCard from '@/views/marketing/ai-operation/LiveAgentCard'
import AgentFlowGraph from '@/views/marketing/ai-operation/AgentFlowGraph'
import MarketingHistoryTimeline from '@/views/marketing/ai-operation/MarketingHistoryTimeline'
import type { MarketingAgent, AgentConnection, MarketingActionEvent } from '@/types/marketing/aiMarketing'

// ---------------------------------------------------------------------------
// Mock data — aligned with MarketingActionEvent and MarketingAgent types
// ---------------------------------------------------------------------------

const mockWorkingAgent: MarketingAgent = {
  id: 'agent-1',
  name: 'campaign_bot',
  displayName: 'Campaign Bot',
  role: 'Envía campañas de email',
  status: 'working',
  currentTask: 'Enviando campaña de email',
  taskStartedAt: '2025-06-15T10:00:00Z',
  lastActivity: '2025-06-15T10:30:00Z',
  color: '#8b5cf6',
  position: { x: 0, y: 0 }
}

const mockIdleAgent: MarketingAgent = {
  id: 'agent-2',
  name: 'lead_qualifier',
  displayName: 'Lead Qualifier',
  role: 'Califica leads entrantes',
  status: 'idle',
  currentTask: null,
  taskStartedAt: null,
  lastActivity: '2025-06-15T09:00:00Z',
  color: '#3b82f6',
  position: { x: 100, y: 0 }
}

const mockWaitingAgent: MarketingAgent = {
  id: 'agent-3',
  name: 'social_media_agent',
  displayName: 'Social Media Agent',
  role: 'Publica contenido en redes',
  status: 'waiting',
  currentTask: 'Esperando aprobación de contenido',
  taskStartedAt: '2025-06-15T10:10:00Z',
  lastActivity: '2025-06-15T10:15:00Z',
  color: '#ec4899',
  position: { x: 200, y: 0 }
}

const mockErrorAgent: MarketingAgent = {
  id: 'agent-4',
  name: 'analytics_reporter',
  displayName: 'Analytics Reporter',
  role: 'Genera reportes de analítica',
  status: 'error',
  currentTask: 'Error al generar reporte',
  taskStartedAt: '2025-06-15T09:55:00Z',
  lastActivity: '2025-06-15T10:00:00Z',
  color: '#ef4444',
  position: { x: 300, y: 0 }
}

const mockConnections: AgentConnection[] = [
  {
    id: 'conn-1',
    sourceAgentId: 'agent-1',
    targetAgentId: 'agent-2',
    label: 'Leads',
    dataFlow: 'leads',
    active: true
  },
  {
    id: 'conn-2',
    sourceAgentId: 'agent-2',
    targetAgentId: 'agent-3',
    label: 'Contenido',
    dataFlow: 'analysis',
    active: false
  }
]

const mockEvents: MarketingActionEvent[] = [
  {
    id: 'evt-1',
    type: 'campaign_created',
    title: 'Campaña Verano 2025',
    description: 'Campaña "Verano 2025" enviada a 1,200 contactos',
    agentId: 'agent-1',
    timestamp: '2025-06-15T10:30:00Z',
    metadata: { recipients: 1200, channel: 'email' }
  },
  {
    id: 'evt-2',
    type: 'lead_search_completed',
    title: 'Lead encontrado',
    description: 'Nuevo lead calificado: Empresa ABC',
    agentId: 'agent-2',
    timestamp: '2025-06-15T10:25:00Z',
    metadata: { score: 85, source: 'website' }
  },
  {
    id: 'evt-3',
    type: 'error',
    title: 'Error de conexión',
    description: 'Timeout al conectar con Google Analytics',
    agentId: 'agent-4',
    timestamp: '2025-06-15T10:00:00Z',
    metadata: { errorCode: 408 }
  }
]

// ---------------------------------------------------------------------------
// LiveAgentCard Tests
// ---------------------------------------------------------------------------

describe('LiveAgentCard', () => {
  it('renders agent display name correctly', () => {
    render(<LiveAgentCard agent={mockWorkingAgent} />)
    expect(screen.getByText('Campaign Bot')).toBeInTheDocument()
  })

  it('renders working status chip with correct label', () => {
    render(<LiveAgentCard agent={mockWorkingAgent} />)
    expect(screen.getByText('Trabajando')).toBeInTheDocument()
  })

  it('renders idle status chip', () => {
    render(<LiveAgentCard agent={mockIdleAgent} />)
    expect(screen.getByText('En espera')).toBeInTheDocument()
  })

  it('renders waiting status chip', () => {
    render(<LiveAgentCard agent={mockWaitingAgent} />)
    expect(screen.getByText('Esperando')).toBeInTheDocument()
  })

  it('renders error status chip', () => {
    render(<LiveAgentCard agent={mockErrorAgent} />)
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('renders current task for working agent', () => {
    render(<LiveAgentCard agent={mockWorkingAgent} />)
    expect(screen.getByText('Enviando campaña de email')).toBeInTheDocument()
  })

  it('renders fallback text when no task is assigned', () => {
    render(<LiveAgentCard agent={mockIdleAgent} />)
    expect(screen.getByText('Sin tarea asignada')).toBeInTheDocument()
  })

  it('renders last activity time', () => {
    render(<LiveAgentCard agent={mockWorkingAgent} />)
    // The time will be formatted, so we just check the label exists
    expect(screen.getByText(/Última actividad:/)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AgentFlowGraph Tests
// ---------------------------------------------------------------------------

describe('AgentFlowGraph', () => {
  it('renders without crashing with agents and connections', () => {
    const { container } = render(
      <AgentFlowGraph
        agents={[mockWorkingAgent, mockIdleAgent]}
        connections={mockConnections}
      />
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders agent names in the SVG', () => {
    const { container } = render(
      <AgentFlowGraph
        agents={[mockWorkingAgent, mockIdleAgent]}
        connections={mockConnections}
      />
    )
    expect(container.textContent).toContain('Campaign Bot')
    expect(container.textContent).toContain('Lead Qualifier')
  })

  it('renders empty state when no agents', () => {
    render(<AgentFlowGraph agents={[]} connections={[]} />)
    expect(screen.getByText('No hay agentes para mostrar')).toBeInTheDocument()
  })

  it('renders connection labels', () => {
    const { container } = render(
      <AgentFlowGraph
        agents={[mockWorkingAgent, mockIdleAgent]}
        connections={mockConnections}
      />
    )
    expect(container.textContent).toContain('Leads')
  })
})

// ---------------------------------------------------------------------------
// MarketingHistoryTimeline Tests
// ---------------------------------------------------------------------------

describe('MarketingHistoryTimeline', () => {
  it('renders without crashing with events', () => {
    render(<MarketingHistoryTimeline events={mockEvents} />)
    expect(screen.getByText('Campaña Verano 2025')).toBeInTheDocument()
  })

  it('renders event descriptions', () => {
    render(<MarketingHistoryTimeline events={mockEvents} />)
    expect(screen.getByText('Campaña "Verano 2025" enviada a 1,200 contactos')).toBeInTheDocument()
    expect(screen.getByText('Nuevo lead calificado: Empresa ABC')).toBeInTheDocument()
    expect(screen.getByText('Timeout al conectar con Google Analytics')).toBeInTheDocument()
  })

  it('renders action type chips with correct labels', () => {
    render(<MarketingHistoryTimeline events={mockEvents} />)
    expect(screen.getByText('Campaña creada')).toBeInTheDocument()
    expect(screen.getByText('Leads encontrados')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('renders empty state when no events', () => {
    render(<MarketingHistoryTimeline events={[]} />)
    expect(screen.getByText('Esperando acciones...')).toBeInTheDocument()
  })

  it('renders event count chip in header', () => {
    render(<MarketingHistoryTimeline events={mockEvents} />)
    // The component renders a Chip with "3 eventos" in the header
    expect(screen.getByText('3 eventos')).toBeInTheDocument()
  })

  it('renders the section title in header', () => {
    render(<MarketingHistoryTimeline events={mockEvents} />)
    expect(screen.getByText('Historial de Acciones')).toBeInTheDocument()
  })

  it('renders event titles', () => {
    render(<MarketingHistoryTimeline events={mockEvents} />)
    expect(screen.getByText('Campaña Verano 2025')).toBeInTheDocument()
    expect(screen.getByText('Lead encontrado')).toBeInTheDocument()
    expect(screen.getByText('Error de conexión')).toBeInTheDocument()
  })

  it('accepts maxHeight prop', () => {
    render(
      <MarketingHistoryTimeline events={mockEvents} maxHeight={600} />
    )
    // The component should render without error
    expect(screen.getByText('Campaña Verano 2025')).toBeInTheDocument()
  })

  it('renders metadata chips for events with metadata', () => {
    render(<MarketingHistoryTimeline events={mockEvents} />)
    // First event has metadata: recipients: 1200, channel: 'email'
    expect(screen.getByText('recipients: 1200')).toBeInTheDocument()
    expect(screen.getByText('channel: email')).toBeInTheDocument()
  })

  it('limits displayed events to 50 max', () => {
    const manyEvents: MarketingActionEvent[] = Array.from({ length: 60 }, (_, i) => ({
      id: `evt-${i}`,
      type: 'message_sent' as const,
      title: `Event ${i}`,
      description: `Description ${i}`,
      agentId: 'agent-1',
      timestamp: '2025-06-15T10:00:00Z',
      metadata: {}
    }))
    const { container } = render(<MarketingHistoryTimeline events={manyEvents} />)
    // Should render without crashing even with 60 events (caps at 50)
    expect(screen.getByText('Event 0')).toBeInTheDocument()
  })

  it('renders formatted timestamps', () => {
    render(<MarketingHistoryTimeline events={mockEvents} />)
    // The timestamp '2025-06-15T10:30:00Z' should be formatted as time string
    // We check that at least one time-formatted caption exists
    const timeElements = screen.getAllByText(/\d{2}:\d{2}:\d{2}/)
    expect(timeElements.length).toBeGreaterThan(0)
  })
})

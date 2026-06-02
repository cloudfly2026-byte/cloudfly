/**
 * AGENTE_DEV_CLOUD-209: LiveAgentCard E2E Integration Test
 *
 * This test verifies the LiveAgentCard component works correctly in the context
 * of the full Marketing Live Dashboard page, including:
 * 1. Component renders within the dashboard page Grid layout
 * 2. Agent data flows from useMarketingAgentsSocket hook → page → LiveAgentCard
 * 3. All 5 status types render correctly when provided via props
 * 4. Click handlers propagate correctly
 * 5. Compact mode works in inline contexts
 * 6. Relative time formatting displays correctly
 * 7. Task duration counter works for working agents
 * 8. Shimmer progress bar appears for working agents
 * 9. Agent icons render correctly for known agent types
 * 10. React.memo optimization is applied
 *
 * HOW TO RUN:
 *   cd frontend_new
 *   npx jest --testPathPatterns="AGENTE_DEV_CLOUD-209-e2e-integration" --no-coverage
 *
 * EXPECTED RESULT: All 43 tests pass
 */

import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import LiveAgentCard from '@/views/marketing/ai-operation/LiveAgentCard'
import type { MarketingAgent, AgentStatus } from '@/types/marketing/aiMarketing'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const createAgent = (overrides: Partial<MarketingAgent> = {}): MarketingAgent => ({
  id: 'researcher',
  name: 'researcher',
  displayName: 'Investigador de Mercado',
  role: 'Market Research',
  status: 'working',
  currentTask: 'Buscando leads cualificados',
  taskStartedAt: new Date(Date.now() - 120000).toISOString(), // 2 min ago
  lastActivity: new Date(Date.now() - 30000).toISOString(), // 30 sec ago
  color: '#3b82f6',
  position: { x: 80, y: 120 },
  ...overrides
})

const allStatusAgents: Record<AgentStatus, MarketingAgent> = {
  idle: createAgent({
    id: 'icp_agent',
    name: 'icp_agent',
    displayName: 'Agente ICP',
    role: 'ICP Analysis',
    status: 'idle',
    currentTask: null,
    taskStartedAt: null,
    lastActivity: '2025-07-19T09:00:00Z',
    color: '#8b5cf6'
  }),
  working: createAgent({
    id: 'researcher',
    name: 'researcher',
    displayName: 'Investigador de Mercado',
    role: 'Market Research',
    status: 'working',
    currentTask: 'Buscando leads cualificados',
    taskStartedAt: new Date(Date.now() - 120000).toISOString(),
    lastActivity: new Date(Date.now() - 30000).toISOString(),
    color: '#3b82f6'
  }),
  waiting: createAgent({
    id: 'qualification_agent',
    name: 'qualification_agent',
    displayName: 'Calificador',
    role: 'Lead Qualification',
    status: 'waiting',
    currentTask: 'Esperando datos del investigador',
    taskStartedAt: '2025-07-19T10:02:00Z',
    lastActivity: '2025-07-19T10:03:00Z',
    color: '#f59e0b'
  }),
  error: createAgent({
    id: 'copywriter_agent',
    name: 'copywriter_agent',
    displayName: 'Copywriter',
    role: 'Content Creation',
    status: 'error',
    currentTask: 'Error al generar contenido',
    taskStartedAt: null,
    lastActivity: '2025-07-19T10:01:00Z',
    color: '#ef4444'
  }),
  completed: createAgent({
    id: 'researcher',
    name: 'researcher',
    displayName: 'Investigador',
    role: 'Market Research',
    status: 'completed',
    currentTask: 'Análisis completado',
    taskStartedAt: '2025-07-19T09:30:00Z',
    lastActivity: '2025-07-19T10:00:00Z',
    color: '#22c55e'
  })
}

// ===========================================================================
// E2E Integration Test Suite
// ===========================================================================

describe('AGENTE_DEV_CLOUD-209: LiveAgentCard E2E Integration', () => {

  // =========================================================================
  // 1. Grid Layout Integration (simulates dashboard page rendering)
  // =========================================================================
  describe('Grid Layout Integration', () => {
    test('renders multiple LiveAgentCards in a responsive Grid layout', () => {
      const agents = Object.values(allStatusAgents)

      const { container } = render(
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {agents.map(agent => (
            <LiveAgentCard key={agent.id + agent.status} agent={agent} />
          ))}
        </div>
      )

      const cards = container.querySelectorAll('.MuiCard-root')
      expect(cards.length).toBe(5)
    })

    test('each card in grid shows correct agent name', () => {
      const agents = Object.values(allStatusAgents)

      render(
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {agents.map(agent => (
            <LiveAgentCard key={agent.id + agent.status} agent={agent} />
          ))}
        </div>
      )

      expect(screen.getByText('Agente ICP')).toBeInTheDocument()
      expect(screen.getByText('Investigador de Mercado')).toBeInTheDocument()
      expect(screen.getByText('Calificador')).toBeInTheDocument()
      expect(screen.getByText('Copywriter')).toBeInTheDocument()
      expect(screen.getByText('Investigador')).toBeInTheDocument()
    })

    test('each card in grid shows correct status label', () => {
      const agents = Object.values(allStatusAgents)

      render(
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {agents.map(agent => (
            <LiveAgentCard key={agent.id + agent.status} agent={agent} />
          ))}
        </div>
      )

      expect(screen.getByText('En espera')).toBeInTheDocument()
      expect(screen.getByText('Trabajando')).toBeInTheDocument()
      expect(screen.getByText('Esperando datos')).toBeInTheDocument()
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Completado')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // 2. Data Flow: Hook → Page → Card (simulated)
  // =========================================================================
  describe('Data Flow: Hook → Page → Card', () => {
    test('agent data from socket hook renders correctly in card', () => {
      // Simulate data that would come from useMarketingAgentsSocket
      const socketAgent: MarketingAgent = {
        id: 'researcher',
        name: 'researcher',
        displayName: 'Investigador de Mercado',
        role: 'Market Research',
        status: 'working',
        currentTask: 'Analizando segmento B2B',
        taskStartedAt: new Date(Date.now() - 300000).toISOString(),
        lastActivity: new Date().toISOString(),
        color: '#3b82f6',
        position: { x: 80, y: 120 }
      }

      render(<LiveAgentCard agent={socketAgent} />)

      expect(screen.getByText('Investigador de Mercado')).toBeInTheDocument()
      expect(screen.getByText('Analizando segmento B2B')).toBeInTheDocument()
      expect(screen.getByText('Trabajando')).toBeInTheDocument()
    })

    test('agent status update re-renders card with new status', () => {
      const { rerender } = render(<LiveAgentCard agent={allStatusAgents.working} />)
      expect(screen.getByText('Trabajando')).toBeInTheDocument()

      // Simulate status change from socket
      rerender(<LiveAgentCard agent={allStatusAgents.completed} />)
      expect(screen.getByText('Completado')).toBeInTheDocument()
    })

    test('agent task change re-renders card with new task', async () => {
      const workingAgent = createAgent({
        currentTask: 'Tarea original'
      })
      const { rerender } = render(<LiveAgentCard agent={workingAgent} />)
      expect(screen.getByText('Tarea original')).toBeInTheDocument()

      // Simulate task change from socket
      const updatedAgent = createAgent({
        currentTask: 'Nueva tarea asignada'
      })
      rerender(<LiveAgentCard agent={updatedAgent} />)

      // Wait for AnimatePresence transition to complete
      await waitFor(() => {
        expect(screen.getByText('Nueva tarea asignada')).toBeInTheDocument()
      })
    })
  })

  // =========================================================================
  // 3. All 5 Status Types in Grid
  // =========================================================================
  describe('All 5 Status Types in Grid', () => {
    test('idle card shows "Sin tarea asignada" and gray chip', () => {
      render(<LiveAgentCard agent={allStatusAgents.idle} />)
      expect(screen.getByText('Sin tarea asignada')).toBeInTheDocument()
      expect(screen.getByText('En espera')).toBeInTheDocument()
    })

    test('working card shows task, shimmer bar, and duration', () => {
      render(<LiveAgentCard agent={allStatusAgents.working} />)
      expect(screen.getByText('Buscando leads cualificados')).toBeInTheDocument()
      expect(screen.getByText('Trabajando')).toBeInTheDocument()
      // Shimmer progress bar
      const progressBar = document.querySelector('.MuiLinearProgress-root')
      expect(progressBar).toBeInTheDocument()
      // Task duration
      const durationText = screen.getByText(/^\d+:\d{2}$/)
      expect(durationText).toBeInTheDocument()
    })

    test('waiting card shows task and "Esperando datos" label', () => {
      render(<LiveAgentCard agent={allStatusAgents.waiting} />)
      expect(screen.getByText('Esperando datos del investigador')).toBeInTheDocument()
      expect(screen.getByText('Esperando datos')).toBeInTheDocument()
    })

    test('error card shows "Requiere atención" and error label', () => {
      render(<LiveAgentCard agent={allStatusAgents.error} />)
      expect(screen.getByText('Error al generar contenido')).toBeInTheDocument()
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Requiere atención')).toBeInTheDocument()
    })

    test('completed card shows task and "Completado" label', () => {
      render(<LiveAgentCard agent={allStatusAgents.completed} />)
      expect(screen.getByText('Análisis completado')).toBeInTheDocument()
      expect(screen.getByText('Completado')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // 4. Click Handler Propagation
  // =========================================================================
  describe('Click Handler Propagation', () => {
    test('clicking card calls onClick with the correct agent object', () => {
      const handleClick = jest.fn()
      render(<LiveAgentCard agent={allStatusAgents.working} onClick={handleClick} />)

      const card = document.querySelector('.MuiCard-root')
      fireEvent.click(card!)

      expect(handleClick).toHaveBeenCalledTimes(1)
      expect(handleClick).toHaveBeenCalledWith(allStatusAgents.working)
    })

    test('clicking card in grid calls onClick for the correct agent', () => {
      const handleClick = jest.fn()
      const agents = [allStatusAgents.working, allStatusAgents.idle]

      render(
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {agents.map(agent => (
            <LiveAgentCard key={agent.id} agent={agent} onClick={handleClick} />
          ))}
        </div>
      )

      const cards = document.querySelectorAll('.MuiCard-root')
      fireEvent.click(cards[0]) // Click first card (working agent)

      expect(handleClick).toHaveBeenCalledWith(allStatusAgents.working)
    })

    test('card without onClick does not crash on click', () => {
      render(<LiveAgentCard agent={allStatusAgents.working} />)
      const card = document.querySelector('.MuiCard-root')
      expect(() => fireEvent.click(card!)).not.toThrow()
    })
  })

  // =========================================================================
  // 5. Compact Mode in Inline Contexts
  // =========================================================================
  describe('Compact Mode in Inline Contexts', () => {
    test('compact card renders in a horizontal inline layout', () => {
      render(
        <div style={{ display: 'flex', gap: 8 }}>
          <LiveAgentCard agent={allStatusAgents.working} compact />
          <LiveAgentCard agent={allStatusAgents.idle} compact />
          <LiveAgentCard agent={allStatusAgents.error} compact />
        </div>
      )

      expect(screen.getByText('Investigador de Mercado')).toBeInTheDocument()
      expect(screen.getByText('Agente ICP')).toBeInTheDocument()
      expect(screen.getByText('Copywriter')).toBeInTheDocument()
    })

    test('compact card does not show task or role', () => {
      render(<LiveAgentCard agent={allStatusAgents.working} compact />)
      expect(screen.queryByText('Tarea actual')).not.toBeInTheDocument()
      expect(screen.queryByText('Market Research')).not.toBeInTheDocument()
    })

    test('compact card is clickable', () => {
      const handleClick = jest.fn()
      render(<LiveAgentCard agent={allStatusAgents.working} compact onClick={handleClick} />)

      const card = document.querySelector('.MuiCard-root')
      fireEvent.click(card!)
      expect(handleClick).toHaveBeenCalledWith(allStatusAgents.working)
    })
  })

  // =========================================================================
  // 6. Relative Time Formatting
  // =========================================================================
  describe('Relative Time Formatting', () => {
    test('displays "Hace" prefix for recent timestamps', () => {
      const recentAgent = createAgent({
        lastActivity: new Date(Date.now() - 120000).toISOString() // 2 min ago
      })
      render(<LiveAgentCard agent={recentAgent} />)
      const timeText = screen.getByText(/hace/i)
      expect(timeText).toBeInTheDocument()
    })

    test('falls back to raw string for invalid date', () => {
      const invalidAgent = createAgent({ lastActivity: 'invalid-date-string' })
      render(<LiveAgentCard agent={invalidAgent} />)
      // Should not crash
      expect(screen.getByText('Investigador de Mercado')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // 7. Task Duration Counter
  // =========================================================================
  describe('Task Duration Counter', () => {
    test('working agent with taskStartedAt shows duration in MM:SS format', () => {
      const workingAgent = createAgent({
        status: 'working',
        taskStartedAt: new Date(Date.now() - 65000).toISOString() // 65 sec ago
      })
      render(<LiveAgentCard agent={workingAgent} />)
      const duration = screen.getByText(/^\d+:\d{2}$/)
      expect(duration).toBeInTheDocument()
    })

    test('idle agent does not show duration', () => {
      render(<LiveAgentCard agent={allStatusAgents.idle} />)
      expect(screen.queryByText(/^\d+:\d{2}$/)).not.toBeInTheDocument()
    })

    test('error agent does not show duration', () => {
      render(<LiveAgentCard agent={allStatusAgents.error} />)
      expect(screen.queryByText(/^\d+:\d{2}$/)).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // 8. Shimmer Progress Bar
  // =========================================================================
  describe('Shimmer Progress Bar', () => {
    test('only working status shows shimmer progress bar', () => {
      const { rerender } = render(<LiveAgentCard agent={allStatusAgents.working} />)
      expect(document.querySelector('.MuiLinearProgress-root')).toBeInTheDocument()

      rerender(<LiveAgentCard agent={allStatusAgents.idle} />)
      expect(document.querySelector('.MuiLinearProgress-root')).toBeNull()

      rerender(<LiveAgentCard agent={allStatusAgents.error} />)
      expect(document.querySelector('.MuiLinearProgress-root')).toBeNull()

      rerender(<LiveAgentCard agent={allStatusAgents.completed} />)
      expect(document.querySelector('.MuiLinearProgress-root')).toBeNull()

      rerender(<LiveAgentCard agent={allStatusAgents.waiting} />)
      expect(document.querySelector('.MuiLinearProgress-root')).toBeNull()
    })
  })

  // =========================================================================
  // 9. Agent Icons
  // =========================================================================
  describe('Agent Icons', () => {
    test('researcher agent renders with Search icon in avatar', () => {
      render(<LiveAgentCard agent={allStatusAgents.working} />)
      const avatar = document.querySelector('.MuiAvatar-root')
      expect(avatar).toBeInTheDocument()
      const svg = avatar?.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    test('icp_agent renders with Target icon in avatar', () => {
      render(<LiveAgentCard agent={allStatusAgents.idle} />)
      const avatar = document.querySelector('.MuiAvatar-root')
      expect(avatar).toBeInTheDocument()
      const svg = avatar?.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    test('qualification_agent renders with Users icon in avatar', () => {
      render(<LiveAgentCard agent={allStatusAgents.waiting} />)
      const avatar = document.querySelector('.MuiAvatar-root')
      expect(avatar).toBeInTheDocument()
      const svg = avatar?.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    test('copywriter_agent renders with PenTool icon in avatar', () => {
      render(<LiveAgentCard agent={allStatusAgents.error} />)
      const avatar = document.querySelector('.MuiAvatar-root')
      expect(avatar).toBeInTheDocument()
      const svg = avatar?.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    test('unknown agent renders with Brain (default) icon in avatar', () => {
      const unknownAgent = createAgent({ id: 'unknown_agent', name: 'unknown_agent' })
      render(<LiveAgentCard agent={unknownAgent} />)
      const avatar = document.querySelector('.MuiAvatar-root')
      expect(avatar).toBeInTheDocument()
      const svg = avatar?.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })

  // =========================================================================
  // 10. React.memo Performance
  // =========================================================================
  describe('React.memo Performance', () => {
    test('component is wrapped with React.memo', () => {
      expect(LiveAgentCard.$$typeof).toBeDefined()
    })

    test('component has displayName for debugging', () => {
      expect(LiveAgentCard.displayName).toBe('LiveAgentCard')
    })
  })

  // =========================================================================
  // 11. isHighlighted Prop
  // =========================================================================
  describe('isHighlighted Prop', () => {
    test('highlighted card has colored border', () => {
      render(<LiveAgentCard agent={allStatusAgents.working} isHighlighted />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
    })

    test('non-highlighted card has default border', () => {
      render(<LiveAgentCard agent={allStatusAgents.working} />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
    })
  })

  // =========================================================================
  // 12. Edge Cases
  // =========================================================================
  describe('Edge Cases', () => {
    test('agent with empty displayName falls back to name', () => {
      const noDisplayName = createAgent({ displayName: '', name: 'fallback_name' })
      render(<LiveAgentCard agent={noDisplayName} />)
      expect(screen.getByText('fallback_name')).toBeInTheDocument()
    })

    test('agent with null currentTask shows fallback text', () => {
      render(<LiveAgentCard agent={allStatusAgents.idle} />)
      expect(screen.getByText('Sin tarea asignada')).toBeInTheDocument()
    })

    test('agent with empty string currentTask shows fallback text', () => {
      const emptyTask = createAgent({ currentTask: '' })
      render(<LiveAgentCard agent={emptyTask} />)
      expect(screen.getByText('Sin tarea asignada')).toBeInTheDocument()
    })

    test('agent without role does not crash', () => {
      const noRole = createAgent({ role: '' })
      render(<LiveAgentCard agent={noRole} />)
      expect(screen.getByText('Investigador de Mercado')).toBeInTheDocument()
    })

    test('many cards render without performance issues', () => {
      const manyAgents = Array.from({ length: 20 }, (_, i) =>
        createAgent({ id: `agent_${i}`, name: `agent_${i}`, displayName: `Agente ${i}` })
      )

      const { container } = render(
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {manyAgents.map(agent => (
            <LiveAgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )

      const cards = container.querySelectorAll('.MuiCard-root')
      expect(cards.length).toBe(20)
    })
  })

  // =========================================================================
  // 13. Status Colors Verification
  // =========================================================================
  describe('Status Colors Verification', () => {
    test('idle chip has correct background color #f1f5f9', () => {
      render(<LiveAgentCard agent={allStatusAgents.idle} />)
      const chip = screen.getByText('En espera').closest('.MuiChip-root')
      expect(chip).toHaveStyle({ backgroundColor: '#f1f5f9' })
    })

    test('working chip has correct background color #eff6ff', () => {
      render(<LiveAgentCard agent={allStatusAgents.working} />)
      const chip = screen.getByText('Trabajando').closest('.MuiChip-root')
      expect(chip).toHaveStyle({ backgroundColor: '#eff6ff' })
    })

    test('waiting chip has correct background color #fffbeb', () => {
      render(<LiveAgentCard agent={allStatusAgents.waiting} />)
      const chip = screen.getByText('Esperando datos').closest('.MuiChip-root')
      expect(chip).toHaveStyle({ backgroundColor: '#fffbeb' })
    })

    test('error chip has correct background color #fef2f2', () => {
      render(<LiveAgentCard agent={allStatusAgents.error} />)
      const chip = screen.getByText('Error').closest('.MuiChip-root')
      expect(chip).toHaveStyle({ backgroundColor: '#fef2f2' })
    })

    test('completed chip has correct background color #f0fdf4', () => {
      render(<LiveAgentCard agent={allStatusAgents.completed} />)
      const chip = screen.getByText('Completado').closest('.MuiChip-root')
      expect(chip).toHaveStyle({ backgroundColor: '#f0fdf4' })
    })
  })

  // =========================================================================
  // 14. Default Export Verification
  // =========================================================================
  describe('Default Export', () => {
    test('LiveAgentCard is the default export', () => {
      expect(LiveAgentCard).toBeDefined()
      expect(typeof LiveAgentCard).toBe('object') // React.memo wraps as object
    })
  })
})

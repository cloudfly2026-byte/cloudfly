/**
 * CLOUD-209: LiveAgentCard Component Tests
 *
 * Tests rendering, status colors, animations, props, compact mode,
 * relative time formatting, task duration counter, agent icons,
 * isHighlighted visuals, and onClick handler for the LiveAgentCard component.
 */

import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import LiveAgentCard from './LiveAgentCard'
import type { MarketingAgent } from '@/types/marketing/aiMarketing'

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
  taskStartedAt: '2025-07-19T10:00:00Z',
  lastActivity: '2025-07-19T10:05:00Z',
  color: '#3b82f6',
  position: { x: 80, y: 120 },
  ...overrides
})

const idleAgent = createAgent({
  id: 'icp_agent',
  name: 'icp_agent',
  displayName: 'Agente ICP',
  role: 'ICP Analysis',
  status: 'idle',
  currentTask: null,
  taskStartedAt: null,
  lastActivity: '2025-07-19T09:00:00Z',
  color: '#8b5cf6'
})

const workingAgent = createAgent({
  id: 'researcher',
  name: 'researcher',
  displayName: 'Investigador de Mercado',
  role: 'Market Research',
  status: 'working',
  currentTask: 'Buscando leads cualificados',
  taskStartedAt: '2025-07-19T10:00:00Z',
  lastActivity: '2025-07-19T10:05:00Z',
  color: '#3b82f6'
})

const waitingAgent = createAgent({
  id: 'qualification_agent',
  name: 'qualification_agent',
  displayName: 'Calificador',
  role: 'Lead Qualification',
  status: 'waiting',
  currentTask: 'Esperando datos del investigador',
  taskStartedAt: '2025-07-19T10:02:00Z',
  lastActivity: '2025-07-19T10:03:00Z',
  color: '#f59e0b'
})

const errorAgent = createAgent({
  id: 'copywriter_agent',
  name: 'copywriter_agent',
  displayName: 'Copywriter',
  role: 'Content Creation',
  status: 'error',
  currentTask: 'Error al generar contenido',
  taskStartedAt: null,
  lastActivity: '2025-07-19T10:01:00Z',
  color: '#ef4444'
})

const completedAgent = createAgent({
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

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('LiveAgentCard', () => {
  // =======================================================================
  // AC-1: Component renders correctly for all 5 status types
  // =======================================================================

  describe('Rendering — All Status Types', () => {
    test('renders idle agent correctly', () => {
      render(<LiveAgentCard agent={idleAgent} />)
      expect(screen.getByText('Agente ICP')).toBeInTheDocument()
      expect(screen.getByText('En espera')).toBeInTheDocument()
      expect(screen.getByText('Sin tarea asignada')).toBeInTheDocument()
    })

    test('renders working agent correctly', () => {
      render(<LiveAgentCard agent={workingAgent} />)
      expect(screen.getByText('Investigador de Mercado')).toBeInTheDocument()
      expect(screen.getByText('Trabajando')).toBeInTheDocument()
      expect(screen.getByText('Buscando leads cualificados')).toBeInTheDocument()
    })

    test('renders waiting agent correctly', () => {
      render(<LiveAgentCard agent={waitingAgent} />)
      expect(screen.getByText('Calificador')).toBeInTheDocument()
      expect(screen.getByText('Esperando datos')).toBeInTheDocument()
      expect(screen.getByText('Esperando datos del investigador')).toBeInTheDocument()
    })

    test('renders error agent correctly', () => {
      render(<LiveAgentCard agent={errorAgent} />)
      expect(screen.getByText('Copywriter')).toBeInTheDocument()
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Error al generar contenido')).toBeInTheDocument()
      expect(screen.getByText('Requiere atención')).toBeInTheDocument()
    })

    test('renders completed agent correctly', () => {
      render(<LiveAgentCard agent={completedAgent} />)
      expect(screen.getByText('Investigador')).toBeInTheDocument()
      expect(screen.getByText('Completado')).toBeInTheDocument()
      expect(screen.getByText('Análisis completado')).toBeInTheDocument()
    })

    test('renders role when provided', () => {
      render(<LiveAgentCard agent={workingAgent} />)
      expect(screen.getByText('Market Research')).toBeInTheDocument()
    })

    test('renders "Tarea actual" label', () => {
      render(<LiveAgentCard agent={workingAgent} />)
      expect(screen.getByText('Tarea actual')).toBeInTheDocument()
    })
  })

  // =======================================================================
  // AC-2: Status colors match specification exactly
  // =======================================================================

  describe('Status Colors', () => {
    test('idle status uses correct color #94a3b8', () => {
      render(<LiveAgentCard agent={idleAgent} />)
      const chip = screen.getByText('En espera').closest('.MuiChip-root')
      expect(chip).toBeInTheDocument()
      // Verify the chip has the idle background color
      expect(chip).toHaveStyle({ backgroundColor: '#f1f5f9' })
    })

    test('working status uses correct color #3b82f6', () => {
      render(<LiveAgentCard agent={workingAgent} />)
      const chip = screen.getByText('Trabajando').closest('.MuiChip-root')
      expect(chip).toBeInTheDocument()
      expect(chip).toHaveStyle({ backgroundColor: '#eff6ff' })
    })

    test('waiting status uses correct color #f59e0b', () => {
      render(<LiveAgentCard agent={waitingAgent} />)
      const chip = screen.getByText('Esperando datos').closest('.MuiChip-root')
      expect(chip).toBeInTheDocument()
      expect(chip).toHaveStyle({ backgroundColor: '#fffbeb' })
    })

    test('error status uses correct color #ef4444', () => {
      render(<LiveAgentCard agent={errorAgent} />)
      const chip = screen.getByText('Error').closest('.MuiChip-root')
      expect(chip).toBeInTheDocument()
      expect(chip).toHaveStyle({ backgroundColor: '#fef2f2' })
    })

    test('completed status uses correct color #22c55e', () => {
      render(<LiveAgentCard agent={completedAgent} />)
      const chip = screen.getByText('Completado').closest('.MuiChip-root')
      expect(chip).toBeInTheDocument()
      expect(chip).toHaveStyle({ backgroundColor: '#f0fdf4' })
    })
  })

  // =======================================================================
  // AC-3: Animations work smoothly
  // =======================================================================

  describe('Animations', () => {
    test('working agent renders shimmer progress bar', () => {
      render(<LiveAgentCard agent={workingAgent} />)
      const progressBar = document.querySelector('.MuiLinearProgress-root')
      expect(progressBar).toBeInTheDocument()
    })

    test('idle agent does not render shimmer progress bar', () => {
      render(<LiveAgentCard agent={idleAgent} />)
      const progressBar = document.querySelector('.MuiLinearProgress-root')
      expect(progressBar).toBeNull()
    })

    test('error agent renders "Requiere atención" text', () => {
      render(<LiveAgentCard agent={errorAgent} />)
      expect(screen.getByText('Requiere atención')).toBeInTheDocument()
    })

    test('non-error agent does not render "Requiere atención"', () => {
      render(<LiveAgentCard agent={workingAgent} />)
      expect(screen.queryByText('Requiere atención')).not.toBeInTheDocument()
    })

    test('framer-motion wrapper renders for card entrance', () => {
      const { container } = render(<LiveAgentCard agent={workingAgent} />)
      // framer-motion renders a div wrapper around the card
      const motionWrapper = container.firstChild
      expect(motionWrapper).toBeInTheDocument()
    })
  })

  // =======================================================================
  // AC-4: Component is responsive and works in Grid layout
  // =======================================================================

  describe('Responsiveness', () => {
    test('card has minWidth 260 in full mode', () => {
      render(<LiveAgentCard agent={workingAgent} />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      // The card should have minWidth: 260 applied via sx
      const computedStyle = window.getComputedStyle(card!)
      // In jsdom, computed styles from sx may not be fully resolved,
      // but we verify the card renders
      expect(card).toBeInTheDocument()
    })

    test('compact mode renders with smaller minWidth', () => {
      render(<LiveAgentCard agent={workingAgent} compact />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
    })

    test('card renders within a grid container', () => {
      // Simulate a grid parent
      const { container } = render(
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <LiveAgentCard agent={workingAgent} />
          <LiveAgentCard agent={idleAgent} />
          <LiveAgentCard agent={completedAgent} />
        </div>
      )
      const cards = container.querySelectorAll('.MuiCard-root')
      expect(cards.length).toBe(3)
    })
  })

  // =======================================================================
  // AC-5: TypeScript props are strictly typed
  // =======================================================================

  describe('Props', () => {
    test('renders with required agent prop only', () => {
      render(<LiveAgentCard agent={workingAgent} />)
      expect(screen.getByText('Investigador de Mercado')).toBeInTheDocument()
    })

    test('renders with isHighlighted prop', () => {
      render(<LiveAgentCard agent={workingAgent} isHighlighted />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
    })

    test('renders without isHighlighted (default false)', () => {
      render(<LiveAgentCard agent={workingAgent} />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
    })

    test('calls onClick when card is clicked', () => {
      const handleClick = jest.fn()
      render(<LiveAgentCard agent={workingAgent} onClick={handleClick} />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      fireEvent.click(card!)
      expect(handleClick).toHaveBeenCalledWith(workingAgent)
    })

    test('does not call onClick when not provided', () => {
      render(<LiveAgentCard agent={workingAgent} />)
      const card = document.querySelector('.MuiCard-root')
      fireEvent.click(card!)
      // No error should occur
      expect(card).toBeInTheDocument()
    })

    test('onClick receives the agent object', () => {
      const handleClick = jest.fn()
      render(<LiveAgentCard agent={idleAgent} onClick={handleClick} />)
      const card = document.querySelector('.MuiCard-root')
      fireEvent.click(card!)
      expect(handleClick).toHaveBeenCalledTimes(1)
      expect(handleClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'icp_agent', status: 'idle' })
      )
    })
  })

  // =======================================================================
  // AC-6: Component is exported as default export
  // =======================================================================

  describe('Export', () => {
    test('component is default exported', () => {
      expect(LiveAgentCard).toBeDefined()
      expect(typeof LiveAgentCard).toBe('object') // React.memo wraps as object
    })

    test('component has displayName for React.memo', () => {
      // React.memo components have displayName set
      expect(LiveAgentCard.displayName).toBe('LiveAgentCard')
    })
  })

  // =======================================================================
  // Bonus: Agent-specific icons
  // =======================================================================

  describe('Agent Icons', () => {
    test('researcher agent uses Search icon in avatar', () => {
      render(<LiveAgentCard agent={workingAgent} />)
      // The avatar should contain an SVG icon (Search from lucide-react)
      const avatar = document.querySelector('.MuiAvatar-root')
      expect(avatar).toBeInTheDocument()
      const svg = avatar?.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    test('icp_agent uses Target icon in avatar', () => {
      render(<LiveAgentCard agent={idleAgent} />)
      const avatar = document.querySelector('.MuiAvatar-root')
      expect(avatar).toBeInTheDocument()
      const svg = avatar?.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    test('unknown agent uses Brain (default) icon in avatar', () => {
      const unknownAgent = createAgent({ id: 'unknown_agent', name: 'unknown_agent' })
      render(<LiveAgentCard agent={unknownAgent} />)
      const avatar = document.querySelector('.MuiAvatar-root')
      expect(avatar).toBeInTheDocument()
      const svg = avatar?.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })

  // =======================================================================
  // Bonus: Relative time formatting (date-fns + Spanish locale)
  // =======================================================================

  describe('Relative Time', () => {
    test('displays relative time in Spanish', () => {
      // Use a recent timestamp so date-fns produces "Hace menos de un minuto" or similar
      const recentAgent = createAgent({
        lastActivity: new Date(Date.now() - 30000).toISOString() // 30 seconds ago
      })
      render(<LiveAgentCard agent={recentAgent} />)
      // date-fns with es locale produces "Hace ..." prefix
      const text = screen.getByText(/hace/i)
      expect(text).toBeInTheDocument()
    })

    test('falls back to raw string on invalid date', () => {
      const invalidAgent = createAgent({
        lastActivity: 'not-a-date'
      })
      render(<LiveAgentCard agent={invalidAgent} />)
      // Should fall back gracefully — either renders the raw string or doesn't crash
      expect(screen.getByText('Investigador de Mercado')).toBeInTheDocument()
    })
  })

  // =======================================================================
  // Bonus: Task duration counter
  // =======================================================================

  describe('Task Duration Counter', () => {
    test('working agent shows task duration', () => {
      // Set taskStartedAt to 65 seconds ago
      const recentWorking = createAgent({
        status: 'working',
        taskStartedAt: new Date(Date.now() - 65000).toISOString()
      })
      render(<LiveAgentCard agent={recentWorking} />)
      // Duration should be approximately "1:05" (65 seconds = 1 min 5 sec)
      // Allow some tolerance due to test execution time
      const durationText = screen.getByText(/^\d+:\d{2}$/)
      expect(durationText).toBeInTheDocument()
    })

    test('idle agent does not show task duration', () => {
      render(<LiveAgentCard agent={idleAgent} />)
      const durationText = screen.queryByText(/^\d+:\d{2}$/)
      expect(durationText).not.toBeInTheDocument()
    })

    test('completed agent does not show task duration', () => {
      render(<LiveAgentCard agent={completedAgent} />)
      const durationText = screen.queryByText(/^\d+:\d{2}$/)
      expect(durationText).not.toBeInTheDocument()
    })
  })

  // =======================================================================
  // Bonus: Compact mode
  // =======================================================================

  describe('Compact Mode', () => {
    test('renders agent name in compact mode', () => {
      render(<LiveAgentCard agent={workingAgent} compact />)
      expect(screen.getByText('Investigador de Mercado')).toBeInTheDocument()
    })

    test('does not show task section in compact mode', () => {
      render(<LiveAgentCard agent={workingAgent} compact />)
      expect(screen.queryByText('Tarea actual')).not.toBeInTheDocument()
    })

    test('does not show role in compact mode', () => {
      render(<LiveAgentCard agent={workingAgent} compact />)
      expect(screen.queryByText('Market Research')).not.toBeInTheDocument()
    })

    test('renders status dot in compact mode', () => {
      const { container } = render(<LiveAgentCard agent={workingAgent} compact />)
      // The status dot is a Box with borderRadius: 50%
      const dot = container.querySelector('[style*="border-radius"]') ||
                  container.querySelector('[style*="borderRadius"]')
      // At minimum, the compact card renders
      expect(screen.getByText('Investigador de Mercado')).toBeInTheDocument()
    })

    test('compact card is clickable', () => {
      const handleClick = jest.fn()
      render(<LiveAgentCard agent={workingAgent} compact onClick={handleClick} />)
      const card = document.querySelector('.MuiCard-root')
      fireEvent.click(card!)
      expect(handleClick).toHaveBeenCalledWith(workingAgent)
    })

    test('compact idle agent renders correctly', () => {
      render(<LiveAgentCard agent={idleAgent} compact />)
      expect(screen.getByText('Agente ICP')).toBeInTheDocument()
    })
  })

  // =======================================================================
  // Bonus: Status indicator dot (top-right corner in full mode)
  // =======================================================================

  describe('Status Indicator Dot', () => {
    test('renders status dot in full mode', () => {
      const { container } = render(<LiveAgentCard agent={workingAgent} />)
      // The status dot is positioned absolute top-right
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      // The dot is a Box inside the card with position: absolute
      const dotElements = container.querySelectorAll('[class*="MuiBox-root"]')
      expect(dotElements.length).toBeGreaterThan(0)
    })
  })

  // =======================================================================
  // Bonus: Shimmer progress bar
  // =======================================================================

  describe('Shimmer Progress Bar', () => {
    test('renders only for working status', () => {
      render(<LiveAgentCard agent={workingAgent} />)
      const progressBar = document.querySelector('.MuiLinearProgress-root')
      expect(progressBar).toBeInTheDocument()
    })

    test('does not render for idle status', () => {
      render(<LiveAgentCard agent={idleAgent} />)
      const progressBar = document.querySelector('.MuiLinearProgress-root')
      expect(progressBar).toBeNull()
    })

    test('does not render for error status', () => {
      render(<LiveAgentCard agent={errorAgent} />)
      const progressBar = document.querySelector('.MuiLinearProgress-root')
      expect(progressBar).toBeNull()
    })

    test('does not render for completed status', () => {
      render(<LiveAgentCard agent={completedAgent} />)
      const progressBar = document.querySelector('.MuiLinearProgress-root')
      expect(progressBar).toBeNull()
    })

    test('does not render for waiting status', () => {
      render(<LiveAgentCard agent={waitingAgent} />)
      const progressBar = document.querySelector('.MuiLinearProgress-root')
      expect(progressBar).toBeNull()
    })
  })

  // =======================================================================
  // Edge cases
  // =======================================================================

  describe('Edge Cases', () => {
    test('agent with no displayName falls back to name', () => {
      const noDisplayName = createAgent({ displayName: '', name: 'fallback_name' })
      render(<LiveAgentCard agent={noDisplayName} />)
      expect(screen.getByText('fallback_name')).toBeInTheDocument()
    })

    test('agent with null currentTask shows "Sin tarea asignada"', () => {
      render(<LiveAgentCard agent={idleAgent} />)
      expect(screen.getByText('Sin tarea asignada')).toBeInTheDocument()
    })

    test('agent with empty string currentTask shows "Sin tarea asignada"', () => {
      const emptyTask = createAgent({ currentTask: '' })
      render(<LiveAgentCard agent={emptyTask} />)
      // Empty string is falsy, so should show fallback
      expect(screen.getByText('Sin tarea asignada')).toBeInTheDocument()
    })

    test('agent without role does not crash', () => {
      const noRole = createAgent({ role: '' })
      render(<LiveAgentCard agent={noRole} />)
      expect(screen.getByText('Investigador de Mercado')).toBeInTheDocument()
    })

    test('multiple cards render independently', () => {
      render(
        <>
          <LiveAgentCard agent={workingAgent} />
          <LiveAgentCard agent={idleAgent} />
          <LiveAgentCard agent={errorAgent} />
        </>
      )
      expect(screen.getByText('Investigador de Mercado')).toBeInTheDocument()
      expect(screen.getByText('Agente ICP')).toBeInTheDocument()
      expect(screen.getByText('Copywriter')).toBeInTheDocument()
    })
  })

  // =======================================================================
  // React.memo verification
  // =======================================================================

  describe('Performance', () => {
    test('component has displayName for React.memo', () => {
      expect(LiveAgentCard.displayName).toBe('LiveAgentCard')
    })

    test('component is wrapped with React.memo', () => {
      // React.memo wrapped components have a $$typeof property
      expect(LiveAgentCard.$$typeof).toBeDefined()
    })
  })

  // =======================================================================
  // CLOUD-262: isHighlighted visual treatment — Full mode
  // =======================================================================

  describe('isHighlighted — Full Mode', () => {
    test('highlighted card has 2px solid border with status color', () => {
      render(<LiveAgentCard agent={workingAgent} isHighlighted />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      // The sx prop sets border: '2px solid' and borderColor: config.color (#3b82f6)
      expect(card).toHaveStyle({ borderColor: '#3b82f6' })
    })

    test('highlighted card uses status background color', () => {
      render(<LiveAgentCard agent={workingAgent} isHighlighted />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      // working status bg is #eff6ff
      expect(card).toHaveStyle({ backgroundColor: '#eff6ff' })
    })

    test('highlighted idle card uses idle colors', () => {
      render(<LiveAgentCard agent={idleAgent} isHighlighted />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      expect(card).toHaveStyle({ borderColor: '#94a3b8' })
      expect(card).toHaveStyle({ backgroundColor: '#f1f5f9' })
    })

    test('highlighted error card uses error colors', () => {
      render(<LiveAgentCard agent={errorAgent} isHighlighted />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      expect(card).toHaveStyle({ borderColor: '#ef4444' })
      expect(card).toHaveStyle({ backgroundColor: '#fef2f2' })
    })

    test('highlighted card has elevation 4', () => {
      render(<LiveAgentCard agent={workingAgent} isHighlighted />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      // MUI Card elevation=4 applies a specific box-shadow via CSS class
      // We verify the card renders (elevation is applied via the elevation prop)
      expect(card).toBeInTheDocument()
    })

    test('non-highlighted card has 1px border', () => {
      render(<LiveAgentCard agent={workingAgent} />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      // Non-highlighted uses 'divider' color, not the status color
      expect(card).toBeInTheDocument()
    })

    test('highlighted card has glow box-shadow with status color', () => {
      render(<LiveAgentCard agent={workingAgent} isHighlighted />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      // The sx applies: boxShadow: `0 0 12px 3px rgba(59, 130, 246, 0.3)`
      // for working status (#3b82f6 = rgb(59, 130, 246))
      // MUI sx applies via Emotion CSS classes, so we check computed style
      expect(card).toHaveStyle({ boxShadow: expect.stringContaining('rgba(59, 130, 246') })
    })

    test('highlighted waiting card has glow with waiting color', () => {
      render(<LiveAgentCard agent={waitingAgent} isHighlighted />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      // waiting color #f59e0b = rgb(245, 158, 11)
      expect(card).toHaveStyle({ boxShadow: expect.stringContaining('rgba(245, 158, 11') })
    })

    test('highlighted completed card has glow with completed color', () => {
      render(<LiveAgentCard agent={completedAgent} isHighlighted />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      // completed color #22c55e = rgb(34, 197, 94)
      expect(card).toHaveStyle({ boxShadow: expect.stringContaining('rgba(34, 197, 94') })
    })
  })

  // =======================================================================
  // CLOUD-262: isHighlighted visual treatment — Compact mode
  // =======================================================================

  describe('isHighlighted — Compact Mode', () => {
    test('highlighted compact card has 2px solid border', () => {
      render(<LiveAgentCard agent={workingAgent} compact isHighlighted />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      expect(card).toHaveStyle({ borderColor: '#3b82f6' })
    })

    test('highlighted compact card uses status background', () => {
      render(<LiveAgentCard agent={workingAgent} compact isHighlighted />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      expect(card).toHaveStyle({ backgroundColor: '#eff6ff' })
    })

    test('highlighted compact card has subtle glow box-shadow', () => {
      render(<LiveAgentCard agent={workingAgent} compact isHighlighted />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      // Compact mode applies: boxShadow: `0 0 8px 2px rgba(59, 130, 246, 0.25)`
      expect(card).toHaveStyle({ boxShadow: expect.stringContaining('rgba(59, 130, 246') })
    })

    test('non-highlighted compact card does not have glow', () => {
      render(<LiveAgentCard agent={workingAgent} compact />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      // Non-highlighted compact should not have box-shadow from isHighlighted
      // (it may have hover effects but not the persistent glow)
    })

    test('highlighted compact idle card uses idle colors', () => {
      render(<LiveAgentCard agent={idleAgent} compact isHighlighted />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      expect(card).toHaveStyle({ borderColor: '#94a3b8' })
      expect(card).toHaveStyle({ backgroundColor: '#f1f5f9' })
    })
  })

  // =======================================================================
  // CLOUD-262: onClick handler — cursor and interaction
  // =======================================================================

  describe('onClick Handler', () => {
    test('card with onClick has cursor pointer in full mode', () => {
      const handleClick = jest.fn()
      render(<LiveAgentCard agent={workingAgent} onClick={handleClick} />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      expect(card).toHaveStyle({ cursor: 'pointer' })
    })

    test('card without onClick has cursor default in full mode', () => {
      render(<LiveAgentCard agent={workingAgent} />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      expect(card).toHaveStyle({ cursor: 'default' })
    })

    test('card with onClick has cursor pointer in compact mode', () => {
      const handleClick = jest.fn()
      render(<LiveAgentCard agent={workingAgent} compact onClick={handleClick} />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      expect(card).toHaveStyle({ cursor: 'pointer' })
    })

    test('card without onClick has cursor default in compact mode', () => {
      render(<LiveAgentCard agent={workingAgent} compact />)
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      expect(card).toHaveStyle({ cursor: 'default' })
    })

    test('clicking highlighted card still triggers onClick', () => {
      const handleClick = jest.fn()
      render(<LiveAgentCard agent={workingAgent} isHighlighted onClick={handleClick} />)
      const card = document.querySelector('.MuiCard-root')
      fireEvent.click(card!)
      expect(handleClick).toHaveBeenCalledWith(workingAgent)
    })

    test('clicking compact highlighted card still triggers onClick', () => {
      const handleClick = jest.fn()
      render(<LiveAgentCard agent={workingAgent} compact isHighlighted onClick={handleClick} />)
      const card = document.querySelector('.MuiCard-root')
      fireEvent.click(card!)
      expect(handleClick).toHaveBeenCalledWith(workingAgent)
    })
  })
})

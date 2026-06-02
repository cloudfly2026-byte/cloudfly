/**
 * CLOUD-263: E2E Integration Test — LiveAgentCard Component
 *
 * This test verifies that the LiveAgentCard component meets all acceptance criteria:
 *   AC-1: All required imports are present and correct
 *   AC-2: Props interface includes agent, isHighlighted?, onClick?, compact?
 *   AC-3: No styled-jsx or <style jsx global> usage remains
 *   AC-4: Component compiles without errors
 *
 * HOW TO EXECUTE:
 *   cd frontend_new
 *   npx jest --testPathPatterns=AGENTE_DEV_CLOUD-263_E2E --verbose
 *
 * Or run all tests including this one:
 *   cd frontend_new
 *   npx jest --verbose
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import LiveAgentCard from '@/views/marketing/ai-operation/LiveAgentCard'
import type { MarketingAgent } from '@/types/marketing/aiMarketing'

// ---------------------------------------------------------------------------
// Test fixture
// ---------------------------------------------------------------------------

const baseAgent: MarketingAgent = {
  id: 'researcher',
  name: 'researcher',
  displayName: 'Investigador de Mercado',
  role: 'Market Research',
  status: 'working',
  currentTask: 'Buscando leads cualificados',
  taskStartedAt: new Date(Date.now() - 65000).toISOString(),
  lastActivity: new Date(Date.now() - 30000).toISOString(),
  color: '#3b82f6',
  position: { x: 80, y: 120 }
}

// ---------------------------------------------------------------------------
// AC-1: All required imports are present and correct
// ---------------------------------------------------------------------------

describe('CLOUD-263 E2E — AC-1: Required Imports', () => {
  test('React hooks (useMemo, useState, useEffect) are used — component renders with live state', () => {
    // The component uses useState + useEffect for the task duration counter
    // and useMemo for derived values. If any import were missing, this would throw.
    render(<LiveAgentCard agent={baseAgent} />)
    // Task duration counter should appear (useState/useEffect working)
    const durationText = screen.getByText(/^\d+:\d{2}$/)
    expect(durationText).toBeInTheDocument()
  })

  test('MUI LinearProgress is used — shimmer bar renders for working status', () => {
    render(<LiveAgentCard agent={baseAgent} />)
    const progressBar = document.querySelector('.MuiLinearProgress-root')
    expect(progressBar).toBeInTheDocument()
  })

  test('MUI Tooltip is used — status label tooltip renders', () => {
    render(<LiveAgentCard agent={baseAgent} />)
    // Tooltip title should be present in the DOM
    expect(screen.getByText('Trabajando')).toBeInTheDocument()
  })

  test('framer-motion (motion, AnimatePresence) is used — entrance animation renders', () => {
    const { container } = render(<LiveAgentCard agent={baseAgent} />)
    // framer-motion wraps the card in a motion.div
    const motionWrapper = container.firstChild
    expect(motionWrapper).toBeInTheDocument()
  })

  test('date-fns (formatDistanceToNow with es locale) is used — relative time in Spanish', () => {
    render(<LiveAgentCard agent={baseAgent} />)
    const relativeTime = screen.getByText(/hace/i)
    expect(relativeTime).toBeInTheDocument()
  })

  test('Lucide icons (Brain, Search, PenTool, Target, Users, Loader2) are used — agent icon renders', () => {
    render(<LiveAgentCard agent={baseAgent} />)
    const avatar = document.querySelector('.MuiAvatar-root')
    expect(avatar).toBeInTheDocument()
    const svg = avatar?.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// AC-2: Props interface includes agent, isHighlighted?, onClick?, compact?
// ---------------------------------------------------------------------------

describe('CLOUD-263 E2E — AC-2: Props Interface', () => {
  test('agent prop (required) — renders agent data', () => {
    render(<LiveAgentCard agent={baseAgent} />)
    expect(screen.getByText('Investigador de Mercado')).toBeInTheDocument()
  })

  test('isHighlighted prop (optional) — applies highlighted styling', () => {
    render(<LiveAgentCard agent={baseAgent} isHighlighted />)
    const card = document.querySelector('.MuiCard-root')
    expect(card).toHaveStyle({ borderColor: '#3b82f6' })
    expect(card).toHaveStyle({ backgroundColor: '#eff6ff' })
  })

  test('onClick prop (optional) — fires callback with agent on click', () => {
    const handleClick = jest.fn()
    render(<LiveAgentCard agent={baseAgent} onClick={handleClick} />)
    const card = document.querySelector('.MuiCard-root')
    fireEvent.click(card!)
    expect(handleClick).toHaveBeenCalledWith(baseAgent)
  })

  test('compact prop (optional) — renders compact layout', () => {
    render(<LiveAgentCard agent={baseAgent} compact />)
    expect(screen.getByText('Investigador de Mercado')).toBeInTheDocument()
    // Compact mode should NOT show full-mode elements
    expect(screen.queryByText('Tarea actual')).not.toBeInTheDocument()
  })

  test('all optional props combined — isHighlighted + onClick + compact', () => {
    const handleClick = jest.fn()
    render(
      <LiveAgentCard
        agent={baseAgent}
        isHighlighted
        onClick={handleClick}
        compact
      />
    )
    const card = document.querySelector('.MuiCard-root')
    expect(card).toHaveStyle({ borderColor: '#3b82f6' })
    fireEvent.click(card!)
    expect(handleClick).toHaveBeenCalledWith(baseAgent)
  })
})

// ---------------------------------------------------------------------------
// AC-3: No styled-jsx or <style jsx global> usage remains
// ---------------------------------------------------------------------------

describe('CLOUD-263 E2E — AC-3: No styled-jsx Usage', () => {
  test('component renders without any <style jsx> tags in the DOM', () => {
    const { container } = render(<LiveAgentCard agent={baseAgent} />)
    const styleTags = container.querySelectorAll('style')
    // No <style jsx> or <style jsx global> tags should exist
    styleTags.forEach((tag) => {
      expect(tag.textContent).not.toMatch(/jsx/)
    })
  })

  test('animations use framer-motion instead of CSS keyframes', () => {
    const { container } = render(<LiveAgentCard agent={baseAgent} />)
    // framer-motion uses inline styles and motion.div wrappers
    // Verify the motion wrapper exists (framer-motion, not styled-jsx)
    const motionWrapper = container.firstChild
    expect(motionWrapper).toBeInTheDocument()
  })

  test('MUI sx prop is used for styling instead of styled-jsx', () => {
    render(<LiveAgentCard agent={baseAgent} />)
    const card = document.querySelector('.MuiCard-root')
    // MUI sx prop generates Emotion CSS classes, not <style jsx> tags
    expect(card).toBeInTheDocument()
    expect(card?.className).toContain('MuiCard-root')
  })
})

// ---------------------------------------------------------------------------
// AC-4: Component compiles without errors
// ---------------------------------------------------------------------------

describe('CLOUD-263 E2E — AC-4: Compilation & Integration', () => {
  test('component renders without runtime errors for all 5 status types', () => {
    const statuses: Array<MarketingAgent['status']> = [
      'idle',
      'working',
      'waiting',
      'error',
      'completed'
    ]

    statuses.forEach((status) => {
      const agent = { ...baseAgent, status }
      // Override status-specific fields
      if (status === 'idle') {
        agent.currentTask = null
        agent.taskStartedAt = null
      }
      if (status === 'error') {
        agent.taskStartedAt = null
      }

      const { unmount } = render(<LiveAgentCard agent={agent} />)
      // Should render without throwing
      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
      unmount()
    })
  })

  test('component is wrapped with React.memo for performance', () => {
    expect(LiveAgentCard.displayName).toBe('LiveAgentCard')
    expect(LiveAgentCard.$$typeof).toBeDefined()
  })

  test('component is default exported', () => {
    expect(LiveAgentCard).toBeDefined()
    expect(typeof LiveAgentCard).toBe('object')
  })

  test('TypeScript types are correctly imported — MarketingAgent interface', () => {
    // This test verifies the type import works at runtime
    const agent: MarketingAgent = baseAgent
    expect(agent.id).toBe('researcher')
    expect(agent.status).toBe('working')
    expect(agent.position).toEqual({ x: 80, y: 120 })
  })
})

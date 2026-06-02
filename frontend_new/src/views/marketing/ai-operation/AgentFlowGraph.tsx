'use client'

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { Box, Typography } from '@mui/material'
import type { MarketingAgent, AgentConnection } from '@/types/marketing/aiMarketing'

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const CARD_WIDTH = 200
const CARD_HEIGHT = 100
const H_GAP = 40
const V_GAP = 80
const SVG_PADDING = 40

// ---------------------------------------------------------------------------
// Predefined agent positions (from System Architect spec)
// ---------------------------------------------------------------------------

const AGENT_POSITIONS: Record<string, { x: number; y: number }> = {
  researcher:          { x: 80,  y: 120 },
  icp_agent:           { x: 280, y: 60  },
  qualification_agent: { x: 480, y: 120 },
  copywriter_agent:    { x: 680, y: 60  }
}

// ---------------------------------------------------------------------------
// Data flow color mapping (aligned with spec: messages = #22c55e)
// ---------------------------------------------------------------------------

const DATA_FLOW_COLORS: Record<string, string> = {
  leads:    '#3b82f6',
  analysis: '#8b5cf6',
  messages: '#22c55e',
  context:  '#f59e0b'
}

// ---------------------------------------------------------------------------
// Status color mapping
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  working:   '#3b82f6',
  waiting:   '#f59e0b',
  error:     '#ef4444',
  completed: '#10b981',
  idle:      '#94a3b8'
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AgentFlowGraphProps {
  agents: MarketingAgent[]
  connections: AgentConnection[]
  width?: number    // Default: 800
  height?: number   // Default: 280
  onAgentClick?: (agent: MarketingAgent) => void
}

// ---------------------------------------------------------------------------
// Helper: quadratic bezier midpoint at t=0.5
// ---------------------------------------------------------------------------

const getBezierMidpoint = (
  x1: number, y1: number,
  cx: number, cy: number,
  x2: number, y2: number
): { x: number; y: number } => {
  const t = 0.5
  const mx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2
  const my = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2
  return { x: mx, y: my }
}

// ---------------------------------------------------------------------------
// Helper: build curved SVG path (quadratic bezier, curves upward)
// ---------------------------------------------------------------------------

const buildCurvedPath = (
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number }
): { pathD: string; midX: number; midY: number; cx: number; cy: number } => {
  // Determine flow direction to pick correct card edges
  const isLeftToRight = targetPos.x > sourcePos.x + 10
  const isRightToLeft = targetPos.x < sourcePos.x - 10

  let startX: number, startY: number, endX: number, endY: number

  if (isLeftToRight) {
    // Source right-center → Target left-center
    startX = sourcePos.x + CARD_WIDTH / 2
    startY = sourcePos.y
    endX = targetPos.x - CARD_WIDTH / 2
    endY = targetPos.y
  } else if (isRightToLeft) {
    // Source left-center → Target right-center
    startX = sourcePos.x - CARD_WIDTH / 2
    startY = sourcePos.y
    endX = targetPos.x + CARD_WIDTH / 2
    endY = targetPos.y
  } else {
    // Vertical: source bottom-center → target top-center
    startX = sourcePos.x
    startY = sourcePos.y + CARD_HEIGHT / 2
    endX = targetPos.x
    endY = targetPos.y - CARD_HEIGHT / 2
  }

  // Control point for the quadratic bezier curve
  const cx = (startX + endX) / 2
  const cy = Math.min(startY, endY) - 30

  const pathD = `M ${startX} ${startY} Q ${cx} ${cy} ${endX} ${endY}`

  // Compute label position at t=0.5 on the bezier
  const t = 0.5
  const midX = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * cx + t * t * endX
  const midY = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * cy + t * t * endY

  return { pathD, midX, midY, cx, cy }
}

// ---------------------------------------------------------------------------
// Component (wrapped in React.memo for performance)
// ---------------------------------------------------------------------------

const AgentFlowGraph: React.FC<AgentFlowGraphProps> = React.memo(({
  agents,
  connections,
  width: propWidth,
  height: propHeight,
  onAgentClick
}) => {
  // -----------------------------------------------------------------------
  // useRef + useEffect for responsive container measurement
  // -----------------------------------------------------------------------

  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: propWidth ?? 900, height: propHeight ?? 400 })

  useEffect(() => {
    const measure = () => {
      if (containerRef.current && !propWidth && !propHeight) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({
          width: Math.max(800, rect.width),
          height: Math.max(280, rect.height)
        })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [propWidth, propHeight])

  const svgWidth = propWidth ?? dimensions.width
  const svgHeight = propHeight ?? dimensions.height

  // -----------------------------------------------------------------------
  // Compute node positions — priority: AGENT_POSITIONS → agent.position → grid
  // -----------------------------------------------------------------------

  const cols = Math.max(1, Math.ceil(Math.sqrt(agents.length)))

  const nodePositions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {}
    agents.forEach((agent, index) => {
      if (AGENT_POSITIONS[agent.id]) {
        // Priority 1: Predefined positions from spec
        map[agent.id] = { ...AGENT_POSITIONS[agent.id] }
      } else if (agent.position && typeof agent.position.x === 'number' && typeof agent.position.y === 'number') {
        // Priority 2: Position from agent data
        map[agent.id] = {
          x: SVG_PADDING + agent.position.x,
          y: SVG_PADDING + agent.position.y
        }
      } else {
        // Priority 3: Grid fallback
        const col = index % cols
        const row = Math.floor(index / cols)
        map[agent.id] = {
          x: SVG_PADDING + col * (CARD_WIDTH + H_GAP) + CARD_WIDTH / 2,
          y: SVG_PADDING + row * (CARD_HEIGHT + V_GAP) + CARD_HEIGHT / 2
        }
      }
    })
    return map
  }, [agents, cols])

  // -----------------------------------------------------------------------
  // Stable callback for agent click
  // -----------------------------------------------------------------------

  const handleAgentClick = useCallback((agent: MarketingAgent) => {
    onAgentClick?.(agent)
  }, [onAgentClick])

  // -----------------------------------------------------------------------
  // Keyboard handler for accessibility
  // -----------------------------------------------------------------------

  const handleKeyDown = useCallback((e: React.KeyboardEvent, agent: MarketingAgent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onAgentClick?.(agent)
    }
  }, [onAgentClick])

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------

  if (agents.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <Typography color='text.secondary'>No hay agentes para mostrar</Typography>
      </Box>
    )
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <Box
      ref={containerRef}
      sx={{ overflowX: 'auto', pb: 2 }}
      role='img'
      aria-label='Grafo de flujo de agentes de marketing'
    >
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ minWidth: svgWidth }}
      >
        <defs>
          {/* Arrowhead marker */}
          <marker
            id='arrowhead'
            markerWidth='10'
            markerHeight='7'
            refX='10'
            refY='3.5'
            orient='auto'
          >
            <polygon points='0 0, 10 3.5, 0 7' fill='#94a3b8' />
          </marker>

          {/* Arrowhead marker for active connections */}
          <marker
            id='arrowhead-active'
            markerWidth='10'
            markerHeight='7'
            refX='10'
            refY='3.5'
            orient='auto'
          >
            <polygon points='0 0, 10 3.5, 0 7' fill='#22c55e' />
          </marker>

          {/* Glow filter for active connections */}
          <filter id='glow' x='-50%' y='-50%' width='200%' height='200%'>
            <feGaussianBlur stdDeviation='3' result='coloredBlur' />
            <feMerge>
              <feMergeNode in='coloredBlur' />
              <feMergeNode in='SourceGraphic' />
            </feMerge>
          </filter>

          {/* Glow filter for working agent pulse */}
          <filter id='glow-soft' x='-50%' y='-50%' width='200%' height='200%'>
            <feGaussianBlur stdDeviation='4' result='coloredBlur' />
            <feMerge>
              <feMergeNode in='coloredBlur' />
              <feMergeNode in='SourceGraphic' />
            </feMerge>
          </filter>
        </defs>

        {/* ------------------------------------------------------------- */}
        {/* Draw connections                                              */}
        {/* ------------------------------------------------------------- */}
        {connections.map((conn) => {
          const fromPos = nodePositions[conn.sourceAgentId]
          const toPos = nodePositions[conn.targetAgentId]
          if (!fromPos || !toPos) return null

          const { pathD, midX, midY } = buildCurvedPath(fromPos, toPos)

          // Check if either agent is working → animate the flow
          const fromAgent = agents.find(a => a.id === conn.sourceAgentId)
          const toAgent = agents.find(a => a.id === conn.targetAgentId)
          const isActive = conn.active && (
            fromAgent?.status === 'working' || toAgent?.status === 'working'
          )

          // Determine stroke color based on dataFlow
          const baseColor = (conn.dataFlow && DATA_FLOW_COLORS[conn.dataFlow])
            ? DATA_FLOW_COLORS[conn.dataFlow]
            : '#cbd5e1'

          const strokeColor = isActive ? '#22c55e' : baseColor

          return (
            <g
              key={conn.id || `${conn.sourceAgentId}-${conn.targetAgentId}`}
              style={{ transition: 'opacity 0.3s ease' }}
            >
              {/* Base connection line */}
              <path
                d={pathD}
                fill='none'
                stroke={strokeColor}
                strokeWidth={isActive ? 3 : 2}
                markerEnd={isActive ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
                strokeDasharray={isActive ? 'none' : '6 4'}
                filter={isActive ? 'url(#glow)' : undefined}
                opacity={0}
              >
                {/* Fade-in animation for new connections */}
                <animate attributeName='opacity' values='0;1' dur='0.3s' fill='freeze' />
              </path>

              {/* Animated dash flow overlay on active connections */}
              {isActive && (
                <path
                  d={pathD}
                  fill='none'
                  stroke='rgba(255,255,255,0.7)'
                  strokeWidth={3}
                  strokeDasharray='8 6'
                  strokeLinecap='round'
                  opacity={0}
                >
                  <animate attributeName='stroke-dashoffset' values='0;-28' dur='0.8s' repeatCount='indefinite' />
                  <animate attributeName='opacity' values='0;1' dur='0.3s' fill='freeze' />
                </path>
              )}

              {/* Label at bezier curve midpoint */}
              {conn.label && (
                <g opacity={0}>
                  <rect
                    x={midX - conn.label.length * 3.5 - 6}
                    y={midY - 18}
                    width={conn.label.length * 7 + 12}
                    height={20}
                    rx={4}
                    fill='rgba(255,255,255,0.92)'
                    stroke={strokeColor}
                    strokeWidth={0.5}
                  />
                  <text
                    x={midX}
                    y={midY - 5}
                    textAnchor='middle'
                    fontSize='11'
                    fill='#334155'
                    fontWeight={600}
                  >
                    {conn.label}
                  </text>
                  <animate attributeName='opacity' values='0;1' dur='0.3s' begin='0.1s' fill='freeze' />
                </g>
              )}
            </g>
          )
        })}

        {/* ------------------------------------------------------------- */}
        {/* Draw agent nodes                                              */}
        {/* ------------------------------------------------------------- */}
        {agents.map(agent => {
          const pos = nodePositions[agent.id]
          if (!pos) return null

          const statusColor = STATUS_COLORS[agent.status] || STATUS_COLORS.idle
          const isWorking = agent.status === 'working'

          return (
            <g
              key={agent.id}
              onClick={() => handleAgentClick(agent)}
              onKeyDown={(e) => handleKeyDown(e, agent)}
              style={{ cursor: onAgentClick ? 'pointer' : 'default' }}
              role={onAgentClick ? 'button' : undefined}
              tabIndex={onAgentClick ? 0 : undefined}
              aria-label={`${agent.displayName || agent.name} - ${agent.status}`}
            >
              {/* Pulse rings for working agents */}
              {isWorking && (
                <>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={28}
                    fill='none'
                    stroke={statusColor}
                    strokeWidth='2'
                    opacity='0.4'
                    filter='url(#glow-soft)'
                  >
                    <animate attributeName='r' values='28;40;28' dur='1.5s' repeatCount='indefinite' />
                    <animate attributeName='opacity' values='0.4;0;0.4' dur='1.5s' repeatCount='indefinite' />
                  </circle>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={28}
                    fill='none'
                    stroke={statusColor}
                    strokeWidth='2'
                    opacity='0.3'
                  >
                    <animate attributeName='r' values='28;50;28' dur='1.5s' begin='0.5s' repeatCount='indefinite' />
                    <animate attributeName='opacity' values='0.3;0;0.3' dur='1.5s' begin='0.5s' repeatCount='indefinite' />
                  </circle>
                </>
              )}

              {/* Card background */}
              <rect
                x={pos.x - CARD_WIDTH / 2}
                y={pos.y - CARD_HEIGHT / 2}
                width={CARD_WIDTH}
                height={CARD_HEIGHT}
                rx={12}
                fill='#fff'
                stroke={statusColor}
                strokeWidth={isWorking ? 2.5 : 2}
              />

              {/* Status indicator dot */}
              <circle
                cx={pos.x + CARD_WIDTH / 2 - 14}
                cy={pos.y - CARD_HEIGHT / 2 + 14}
                r={6}
                fill={statusColor}
              >
                {isWorking && (
                  <animate attributeName='r' values='6;9;6' dur='1.5s' repeatCount='indefinite' />
                )}
              </circle>

              {/* Agent name */}
              <text
                x={pos.x}
                y={pos.y - 8}
                textAnchor='middle'
                fontSize='13'
                fontWeight={700}
                fill='#1e293b'
              >
                {agent.displayName || agent.name}
              </text>

              {/* Current task (truncated) */}
              <text
                x={pos.x}
                y={pos.y + 12}
                textAnchor='middle'
                fontSize='11'
                fill='#64748b'
              >
                {agent.currentTask && agent.currentTask.length > 24
                  ? agent.currentTask.substring(0, 24) + '…'
                  : agent.currentTask || 'Sin tarea'}
              </text>
            </g>
          )
        })}
      </svg>
    </Box>
  )
})

AgentFlowGraph.displayName = 'AgentFlowGraph'

export default AgentFlowGraph

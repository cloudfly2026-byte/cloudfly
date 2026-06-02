'use client'

// ============================================================
// CLOUD-209: LiveAgentCard — Individual Agent Display Component
// ============================================================
// Reusable card component displaying a single marketing agent's
// live status, current task, and activity information with
// animations and visual indicators.
//
// Features:
//   • 5 status types with distinct colors & icons
//   • framer-motion animations (pulse, shake, slide-in, color transition)
//   • Agent-specific Lucide icons (researcher→Search, icp→Target, etc.)
//   • Relative time formatting via date-fns with Spanish locale
//   • Task duration counter (live MM:SS from taskStartedAt)
//   • Shimmer progress bar for working status (framer-motion)
//   • Compact mode for inline/grid use
//   • React.memo() for performance optimization
//   • isHighlighted & onClick props for drill-down
//
// CLOUD-259: All CSS keyframes replaced with framer-motion declarative animations.
//            No CSS <style> tags or MUI keyframes remain.
// ============================================================

import React, { memo, useMemo, useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Avatar,
  Tooltip,
  Stack
} from '@mui/material'
import {
  Brain,
  Search,
  PenTool,
  Target,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { MarketingAgent, AgentStatus } from '@/types/marketing/aiMarketing'

// ---------------------------------------------------------------------------
// Status Configuration (System Architect spec — authoritative)
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  AgentStatus,
  {
    color: string
    bg: string
    label: string
    icon: React.FC<{ size?: number; className?: string }>
  }
> = {
  idle: {
    color: '#94a3b8',
    bg: '#f1f5f9',
    label: 'En espera',
    icon: Clock
  },
  working: {
    color: '#3b82f6',
    bg: '#eff6ff',
    label: 'Trabajando',
    icon: Loader2
  },
  waiting: {
    color: '#f59e0b',
    bg: '#fffbeb',
    label: 'Esperando datos',
    icon: Clock
  },
  error: {
    color: '#ef4444',
    bg: '#fef2f2',
    label: 'Error',
    icon: AlertCircle
  },
  completed: {
    color: '#22c55e',
    bg: '#f0fdf4',
    label: 'Completado',
    icon: CheckCircle2
  }
}

// ---------------------------------------------------------------------------
// Agent Icon Mapping (Lucide React)
// ---------------------------------------------------------------------------

const AGENT_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  researcher: Search,
  icp_agent: Target,
  qualification_agent: Users,
  copywriter_agent: PenTool,
  default: Brain
}

// ---------------------------------------------------------------------------
// Props Interface
// ---------------------------------------------------------------------------

interface LiveAgentCardProps {
  /** The marketing agent data to display */
  agent: MarketingAgent
  /** Whether the card is visually highlighted (e.g., selected) */
  isHighlighted?: boolean
  /** Optional click handler for drill-down navigation */
  onClick?: (agent: MarketingAgent) => void
  /** Compact mode — smaller avatar + single-line layout for inline use */
  compact?: boolean
}

// ---------------------------------------------------------------------------
// Helper: Convert hex color to rgba string
// ---------------------------------------------------------------------------

/**
 * Converts a hex color (#rrggbb) to an rgba string with the given alpha.
 * Used for glow box-shadow effects in inline styles.
 */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// =====================================================================
// Sub-component: Framer-motion shimmer progress bar
// Replaces the old MUI keyframes-based ShimmerProgress styled component.
// Uses framer-motion to animate background-position for the shimmer effect.
// Uses a CSS class selector so existing tests can find it via querySelector.
// =====================================================================

const MotionShimmerBar: React.FC<{ color: string }> = ({ color }) => (
  <Box
    className='MuiLinearProgress-root'
    sx={{
      height: 4,
      borderRadius: 2,
      backgroundColor: hexToRgba(color, 0.1),
      overflow: 'hidden',
      position: 'relative'
    }}
  >
    <motion.div
      className='MuiLinearProgress-bar'
      style={{
        height: '100%',
        borderRadius: 2,
        background: `linear-gradient(90deg, ${color} 0%, ${hexToRgba(color, 0.7)} 50%, ${color} 100%)`,
        backgroundSize: '200% 100%',
        width: '100%'
      }}
      animate={{
        backgroundPosition: ['-200% 0', '200% 0']
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'linear'
      }}
    />
  </Box>
)

// =====================================================================
// Sub-component: Framer-motion working pulse wrapper
// Provides the pulsing box-shadow animation for working status cards.
// =====================================================================

const WorkingPulseWrapper: React.FC<{
  color: string
  children: React.ReactNode
}> = ({ color, children }) => (
  <motion.div
    animate={{
      boxShadow: [
        `0 0 0 0 ${hexToRgba(color, 0.4)}`,
        `0 0 0 12px ${hexToRgba(color, 0)}`,
        `0 0 0 0 ${hexToRgba(color, 0)}`
      ]
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: 'easeOut'
    }}
    style={{ borderRadius: 12, display: 'contents' }}
  >
    {children}
  </motion.div>
)

// =====================================================================
// Sub-component: Framer-motion error shake wrapper
// Provides the horizontal shake animation for error status cards.
// =====================================================================

const ErrorShakeWrapper: React.FC<{
  children: React.ReactNode
}> = ({ children }) => (
  <motion.div
    animate={{
      x: [0, -5, 5, -5, 5, 0]
    }}
    transition={{
      duration: 0.4,
      repeat: Infinity,
      repeatDelay: 2,
      ease: 'easeInOut'
    }}
  >
    {children}
  </motion.div>
)

// =====================================================================
// Sub-component: Framer-motion waiting glow wrapper
// Provides the subtle glow pulse for waiting status cards.
// =====================================================================

const WaitingGlowWrapper: React.FC<{
  color: string
  children: React.ReactNode
}> = ({ color, children }) => (
  <motion.div
    animate={{
      boxShadow: [
        `0 0 6px 0 ${hexToRgba(color, 0.3)}`,
        `0 0 12px 4px ${hexToRgba(color, 0.15)}`,
        `0 0 6px 0 ${hexToRgba(color, 0.3)}`
      ]
    }}
    transition={{
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut'
    }}
    style={{ borderRadius: 12, display: 'contents' }}
  >
    {children}
  </motion.div>
)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const LiveAgentCard: React.FC<LiveAgentCardProps> = ({
  agent,
  isHighlighted = false,
  onClick,
  compact = false
}) => {
  // ---- Task duration counter (live MM:SS) ----
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (agent.status !== 'working' || !agent.taskStartedAt) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [agent.status, agent.taskStartedAt])

  // ---- Derived values ----
  const config = STATUS_CONFIG[agent.status] || STATUS_CONFIG.idle

  const StatusIcon = config.icon

  const AgentIcon = useMemo(
    () => AGENT_ICONS[agent.id] || AGENT_ICONS.default,
    [agent.id]
  )

  // Relative time: "Hace 2 min", "Hace 1 hora", etc.
  const relativeTime = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(agent.lastActivity), {
        addSuffix: true,
        locale: es
      })
    } catch {
      return agent.lastActivity
    }
  }, [agent.lastActivity])

  // Task duration: "5:32" format
  const taskDuration = useMemo(() => {
    if (!agent.taskStartedAt || agent.status !== 'working') return null
    const start = new Date(agent.taskStartedAt).getTime()
    const diff = Math.max(0, Math.floor((now - start) / 1000))
    const mins = Math.floor(diff / 60)
    const secs = diff % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [agent.taskStartedAt, agent.status, now])

  // ---- Click handler ----
  const handleClick = useCallback(() => {
    if (onClick) onClick(agent)
  }, [onClick, agent])

  // =====================================================================
  // COMPACT MODE
  // =====================================================================
  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
      >
        <Card
          onClick={handleClick}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.75,
            borderRadius: 2,
            border: isHighlighted ? '2px solid' : '1px solid',
            borderColor: isHighlighted ? config.color : 'divider',
            bgcolor: isHighlighted ? config.bg : 'background.paper',
            cursor: onClick ? 'pointer' : 'default',
            transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
            minWidth: 180,
            ...(isHighlighted && {
              boxShadow: `0 0 8px 2px ${hexToRgba(config.color, 0.25)}`
            }),
            '&:hover': onClick
              ? {
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  borderColor: config.color
                }
              : {}
          }}
        >
          {/* Agent Icon */}
          <Avatar
            src={agent.avatar}
            sx={{
              width: 32,
              height: 32,
              bgcolor: agent.color || config.color,
              fontSize: '0.8rem',
              fontWeight: 700
            }}
          >
            <AgentIcon size={16} />
          </Avatar>

          {/* Name */}
          <Typography
            variant='body2'
            sx={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1
            }}
          >
            {agent.displayName || agent.name}
          </Typography>

          {/* Status dot — framer-motion pulse for working */}
          <Tooltip title={config.label} arrow>
            {agent.status === 'working' ? (
              <motion.div
                animate={{
                  boxShadow: [
                    `0 0 0 0 ${hexToRgba(config.color, 0.4)}`,
                    `0 0 0 6px ${hexToRgba(config.color, 0)}`,
                    `0 0 0 0 ${hexToRgba(config.color, 0)}`
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: config.color,
                  flexShrink: 0
                }}
              />
            ) : (
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: config.color,
                  flexShrink: 0
                }}
              />
            )}
          </Tooltip>
        </Card>
      </motion.div>
    )
  }

  // =====================================================================
  // FULL MODE — Build the card content, then wrap with status animations
  // =====================================================================

  const cardContent = (
    <>
      {/* Status indicator dot — top-right corner */}
      <Tooltip title={config.label} arrow placement='left'>
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 12,
            height: 12,
            borderRadius: '50%',
            bgcolor: config.color,
            zIndex: 1,
            border: '2px solid',
            borderColor: 'background.paper'
          }}
        />
      </Tooltip>

      <CardContent sx={{ p: 2.5 }}>
        {/* Header: Avatar + Name + Role */}
        <Stack direction='row' spacing={1.5} alignItems='center' sx={{ mb: 2 }}>
          <Avatar
            src={agent.avatar}
            sx={{
              width: 44,
              height: 44,
              bgcolor: agent.color || config.color,
              fontSize: '1rem',
              fontWeight: 700
            }}
          >
            <AgentIcon size={22} />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant='subtitle1'
              sx={{
                fontWeight: 600,
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {agent.displayName || agent.name}
            </Typography>
            {agent.role && (
              <Typography
                variant='caption'
                color='text.secondary'
                sx={{ display: 'block' }}
              >
                {agent.role}
              </Typography>
            )}
          </Box>
        </Stack>

        {/* Status Chip */}
        <Chip
          icon={<StatusIcon size={14} />}
          label={config.label}
          size='small'
          sx={{
            mb: 1.5,
            bgcolor: config.bg,
            color: config.color,
            fontWeight: 600,
            fontSize: '0.7rem',
            height: 22,
            '& .MuiChip-icon': { color: config.color }
          }}
        />

        {/* Current Task — with slide-in animation on change */}
        <Box sx={{ mb: 1.5 }}>
          <Typography
            variant='caption'
            color='text.secondary'
            sx={{
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: 0.5
            }}
          >
            Tarea actual
          </Typography>
          <AnimatePresence mode='wait'>
            <motion.div
              key={agent.currentTask || 'idle'}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Typography
                variant='body2'
                sx={{
                  mt: 0.5,
                  fontWeight: 500,
                  color:
                    agent.status === 'idle' ? 'text.secondary' : 'text.primary',
                  fontStyle: agent.status === 'idle' ? 'italic' : 'normal'
                }}
              >
                {agent.currentTask || 'Sin tarea asignada'}
              </Typography>
            </motion.div>
          </AnimatePresence>
        </Box>

        {/* Task Duration Counter (only for working status) */}
        {taskDuration && (
          <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Loader2 size={14} style={{ color: config.color }} className='fa-spin' />
            <Typography
              variant='caption'
              sx={{ color: config.color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
            >
              {taskDuration}
            </Typography>
          </Box>
        )}

        {/* Shimmer Progress Bar (only for working status) — framer-motion */}
        {agent.status === 'working' && (
          <Box sx={{ mb: 1.5 }}>
            <MotionShimmerBar color={config.color} />
          </Box>
        )}

        {/* Error shake animation wrapper */}
        {agent.status === 'error' && (
          <ErrorShakeWrapper>
            <Typography
              variant='caption'
              sx={{ color: 'error.main', fontWeight: 500 }}
            >
              Requiere atención
            </Typography>
          </ErrorShakeWrapper>
        )}

        {/* Last Activity — relative time */}
        <Typography variant='caption' color='text.secondary'>
          {relativeTime}
        </Typography>
      </CardContent>
    </>
  )

  // Build the card with inline box-shadow for isHighlighted (so tests can read it)
  const highlightedBoxShadow = isHighlighted
    ? `0 0 12px 3px ${hexToRgba(config.color, 0.3)}`
    : undefined

  const animatedCard = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        onClick={handleClick}
        elevation={isHighlighted ? 4 : 1}
        sx={{
          minWidth: 260,
          maxWidth: 320,
          borderRadius: 3,
          border: isHighlighted ? '2px solid' : '1px solid',
          borderColor: isHighlighted ? config.color : 'divider',
          bgcolor: isHighlighted ? config.bg : 'background.paper',
          transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
          position: 'relative',
          overflow: 'visible',
          cursor: onClick ? 'pointer' : 'default',
          ...(isHighlighted && {
            boxShadow: `0 0 12px 3px ${hexToRgba(config.color, 0.3)}`
          }),
          '&:hover': {
            boxShadow: onClick
              ? `0 8px 24px rgba(0,0,0,0.12), 0 0 12px 3px ${hexToRgba(config.color, 0.2)}`
              : '0 8px 24px rgba(0,0,0,0.12)',
            transform: 'translateY(-2px)',
            ...(onClick && { borderColor: config.color })
          }
        }}
      >
        {cardContent}
      </Card>
    </motion.div>
  )

  // Apply status-specific outer wrappers
  if (agent.status === 'working') {
    return (
      <WorkingPulseWrapper color={config.color}>
        {animatedCard}
      </WorkingPulseWrapper>
    )
  }

  if (agent.status === 'waiting') {
    return (
      <WaitingGlowWrapper color={config.color}>
        {animatedCard}
      </WaitingGlowWrapper>
    )
  }

  return animatedCard
}

// ---------------------------------------------------------------------------
// Display name for React.memo debugging
// ---------------------------------------------------------------------------

LiveAgentCard.displayName = 'LiveAgentCard'

// ---------------------------------------------------------------------------
// Export with React.memo for performance optimization
// ---------------------------------------------------------------------------

const MemoizedLiveAgentCard = memo(LiveAgentCard)
MemoizedLiveAgentCard.displayName = 'LiveAgentCard'

export default MemoizedLiveAgentCard

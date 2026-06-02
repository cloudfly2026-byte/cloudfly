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
//   • Shimmer progress bar for working status
//   • Compact mode for inline/grid use
//   • React.memo() for performance optimization
//   • isHighlighted & onClick props for drill-down
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
  LinearProgress,
  Stack,
  keyframes,
  styled
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
// CSS Keyframes (MUI styled keyframes — replaces styled-jsx)
// ---------------------------------------------------------------------------

const pulseRing = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
  }
  70% {
    box-shadow: 0 0 0 12px rgba(59, 130, 246, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
  }
`

const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
`

const glowPulse = keyframes`
  0%, 100% { box-shadow: 0 0 6px 0 rgba(245, 158, 11, 0.3); }
  50% { box-shadow: 0 0 12px 4px rgba(245, 158, 11, 0.15); }
`

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
// Styled Shimmer Progress Bar
// ---------------------------------------------------------------------------

const ShimmerProgress = styled(LinearProgress)(({ theme }) => ({
  height: 4,
  borderRadius: 2,
  backgroundColor: 'rgba(59, 130, 246, 0.1)',
  '& .MuiLinearProgress-bar': {
    background: `linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%)`,
    backgroundSize: '200% 100%',
    animation: `${shimmer} 2s linear infinite`
  }
}))

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

  // ---- Animation variants ----
  const cardVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
  }

  const taskVariants = {
    initial: { x: -20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 20, opacity: 0 }
  }

  const errorShake = {
    animate: {
      x: [0, -5, 5, -5, 5, 0]
    },
    transition: {
      duration: 0.4,
      repeat: Infinity,
      repeatDelay: 2
    }
  }

  // ---- Status-specific card sx ----
  const getStatusSx = (): Record<string, unknown> => {
    const base: Record<string, unknown> = {}

    if (agent.status === 'working') {
      base.animation = `${pulseRing} 2s ease-out infinite`
    }

    if (agent.status === 'waiting') {
      base.animation = `${glowPulse} 3s ease-in-out infinite`
    }

    if (agent.status === 'error') {
      base.animation = `${shake} 0.4s ease-in-out`
    }

    return base
  }

  // =====================================================================
  // COMPACT MODE
  // =====================================================================
  if (compact) {
    return (
      <motion.div
        initial={cardVariants.initial}
        animate={cardVariants.animate}
        exit={cardVariants.exit}
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
            border: '1px solid',
            borderColor: isHighlighted ? config.color : 'divider',
            bgcolor: isHighlighted ? config.bg : 'background.paper',
            cursor: onClick ? 'pointer' : 'default',
            transition: 'all 0.3s ease',
            minWidth: 180,
            '&:hover': onClick
              ? {
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  borderColor: config.color
                }
              : {},
            ...getStatusSx()
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

          {/* Status dot */}
          <Tooltip title={config.label} arrow>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: config.color,
                flexShrink: 0,
                ...(agent.status === 'working' && {
                  animation: `${pulseRing} 2s ease-out infinite`
                })
              }}
            />
          </Tooltip>
        </Card>
      </motion.div>
    )
  }

  // =====================================================================
  // FULL MODE
  // =====================================================================
  return (
    <motion.div
      initial={cardVariants.initial}
      animate={cardVariants.animate}
      exit={cardVariants.exit}
      transition={{ duration: 0.3 }}
    >
      <Card
        onClick={handleClick}
        sx={{
          minWidth: 260,
          maxWidth: 320,
          borderRadius: 3,
          border: '1px solid',
          borderColor: isHighlighted ? config.color : 'divider',
          bgcolor: isHighlighted ? config.bg : 'background.paper',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'visible',
          cursor: onClick ? 'pointer' : 'default',
          '&:hover': {
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            transform: 'translateY(-2px)',
            ...(onClick && { borderColor: config.color })
          },
          ...getStatusSx()
        }}
      >
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
              borderColor: 'background.paper',
              ...(agent.status === 'working' && {
                animation: `${pulseRing} 2s ease-out infinite`
              })
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
                initial={taskVariants.initial}
                animate={taskVariants.animate}
                exit={taskVariants.exit}
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

          {/* Shimmer Progress Bar (only for working status) */}
          {agent.status === 'working' && (
            <Box sx={{ mb: 1.5 }}>
              <ShimmerProgress />
            </Box>
          )}

          {/* Error shake animation wrapper */}
          {agent.status === 'error' && (
            <motion.div {...errorShake}>
              <Typography
                variant='caption'
                sx={{ color: 'error.main', fontWeight: 500 }}
              >
                Requiere atención
              </Typography>
            </motion.div>
          )}

          {/* Last Activity — relative time */}
          <Typography variant='caption' color='text.secondary'>
            {relativeTime}
          </Typography>
        </CardContent>
      </Card>
    </motion.div>
  )
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

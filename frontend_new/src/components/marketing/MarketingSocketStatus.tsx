'use client'

// ============================================================
// CLOUD-243: MarketingSocketStatus — Socket Connection Status UI
// ============================================================
// Reusable component that visualizes the real-time socket connection
// status for the Marketing Live Dashboard. Shows connection state,
// subscription room, and last update timestamp with animated indicators.
//
// Features:
//   • 3 connection states with distinct colors & animations
//   • Room name display (marketing_tenant_X or marketing_tenant_X_company_Y)
//   • Last update timestamp with relative time
//   • Compact and full display modes
//   • Smooth transitions between states
//   • Multi-tenant room isolation indicator
// ============================================================

import React, { memo, useMemo } from 'react'
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  Stack,
  keyframes,
  styled
} from '@mui/material'
import {
  Wifi,
  WifiOff,
  Loader2,
  Shield,
  ShieldCheck,
  Radio
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

// ---------------------------------------------------------------------------
// CSS Keyframes
// ---------------------------------------------------------------------------

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 4px 0 rgba(16, 185, 129, 0.2); }
  50% { box-shadow: 0 0 12px 4px rgba(16, 185, 129, 0.15); }
`

const spinSlow = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

// ---------------------------------------------------------------------------
// Connection Status Configuration
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  connected: {
    icon: Wifi,
    label: 'Conectado',
    color: '#10b981',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    dotColor: '#10b981',
    animation: `${pulseGlow} 3s ease-in-out infinite`
  },
  disconnected: {
    icon: WifiOff,
    label: 'Desconectado',
    color: '#ef4444',
    bg: '#fef2f2',
    border: '#fecaca',
    dotColor: '#ef4444',
    animation: 'none'
  },
  reconnecting: {
    icon: Loader2,
    label: 'Reconectando...',
    color: '#f59e0b',
    bg: '#fffbeb',
    border: '#fde68a',
    dotColor: '#f59e0b',
    animation: `${spinSlow} 1.5s linear infinite`
  }
} as const

type ConnectionStatus = keyof typeof STATUS_CONFIG

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MarketingSocketStatusProps {
  /** Current connection status from useMarketingAgentsSocket */
  connectionStatus: ConnectionStatus
  /** Whether the socket is connected (from useSocket) */
  isConnected?: boolean
  /** The subscribed room name (e.g., marketing_tenant_1_company_2) */
  roomName?: string | null
  /** ISO-8601 timestamp of the last received event */
  lastUpdate?: string | null
  /** Current tenant ID for multi-tenant display */
  tenantId?: number
  /** Current company ID for multi-tenant display */
  companyId?: number
  /** Compact mode — inline chip only */
  compact?: boolean
  /** Show security/tenant isolation badge */
  showSecurityBadge?: boolean
}

// ---------------------------------------------------------------------------
// Styled Dot Indicator
// ---------------------------------------------------------------------------

const StatusDot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'dotColor' && prop !== 'dotAnimation'
})<{ dotColor: string; dotAnimation: string }>(
  ({ dotColor, dotAnimation }) => ({
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: dotColor,
    animation: dotAnimation,
    flexShrink: 0
  })
)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MarketingSocketStatus: React.FC<MarketingSocketStatusProps> = ({
  connectionStatus,
  isConnected,
  roomName,
  lastUpdate,
  tenantId,
  companyId,
  compact = false,
  showSecurityBadge = true
}) => {
  const config = STATUS_CONFIG[connectionStatus] || STATUS_CONFIG.disconnected
  const StatusIcon = config.icon

  // Relative time for last update
  const relativeTime = useMemo(() => {
    if (!lastUpdate) return null
    try {
      return formatDistanceToNow(new Date(lastUpdate), {
        addSuffix: true,
        locale: es
      })
    } catch {
      return null
    }
  }, [lastUpdate])

  // Room display name (shortened for compact mode)
  const displayRoom = useMemo(() => {
    if (!roomName) return null
    if (compact) {
      // Shorten: marketing_tenant_1_company_2 → T1:C2
      const tenantMatch = roomName.match(/tenant_(\d+)/)
      const companyMatch = roomName.match(/company_(\d+)/)
      if (tenantMatch) {
        return companyMatch ? `T${tenantMatch[1]}:C${companyMatch[1]}` : `T${tenantMatch[1]}`
      }
    }
    return roomName
  }, [roomName, compact])

  // Animation variants
  const variants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 }
  }

  // =====================================================================
  // COMPACT MODE — Inline chip
  // =====================================================================
  if (compact) {
    return (
      <AnimatePresence mode='wait'>
        <motion.div
          key={connectionStatus}
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
          transition={{ duration: 0.2 }}
        >
          <Chip
            icon={<StatusIcon size={14} />}
            label={config.label}
            size='small'
            sx={{
              bgcolor: config.bg,
              color: config.color,
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 24,
              border: '1px solid',
              borderColor: config.border,
              '& .MuiChip-icon': { color: config.color }
            }}
          />
        </motion.div>
      </AnimatePresence>
    )
  }

  // =====================================================================
  // FULL MODE — Status card with room info & security badge
  // =====================================================================
  return (
    <AnimatePresence mode='wait'>
      <motion.div
        key={connectionStatus}
        initial={variants.initial}
        animate={variants.animate}
        exit={variants.exit}
        transition={{ duration: 0.3 }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            p: 2,
            borderRadius: 2.5,
            bgcolor: config.bg,
            border: '1px solid',
            borderColor: config.border,
            transition: 'all 0.3s ease',
            animation: connectionStatus === 'connected' ? config.animation : 'none'
          }}
        >
          {/* Header: Status dot + label + icon */}
          <Stack direction='row' spacing={1} alignItems='center'>
            <StatusDot dotColor={config.dotColor} dotAnimation={config.animation} />
            <Typography
              variant='subtitle2'
              sx={{
                fontWeight: 700,
                color: config.color,
                flex: 1
              }}
            >
              {config.label}
            </Typography>
            <StatusIcon size={18} style={{ color: config.color }} />
          </Stack>

          {/* Room name */}
          {roomName && (
            <Stack direction='row' spacing={0.75} alignItems='center'>
              <Radio size={14} style={{ color: '#64748b' }} />
              <Typography
                variant='caption'
                sx={{
                  color: 'text.secondary',
                  fontFamily: 'monospace',
                  fontSize: '0.7rem',
                  letterSpacing: 0.3
                }}
              >
                {roomName}
              </Typography>
            </Stack>
          )}

          {/* Last update */}
          {relativeTime && (
            <Typography
              variant='caption'
              sx={{ color: 'text.secondary', fontSize: '0.65rem' }}
            >
              Última actualización: {relativeTime}
            </Typography>
          )}

          {/* Security / Tenant isolation badge */}
          {showSecurityBadge && tenantId && (
            <Tooltip
              title={`Aislamiento multi-tenant activo. Solo datos del tenant ${tenantId}${companyId ? ` / compañía ${companyId}` : ''} son visibles.`}
              arrow
              placement='top'
            >
              <Chip
                icon={<ShieldCheck size={12} />}
                label={`Tenant ${tenantId}${companyId ? ` · Cía ${companyId}` : ''}`}
                size='small'
                sx={{
                  bgcolor: 'rgba(99, 102, 241, 0.08)',
                  color: '#6366f1',
                  fontWeight: 600,
                  fontSize: '0.6rem',
                  height: 20,
                  '& .MuiChip-icon': { color: '#6366f1' },
                  alignSelf: 'flex-start'
                }}
              />
            </Tooltip>
          )}
        </Box>
      </motion.div>
    </AnimatePresence>
  )
}

MarketingSocketStatus.displayName = 'MarketingSocketStatus'

const MemoizedMarketingSocketStatus = memo(MarketingSocketStatus)
MemoizedMarketingSocketStatus.displayName = 'MarketingSocketStatus'

export default MemoizedMarketingSocketStatus

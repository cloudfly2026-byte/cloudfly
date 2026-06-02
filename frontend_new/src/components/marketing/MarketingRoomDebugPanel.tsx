'use client'

// ============================================================
// CLOUD-243: MarketingRoomDebugPanel — Debug Panel for Socket Rooms
// ============================================================
// Developer tool component that displays real-time socket subscription
// information for the Marketing Live Dashboard. Shows:
//   • Current subscription room name
//   • Connection status with animated indicator
//   • Tenant/Company isolation verification
//   • Event log (last N socket events received)
//   • Manual subscribe/unsubscribe controls
//   • Cross-tenant attempt simulation (for security testing)
//
// This component is ONLY rendered in development mode (NODE_ENV=development)
// and is hidden behind a toggle to avoid cluttering the production UI.
// ============================================================

import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Button,
  Divider,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  IconButton,
  Tooltip,
  keyframes
} from '@mui/material'
import {
  Bug,
  ChevronDown,
  Send,
  LogOut,
  Shield,
  ShieldAlert,
  Radio,
  Wifi,
  WifiOff,
  Trash2,
  Copy
} from 'lucide-react'
import { useSocket } from '@/contexts/SocketContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SocketEventLogEntry {
  id: number
  event: string
  data: unknown
  timestamp: string
  direction: 'in' | 'out'
}

interface MarketingRoomDebugPanelProps {
  /** Current tenant ID */
  tenantId: number
  /** Current company ID (optional) */
  companyId?: number
  /** Current connection status */
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting'
  /** Current subscribed room name */
  currentRoom?: string | null
}

// ---------------------------------------------------------------------------
// Keyframes
// ---------------------------------------------------------------------------

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
`

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MarketingRoomDebugPanel: React.FC<MarketingRoomDebugPanelProps> = ({
  tenantId,
  companyId,
  connectionStatus,
  currentRoom
}) => {
  const { socket, isConnected } = useSocket()
  const [eventLog, setEventLog] = useState<SocketEventLogEntry[]>([])
  const [customTenantId, setCustomTenantId] = useState(String(tenantId))
  const [customCompanyId, setCustomCompanyId] = useState(companyId ? String(companyId) : '')
  const [crossTenantResult, setCrossTenantResult] = useState<string | null>(null)
  const logIdRef = useRef(0)

  // -----------------------------------------------------------------------
  // Listen for marketing socket events and log them
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!socket) return

    const eventsToListen = [
      'subscribed-marketing',
      'unsubscribed-marketing',
      'marketing-batch-update',
      'marketing-agent-status-update',
      'marketing-agent-task-update',
      'marketing-action-event',
      'error'
    ]

    const handlers: Record<string, (data: unknown) => void> = {}

    eventsToListen.forEach(eventName => {
      handlers[eventName] = (data: unknown) => {
        logIdRef.current += 1
        setEventLog(prev => [
          {
            id: logIdRef.current,
            event: eventName,
            data,
            timestamp: new Date().toISOString(),
            direction: 'in'
          },
          ...prev
        ].slice(0, 50)) // Keep last 50 entries
      }
      socket.on(eventName, handlers[eventName])
    })

    return () => {
      eventsToListen.forEach(eventName => {
        socket.off(eventName, handlers[eventName])
      })
    }
  }, [socket])

  // -----------------------------------------------------------------------
  // Manual subscribe
  // -----------------------------------------------------------------------

  const handleManualSubscribe = useCallback(() => {
    if (!socket) return
    const payload = {
      tenantId: Number(customTenantId),
      companyId: customCompanyId ? Number(customCompanyId) : undefined
    }
    socket.emit('subscribe-marketing', payload)

    logIdRef.current += 1
    setEventLog(prev => [
      {
        id: logIdRef.current,
        event: 'subscribe-marketing',
        data: payload,
        timestamp: new Date().toISOString(),
        direction: 'out'
      },
      ...prev
    ].slice(0, 50))
  }, [socket, customTenantId, customCompanyId])

  // -----------------------------------------------------------------------
  // Manual unsubscribe
  // -----------------------------------------------------------------------

  const handleManualUnsubscribe = useCallback(() => {
    if (!socket) return
    const payload = {
      tenantId: Number(customTenantId),
      companyId: customCompanyId ? Number(customCompanyId) : undefined
    }
    socket.emit('unsubscribe-marketing', payload)

    logIdRef.current += 1
    setEventLog(prev => [
      {
        id: logIdRef.current,
        event: 'unsubscribe-marketing',
        data: payload,
        timestamp: new Date().toISOString(),
        direction: 'out'
      },
      ...prev
    ].slice(0, 50))
  }, [socket, customTenantId, customCompanyId])

  // -----------------------------------------------------------------------
  // Cross-tenant attempt simulation (security test)
  // -----------------------------------------------------------------------

  const handleCrossTenantAttempt = useCallback(() => {
    if (!socket) return
    // Try to subscribe with a DIFFERENT tenantId
    const fakeTenantId = tenantId + 9999
    const payload = { tenantId: fakeTenantId }
    socket.emit('subscribe-marketing', payload)

    setCrossTenantResult(`Intento de cross-tenant enviado: tenantId=${fakeTenantId} (esperado: error del servidor)`)

    logIdRef.current += 1
    setEventLog(prev => [
      {
        id: logIdRef.current,
        event: 'subscribe-marketing (cross-tenant attempt)',
        data: payload,
        timestamp: new Date().toISOString(),
        direction: 'out'
      },
      ...prev
    ].slice(0, 50))
  }, [socket, tenantId])

  // -----------------------------------------------------------------------
  // Clear log
  // -----------------------------------------------------------------------

  const handleClearLog = useCallback(() => {
    setEventLog([])
    setCrossTenantResult(null)
  }, [])

  // -----------------------------------------------------------------------
  // Copy room name to clipboard
  // -----------------------------------------------------------------------

  const handleCopyRoom = useCallback(() => {
    if (currentRoom) {
      navigator.clipboard.writeText(currentRoom)
    }
  }, [currentRoom])

  // -----------------------------------------------------------------------
  // Only render in development mode
  // -----------------------------------------------------------------------

  if (process.env.NODE_ENV === 'production') {
    return null
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const expectedRoom = companyId
    ? `marketing_tenant_${tenantId}_company_${companyId}`
    : `marketing_tenant_${tenantId}`

  return (
    <Box sx={{ mt: 3 }}>
      <Accordion
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary
          expandIcon={<ChevronDown size={18} />}
          sx={{
            bgcolor: 'action.hover',
            borderRadius: 2,
            minHeight: 44,
            '&.Mui-expanded': { minHeight: 44 }
          }}
        >
          <Stack direction='row' spacing={1} alignItems='center'>
            <Bug size={18} style={{ color: '#8b5cf6' }} />
            <Typography variant='subtitle2' sx={{ fontWeight: 600 }}>
              Debug: Marketing Socket Rooms
            </Typography>
            <Chip
              label={`${eventLog.length} eventos`}
              size='small'
              sx={{ bgcolor: '#f5f3ff', color: '#8b5cf6', fontWeight: 600, fontSize: '0.6rem', height: 18 }}
            />
          </Stack>
        </AccordionSummary>

        <AccordionDetails sx={{ p: 2.5 }}>
          {/* Connection Info */}
          <Typography variant='subtitle2' sx={{ mb: 1.5, fontWeight: 600 }}>
            Información de Conexión
          </Typography>

          <Stack spacing={1} sx={{ mb: 2.5 }}>
            {/* Socket ID */}
            <Stack direction='row' spacing={1} alignItems='center'>
              <Typography variant='caption' color='text.secondary' sx={{ minWidth: 100 }}>
                Socket ID:
              </Typography>
              <Typography variant='caption' sx={{ fontFamily: 'monospace' }}>
                {socket?.id || 'N/A'}
              </Typography>
            </Stack>

            {/* Connection Status */}
            <Stack direction='row' spacing={1} alignItems='center'>
              <Typography variant='caption' color='text.secondary' sx={{ minWidth: 100 }}>
                Estado:
              </Typography>
              <Chip
                icon={connectionStatus === 'connected' ? <Wifi size={12} /> : <WifiOff size={12} />}
                label={connectionStatus}
                size='small'
                sx={{
                  bgcolor: connectionStatus === 'connected' ? '#ecfdf5' : '#fef2f2',
                  color: connectionStatus === 'connected' ? '#10b981' : '#ef4444',
                  fontWeight: 600,
                  fontSize: '0.6rem',
                  height: 18,
                  '& .MuiChip-icon': { color: 'inherit' }
                }}
              />
            </Stack>

            {/* Expected Room */}
            <Stack direction='row' spacing={1} alignItems='center'>
              <Typography variant='caption' color='text.secondary' sx={{ minWidth: 100 }}>
                Sala esperada:
              </Typography>
              <Typography variant='caption' sx={{ fontFamily: 'monospace', color: '#3b82f6' }}>
                {expectedRoom}
              </Typography>
              <Tooltip title='Copiar nombre de sala'>
                <IconButton size='small' onClick={handleCopyRoom}>
                  <Copy size={12} />
                </IconButton>
              </Tooltip>
            </Stack>

            {/* Current Room (from subscribed-marketing confirmation) */}
            <Stack direction='row' spacing={1} alignItems='center'>
              <Typography variant='caption' color='text.secondary' sx={{ minWidth: 100 }}>
                Sala actual:
              </Typography>
              <Typography variant='caption' sx={{ fontFamily: 'monospace', color: currentRoom ? '#10b981' : '#94a3b8' }}>
                {currentRoom || 'No suscrito'}
              </Typography>
            </Stack>

            {/* Tenant Isolation */}
            <Stack direction='row' spacing={1} alignItems='center'>
              <Typography variant='caption' color='text.secondary' sx={{ minWidth: 100 }}>
                Aislamiento:
              </Typography>
              <Chip
                icon={<Shield size={12} />}
                label={`Tenant ${tenantId}${companyId ? ` · Cía ${companyId}` : ''}`}
                size='small'
                sx={{
                  bgcolor: 'rgba(99, 102, 241, 0.08)',
                  color: '#6366f1',
                  fontWeight: 600,
                  fontSize: '0.6rem',
                  height: 18,
                  '& .MuiChip-icon': { color: '#6366f1' }
                }}
              />
            </Stack>
          </Stack>

          <Divider sx={{ mb: 2.5 }} />

          {/* Manual Controls */}
          <Typography variant='subtitle2' sx={{ mb: 1.5, fontWeight: 600 }}>
            Controles Manuales
          </Typography>

          <Stack spacing={1.5} sx={{ mb: 2.5 }}>
            <Stack direction='row' spacing={1} alignItems='center'>
              <TextField
                size='small'
                label='Tenant ID'
                value={customTenantId}
                onChange={e => setCustomTenantId(e.target.value)}
                sx={{ width: 120 }}
                type='number'
              />
              <TextField
                size='small'
                label='Company ID'
                value={customCompanyId}
                onChange={e => setCustomCompanyId(e.target.value)}
                sx={{ width: 120 }}
                type='number'
                placeholder='Opcional'
              />
              <Button
                variant='contained'
                size='small'
                startIcon={<Send size={14} />}
                onClick={handleManualSubscribe}
                disabled={!isConnected}
                sx={{ bgcolor: '#3b82f6' }}
              >
                Subscribe
              </Button>
              <Button
                variant='outlined'
                size='small'
                startIcon={<LogOut size={14} />}
                onClick={handleManualUnsubscribe}
                disabled={!isConnected}
                color='secondary'
              >
                Unsubscribe
              </Button>
            </Stack>

            {/* Cross-tenant test */}
            <Stack direction='row' spacing={1} alignItems='center'>
              <Button
                variant='outlined'
                size='small'
                startIcon={<ShieldAlert size={14} />}
                onClick={handleCrossTenantAttempt}
                disabled={!isConnected}
                sx={{ borderColor: '#ef4444', color: '#ef4444', '&:hover': { borderColor: '#dc2626', bgcolor: '#fef2f2' } }}
              >
                Test Cross-Tenant
              </Button>
              <Typography variant='caption' color='text.secondary'>
                Simula una suscripción con tenantId diferente (debe ser rechazada por el servidor)
              </Typography>
            </Stack>

            {crossTenantResult && (
              <Alert severity='warning' sx={{ py: 0 }}>
                {crossTenantResult}
              </Alert>
            )}
          </Stack>

          <Divider sx={{ mb: 2.5 }} />

          {/* Event Log */}
          <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 1.5 }}>
            <Typography variant='subtitle2' sx={{ fontWeight: 600, flex: 1 }}>
              Log de Eventos
            </Typography>
            <Button
              variant='text'
              size='small'
              startIcon={<Trash2 size={12} />}
              onClick={handleClearLog}
              sx={{ color: '#94a3b8' }}
            >
              Limpiar
            </Button>
          </Stack>

          <Box
            sx={{
              maxHeight: 300,
              overflowY: 'auto',
              bgcolor: '#0f172a',
              borderRadius: 1.5,
              p: 1.5,
              fontFamily: 'monospace',
              fontSize: '0.7rem'
            }}
          >
            {eventLog.length === 0 ? (
              <Typography sx={{ color: '#64748b', fontStyle: 'italic' }}>
                Esperando eventos...
              </Typography>
            ) : (
              eventLog.map(entry => {
                const isOut = entry.direction === 'out'
                const isError = entry.event === 'error'
                const time = new Date(entry.timestamp).toLocaleTimeString('es-CO')

                return (
                  <Box
                    key={entry.id}
                    sx={{
                      mb: 0.75,
                      display: 'flex',
                      gap: 1,
                      alignItems: 'flex-start'
                    }}
                  >
                    <Typography
                      sx={{
                        color: '#64748b',
                        flexShrink: 0,
                        fontSize: '0.65rem'
                      }}
                    >
                      {time}
                    </Typography>
                    <Chip
                      label={isOut ? 'OUT' : 'IN'}
                      size='small'
                      sx={{
                        bgcolor: isOut ? '#1e3a5f' : '#1e293b',
                        color: isOut ? '#60a5fa' : '#94a3b8',
                        fontWeight: 700,
                        fontSize: '0.5rem',
                        height: 14,
                        minWidth: 28,
                        '& .MuiChip-label': { px: 0.5 }
                      }}
                    />
                    <Typography
                      sx={{
                        color: isError ? '#ef4444' : isOut ? '#60a5fa' : '#22c55e',
                        fontWeight: 600,
                        flexShrink: 0
                      }}
                    >
                      {entry.event}
                    </Typography>
                    <Typography
                      sx={{
                        color: '#94a3b8',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {JSON.stringify(entry.data).substring(0, 120)}
                    </Typography>
                  </Box>
                )
              })
            )}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  )
}

MarketingRoomDebugPanel.displayName = 'MarketingRoomDebugPanel'

export default MarketingRoomDebugPanel

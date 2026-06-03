'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Box,
  Typography,
  Grid,
  Paper,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  Button,
  Divider,
  Fade,
  Zoom,
  Collapse,
  Snackbar
} from '@mui/material'
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Users,
  Activity,
  Zap,
  Loader,
  Clock,
  ShieldAlert,
  Radio
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useMarketingAgentsSocket } from '@/hooks/useMarketingAgentsSocket'
import { marketingHistoryService } from '@/services/marketing/marketingHistoryService'
import LiveAgentCard from '@/views/marketing/ai-operation/LiveAgentCard'
import AgentFlowGraph from '@/views/marketing/ai-operation/AgentFlowGraph'
import MarketingHistoryTimeline from '@/views/marketing/ai-operation/MarketingHistoryTimeline'
import MarketingSocketStatus from '@/components/marketing/MarketingSocketStatus'
import MarketingRoomDebugPanel from '@/components/marketing/MarketingRoomDebugPanel'
import type { MarketingAgent, AgentConnection, MarketingActionEvent } from '@/types/marketing/aiMarketing'

// ---------------------------------------------------------------------------
// Connection status chip — uses connectionStatus from hook
// ---------------------------------------------------------------------------

const ConnectionChip: React.FC<{ connectionStatus: 'connected' | 'disconnected' | 'reconnecting' }> = ({ connectionStatus }) => {
  const config = {
    connected: {
      icon: <Wifi size={16} />,
      label: 'Conectado',
      bgColor: '#ecfdf5',
      color: '#10b981'
    },
    disconnected: {
      icon: <WifiOff size={16} />,
      label: 'Desconectado',
      bgColor: '#fef2f2',
      color: '#ef4444'
    },
    reconnecting: {
      icon: <Loader size={16} />,
      label: 'Reconectando...',
      bgColor: '#fffbeb',
      color: '#f59e0b'
    }
  }

  const c = config[connectionStatus] || config.disconnected

  return (
    <Chip
      icon={c.icon}
      label={c.label}
      size='small'
      sx={{
        bgcolor: c.bgColor,
        color: c.color,
        fontWeight: 600,
        '& .MuiChip-icon': { color: 'inherit' }
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => (
  <Paper
    sx={{
      p: 2,
      borderRadius: 3,
      border: '1px solid',
      borderColor: 'divider',
      display: 'flex',
      alignItems: 'center',
      gap: 1.5
    }}
  >
    <Box sx={{ color }}>{icon}</Box>
    <Box>
      <Typography variant='h5' sx={{ fontWeight: 700, lineHeight: 1.2 }}>{value}</Typography>
      <Typography variant='caption' color='text.secondary'>{label}</Typography>
    </Box>
  </Paper>
)

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

const MarketingLiveDashboardPage: React.FC = () => {
  // -----------------------------------------------------------------------
  // CLOUD-251: Resolve tenantId and companyId from NextAuth session
  // -----------------------------------------------------------------------
  const { data: session } = useSession()
  const tenantId = session?.user?.tenantId || session?.user?.customerId || 1
  const companyId = session?.user?.activeCompanyId || session?.user?.company_id

  const {
    agents,
    connections,
    events,
    isConnected,
    connectionStatus,
    lastUpdate,
    roomName,
    subscriptionError,
    reconnect,
    requestStatus
  } = useMarketingAgentsSocket({ tenantId, companyId })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // -----------------------------------------------------------------------
  // CLOUD-252: State for REST history events (for merging with socket events)
  // -----------------------------------------------------------------------
  const [historyEvents, setHistoryEvents] = useState<MarketingActionEvent[]>([])

  // -----------------------------------------------------------------------
  // CLOUD-243: Show snackbar for subscription errors (cross-tenant, etc.)
  // -----------------------------------------------------------------------
  const [showSubError, setShowSubError] = useState(false)

  useEffect(() => {
    if (subscriptionError) {
      setShowSubError(true)
    }
  }, [subscriptionError])

  // Request current status from the marketing team via socket on connection/mount
  useEffect(() => {
    if (connectionStatus === 'connected') {
      requestStatus()
    }
  }, [connectionStatus, requestStatus])

  // -----------------------------------------------------------------------
  // Initial data load via REST with AbortController cleanup
  // -----------------------------------------------------------------------

  useEffect(() => {
    const controller = new AbortController()

    const loadInitialData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch initial action history via REST with AbortSignal
        const history = await marketingHistoryService.getActionHistory(
          tenantId,
          50,
          0,
          companyId,
          controller.signal
        )
        if (history?.events) {
          // CLOUD-252: Store REST history events for merging with socket events
          setHistoryEvents(history.events)
        }
      } catch (err) {
        // Do NOT set error state if the request was intentionally cancelled
        if ((err as Error).name !== 'AbortError') {
          console.error('[MarketingLiveDashboard] Initial load error:', err)
          setError('Error al cargar los datos iniciales. Usando modo offline.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()

    // Cleanup: abort any in-flight request when component unmounts
    return () => controller.abort()
  }, [tenantId, companyId])

  // -----------------------------------------------------------------------
  // Manual reconnect handler — triggers both WS reconnect and REST refetch
  // -----------------------------------------------------------------------

  const handleReconnect = () => {
    reconnect()
    setRefreshKey(prev => prev + 1)
  }

  // Use a refreshKey to allow manual re-fetch from the reconnect button
  const [refreshKey, setRefreshKey] = useState(0)

  // Separate useEffect for manual reconnection that depends on refreshKey
  useEffect(() => {
    if (refreshKey === 0) return // Skip initial mount (handled by the main useEffect above)

    const controller = new AbortController()

    const loadInitialData = async () => {
      try {
        setLoading(true)
        setError(null)

        const history = await marketingHistoryService.getActionHistory(
          tenantId,
          50,
          0,
          companyId,
          controller.signal
        )
        if (history?.events) {
          setHistoryEvents(history.events)
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('[MarketingLiveDashboard] Re-fetch error:', err)
          setError('Error al recargar los datos. Usando modo offline.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()

    return () => controller.abort()
  }, [refreshKey, tenantId, companyId])

  // -----------------------------------------------------------------------
  // CLOUD-252: Merge socket events + REST history, deduplicated by ID
  // -----------------------------------------------------------------------

  const allEvents = useMemo(() => {
    const socketIds = new Set(events.map(e => e.id))
    const filteredHistory = historyEvents.filter(e => !socketIds.has(e.id))
    return [...events, ...filteredHistory].slice(0, 50)
  }, [events, historyEvents])

  // -----------------------------------------------------------------------
  // Derived stats
  // -----------------------------------------------------------------------

  const workingCount = agents.filter(a => a.status === 'working').length
  const waitingCount = agents.filter(a => a.status === 'waiting').length
  const errorCount = agents.filter(a => a.status === 'error').length
  const idleCount = agents.filter(a => a.status === 'idle').length

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading && agents.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={60} thickness={4} />
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          mb: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 2
        }}
      >
        <Box>
          <Typography
            variant='h4'
            sx={{
              mb: 1,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5
            }}
          >
            <Activity size={32} className='text-blue-500' />
            Marketing Live Dashboard
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Estado en tiempo real del equipo de marketing — agentes, flujo de trabajo y historial de acciones.
          </Typography>
          {lastUpdate && (
            <Typography variant='caption' color='text.secondary' sx={{ mt: 0.5, display: 'block' }}>
              Última actualización: {new Date(lastUpdate).toLocaleTimeString('es-CO')}
            </Typography>
          )}
        </Box>
        <Stack direction='row' spacing={1.5} alignItems='center'>
          <ConnectionChip connectionStatus={connectionStatus} />
          <Button
            variant='outlined'
            size='small'
            startIcon={<RefreshCw size={16} />}
            onClick={handleReconnect}
            disabled={connectionStatus === 'reconnecting'}
          >
            Reconectar
          </Button>
        </Stack>
      </Box>

      {/* CLOUD-243: Subscription error alert (cross-tenant rejection) */}
      <Collapse in={!!subscriptionError}>
        <Alert
          severity='error'
          sx={{ mb: 3 }}
          onClose={() => setShowSubError(false)}
          icon={<ShieldAlert size={20} />}
        >
          <Typography variant='body2' sx={{ fontWeight: 600 }}>
            Error de suscripción al canal de marketing
          </Typography>
          <Typography variant='caption'>
            {subscriptionError || 'Error desconocido'} — Verifique que el tenant y compañía sean correctos.
          </Typography>
        </Alert>
      </Collapse>

      {/* Error alert */}
      {error && (
        <Alert severity='warning' sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* CLOUD-243: Socket Status Panel + Room Info */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <MarketingSocketStatus
            connectionStatus={connectionStatus}
            isConnected={isConnected}
            roomName={roomName}
            lastUpdate={lastUpdate}
            tenantId={tenantId}
            companyId={companyId}
            showSecurityBadge
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'divider',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            <Stack direction='row' spacing={2} alignItems='center' justifyContent='space-around'>
              {/* Room indicator */}
              <Box sx={{ textAlign: 'center' }}>
                <Radio size={20} style={{ color: connectionStatus === 'connected' ? '#10b981' : '#94a3b8' }} />
                <Typography variant='caption' display='block' color='text.secondary' sx={{ mt: 0.5 }}>
                  Canal
                </Typography>
                <Typography
                  variant='caption'
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    color: roomName ? '#3b82f6' : '#94a3b8',
                    fontSize: '0.65rem'
                  }}
                >
                  {roomName || 'No suscrito'}
                </Typography>
              </Box>

              {/* Tenant isolation */}
              <Box sx={{ textAlign: 'center' }}>
                <Chip
                  label={`T${tenantId}${companyId ? `:C${companyId}` : ''}`}
                  size='small'
                  sx={{
                    bgcolor: 'rgba(99, 102, 241, 0.08)',
                    color: '#6366f1',
                    fontWeight: 700,
                    fontSize: '0.7rem'
                  }}
                />
                <Typography variant='caption' display='block' color='text.secondary' sx={{ mt: 0.5 }}>
                  Aislamiento
                </Typography>
              </Box>

              {/* Agent count */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant='h6' sx={{ fontWeight: 700, color: '#3b82f6' }}>
                  {agents.length}
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                  Agentes
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Stats row — CLOUD-253: 5 stat cards including Total Eventos */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={2.4}>
          <StatCard
            icon={<Users size={24} />}
            label='Agentes Activos'
            value={agents.length}
            color='#3b82f6'
          />
        </Grid>
        <Grid item xs={6} sm={2.4}>
          <StatCard
            icon={<Zap size={24} />}
            label='Trabajando'
            value={workingCount}
            color='#10b981'
          />
        </Grid>
        <Grid item xs={6} sm={2.4}>
          <StatCard
            icon={<Activity size={24} />}
            label='En Espera'
            value={waitingCount}
            color='#f59e0b'
          />
        </Grid>
        <Grid item xs={6} sm={2.4}>
          <StatCard
            icon={<Activity size={24} />}
            label='Errores'
            value={errorCount}
            color='#ef4444'
          />
        </Grid>
        <Grid item xs={12} sm={2.4}>
          <StatCard
            icon={<Clock size={24} />}
            label='Total Eventos'
            value={allEvents.length}
            color='#8b5cf6'
          />
        </Grid>
      </Grid>

      {/* Agent Flow Graph */}
      <Paper
        sx={{
          mb: 4,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant='h6' sx={{ fontWeight: 600 }}>
            Flujo de Agentes
          </Typography>
          <Typography variant='caption' color='text.secondary'>
            Visualización del flujo de trabajo entre agentes
          </Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          <AgentFlowGraph agents={agents} connections={connections} />
        </Box>
      </Paper>

      <Grid container spacing={3}>
        {/* Agent Cards */}
        <Grid item xs={12} lg={7}>
          <Paper
            sx={{
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden'
            }}
          >
            <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant='h6' sx={{ fontWeight: 600 }}>
                Estado de Agentes
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                Estado en tiempo real de cada agente del equipo
              </Typography>
            </Box>
            <Box sx={{ p: 2.5 }}>
              {agents.length === 0 ? (
                <Typography color='text.secondary' sx={{ textAlign: 'center', py: 4 }}>
                  No hay agentes disponibles. Esperando conexión...
                </Typography>
              ) : (
                /* CLOUD-254: Responsive Grid instead of horizontal Stack */
                <Grid container spacing={2}>
                  {agents.map(agent => (
                    <Grid item xs={12} sm={6} md={4} key={agent.id}>
                      <Zoom in timeout={500}>
                        <div>
                          <LiveAgentCard agent={agent} />
                        </div>
                      </Zoom>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* History Timeline — CLOUD-252: receives merged events */}
        <Grid item xs={12} lg={5}>
          <MarketingHistoryTimeline events={allEvents} />
        </Grid>
      </Grid>

      {/* CLOUD-243: Debug Panel (only visible in development) */}
      <MarketingRoomDebugPanel
        tenantId={tenantId}
        companyId={companyId}
        connectionStatus={connectionStatus}
        currentRoom={roomName}
      />

      {/* CLOUD-243: Snackbar for subscription errors */}
      <Snackbar
        open={showSubError && !!subscriptionError}
        autoHideDuration={6000}
        onClose={() => setShowSubError(false)}
        message={subscriptionError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      />
    </Box>
  )
}

export default MarketingLiveDashboardPage

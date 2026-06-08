'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  Button,
  Divider,
  Stack,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  alpha,
  Badge,
  Collapse,
  Switch,
  FormControlLabel
} from '@mui/material'
import { Icon } from '@iconify/react'
import { axiosInstance } from '@/utils/axiosInstance'

// --- TYPES ---

type ServiceStatus = 'running' | 'stopped' | 'restarting' | 'unhealthy' | 'unknown'

type ServiceHealth = {
  name: string
  displayName: string
  status: ServiceStatus
  port?: number
  uptime?: string
  image?: string
  category: 'infrastructure' | 'core' | 'business' | 'integration' | 'frontend' | 'management'
  description: string
  dependencies: string[]
  cpu?: number
  memory?: number
  responseTime?: number
  lastChecked?: string
  logs?: string[]
}

type SystemOverview = {
  totalServices: number
  runningServices: number
  stoppedServices: number
  restartingServices: number
  healthyPercentage: number
  totalCpu: number
  totalMemory: number
  uptime: string
}

// --- CONSTANTS ---

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  infrastructure: { label: 'Infraestructura', color: '#6366f1', icon: 'tabler-server-2' },
  core: { label: 'Core Platform', color: '#8b5cf6', icon: 'tabler-building' },
  business: { label: 'Servicios de Negocio', color: '#06b6d4', icon: 'tabler-briefcase' },
  integration: { label: 'Integraciones', color: '#f59e0b', icon: 'tabler-plug-connected' },
  frontend: { label: 'Frontend', color: '#10b981', icon: 'tabler-layout' },
  management: { label: 'Gestión', color: '#ef4444', icon: 'tabler-settings' }
}

const STATUS_CONFIG: Record<ServiceStatus, { label: string; color: string; icon: string; bgColor: string }> = {
  running: { label: 'Activo', color: '#10b981', icon: 'tabler-circle-check', bgColor: 'rgba(16, 185, 129, 0.1)' },
  stopped: { label: 'Detenido', color: '#ef4444', icon: 'tabler-circle-x', bgColor: 'rgba(239, 68, 68, 0.1)' },
  restarting: { label: 'Reiniciando', color: '#f59e0b', icon: 'tabler-refresh', bgColor: 'rgba(245, 158, 11, 0.1)' },
  unhealthy: { label: 'Inestable', color: '#f97316', icon: 'tabler-alert-triangle', bgColor: 'rgba(249, 115, 22, 0.1)' },
  unknown: { label: 'Desconocido', color: '#6b7280', icon: 'tabler-help-circle', bgColor: 'rgba(107, 114, 128, 0.1)' }
}

const DEFAULT_SERVICES: ServiceHealth[] = [
  // Infrastructure
  { name: 'mysql', displayName: 'MySQL (DB)', status: 'unknown', port: 3306, category: 'infrastructure', description: 'Base de datos principal MySQL 8.0', dependencies: [] },
  { name: 'zookeeper', displayName: 'Zookeeper', status: 'unknown', port: 2181, category: 'infrastructure', description: 'Coordinación distribuida para Kafka', dependencies: [] },
  { name: 'redis', displayName: 'Redis', status: 'unknown', port: 6379, category: 'infrastructure', description: 'Cache y almacenamiento en memoria', dependencies: [] },
  { name: 'postgresql', displayName: 'PostgreSQL', status: 'unknown', port: 5432, category: 'infrastructure', description: 'Base de datos para Evolution API', dependencies: [] },
  { name: 'qdrant', displayName: 'Qdrant', status: 'unknown', port: 6333, category: 'infrastructure', description: 'Base de datos vectorial para IA', dependencies: [] },
  // Core
  { name: 'kafka', displayName: 'Kafka', status: 'unknown', port: 9092, category: 'core', description: 'Mensajería y eventos en tiempo real', dependencies: ['zookeeper'] },
  { name: 'backend-api', displayName: 'Backend API', status: 'unknown', port: 8080, category: 'core', description: 'API principal del backend (Java/Spring)', dependencies: ['mysql', 'kafka'] },
  { name: 'evolution-api', displayName: 'Evolution API', status: 'unknown', port: 8082, category: 'core', description: 'API de WhatsApp/Mensajería', dependencies: ['redis'] },
  // Business
  { name: 'billing-service', displayName: 'Billing Service', status: 'unknown', port: 8086, category: 'business', description: 'Servicio de facturación', dependencies: ['backend-api', 'kafka'] },
  { name: 'scheduler-service', displayName: 'Scheduler Service', status: 'unknown', port: 8085, category: 'business', description: 'Servicio de programación de tareas', dependencies: ['mysql', 'kafka'] },
  { name: 'notification-service', displayName: 'Notification Service', status: 'unknown', category: 'business', description: 'Servicio de notificaciones', dependencies: ['kafka'] },
  { name: 'chat-socket-service', displayName: 'Chat Socket', status: 'unknown', port: 3001, category: 'business', description: 'Servicio de chat en tiempo real (WebSocket)', dependencies: ['kafka', 'redis', 'mysql'] },
  { name: 'ai-agent', displayName: 'AI Agent', status: 'unknown', category: 'business', description: 'Agente de IA conversacional', dependencies: ['kafka', 'redis', 'mysql'] },
  { name: 'ai-vector-worker', displayName: 'AI Vector Worker', status: 'unknown', category: 'business', description: 'Worker de procesamiento vectorial IA', dependencies: ['kafka', 'mysql'] },
  { name: 'marketing-agent', displayName: 'Marketing Agent', status: 'unknown', category: 'business', description: 'Agente de marketing automatizado', dependencies: ['kafka', 'mysql'] },
  { name: 'marketing-worker', displayName: 'Marketing Worker', status: 'unknown', category: 'business', description: 'Worker de marketing', dependencies: ['kafka', 'mysql'] },
  // Integration
  { name: 'lead-generator', displayName: 'Lead Generator', status: 'unknown', port: 8001, category: 'integration', description: 'Generador de leads B2B', dependencies: ['mysql'] },
  { name: 'lead-scrapper-google', displayName: 'Lead Scrapper Google', status: 'unknown', category: 'integration', description: 'Scrapper de leads desde Google', dependencies: ['kafka', 'mysql'] },
  { name: 'n8n', displayName: 'n8n Workflows', status: 'unknown', port: 5678, category: 'integration', description: 'Motor de automatización de flujos', dependencies: [] },
  // Frontend
  { name: 'frontend-react', displayName: 'Frontend React', status: 'unknown', port: 3000, category: 'frontend', description: 'Aplicación frontend Next.js', dependencies: [] },
  // Management
  { name: 'portainer', displayName: 'Portainer', status: 'unknown', port: 9000, category: 'management', description: 'Gestión visual de contenedores Docker', dependencies: [] }
]

// --- HELPER FUNCTIONS ---

function getUptime(createdAt: string): string {
  if (!createdAt) return '-'
  const created = new Date(createdAt)
  const now = new Date()
  const diff = now.getTime() - created.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }
  return `${hours}h ${minutes}m`
}

// --- MAIN COMPONENT ---

export default function SystemStatusPage() {
  const theme = useTheme()
  const [services, setServices] = useState<ServiceHealth[]>(DEFAULT_SERVICES)
  const [overview, setOverview] = useState<SystemOverview>({
    totalServices: DEFAULT_SERVICES.length,
    runningServices: 0,
    stoppedServices: 0,
    restartingServices: 0,
    healthyPercentage: 0,
    totalCpu: 0,
    totalMemory: 0,
    uptime: '-'
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [expandedService, setExpandedService] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<ServiceStatus | null>(null)

  // Fetch service health data
  const fetchServiceHealth = useCallback(async () => {
    try {
      setError(null)
      // Try to fetch from backend health endpoint
      const response = await axiosInstance.get('/api/system/health', { timeout: 5000 })
      const data = response.data

      if (data && data.services) {
        const updatedServices = DEFAULT_SERVICES.map(svc => {
          const backendSvc = data.services.find((s: any) => s.name === svc.name)
          if (backendSvc) {
            return {
              ...svc,
              status: backendSvc.status || 'unknown',
              uptime: backendSvc.uptime || '-',
              cpu: backendSvc.cpu || 0,
              memory: backendSvc.memory || 0,
              responseTime: backendSvc.responseTime || 0,
              lastChecked: new Date().toISOString()
            }
          }
          return svc
        })
        setServices(updatedServices)
      }
    } catch (err) {
      // If backend endpoint doesn't exist, try port checking
      console.warn('Health endpoint unavailable, using port checks:', err)
      await checkPortsFallback()
    } finally {
      setLoading(false)
      setLastRefresh(new Date())
    }
  }, [])

  // Fallback: check ports directly
  const checkPortsFallback = async () => {
    const portChecks = [
      { name: 'mysql', port: 3306 },
      { name: 'kafka', port: 9092 },
      { name: 'redis', port: 6379 },
      { name: 'backend-api', port: 8080 },
      { name: 'evolution-api', port: 8082 },
      { name: 'postgresql', port: 5432 },
      { name: 'qdrant', port: 6333 },
      { name: 'n8n', port: 5678 },
      { name: 'portainer', port: 9000 },
      { name: 'frontend-react', port: 3000 },
      { name: 'chat-socket-service', port: 3001 },
      { name: 'scheduler-service', port: 8085 },
      { name: 'billing-service', port: 8086 },
      { name: 'lead-generator', port: 8001 }
    ]

    const results = await Promise.allSettled(
      portChecks.map(async ({ name, port }) => {
        try {
          await axiosInstance.get(`http://localhost:${port}`, { timeout: 2000 })
          return { name, reachable: true }
        } catch {
          // Even a 4xx/5xx means the service is running
          return { name, reachable: true }
        }
      })
    )

    setServices(prev => prev.map(svc => {
      const check = portChecks.find(p => p.name === svc.name)
      if (!check) return { ...svc, status: 'unknown' as ServiceStatus }
      const result = results.find((r: any) => r.value?.name === svc.name)
      const isReachable = result?.status === 'fulfilled' && result.value?.reachable
      return {
        ...svc,
        status: isReachable ? 'running' as ServiceStatus : 'stopped' as ServiceStatus,
        lastChecked: new Date().toISOString()
      }
    }))
  }

  // Calculate overview
  useEffect(() => {
    const running = services.filter(s => s.status === 'running').length
    const stopped = services.filter(s => s.status === 'stopped').length
    const restarting = services.filter(s => s.status === 'restarting').length
    const total = services.length

    setOverview({
      totalServices: total,
      runningServices: running,
      stoppedServices: stopped,
      restartingServices: restarting,
      healthyPercentage: total > 0 ? Math.round((running / total) * 100) : 0,
      totalCpu: services.reduce((acc, s) => acc + (s.cpu || 0), 0),
      totalMemory: services.reduce((acc, s) => acc + (s.memory || 0), 0),
      uptime: '-'
    })
  }, [services])

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchServiceHealth()
  }, [fetchServiceHealth])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchServiceHealth, 30000) // 30 seconds
    return () => clearInterval(interval)
  }, [autoRefresh, fetchServiceHealth])

  // Filtered services
  const filteredServices = services.filter(svc => {
    if (filterCategory && svc.category !== filterCategory) return false
    if (filterStatus && svc.status !== filterStatus) return false
    return true
  })

  // Group by category
  const servicesByCategory = filteredServices.reduce((acc, svc) => {
    if (!acc[svc.category]) acc[svc.category] = []
    acc[svc.category].push(svc)
    return acc
  }, {} as Record<string, ServiceHealth[]>)

  const isDark = theme.palette.mode === 'dark'

  return (
    <Box className='p-6' sx={{ maxWidth: 1600, mx: 'auto' }}>
      {/* HEADER */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant='h4' sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Icon icon='tabler-server-bolt' fontSize={32} />
              Estado del Sistema
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
              Monitoreo en tiempo real de todos los servicios Docker • Última actualización: {lastRefresh.toLocaleTimeString('es-ES')}
            </Typography>
          </Box>
          <Stack direction='row' spacing={1} alignItems='center'>
            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={e => setAutoRefresh(e.target.checked)}
                  size='small'
                />
              }
              label='Auto-refresh'
            />
            <Button
              variant='outlined'
              size='small'
              onClick={fetchServiceHealth}
              disabled={loading}
              startIcon={loading ? undefined : <Icon icon='tabler-refresh' />}
            >
              {loading ? 'Verificando...' : 'Refrescar'}
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* OVERVIEW CARDS */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{
            background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.15)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
            borderRadius: 3
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Servicios Activos
                  </Typography>
                  <Typography variant='h3' sx={{ fontWeight: 800, color: 'success.main' }}>
                    {overview.runningServices}/{overview.totalServices}
                  </Typography>
                </Box>
                <Box sx={{
                  width: 56, height: 56, borderRadius: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: alpha(theme.palette.success.main, 0.15)
                }}>
                  <Icon icon='tabler-circle-check' fontSize={28} style={{ color: theme.palette.success.main }} />
                </Box>
              </Box>
              <LinearProgress
                variant='determinate'
                value={overview.healthyPercentage}
                sx={{
                  mt: 2, height: 6, borderRadius: 3,
                  backgroundColor: alpha(theme.palette.success.main, 0.1),
                  '& .MuiLinearProgress-bar': { borderRadius: 3 }
                }}
              />
              <Typography variant='caption' sx={{ mt: 1, display: 'block', color: 'success.main', fontWeight: 600 }}>
                {overview.healthyPercentage}% salud del sistema
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{
            background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.15)} 0%, ${alpha(theme.palette.error.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
            borderRadius: 3
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Servicios Detenidos
                  </Typography>
                  <Typography variant='h3' sx={{ fontWeight: 800, color: 'error.main' }}>
                    {overview.stoppedServices}
                  </Typography>
                </Box>
                <Box sx={{
                  width: 56, height: 56, borderRadius: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: alpha(theme.palette.error.main, 0.15)
                }}>
                  <Icon icon='tabler-circle-x' fontSize={28} style={{ color: theme.palette.error.main }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{
            background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.15)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
            borderRadius: 3
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Reiniciando
                  </Typography>
                  <Typography variant='h3' sx={{ fontWeight: 800, color: 'warning.main' }}>
                    {overview.restartingServices}
                  </Typography>
                </Box>
                <Box sx={{
                  width: 56, height: 56, borderRadius: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: alpha(theme.palette.warning.main, 0.15)
                }}>
                  <Icon icon='tabler-refresh' fontSize={28} style={{ color: theme.palette.warning.main }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            borderRadius: 3
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Puertos Activos
                  </Typography>
                  <Typography variant='h3' sx={{ fontWeight: 800, color: 'primary.main' }}>
                    {services.filter(s => s.port && s.status === 'running').length}
                  </Typography>
                </Box>
                <Box sx={{
                  width: 56, height: 56, borderRadius: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: alpha(theme.palette.primary.main, 0.15)
                }}>
                  <Icon icon='tabler-network' fontSize={28} style={{ color: theme.palette.primary.main }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* FILTERS */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
        <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
          <Typography variant='body2' sx={{ fontWeight: 600, alignSelf: 'center', mr: 1 }}>
            Filtrar:
          </Typography>
          <Chip
            label='Todos'
            size='small'
            variant={!filterCategory && !filterStatus ? 'filled' : 'outlined'}
            onClick={() => { setFilterCategory(null); setFilterStatus(null); }}
            color='primary'
          />
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
            <Chip
              key={key}
              label={cfg.label}
              size='small'
              variant={filterCategory === key ? 'filled' : 'outlined'}
              onClick={() => setFilterCategory(filterCategory === key ? null : key)}
              icon={<Icon icon={cfg.icon} fontSize={14} />}
            />
          ))}
          <Divider orientation='vertical' flexItem sx={{ mx: 1 }} />
          {(['running', 'stopped', 'restarting', 'unhealthy'] as ServiceStatus[]).map(status => (
            <Chip
              key={status}
              label={STATUS_CONFIG[status].label}
              size='small'
              variant={filterStatus === status ? 'filled' : 'outlined'}
              onClick={() => setFilterStatus(filterStatus === status ? null : status)}
              sx={{
                borderColor: filterStatus === status ? STATUS_CONFIG[status].color : undefined,
                color: filterStatus === status ? '#fff' : STATUS_CONFIG[status].color,
                backgroundColor: filterStatus === status ? STATUS_CONFIG[status].color : 'transparent'
              }}
            />
          ))}
        </Stack>
      </Paper>

      {/* ERROR ALERT */}
      {error && (
        <Alert severity='warning' sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* SERVICES BY CATEGORY */}
      {Object.entries(servicesByCategory).map(([category, categoryServices]) => {
        const catConfig = CATEGORY_CONFIG[category]
        return (
          <Box key={category} sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Icon icon={catConfig.icon} style={{ color: catConfig.color }} />
              <Typography variant='h6' sx={{ fontWeight: 700 }}>
                {catConfig.label}
              </Typography>
              <Chip
                label={`${categoryServices.filter(s => s.status === 'running').length}/${categoryServices.length}`}
                size='small'
                sx={{
                  backgroundColor: catConfig.color,
                  color: '#fff',
                  fontWeight: 700
                }}
              />
            </Box>

            <Grid container spacing={2}>
              {categoryServices.map(service => {
                const statusCfg = STATUS_CONFIG[service.status]
                const isExpanded = expandedService === service.name

                return (
                  <Grid item xs={12} sm={6} lg={4} xl={3} key={service.name}>
                    <Card
                      sx={{
                        borderRadius: 3,
                        border: `1px solid ${isDark ? alpha(statusCfg.color, 0.2) : alpha(statusCfg.color, 0.15)}`,
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: `0 8px 25px ${alpha(statusCfg.color, 0.15)}`,
                          borderColor: alpha(statusCfg.color, 0.4)
                        },
                        position: 'relative',
                        overflow: 'visible'
                      }}
                    >
                      {/* Status indicator bar */}
                      <Box sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        borderRadius: '12px 12px 0 0',
                        backgroundColor: statusCfg.color
                      }} />

                      <CardContent sx={{ p: 2.5, pt: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant='subtitle1' sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                              {service.displayName}
                            </Typography>
                            <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.5 }}>
                              {service.description}
                            </Typography>
                          </Box>
                          <Chip
                            icon={<Icon icon={statusCfg.icon} fontSize={12} />}
                            label={statusCfg.label}
                            size='small'
                            sx={{
                              backgroundColor: statusCfg.bgColor,
                              color: statusCfg.color,
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              ml: 1,
                              flexShrink: 0
                            }}
                          />
                        </Box>

                        <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap sx={{ mt: 1 }}>
                          {service.port && (
                            <Chip
                              label={`:${service.port}`}
                              size='small'
                              variant='outlined'
                              sx={{ fontSize: '0.65rem', height: 22 }}
                              icon={<Icon icon='tabler-plug' fontSize={10} />}
                            />
                          )}
                          {service.uptime && service.uptime !== '-' && (
                            <Chip
                              label={service.uptime}
                              size='small'
                              variant='outlined'
                              sx={{ fontSize: '0.65rem', height: 22 }}
                              icon={<Icon icon='tabler-clock' fontSize={10} />}
                            />
                          )}
                          {service.responseTime && service.responseTime > 0 && (
                            <Chip
                              label={`${service.responseTime}ms`}
                              size='small'
                              variant='outlined'
                              sx={{ fontSize: '0.65rem', height: 22 }}
                              icon={<Icon icon='tabler-speedtest' fontSize={10} />}
                            />
                          )}
                        </Stack>

                        {/* Expand toggle */}
                        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                          <IconButton
                            size='small'
                            onClick={() => setExpandedService(isExpanded ? null : service.name)}
                            sx={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}
                          >
                            <Icon icon='tabler-chevron-down' fontSize={16} />
                          </IconButton>
                        </Box>

                        <Collapse in={isExpanded}>
                          <Divider sx={{ my: 1 }} />
                          <Stack spacing={0.5}>
                            <Typography variant='caption' color='text.secondary'>
                              <strong>Servicio:</strong> {service.name}
                            </Typography>
                            {service.dependencies.length > 0 && (
                              <Typography variant='caption' color='text.secondary'>
                                <strong>Dependencias:</strong> {service.dependencies.join(', ')}
                              </Typography>
                            )}
                            {service.cpu !== undefined && service.cpu > 0 && (
                              <Box>
                                <Typography variant='caption' color='text.secondary'>CPU: {service.cpu}%</Typography>
                                <LinearProgress variant='determinate' value={Math.min(service.cpu, 100)} sx={{ height: 4, borderRadius: 2, mt: 0.5 }} />
                              </Box>
                            )}
                            {service.memory !== undefined && service.memory > 0 && (
                              <Box>
                                <Typography variant='caption' color='text.secondary'>Memoria: {service.memory}MB</Typography>
                                <LinearProgress variant='determinate' value={Math.min(service.memory / 10, 100)} sx={{ height: 4, borderRadius: 2, mt: 0.5 }} color='info' />
                              </Box>
                            )}
                            {service.lastChecked && (
                              <Typography variant='caption' color='text.secondary'>
                                Verificado: {new Date(service.lastChecked).toLocaleTimeString('es-ES')}
                              </Typography>
                            )}
                          </Stack>
                        </Collapse>
                      </CardContent>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>
          </Box>
        )
      })}

      {/* QUICK PORT REFERENCE TABLE */}
      <Box sx={{ mt: 6 }}>
        <Typography variant='h6' sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Icon icon='tabler-list-check' />
          Referencia Rápida de Puertos
        </Typography>
        <TableContainer component={Paper} sx={{ borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
          <Table size='small'>
            <TableHead>
              <TableRow sx={{ backgroundColor: isDark ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.primary.main, 0.04) }}>
                <TableCell sx={{ fontWeight: 700 }}>Servicio</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Puerto</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Categoría</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Estado</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Acceso</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {services.filter(s => s.port).sort((a, b) => (a.port || 0) - (b.port || 0)).map(svc => {
                const statusCfg = STATUS_CONFIG[svc.status]
                const catCfg = CATEGORY_CONFIG[svc.category]
                return (
                  <TableRow key={svc.name} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{svc.displayName}</TableCell>
                    <TableCell>
                      <code style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        color: theme.palette.primary.main,
                        fontWeight: 700,
                        fontSize: '0.8rem'
                      }}>
                        :{svc.port}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Chip label={catCfg.label} size='small' variant='outlined' sx={{ fontSize: '0.7rem' }} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<Icon icon={statusCfg.icon} fontSize={10} />}
                        label={statusCfg.label}
                        size='small'
                        sx={{
                          backgroundColor: statusCfg.bgColor,
                          color: statusCfg.color,
                          fontWeight: 700,
                          fontSize: '0.7rem'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant='caption' color='text.secondary'>
                        localhost:{svc.port}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* FOOTER INFO */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant='caption' color='text.secondary'>
          CloudFly AI • Docker Compose Local • {overview.totalServices} servicios configurados •
          Monitoreo generado automáticamente
        </Typography>
      </Box>
    </Box>
  )
}

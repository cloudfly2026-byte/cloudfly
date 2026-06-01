'use client'

import React, { useEffect, useRef, useMemo } from 'react'
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Avatar,
  Divider,
  Slide,
  Fade
} from '@mui/material'
import {
  Search,
  Target,
  Users,
  PenTool,
  Send,
  CheckCircle2,
  AlertCircle,
  Zap,
  TrendingUp
} from 'lucide-react'
import type { MarketingActionEvent } from '@/types/marketing/aiMarketing'

// ---------------------------------------------------------------------------
// Event type configuration — System Architect spec
// ---------------------------------------------------------------------------

const EVENT_CONFIG: Record<
  string,
  {
    icon: React.FC<any>
    color: string
    bg: string
    label: string
  }
> = {
  lead_search_started: {
    icon: Search,
    color: '#3b82f6',
    bg: '#eff6ff',
    label: 'Búsqueda iniciada'
  },
  lead_search_completed: {
    icon: Target,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    label: 'Leads encontrados'
  },
  campaign_created: {
    icon: Send,
    color: '#22c55e',
    bg: '#f0fdf4',
    label: 'Campaña creada'
  },
  message_sent: {
    icon: PenTool,
    color: '#06b6d4',
    bg: '#ecfeff',
    label: 'Mensaje enviado'
  },
  analysis_completed: {
    icon: TrendingUp,
    color: '#f59e0b',
    bg: '#fffbeb',
    label: 'Análisis completado'
  },
  crew_kickoff: {
    icon: Zap,
    color: '#ec4899',
    bg: '#fdf2f8',
    label: 'Crew iniciado'
  },
  flow_transition: {
    icon: Users,
    color: '#6366f1',
    bg: '#eef2ff',
    label: 'Transición'
  },
  error: {
    icon: AlertCircle,
    color: '#ef4444',
    bg: '#fef2f2',
    label: 'Error'
  }
}

const DEFAULT_CONFIG = {
  icon: CheckCircle2,
  color: '#64748b',
  bg: '#f8fafc',
  label: 'Evento'
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MarketingHistoryTimelineProps {
  events: MarketingActionEvent[]
  maxHeight?: number
}

// ---------------------------------------------------------------------------
// Time formatter
// ---------------------------------------------------------------------------

const formatTime = (timestamp: string): string => {
  try {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return timestamp
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MarketingHistoryTimeline: React.FC<MarketingHistoryTimelineProps> = ({
  events,
  maxHeight = 500
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to TOP when new events arrive (newest first)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [events.length])

  // Memoize rendered events to prevent unnecessary re-renders
  const renderedEvents = useMemo(() => {
    return events.slice(0, 50)
  }, [events])

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------
  if (renderedEvents.length === 0) {
    return (
      <Paper
        sx={{
          p: 4,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          textAlign: 'center'
        }}
      >
        <Typography color='text.secondary' sx={{ fontStyle: 'italic' }}>
          Esperando acciones...
        </Typography>
      </Paper>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <>
      {/* Custom scrollbar styles */}
      <style>{`
        .timeline-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .timeline-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .timeline-scroll::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.15);
          border-radius: 3px;
        }
        .timeline-scroll::-webkit-scrollbar-thumb:hover {
          background-color: rgba(0, 0, 0, 0.25);
        }
      `}</style>

      <Paper
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden'
        }}
      >
        {/* Header with event counter chip */}
        <Box
          sx={{
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
            Historial de Acciones
          </Typography>
          <Chip
            label={`${events.length} eventos`}
            size='small'
            sx={{
              bgcolor: 'action.selected',
              fontWeight: 600,
              fontSize: '0.7rem'
            }}
          />
        </Box>

        {/* Scrollable timeline */}
        <Box
          ref={scrollRef}
          className='timeline-scroll'
          sx={{
            maxHeight,
            overflowY: 'auto',
            p: 2
          }}
        >
          <Stack spacing={0}>
            {renderedEvents.map((event, index) => {
              const config = EVENT_CONFIG[event.type] || DEFAULT_CONFIG
              const IconComponent = config.icon
              const isNewest = index === 0
              const isLast = index === renderedEvents.length - 1

              // Extract up to 3 metadata key-value pairs
              const metadataEntries = Object.entries(event.metadata || {}).slice(0, 3)

              return (
                <Slide
                  key={event.id}
                  direction='down'
                  in
                  timeout={isNewest ? 500 : 0}
                  mountOnEnter
                  unmountOnExit
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: isNewest ? config.bg : 'transparent',
                      transition: 'background-color 0.3s ease',
                      position: 'relative'
                    }}
                  >
                    {/* Timeline connector line + dot */}
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        flexShrink: 0,
                        width: 24
                      }}
                    >
                      {/* Avatar / Dot */}
                      <Avatar
                        sx={{
                          width: 24,
                          height: 24,
                          bgcolor: config.color,
                          boxShadow: isNewest
                            ? `0 0 0 3px ${config.color}33`
                            : 'none'
                        }}
                      >
                        <IconComponent size={12} color='#fff' />
                      </Avatar>

                      {/* Vertical connector line (not for last item) */}
                      {!isLast && (
                        <Box
                          sx={{
                            width: 2,
                            flex: 1,
                            minHeight: 20,
                            bgcolor: 'divider',
                            mt: 0.5
                          }}
                        />
                      )}
                    </Box>

                    {/* Content */}
                    <Box sx={{ flex: 1, minWidth: 0, pb: isLast ? 0 : 1 }}>
                      {/* Top row: chip + time */}
                      <Stack
                        direction='row'
                        spacing={1}
                        alignItems='center'
                        sx={{ mb: 0.5 }}
                        flexWrap='wrap'
                      >
                        <Chip
                          label={config.label}
                          size='small'
                          sx={{
                            bgcolor: config.bg,
                            color: config.color,
                            fontWeight: 600,
                            fontSize: '0.65rem',
                            height: 20
                          }}
                        />
                        <Typography
                          variant='caption'
                          color='text.secondary'
                          sx={{ fontSize: '0.65rem' }}
                        >
                          {formatTime(event.timestamp)}
                        </Typography>
                      </Stack>

                      {/* Title */}
                      <Typography
                        variant='body2'
                        sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.3 }}
                      >
                        {event.title}
                      </Typography>

                      {/* Description */}
                      <Typography
                        variant='caption'
                        color='text.secondary'
                        sx={{ display: 'block', mt: 0.25 }}
                      >
                        {event.description}
                      </Typography>

                      {/* Metadata chips (up to 3) */}
                      {metadataEntries.length > 0 && (
                        <Stack
                          direction='row'
                          spacing={0.5}
                          flexWrap='wrap'
                          sx={{ mt: 0.75 }}
                        >
                          {metadataEntries.map(([key, value]) => (
                            <Chip
                              key={key}
                              label={`${key}: ${String(value)}`}
                              size='small'
                              variant='outlined'
                              sx={{
                                fontSize: '0.6rem',
                                height: 18,
                                '& .MuiChip-label': { px: 0.75 }
                              }}
                            />
                          ))}
                        </Stack>
                      )}
                    </Box>
                  </Box>
                </Slide>
              )
            })}
          </Stack>
        </Box>
      </Paper>
    </>
  )
}

export default MarketingHistoryTimeline

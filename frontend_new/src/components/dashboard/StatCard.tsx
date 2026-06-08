'use client'

import React from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import { alpha, useTheme } from '@mui/material/styles'
import type { CardProps } from '@mui/material/Card'

interface StatCardProps extends CardProps {
  title: string
  stats: string
  avatarIcon: string
  avatarColor: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'
  avatarSize?: number
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  subtitle?: string
}

const StatCard = ({
  title,
  stats,
  avatarIcon,
  avatarColor,
  avatarSize = 42,
  trend,
  trendValue,
  subtitle,
  ...rest
}: StatCardProps) => {
  const theme = useTheme()
  const colorValue = theme.palette[avatarColor].main

  return (
    <Card
      sx={{
        borderRadius: 3,
        border: `1px solid ${alpha(colorValue, 0.15)}`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 8px 25px ${alpha(colorValue, 0.12)}`,
          borderColor: alpha(colorValue, 0.3)
        }
      }}
      {...rest}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant='caption'
              sx={{
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: 'text.secondary'
              }}
            >
              {title}
            </Typography>
            <Typography
              variant='h4'
              sx={{
                fontWeight: 800,
                color: colorValue,
                mt: 0.5
              }}
            >
              {stats}
            </Typography>
            {subtitle && (
              <Typography variant='caption' color='text.secondary'>
                {subtitle}
              </Typography>
            )}
            {trend && trendValue && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                <Box
                  component='span'
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    color: trend === 'up' ? 'success.main' : trend === 'down' ? 'error.main' : 'text.secondary',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}
                >
                  {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
                </Box>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(135deg, ${alpha(colorValue, 0.2)} 0%, ${alpha(colorValue, 0.08)} 100%)`,
              flexShrink: 0
            }}
          >
            <span
              className={`tabler-${avatarIcon.includes('tabler-') ? avatarIcon.replace('tabler-', '') : avatarIcon}`}
              style={{
                fontSize: avatarSize * 0.5,
                color: colorValue,
                lineHeight: 1
              }}
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

export default StatCard

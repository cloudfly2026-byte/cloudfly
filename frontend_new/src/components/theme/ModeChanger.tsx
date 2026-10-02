// React Imports
import { useEffect } from 'react'

// Next Imports
import { usePathname } from 'next/navigation'

// MUI Imports
import { useColorScheme } from '@mui/material/styles'

// Third-party Imports
import { useMedia } from 'react-use'

// Type Imports
import type { SystemMode } from '@core/types'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

const ModeChanger = ({ systemMode }: { systemMode: SystemMode }) => {
  // Hooks
  const { setMode } = useColorScheme()
  const { settings } = useSettings()
  const isDark = useMedia('(prefers-color-scheme: dark)', systemMode === 'dark')
  const pathname = usePathname()

  useEffect(() => {
    // CLOUD-281: login is always dark (stored light/system mode never wins here)
    if (pathname === '/login') {
      setMode('dark')

      return
    }

    if (settings.mode) {
      if (settings.mode === 'system') {
        setMode(isDark ? 'dark' : 'light')
      } else {
        setMode(settings.mode)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.mode, pathname])

  return null
}

export default ModeChanger

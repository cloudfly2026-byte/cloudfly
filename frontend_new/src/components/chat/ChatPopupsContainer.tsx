'use client'

import React from 'react'
import { Box, Fab, Badge, Tooltip, keyframes } from '@mui/material'
import { Icon } from '@iconify/react'
import { usePopupChat } from '@/contexts/PopupChatContext'
import PopupChatWindow from './PopupChatWindow'

// Pulse animation for the FAB when there are unread messages
const pulseAnimation = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(115, 103, 240, 0.5); }
  70% { box-shadow: 0 0 0 12px rgba(115, 103, 240, 0); }
  100% { box-shadow: 0 0 0 0 rgba(115, 103, 240, 0); }
`

const ChatPopupsContainer: React.FC = () => {
  const { 
    activePopups, 
    closePopup, 
    minimizePopup, 
    openPopup, 
    unreadCount,
    clearUnreadCount 
  } = usePopupChat()

  const handleFabClick = () => {
    const minimized = activePopups.filter(p => p.state === 'minimized')
    if (minimized.length > 0) {
      openPopup(minimized[minimized.length - 1].contact)
    } else if (activePopups.length > 0) {
      openPopup(activePopups[activePopups.length - 1].contact)
    }
    clearUnreadCount()
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        right: 20,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'row-reverse',
        alignItems: 'flex-end',
        gap: 3,
        pointerEvents: 'none'
      }}
    >
      {/* Main Floating Action Button */}
      <Box sx={{ pointerEvents: 'auto', mb: 2 }}>
        <Tooltip title={unreadCount > 0 ? `${unreadCount} mensaje(s) sin leer` : 'Chat'} placement="left">
          <Badge 
            badgeContent={unreadCount} 
            color="error"
            sx={{
              '& .MuiBadge-badge': {
                fontWeight: 700,
                fontSize: '0.75rem',
                animation: unreadCount > 0 ? `${pulseAnimation} 2s infinite` : 'none'
              }
            }}
          >
            <Fab 
              color="primary" 
              aria-label="chat" 
              onClick={handleFabClick}
              sx={{ 
                width: 56, 
                height: 56,
                background: unreadCount > 0 
                  ? 'linear-gradient(135deg, #7367F0 0%, #9C87FF 100%)' 
                  : undefined,
                boxShadow: unreadCount > 0 
                  ? '0 4px 14px rgba(115, 103, 240, 0.4)' 
                  : undefined,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.08)',
                  boxShadow: '0 6px 20px rgba(115, 103, 240, 0.5)'
                }
              }}
            >
              <Icon icon="tabler:message-circle" fontSize="1.8rem" />
            </Fab>
          </Badge>
        </Tooltip>
      </Box>

      {/* List of active popups, they will stack to the left */}
      {activePopups.map((popup) => (
        <Box key={popup.contact.id} sx={{ pointerEvents: 'auto', mb: popup.state === 'minimized' ? 3 : 0 }}>
          <PopupChatWindow
            contact={popup.contact}
            state={popup.state}
            onClose={() => closePopup(popup.contact.id)}
            onMinimize={() => minimizePopup(popup.contact.id)}
            onToggle={() => {
                if (popup.state === 'minimized') {
                    openPopup(popup.contact)
                } else {
                    minimizePopup(popup.contact.id)
                }
            }}
          />
        </Box>
      ))}
    </Box>
  )
}

export default ChatPopupsContainer

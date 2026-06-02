'use client'

import React from 'react'
import { Box, Paper, Typography, IconButton, Avatar, Tooltip, Chip } from '@mui/material'
import { Icon } from '@iconify/react'
import { Contact } from '@/types/marketing/contactTypes'
import ChatInterface from '@/views/marketing/contacts/Detail/ChatInterface'
import { useRouter } from 'next/navigation'

interface PopupChatWindowProps {
  contact: Contact
  state: 'open' | 'minimized'
  onClose: () => void
  onMinimize: () => void
  onToggle: () => void
}

const PopupChatWindow: React.FC<PopupChatWindowProps> = ({ 
  contact, 
  state, 
  onClose, 
  onMinimize, 
  onToggle 
}) => {
  const router = useRouter()

  const handleViewContact = () => {
    router.push(`/marketing/contacts/${contact.id}`)
  }

  if (state === 'minimized') {
    return (
      <Tooltip title={contact.name} placement="top">
        <Avatar 
          src={contact.avatarUrl} 
          onClick={onToggle}
          sx={{ 
            width: 48, 
            height: 48, 
            cursor: 'pointer', 
            boxShadow: 3,
            border: '2px solid white',
            bgcolor: 'primary.main',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            '&:hover': { 
              transform: 'scale(1.12)', 
              boxShadow: 6
            }
          }}
        >
          {contact.name?.charAt(0) || 'C'}
        </Avatar>
      </Tooltip>
    )
  }

  return (
    <Paper
      elevation={6}
      sx={{
        width: 340,
        height: 500,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '12px 12px 0 0',
        overflow: 'hidden',
        position: 'relative',
        bgcolor: 'background.paper',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        animation: 'popupSlideIn 0.25s ease-out',
        '@keyframes popupSlideIn': {
          '0%': { transform: 'translateY(20px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 }
        }
      }}
    >
      {/* Custom Popup Header */}
      <Box
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #7367F0 0%, #9C87FF 100%)',
          color: 'white',
          cursor: 'pointer',
          minHeight: 52
        }}
        onClick={onMinimize}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
          <Avatar 
            src={contact.avatarUrl} 
            sx={{ 
              width: 34, 
              height: 34, 
              border: '2px solid rgba(255,255,255,0.6)',
              flexShrink: 0,
              bgcolor: 'rgba(255,255,255,0.2)'
            }}
          >
            {contact.name?.charAt(0) || 'C'}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography 
              variant="subtitle2" 
              sx={{ 
                fontWeight: 700, 
                maxWidth: '100%', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                fontSize: '0.85rem',
                lineHeight: 1.2
              }}
            >
              {contact.name}
            </Typography>
            {contact.phone && (
              <Typography 
                variant="caption" 
                sx={{ 
                  opacity: 0.8, 
                  fontSize: '0.65rem',
                  display: 'block',
                  lineHeight: 1.2,
                  mt: 0.25
                }}
              >
                {contact.phone}
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Tooltip title="Ver Contacto">
            <IconButton 
              size="small" 
              color="inherit" 
              onClick={(e) => { e.stopPropagation(); handleViewContact(); }}
              sx={{ 
                opacity: 0.8,
                '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.15)' }
              }}
            >
              <Icon icon="tabler:external-link" fontSize="1rem" />
            </IconButton>
          </Tooltip>
          <IconButton 
            size="small" 
            color="inherit" 
            onClick={(e) => { e.stopPropagation(); onMinimize(); }}
            sx={{ 
              opacity: 0.8,
              '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.15)' }
            }}
          >
            <Icon icon="tabler:minus" fontSize="1rem" />
          </IconButton>
          <IconButton 
            size="small" 
            color="inherit" 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            sx={{ 
              opacity: 0.8,
              '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.15)' }
            }}
          >
            <Icon icon="tabler:x" fontSize="1rem" />
          </IconButton>
        </Box>
      </Box>

      {/* Reusing ChatInterface with isPopup prop */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <ChatInterface 
          contact={contact} 
          isNew={false} 
          isPopup={true} 
        />
      </Box>
    </Paper>
  )
}

export default PopupChatWindow

'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useSocket } from './SocketContext'
import { Contact } from '@/types/marketing/contactTypes'
import { contactService } from '@/services/marketing/contactService'

export interface PopupChat {
  contact: Contact
  state: 'open' | 'minimized'
}

interface PopupChatContextType {
  activePopups: PopupChat[]
  openPopup: (contact: Contact) => void
  closePopup: (contactId: number | string) => void
  minimizePopup: (contactId: number | string) => void
  unreadCount: number
  clearUnreadCount: () => void
}

const PopupChatContext = createContext<PopupChatContextType | undefined>(undefined)

/** No abrir popup si el usuario ya está en la ficha de ese contacto */
function isViewingContactDetail(pathname: string, contactId: number | string): boolean {
  return new RegExp(`/marketing/contacts/${contactId}(/|$)`).test(pathname)
}

export const PopupChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activePopups, setActivePopups] = useState<PopupChat[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const pathname = usePathname()
  const { lastInbound } = useSocket()
  const processedInboundSeq = useRef(0)

  const openPopupForContact = useCallback((contact: Contact) => {
    setActivePopups(prev => {
      const exists = prev.some(p => p.contact.id === contact.id)
      if (exists) {
        return prev.map(p => (p.contact.id === contact.id ? { ...p, state: 'open' as const } : p))
      }
      return [...prev, { contact, state: 'open' }]
    })
  }, [])

  const fetchContactAndOpenPopup = useCallback(
    async (contactId: string | number) => {
      try {
        const contact = await contactService.getContactById(Number(contactId))
        setActivePopups(prev => {
          if (prev.some(p => p.contact.id == contactId)) {
            return prev.map(p => (p.contact.id == contactId ? { ...p, state: 'open' as const } : p))
          }
          return [...prev, { contact, state: 'open' }]
        })
      } catch (error) {
        console.error('[CLOUD-239] Error fetching contact for popup:', error)
      }
    },
    []
  )

  // CLOUD-239: Mensaje entrante no leído → abrir popup en dashboard
  // When a new-message event arrives (now also emitted to the company room by the backend),
  // the embeddedContact from the payload contains the REAL contact data (id, uuid, name, phone).
  // We use it directly to open the popup instantly, without any mapping that could create
  // fictitious contacts.
  useEffect(() => {
    if (!lastInbound) return
    if (lastInbound.seq === processedInboundSeq.current) return
    processedInboundSeq.current = lastInbound.seq

    const { message, contact: embeddedContact } = lastInbound
    const contactId = message.contactId ?? embeddedContact?.id
    if (!contactId) return

    // Don't open popup if user is already viewing this contact's detail page
    if (isViewingContactDetail(pathname, contactId)) {
      return
    }

    setUnreadCount(prev => prev + 1)

    // CLOUD-239 FIX: Use embeddedContact directly when it has a valid id.
    // NEVER attempt to map a Message object as a Contact (the old bug).
    //
    // OLD BUG: const mapped = embeddedContact || mapSocketContact(message)
    //   → mapSocketContact(message) returned a fictitious contact with:
    //     { id: Date.now(), name: 'Contacto', phone: undefined, uuid: undefined }
    //   → This caused "C Contacto" and "No hay mensajes todavía" because
    //     ChatInterface couldn't join the socket room or fetch history.
    //
    // NEW FIX: Only use embeddedContact (real data from backend payload).
    //   If not available, fall back to fetchContactAndOpenPopup(contactId)
    //   which makes an HTTP call to get the real contact.
    if (embeddedContact && embeddedContact.id) {
      openPopupForContact(embeddedContact)
    } else {
      fetchContactAndOpenPopup(contactId)
    }
  }, [lastInbound, pathname, openPopupForContact, fetchContactAndOpenPopup])

  const openPopup = (contact: Contact) => {
    openPopupForContact(contact)
  }

  const closePopup = (contactId: number | string) => {
    setActivePopups(prev => prev.filter(p => p.contact.id != contactId))
  }

  const minimizePopup = (contactId: number | string) => {
    setActivePopups(prev => prev.map(p => (p.contact.id == contactId ? { ...p, state: 'minimized' } : p)))
  }

  const clearUnreadCount = () => {
    setUnreadCount(0)
  }

  return (
    <PopupChatContext.Provider
      value={{
        activePopups,
        openPopup,
        closePopup,
        minimizePopup,
        unreadCount,
        clearUnreadCount
      }}
    >
      {children}
    </PopupChatContext.Provider>
  )
}

export const usePopupChat = () => {
  const context = useContext(PopupChatContext)
  if (!context) throw new Error('usePopupChat must be used within PopupChatProvider')
  return context
}

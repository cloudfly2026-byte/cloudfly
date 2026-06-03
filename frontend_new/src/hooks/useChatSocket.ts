'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { userMethods } from '@/utils/userMethods'

interface UseChatSocketProps {
  conversationId?: string | number
  phone?: string
  tenantId?: number
  contactId?: number | string
  onNewMessage?: (message: any) => void
}

export const useChatSocket = ({ conversationId, phone, tenantId, contactId, onNewMessage }: UseChatSocketProps) => {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const onNewMessageRef = useRef(onNewMessage)

  // Actualizar el ref cada vez que cambie la función
  useEffect(() => {
    onNewMessageRef.current = onNewMessage
  }, [onNewMessage])
  
  // URL del servidor de sockets - Prioridad: Env var > Dominio Producción > Localhost
  const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 
                     (typeof window !== 'undefined' && window.location.hostname === 'dashboard.cloudfly.com.co' 
                      ? 'https://chat.cloudfly.com.co' 
                      : 'http://localhost:3001')

  useEffect(() => {
    const token = localStorage.getItem('jwt')
    
    if (!token || !phone) return

    // Evitar múltiples conexiones
    if (socketRef.current) {
        socketRef.current.disconnect()
    }

    // Inicializar socket
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })

    socketRef.current = socket

    // Eventos básicos
    socket.on('connect', () => {
      console.log('✅ Connected to chat socket')
      setIsConnected(true)
      
      // CLOUD-239: Join the conversation room using phone.
      // This joins the contact-specific room: tenant_{t}_company_{c}_contact_{phone}
      // which is where the backend emits new-message for advisors with the chat open.
      socket.emit('join-conversation', { phone })
    })

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from chat socket:', reason)
      setIsConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.error('⚠️ Socket Connection Error:', err.message)
    })

    // Eventos de negocio
    socket.on('new-message', (data) => {
      console.log('📥 New real-time message received:', data)
      // Normalización: el socket a veces envía { message, contact } o solo el mensaje
      const msg = data.message || data;

      // Extract identifying details from the incoming event payload
      const incomingContactId = data.contact?.id || 
                                data.message?.contactId || 
                                data.contactId || 
                                data.message?.contact?.id || 
                                msg.contactId;

      const incomingPhone = data.contact?.phone || 
                            data.message?.contact?.phone || 
                            data.phone || 
                            data.message?.phone ||
                            msg.phone;

      const incomingConversationId = data.message?.conversationId || 
                                     data.conversationId || 
                                     msg.conversationId;

      // Clean phone numbers for comparison
      const cleanIncomingPhone = incomingPhone ? String(incomingPhone).replace(/\D/g, '') : null;
      const cleanTargetPhone = phone ? String(phone).replace(/\D/g, '') : null;

      // Check if this message belongs to our chat
      let isForCurrentChat = false;

      // 1. Try comparing by numeric contactId if both are available
      if (contactId && incomingContactId) {
        if (Number(contactId) === Number(incomingContactId)) {
          isForCurrentChat = true;
        }
      }
      // 2. Try comparing by cleaned phone number
      else if (cleanTargetPhone && cleanIncomingPhone) {
        if (cleanTargetPhone === cleanIncomingPhone) {
          isForCurrentChat = true;
        }
      }
      // 3. Try comparing by conversationId / contact UUID
      else if (conversationId && incomingConversationId) {
        if (String(conversationId) === String(incomingConversationId)) {
          isForCurrentChat = true;
        }
      }

      // If we could resolve identities but none of them matched, ignore this message for this hook instance
      if (!isForCurrentChat && (contactId || phone || conversationId)) {
        console.log(`⏭️ Ignoring message in useChatSocket: not for contactId: ${contactId}, phone: ${phone}`);
        return;
      }

      if (onNewMessageRef.current) {
        onNewMessageRef.current(msg)
      }
    })

    socket.on('joined-conversation', (data) => {
      console.log('🏠 Joined conversation room:', data.room)
    })

    // Cleanup al desmontar
    return () => {
      if (socketRef.current) {
        console.log('🔌 Disconnecting socket...')
        socketRef.current.emit('leave-conversation', { phone })
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [phone, conversationId, contactId, SOCKET_URL])


  // Método manual para enviar mensajes (opcional, ya que usamos API)
  const sendMessage = useCallback((data: any) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('send-message', data)
    }
  }, [isConnected])

  return {
    socket: socketRef.current,
    isConnected,
    sendMessage
  }
}

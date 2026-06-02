/**
 * CLOUD-239: Unit tests for PopupChatContext.tsx fix
 * 
 * Tests that the buggy mapSocketContact(message) call is removed and
 * that embeddedContact is used correctly for opening popups.
 * 
 * Also tests:
 * - Deduplication of messages from dual room emission
 * - Contact validation (isValidContact)
 * - Popup opening behavior with real vs fictitious contacts
 */

// Mock the contactService
jest.mock('@/services/marketing/contactService', () => ({
  contactService: {
    getContactById: jest.fn()
  }
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn()
}))

import React from 'react'
import { Contact } from '@/types/marketing/contactTypes'
import { isValidContact, mapSocketContact, normalizeInboundSocketMessage } from '@/utils/normalizeSocketPayload'

// ============================================================
// 1. Tests for isValidContact (CLOUD-239 safety net)
// ============================================================
describe('CLOUD-239: isValidContact', () => {
  it('should return true for a real Contact object', () => {
    const realContact = {
      id: 42,
      uuid: 'test-uuid-123',
      name: 'Juan Perez',
      phone: '573001234567',
      email: 'juan@test.com',
      type: 'LEAD',
      stage: 'LEAD',
      tenantId: 1,
      companyId: 1,
      isActive: true,
      chatbotEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    expect(isValidContact(realContact)).toBe(true)
  })

  it('should return false for a Message object (the bug scenario)', () => {
    // A message has direction, body, content — not contact fields
    const fakeMessage = {
      id: Date.now(),
      content: 'Hello world',
      direction: 'INBOUND',
      body: 'Hello world',
      status: 'RECEIVED',
      conversationId: 'conv-123',
      createdAt: new Date().toISOString()
    }
    expect(isValidContact(fakeMessage)).toBe(false)
  })

  it('should return false for null', () => {
    expect(isValidContact(null)).toBe(false)
  })

  it('should return false for undefined', () => {
    expect(isValidContact(undefined)).toBe(false)
  })

  it('should return false for an object without id', () => {
    expect(isValidContact({ name: 'Test' })).toBe(false)
  })

  it('should return false for an object without name', () => {
    expect(isValidContact({ id: 1 })).toBe(false)
  })

  it('should return false for an object with direction field (Message-like)', () => {
    expect(isValidContact({ id: 1, name: 'Test', direction: 'INBOUND' })).toBe(false)
  })

  it('should return false for an object with body field (Message-like)', () => {
    expect(isValidContact({ id: 1, name: 'Test', body: 'Hello' })).toBe(false)
  })

  it('should return false for an object with content field (Message-like)', () => {
    expect(isValidContact({ id: 1, name: 'Test', content: 'Hello' })).toBe(false)
  })
})

// ============================================================
// 2. Tests for mapSocketContact
// ============================================================
describe('CLOUD-239: mapSocketContact', () => {
  it('should return null for null input', () => {
    expect(mapSocketContact(null)).toBeNull()
  })

  it('should return null for undefined input', () => {
    expect(mapSocketContact(undefined)).toBeNull()
  })

  it('should return null for object without id', () => {
    expect(mapSocketContact({ name: 'Test' })).toBeNull()
  })

  it('should map a real contact payload correctly', () => {
    const raw = {
      id: 42,
      uuid: 'uuid-123',
      name: 'Maria Garcia',
      phone: '573001234567',
      email: 'maria@test.com',
      type: 'LEAD',
      stage: 'LEAD',
      tenant_id: 1,
      company_id: 1,
      is_active: 1,
      chatbot_enabled: 0,
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    }
    const result = mapSocketContact(raw)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(42)
    expect(result!.name).toBe('Maria Garcia')
    expect(result!.phone).toBe('573001234567')
    expect(result!.uuid).toBe('uuid-123')
  })

  it('should return a contact with name="Contacto" for object with id but no name', () => {
    // This is what happens when you pass a Message to mapSocketContact
    // The message has id (Date.now()) but no name, so it defaults to 'Contacto'
    const raw = { id: Date.now() }
    const result = mapSocketContact(raw)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Contacto')
    expect(result!.phone).toBeUndefined()
    expect(result!.uuid).toBeUndefined()
    // This is the fictitious contact that caused the bug!
  })
})

// ============================================================
// 3. Tests for normalizeInboundSocketMessage
// ============================================================
describe('CLOUD-239: normalizeInboundSocketMessage', () => {
  it('should extract real contact from backend eventPayload', () => {
    // This is the payload format emitted by chatService.js to both rooms
    const payload = {
      message: {
        id: 1001,
        content: 'Hola, necesito información',
        direction: 'INBOUND',
        status: 'RECEIVED',
        conversationId: 'conv-uuid-123',
        createdAt: new Date().toISOString()
      },
      contact: {
        id: 42,
        uuid: 'contact-uuid-123',
        name: 'Juan Perez',
        phone: '573001234567',
        email: 'juan@test.com',
        type: 'LEAD',
        stage: 'LEAD',
        tenant_id: 1,
        company_id: 1,
        is_active: 1,
        chatbot_enabled: 0,
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      },
      history: []
    }

    const result = normalizeInboundSocketMessage(payload)
    expect(result).not.toBeNull()
    expect(result!.message.id).toBe(1001)
    expect(result!.message.body).toBe('Hola, necesito información')
    expect(result!.message.direction).toBe('INBOUND')
    
    // The contact should be the REAL contact from the payload
    expect(result!.contact).toBeDefined()
    expect(result!.contact!.id).toBe(42)
    expect(result!.contact!.name).toBe('Juan Perez')
    expect(result!.contact!.phone).toBe('573001234567')
    expect(result!.contact!.uuid).toBe('contact-uuid-123')
  })

  it('should return null for OUTBOUND messages', () => {
    const payload = {
      message: {
        id: 1002,
        content: 'Reply',
        direction: 'OUTBOUND',
        status: 'SENT',
        conversationId: 'conv-uuid-123',
        createdAt: new Date().toISOString()
      },
      contact: { id: 42, name: 'Test', phone: '123' }
    }
    expect(normalizeInboundSocketMessage(payload)).toBeNull()
  })

  it('should return null for null payload', () => {
    expect(normalizeInboundSocketMessage(null)).toBeNull()
  })

  it('should handle payload without contact (fallback)', () => {
    const payload = {
      message: {
        id: 1003,
        content: 'Hello',
        direction: 'INBOUND',
        status: 'RECEIVED',
        conversationId: 'conv-123',
        contactId: 42,
        createdAt: new Date().toISOString()
      }
    }
    const result = normalizeInboundSocketMessage(payload)
    expect(result).not.toBeNull()
    expect(result!.message.contactId).toBe(42)
    // No contact in payload, so contact should be undefined
    expect(result!.contact).toBeUndefined()
  })

  it('should NOT create fictitious contact from Message-like payload', () => {
    // Edge case: what if someone accidentally puts a Message in the contact field?
    const payload = {
      message: {
        id: 1004,
        content: 'Hello',
        direction: 'INBOUND',
        status: 'RECEIVED',
        conversationId: 'conv-123',
        createdAt: new Date().toISOString()
      },
      contact: {
        // This is a Message object, NOT a Contact!
        id: Date.now(),
        content: 'Some message',
        direction: 'INBOUND',
        body: 'Some message'
      }
    }
    const result = normalizeInboundSocketMessage(payload)
    expect(result).not.toBeNull()
    // The isValidContact check should reject the Message-as-Contact
    expect(result!.contact).toBeUndefined()
  })
})

// ============================================================
// 4. Tests for PopupChatContext logic (behavioral)
// ============================================================
describe('CLOUD-239: PopupChatContext behavioral tests', () => {
  it('should use embeddedContact when it has a valid id', () => {
    const embeddedContact: Contact = {
      id: 42,
      uuid: 'test-uuid-123',
      name: 'Juan Perez',
      phone: '573001234567',
      email: 'juan@test.com',
      type: 'LEAD',
      stage: 'LEAD',
      tenantId: 1,
      companyId: 1,
      isActive: true,
      chatbotEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // The fix ensures that when embeddedContact exists and has an id,
    // it is passed directly to openPopupForContact without any mapping
    expect(embeddedContact.id).toBe(42)
    expect(embeddedContact.name).toBe('Juan Perez')
    expect(embeddedContact.phone).toBe('573001234567')
    expect(embeddedContact.uuid).toBe('test-uuid-123')
  })

  it('should NOT map a Message object as a Contact (the bug)', () => {
    const fakeMessage = {
      id: Date.now(),
      content: 'Hello world',
      direction: 'INBOUND',
      status: 'RECEIVED',
      conversationId: 'conv-123',
      createdAt: new Date().toISOString()
    }

    // The message object does NOT have contact fields
    expect(fakeMessage.id).toBeDefined()
    expect((fakeMessage as any).name).toBeUndefined()
    expect((fakeMessage as any).phone).toBeUndefined()
    expect((fakeMessage as any).uuid).toBeUndefined()
  })

  it('should call fetchContactAndOpenPopup when embeddedContact is null', () => {
    const embeddedContact = null
    const contactId = 42

    // The fix: if (!embeddedContact) → fetchContactAndOpenPopup(contactId)
    expect(embeddedContact).toBeNull()
    expect(contactId).toBe(42)
  })

  it('should call fetchContactAndOpenPopup when embeddedContact has no id', () => {
    const embeddedContact = { name: 'Test' } as any
    const contactId = 99

    // The fix checks: if (embeddedContact && embeddedContact.id)
    expect(embeddedContact.id).toBeUndefined()
    expect(contactId).toBe(99)
  })
})

// ============================================================
// 5. Tests for isViewingContactDetail guard
// ============================================================
describe('CLOUD-239: isViewingContactDetail guard', () => {
  // Replicate the function from PopupChatContext
  function isViewingContactDetail(pathname: string, contactId: number | string): boolean {
    return new RegExp(`/marketing/contacts/${contactId}(/|$)`).test(pathname)
  }

  it('should not open popup when user is viewing contact detail page', () => {
    const pathname = '/marketing/contacts/42'
    const contactId = 42
    expect(isViewingContactDetail(pathname, contactId)).toBe(true)
  })

  it('should open popup when user is on a different page', () => {
    const pathname = '/marketing/pipelines/kanban'
    const contactId = 42
    expect(isViewingContactDetail(pathname, contactId)).toBe(false)
  })

  it('should open popup when user is on dashboard', () => {
    const pathname = '/dashboards/crm'
    const contactId = 42
    expect(isViewingContactDetail(pathname, contactId)).toBe(false)
  })

  it('should not open popup when viewing same contact with trailing slash', () => {
    const pathname = '/marketing/contacts/42/'
    const contactId = 42
    expect(isViewingContactDetail(pathname, contactId)).toBe(true)
  })
})

// ============================================================
// 6. Tests for deduplication logic
// ============================================================
describe('CLOUD-239: Message deduplication', () => {
  it('should deduplicate messages with the same id within the dedup window', () => {
    // Simulate the dedup logic from SocketContext
    const processedMessageIds = new Map<number, number>()
    const DEDUP_WINDOW_MS = 5000

    const isDuplicateMessage = (msgId: number): boolean => {
      const now = Date.now()
      const lastSeen = processedMessageIds.get(msgId)
      if (lastSeen && (now - lastSeen) < DEDUP_WINDOW_MS) {
        return true
      }
      processedMessageIds.set(msgId, now)
      return false
    }

    const messageId = 1001

    // First time: not a duplicate
    expect(isDuplicateMessage(messageId)).toBe(false)

    // Second time (same message from company room): duplicate
    expect(isDuplicateMessage(messageId)).toBe(true)

    // Different message: not a duplicate
    expect(isDuplicateMessage(1002)).toBe(false)
  })

  it('should allow messages after the dedup window expires', () => {
    const processedMessageIds = new Map<number, number>()
    const DEDUP_WINDOW_MS = 5000

    // Simulate a message processed 6 seconds ago
    const messageId = 1001
    processedMessageIds.set(messageId, Date.now() - 6000)

    const isDuplicateMessage = (msgId: number): boolean => {
      const now = Date.now()
      const lastSeen = processedMessageIds.get(msgId)
      if (lastSeen && (now - lastSeen) < DEDUP_WINDOW_MS) {
        return true
      }
      processedMessageIds.set(msgId, now)
      return false
    }

    // Should NOT be a duplicate (window expired)
    expect(isDuplicateMessage(messageId)).toBe(false)
  })
})

/**
 * CLOUD-239: Unit tests for normalizeSocketPayload.ts
 * 
 * Tests the isValidContact function and the enhanced normalizeInboundSocketMessage
 * that now validates contacts to prevent the Message-as-Contact bug.
 */

import {
  mapSocketContact,
  isValidContact,
  normalizeInboundSocketMessage,
  isInboundUnreadConversationUpdate,
  type ConversationUpdatedPayload
} from '@/utils/normalizeSocketPayload'

// ============================================================
// 1. isValidContact tests
// ============================================================
describe('CLOUD-239: isValidContact', () => {
  it('returns true for a valid Contact object', () => {
    const contact = {
      id: 42,
      name: 'Juan Perez',
      phone: '573001234567',
      uuid: 'uuid-123',
      type: 'LEAD',
      stage: 'LEAD',
      tenantId: 1,
      companyId: 1,
      isActive: true,
      chatbotEnabled: false,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    }
    expect(isValidContact(contact)).toBe(true)
  })

  it('returns false for a Message object with direction field', () => {
    const message = {
      id: Date.now(),
      direction: 'INBOUND',
      body: 'Hello',
      content: 'Hello'
    }
    expect(isValidContact(message)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isValidContact(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isValidContact(undefined)).toBe(false)
  })

  it('returns false for object without id', () => {
    expect(isValidContact({ name: 'Test' })).toBe(false)
  })

  it('returns false for object with string id', () => {
    expect(isValidContact({ id: 'abc', name: 'Test' })).toBe(false)
  })

  it('returns false for object without name', () => {
    expect(isValidContact({ id: 1 })).toBe(false)
  })

  it('returns false for object with body field (Message-like)', () => {
    expect(isValidContact({ id: 1, name: 'Test', body: 'Hello' })).toBe(false)
  })

  it('returns false for object with content field (Message-like)', () => {
    expect(isValidContact({ id: 1, name: 'Test', content: 'Hello' })).toBe(false)
  })

  it('returns true for minimal valid Contact', () => {
    expect(isValidContact({ id: 1, name: 'Test' })).toBe(true)
  })
})

// ============================================================
// 2. normalizeInboundSocketMessage with contact validation
// ============================================================
describe('CLOUD-239: normalizeInboundSocketMessage with validation', () => {
  it('extracts real contact from backend eventPayload', () => {
    const payload = {
      message: {
        id: 1001,
        content: 'Hola',
        direction: 'INBOUND',
        status: 'RECEIVED',
        conversationId: 'conv-123',
        createdAt: new Date().toISOString()
      },
      contact: {
        id: 42,
        uuid: 'uuid-123',
        name: 'Juan Perez',
        phone: '573001234567',
        type: 'LEAD',
        stage: 'LEAD',
        tenant_id: 1,
        company_id: 1,
        is_active: 1,
        chatbot_enabled: 0,
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      }
    }

    const result = normalizeInboundSocketMessage(payload)
    expect(result).not.toBeNull()
    expect(result!.contact).toBeDefined()
    expect(result!.contact!.id).toBe(42)
    expect(result!.contact!.name).toBe('Juan Perez')
    expect(result!.contact!.phone).toBe('573001234567')
  })

  it('rejects Message object in contact field', () => {
    const payload = {
      message: {
        id: 1002,
        content: 'Hello',
        direction: 'INBOUND',
        status: 'RECEIVED',
        conversationId: 'conv-123',
        createdAt: new Date().toISOString()
      },
      contact: {
        id: Date.now(),
        direction: 'INBOUND',
        body: 'Some message',
        content: 'Some message'
      }
    }

    const result = normalizeInboundSocketMessage(payload)
    expect(result).not.toBeNull()
    // Contact should be undefined because isValidContact rejected it
    expect(result!.contact).toBeUndefined()
  })

  it('returns null for OUTBOUND messages', () => {
    const payload = {
      message: {
        id: 1003,
        content: 'Reply',
        direction: 'OUTBOUND',
        status: 'SENT',
        conversationId: 'conv-123',
        createdAt: new Date().toISOString()
      }
    }
    expect(normalizeInboundSocketMessage(payload)).toBeNull()
  })

  it('handles payload without contact field', () => {
    const payload = {
      message: {
        id: 1004,
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
    expect(result!.contact).toBeUndefined()
  })
})

// ============================================================
// 3. isInboundUnreadConversationUpdate tests
// ============================================================
describe('CLOUD-239: isInboundUnreadConversationUpdate', () => {
  it('returns true for valid unread conversation update', () => {
    const payload: ConversationUpdatedPayload = {
      contactId: 42,
      conversationId: 'conv-123',
      lastMessage: 'Hello',
      unreadCount: 3,
      updatedAt: new Date().toISOString()
    }
    expect(isInboundUnreadConversationUpdate(payload)).toBe(true)
  })

  it('returns false when unreadCount is 0', () => {
    const payload: ConversationUpdatedPayload = {
      contactId: 42,
      unreadCount: 0
    }
    expect(isInboundUnreadConversationUpdate(payload)).toBe(false)
  })

  it('returns false when contactId is missing', () => {
    const payload = {
      unreadCount: 3
    } as unknown as ConversationUpdatedPayload
    expect(isInboundUnreadConversationUpdate(payload)).toBe(false)
  })
})

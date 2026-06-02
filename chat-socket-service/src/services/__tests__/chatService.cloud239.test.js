/**
 * CLOUD-239: Unit tests for chatService.js fix
 * 
 * Tests that the 'new-message' event is emitted to both:
 * 1. The contact-specific room (existing behavior)
 * 2. The company room (new fix for popup auto-open)
 */

const mockDb = {
  execute: jest.fn()
}

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}

// Mock all dependencies - paths relative to __tests__ directory
jest.mock('../../utils/db', () => mockDb)
jest.mock('../../utils/logger', () => mockLogger)
jest.mock('../conversationService', () => ({
  getOrCreateConversationId: jest.fn().mockResolvedValue('conv-uuid-123')
}))
jest.mock('../chatbotGateService', () => ({
  isChatbotEnabled: jest.fn().mockResolvedValue(false)
}))
jest.mock('../messageBufferService', () => ({
  bufferMessage: jest.fn().mockResolvedValue(true)
}))
jest.mock('../evolutionClient', () => ({
  getBase64FromMediaMessage: jest.fn().mockResolvedValue(null),
  setPresence: jest.fn().mockResolvedValue(undefined),
  sendMessage: jest.fn().mockResolvedValue(undefined)
}))
jest.mock('../kafkaProducer', () => ({
  publishToEmailTopic: jest.fn().mockResolvedValue(true)
}))

describe('CLOUD-239: ChatService processEvolutionWebhook', () => {
  let chatService
  let mockIo

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset module registry to get fresh instance
    jest.resetModules()
    
    // Re-require after reset
    chatService = require('../chatService')
    
    // Mock Socket.IO server
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    }

    // Default DB mocks
    mockDb.execute.mockImplementation((query, params) => {
      // Channel lookup
      if (query.includes('SELECT id, tenant_id, company_id FROM channels')) {
        return Promise.resolve([[{ id: 1, tenant_id: 1, company_id: 1 }]])
      }
      // Contact lookup (existing contact)
      if (query.includes('SELECT * FROM contacts WHERE tenant_id')) {
        return Promise.resolve([[{
          id: 42,
          uuid: 'contact-uuid-123',
          name: 'Juan Perez',
          phone: '573001234567',
          type: 'LEAD',
          stage: 'LEAD',
          tenant_id: 1,
          company_id: 1
        }]])
      }
      // Insert message
      if (query.includes('INSERT INTO omni_channel_messages')) {
        return Promise.resolve([{ insertId: 1001 }])
      }
      // History query
      if (query.includes('ORDER BY created_at DESC LIMIT 10')) {
        return Promise.resolve([[]])
      }
      // Unread count
      if (query.includes('COUNT(*) as cnt')) {
        return Promise.resolve([[{ cnt: 3 }]])
      }
      // Pipeline lookup
      if (query.includes('SELECT id FROM pipelines')) {
        return Promise.resolve([[{ id: 1 }]])
      }
      // Stage lookup
      if (query.includes('SELECT id FROM pipeline_stages')) {
        return Promise.resolve([[{ id: 1 }]])
      }
      return Promise.resolve([[]])
    })
  })

  it('should emit new-message to contact room AND company room', async () => {
    const payload = {
      event: 'messages.upsert',
      instance: 'test-instance',
      data: {
        key: {
          remoteJid: '573001234567@s.whatsapp.net',
          fromMe: false,
          id: 'ext-msg-001'
        },
        pushName: 'Juan Perez',
        message: {
          conversation: 'Hola, necesito información'
        }
      }
    }

    await chatService.processEvolutionWebhook(mockIo, payload)

    // Verify emit was called for the contact room
    const contactRoomCalls = mockIo.to.mock.calls.filter(
      call => call[0] === 'tenant_1_company_1_contact_573001234567'
    )
    expect(contactRoomCalls.length).toBeGreaterThan(0)
    
    // Verify emit was called for the company room (THE FIX)
    const companyRoomCalls = mockIo.to.mock.calls.filter(
      call => call[0] === 'tenant_1_company_1'
    )
    expect(companyRoomCalls.length).toBeGreaterThan(0)

    // Verify new-message was emitted to company room
    const newMessageCalls = mockIo.emit.mock.calls.filter(
      call => call[0] === 'new-message'
    )
    // Should be emitted twice: once to contact room, once to company room
    expect(newMessageCalls.length).toBe(2)
  })

  it('should include full contact data in eventPayload emitted to company room', async () => {
    const payload = {
      event: 'messages.upsert',
      instance: 'test-instance',
      data: {
        key: {
          remoteJid: '573001234567@s.whatsapp.net',
          fromMe: false,
          id: 'ext-msg-002'
        },
        pushName: 'Maria Garcia',
        message: {
          conversation: 'Buenos días'
        }
      }
    }

    await chatService.processEvolutionWebhook(mockIo, payload)

    // Find the new-message emit calls
    const newMessageCalls = mockIo.emit.mock.calls.filter(
      call => call[0] === 'new-message'
    )

    // Both calls should have the same eventPayload with contact data
    newMessageCalls.forEach(call => {
      const eventPayload = call[1]
      expect(eventPayload).toHaveProperty('message')
      expect(eventPayload).toHaveProperty('contact')
      expect(eventPayload.contact).toHaveProperty('id')
      expect(eventPayload.contact).toHaveProperty('name')
      expect(eventPayload.contact).toHaveProperty('phone')
      expect(eventPayload.contact).toHaveProperty('uuid')
    })
  })

  it('should emit conversation-updated to company room', async () => {
    const payload = {
      event: 'messages.upsert',
      instance: 'test-instance',
      data: {
        key: {
          remoteJid: '573001234567@s.whatsapp.net',
          fromMe: false,
          id: 'ext-msg-003'
        },
        pushName: 'Carlos Lopez',
        message: {
          conversation: 'Gracias'
        }
      }
    }

    await chatService.processEvolutionWebhook(mockIo, payload)

    // Verify conversation-updated was emitted to company room
    const conversationUpdatedCalls = mockIo.emit.mock.calls.filter(
      call => call[0] === 'conversation-updated'
    )
    expect(conversationUpdatedCalls.length).toBe(1)

    const payload_data = conversationUpdatedCalls[0][1]
    expect(payload_data).toHaveProperty('contactId')
    expect(payload_data).toHaveProperty('conversationId')
    expect(payload_data).toHaveProperty('lastMessage')
    expect(payload_data).toHaveProperty('unreadCount')
  })

  it('should auto-create new contact with pushName when contact does not exist', async () => {
    // Override DB mock for this test - no existing contact
    mockDb.execute.mockImplementation((query, params) => {
      if (query.includes('SELECT id, tenant_id, company_id FROM channels')) {
        return Promise.resolve([[{ id: 1, tenant_id: 1, company_id: 1 }]])
      }
      // Contact lookup returns empty (new contact)
      if (query.includes('SELECT * FROM contacts WHERE tenant_id')) {
        return Promise.resolve([[]])
      }
      // Insert contact
      if (query.includes('INSERT INTO contacts')) {
        return Promise.resolve([{ insertId: 999 }])
      }
      // Newly created contact lookup
      if (query.includes('SELECT * FROM contacts WHERE id = ?')) {
        return Promise.resolve([[{
          id: 999,
          uuid: 'new-uuid-456',
          name: 'Nuevo Usuario WhatsApp',
          phone: '573009876543',
          type: 'LEAD',
          stage: 'LEAD',
          tenant_id: 1,
          company_id: 1
        }]])
      }
      if (query.includes('INSERT INTO omni_channel_messages')) {
        return Promise.resolve([{ insertId: 2001 }])
      }
      if (query.includes('ORDER BY created_at DESC LIMIT 10')) {
        return Promise.resolve([[]])
      }
      if (query.includes('COUNT(*) as cnt')) {
        return Promise.resolve([[{ cnt: 1 }]])
      }
      if (query.includes('SELECT id FROM pipelines')) {
        return Promise.resolve([[{ id: 1 }]])
      }
      if (query.includes('SELECT id FROM pipeline_stages')) {
        return Promise.resolve([[{ id: 1 }]])
      }
      return Promise.resolve([[]])
    })

    const payload = {
      event: 'messages.upsert',
      instance: 'test-instance',
      data: {
        key: {
          remoteJid: '573009876543@s.whatsapp.net',
          fromMe: false,
          id: 'ext-msg-004'
        },
        pushName: 'Nuevo Usuario WhatsApp',
        message: {
          conversation: 'Primer mensaje'
        }
      }
    }

    await chatService.processEvolutionWebhook(mockIo, payload)

    // Verify new-message was emitted (popup should open for new contact)
    const newMessageCalls = mockIo.emit.mock.calls.filter(
      call => call[0] === 'new-message'
    )
    expect(newMessageCalls.length).toBe(2) // contact room + company room

    // Verify the contact data includes the pushName
    const eventPayload = newMessageCalls[0][1]
    expect(eventPayload.contact.name).toBe('Nuevo Usuario WhatsApp')
  })
})

describe('CLOUD-239: ChatService _handleFacebookMessage', () => {
  let chatService
  let mockIo

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    chatService = require('../chatService')
    
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    }

    mockDb.execute.mockImplementation((query, params) => {
      if (query.includes('SELECT id, tenant_id, company_id FROM channels')) {
        return Promise.resolve([[{ id: 2, tenant_id: 1, company_id: 1 }]])
      }
      if (query.includes('SELECT * FROM contacts WHERE tenant_id')) {
        return Promise.resolve([[{
          id: 50,
          uuid: 'fb-contact-uuid',
          name: 'Usuario Facebook',
          phone: 'fb-sender-123',
          type: 'LEAD',
          stage: 'LEAD',
          tenant_id: 1,
          company_id: 1
        }]])
      }
      if (query.includes('INSERT INTO omni_channel_messages')) {
        return Promise.resolve([{ insertId: 3001 }])
      }
      if (query.includes('ORDER BY created_at DESC LIMIT 10')) {
        return Promise.resolve([[]])
      }
      if (query.includes('COUNT(*) as cnt')) {
        return Promise.resolve([[{ cnt: 2 }]])
      }
      return Promise.resolve([[]])
    })
  })

  it('should emit new-message to company room for Facebook messages too', async () => {
    const pageId = 'page-123'
    const event = {
      sender: { id: 'fb-sender-123' },
      message: { text: 'Hola desde Facebook', mid: 'fb-msg-001' }
    }

    await chatService._handleFacebookMessage(mockIo, pageId, event)

    // Verify new-message was emitted to company room
    const companyRoomCalls = mockIo.to.mock.calls.filter(
      call => call[0] === 'tenant_1_company_1'
    )
    expect(companyRoomCalls.length).toBeGreaterThan(0)

    const newMessageCalls = mockIo.emit.mock.calls.filter(
      call => call[0] === 'new-message'
    )
    // Should be emitted twice: contact room + company room
    expect(newMessageCalls.length).toBe(2)
  })
})

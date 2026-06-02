import type { Message } from '@/types/apps/chatTypes'
import type { Contact } from '@/types/marketing/contactTypes'

export interface ConversationUpdatedPayload {
  contactId: number
  conversationId?: string
  lastMessage?: string
  unreadCount?: number
  updatedAt?: string
}

/** Convierte fila DB o payload mixto del socket a Contact del frontend */
export function mapSocketContact(raw: Record<string, unknown> | null | undefined): Contact | null {
  if (!raw || raw.id == null) return null

  return {
    id: Number(raw.id),
    uuid: (raw.uuid as string) || undefined,
    name: String(raw.name ?? 'Contacto'),
    email: (raw.email as string) || undefined,
    phone: (raw.phone as string) || undefined,
    address: (raw.address as string) || undefined,
    type: String(raw.type ?? 'LEAD'),
    stage: String(raw.stage ?? 'LEAD'),
    avatarUrl: (raw.avatar_url as string) || (raw.avatarUrl as string) || undefined,
    tenantId: Number(raw.tenant_id ?? raw.tenantId ?? 0),
    companyId: Number(raw.company_id ?? raw.companyId ?? 0),
    pipelineId: raw.pipeline_id != null ? Number(raw.pipeline_id) : raw.pipelineId != null ? Number(raw.pipelineId) : undefined,
    stageId: raw.stage_id != null ? Number(raw.stage_id) : raw.stageId != null ? Number(raw.stageId) : undefined,
    isActive: raw.is_active !== undefined ? Boolean(raw.is_active) : raw.isActive !== undefined ? Boolean(raw.isActive) : true,
    chatbotEnabled: raw.chatbot_enabled !== undefined ? Boolean(raw.chatbot_enabled) : raw.chatbotEnabled !== undefined ? Boolean(raw.chatbotEnabled) : true,
    createdAt: String(raw.created_at ?? raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updated_at ?? raw.updatedAt ?? new Date().toISOString())
  }
}

/**
 * CLOUD-239: Validates that a given object is a real Contact (not a Message masquerading as one).
 * 
 * The old bug: mapSocketContact(message) would return a fictitious contact because
 * message.id is non-null (Date.now()). This function ensures we only accept objects
 * that have actual contact fields (name, phone, uuid).
 * 
 * @param obj - The object to validate
 * @returns true if the object appears to be a real Contact, false otherwise
 */
export function isValidContact(obj: unknown): obj is Contact {
  if (!obj || typeof obj !== 'object') return false
  const record = obj as Record<string, unknown>
  
  // Must have a numeric id
  if (record.id == null || typeof record.id !== 'number') return false
  
  // Must have at least a name (contacts always have a name)
  if (!record.name || typeof record.name !== 'string') return false
  
  // A Message object will have 'direction', 'body', 'content', 'conversationId' etc.
  // A Contact object will NOT have these fields
  if ('direction' in record || 'body' in record || 'content' in record) return false
  
  return true
}

/** 
 * new-message del socket puede venir plano o como { message, contact, history }
 * 
 * CLOUD-239: The backend now emits new-message to BOTH the contact room AND
 * the company room. The payload includes the full contact object, so the
 * frontend can open the popup instantly without additional HTTP calls.
 */
export function normalizeInboundSocketMessage(payload: unknown): {
  message: Message
  contact?: Contact
} | null {
  if (!payload || typeof payload !== 'object') return null

  const p = payload as Record<string, unknown>
  const rawMsg = (p.message as Record<string, unknown>) || p
  const direction = String(rawMsg.direction ?? p.direction ?? 'INBOUND').toUpperCase()

  if (direction !== 'INBOUND') return null

  // CLOUD-239: Extract contact from payload using mapSocketContact.
  // The backend eventPayload includes: { message, contact, history }
  // where contact is the REAL contact object from getOrCreateContact().
  // We try p.contact first (the dedicated contact field), then rawMsg.contact
  // (in case it's nested inside the message object).
  const rawContact = (p.contact as Record<string, unknown>) || (rawMsg.contact as Record<string, unknown>)
  const contact = mapSocketContact(rawContact)
  
  // CLOUD-239: Validate that the contact is real (not a Message masquerading as Contact)
  // This is a safety net to prevent the old bug from recurring
  const validatedContact = contact && isValidContact(rawContact) ? contact : undefined

  const contactId =
    rawMsg.contactId != null
      ? Number(rawMsg.contactId)
      : p.contactId != null
        ? Number(p.contactId)
        : validatedContact?.id

  const id = rawMsg.id ?? p.id
  if (id == null && !contactId) return null

  const message: Message = {
    id: typeof id === 'number' ? id : Number(id) || Date.now(),
    conversationId: String(rawMsg.conversationId ?? p.conversationId ?? validatedContact?.phone ?? ''),
    contactId,
    direction: 'INBOUND',
    messageType: (rawMsg.messageType as Message['messageType']) || 'TEXT',
    body: String(rawMsg.body ?? rawMsg.content ?? p.lastMessage ?? ''),
    status: (rawMsg.status as Message['status']) || 'RECEIVED',
    sentAt: String(rawMsg.sentAt ?? rawMsg.createdAt ?? new Date().toISOString()),
    createdAt: String(rawMsg.createdAt ?? new Date().toISOString())
  }

  return { message, contact: validatedContact }
}

export function isInboundUnreadConversationUpdate(payload: ConversationUpdatedPayload): boolean {
  return Boolean(payload?.contactId) && (payload.unreadCount ?? 0) > 0
}

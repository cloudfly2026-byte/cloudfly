# 🤖 AGENTE_DEV — CLOUD-248: API Contracts

## Marketing Live Dashboard — Complete API Reference

**Date:** 2025-07-19  
**Ticket:** CLOUD-248 — E2E Smoke Test: Marketing Live Dashboard  
**Parent:** CLOUD-213 — Real-time Marketing Agent Dashboard

---

## 1. Socket.IO Events API

### 1.1 Connection Events

#### `connect` (Built-in)

Establishes the WebSocket connection. Authentication is handled via middleware.

**Auth Payload (set at connection time):**
```typescript
{
  token: string;        // JWT token
  tenantId: number;     // From JWT
  companyId?: number;   // From JWT
}
```

**Server sets on socket:**
```typescript
socket.tenantId = number;    // From JWT (trusted)
socket.companyId = number;   // From JWT (trusted)
socket.userId = number;      // From JWT
socket.userName = string;    // From JWT
```

---

#### `disconnect` (Built-in)

Fired when the socket disconnects.

**Payload:**
```typescript
reason: string;  // "transport close", "ping timeout", etc.
```

---

### 1.2 Marketing Subscription Events

#### `subscribe-marketing` (Client → Server)

Subscribes the socket to the marketing room for the given tenant/company.

**Request Payload:**
```typescript
interface SubscribeMarketingRequest {
  tenantId: number;
  companyId?: number;
}
```

**Success Response (`subscribed-marketing`):**
```typescript
interface SubscribedMarketingResponse {
  room: string;              // e.g., "marketing_tenant_1_company_5"
  tenantId: number;
  companyId: number | null;
}
```

**Error Response (`error`):**
```typescript
interface SubscriptionError {
  message: string;
  // Possible values:
  // - "Cross-tenant subscription not allowed"
  // - "tenantId is required to subscribe to marketing"
  // - "Failed to subscribe to marketing room"
}
```

**Room Naming Convention:**
| Condition | Room Name |
|-----------|-----------|
| With companyId | `marketing_tenant_{tenantId}_company_{companyId}` |
| Without companyId | `marketing_tenant_{tenantId}` |

**Security:**
- The `tenantId` in the payload is **validated** against `socket.tenantId` from JWT
- Cross-tenant subscription attempts are rejected with an error
- The server always uses `socket.tenantId` (never the payload) for room name construction

---

#### `unsubscribe-marketing` (Client → Server)

Unsubscribes the socket from the marketing room.

**Request Payload:**
```typescript
interface UnsubscribeMarketingRequest {
  tenantId: number;
  companyId?: number;
}
```

**Success Response (`unsubscribed-marketing`):**
```typescript
interface UnsubscribedMarketingResponse {
  room: string;
  tenantId: number;
  companyId: number | null;
}
```

---

### 1.3 Marketing Data Events (Server → Client)

#### `marketing-batch-update`

Full snapshot of all agents and connections. Sent on initial subscription and periodic refresh.

**Payload:**
```typescript
interface MarketingAgentBatchPayload {
  agents: MarketingAgent[];
  connections: AgentConnection[];
  timestamp: string;  // ISO-8601
}
```

**MarketingAgent:**
```typescript
interface MarketingAgent {
  id: string;                    // e.g., "researcher", "icp_agent"
  name: string;                  // Internal code/name
  displayName: string;           // Human-readable: "Investigador de Mercado"
  role: string;                  // Role description
  status: AgentStatus;           // 'idle' | 'working' | 'waiting' | 'error' | 'completed'
  currentTask: string | null;    // Current task description
  taskStartedAt: string | null;  // ISO-8601
  lastActivity: string;          // ISO-8601
  avatar?: string;               // URL
  color: string;                 // Hex color: "#3b82f6"
  position: { x: number; y: number };  // Flow graph position
}
```

**AgentConnection:**
```typescript
interface AgentConnection {
  id: string;
  sourceAgentId: string;
  targetAgentId: string;
  label: string;
  dataFlow: 'leads' | 'analysis' | 'messages' | 'context';
  active: boolean;
}
```

---

#### `marketing-agent-status-update`

Single agent status change event.

**Payload:**
```typescript
interface AgentStatusUpdatePayload {
  agentId: string;
  agentName: string;
  status: AgentStatus;
  currentTask: string | null;
  taskStartedAt: string | null;
  lastActivity: string;
  tenantId: number;
  companyId: number;
}
```

**AgentStatus Union Type:**
```typescript
type AgentStatus = 'idle' | 'working' | 'waiting' | 'error' | 'completed';
```

| Status | Meaning | Color |
|--------|---------|-------|
| `idle` | Online, no task | Gray |
| `working` | Actively executing | Green |
| `waiting` | Paused, waiting for input | Yellow |
| `error` | Error encountered | Red |
| `completed` | Task finished successfully | Blue |

---

#### `marketing-agent-task-update`

Single agent task change event.

**Payload:**
```typescript
interface AgentTaskUpdatePayload {
  agentId: string;
  taskId: string;
  taskName: string;
  taskDescription: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  progress: number;       // 0-100
  output: string | null;
  timestamp: string;      // ISO-8601
}
```

---

#### `marketing-action-event`

New action event for the history timeline.

**Payload:**
```typescript
interface MarketingActionEvent {
  id: string;
  type: ActionType;
  title: string;
  description: string;
  agentId: string;
  timestamp: string;      // ISO-8601
  metadata: Record<string, any>;
}
```

**ActionType Union Type:**
```typescript
type ActionType = 
  | 'lead_search_started'
  | 'lead_search_completed'
  | 'campaign_created'
  | 'message_sent'
  | 'analysis_completed'
  | 'crew_kickoff'
  | 'flow_transition'
  | 'error';
```

| Type | Color | Icon |
|------|-------|------|
| `lead_search_started` | Blue | 🔍 |
| `lead_search_completed` | Green | ✅ |
| `campaign_created` | Purple | 📢 |
| `message_sent` | Teal | 💬 |
| `analysis_completed` | Indigo | 📊 |
| `crew_kickoff` | Orange | 🚀 |
| `flow_transition` | Cyan | ➡️ |
| `error` | Red | ❌ |

---

## 2. REST API Endpoints

### 2.1 Health Check

```
GET /health
```

**Response 200:**
```json
{
  "status": "ok",
  "service": "chat-socket-service",
  "timestamp": "2025-07-19T12:00:00.000Z",
  "uptime": 5804.123
}
```

---

### 2.2 Marketing Emit (Service-to-Service)

```
POST /api/marketing/emit
Content-Type: application/json
```

**Request Body:**
```typescript
interface MarketingEmitRequest {
  event: 'marketing-batch-update' | 'marketing-agent-status-update' | 
         'marketing-agent-task-update' | 'marketing-action-event';
  tenantId: number;
  companyId?: number;
  payload: object;
}
```

**Response 200:**
```json
{
  "success": true,
  "event": "marketing-agent-status-update",
  "room": "marketing_tenant_1_company_5",
  "timestamp": "2025-07-19T12:00:00.000Z"
}
```

**Response 400 (Validation Error):**
```json
{
  "error": "Missing required field: event"
}
```

```json
{
  "error": "Invalid event: 'unknown-event'. Valid events: marketing-batch-update, marketing-agent-status-update, marketing-agent-task-update, marketing-action-event"
}
```

**Response 503 (Socket.IO Unavailable):**
```json
{
  "error": "Socket.IO service not available"
}
```

**Valid Event Names (Whitelist):**
- `marketing-batch-update`
- `marketing-agent-status-update`
- `marketing-agent-task-update`
- `marketing-action-event`

---

### 2.3 Marketing Rooms (Debug/Monitoring)

```
GET /api/marketing/rooms/:tenantId?companyId=number
```

**Response 200:**
```json
{
  "room": "marketing_tenant_1_company_5",
  "tenantId": 1,
  "companyId": 5,
  "socketCount": 3,
  "sockets": ["socket-id-1", "socket-id-2", "socket-id-3"]
}
```

---

### 2.4 Marketing History (Frontend Service)

```
GET /api/marketing/history?tenantId=1&companyId=5&limit=50&offset=0
```

**Response 200:**
```typescript
interface MarketingHistoryResponse {
  events: MarketingActionEvent[];
  total: number;
  hasMore: boolean;
}
```

---

## 3. TypeScript Type Definitions

### 3.1 Complete Type System

```typescript
// ============================================================
// Agent Status
// ============================================================
type AgentStatus = 'idle' | 'working' | 'waiting' | 'error' | 'completed';

// ============================================================
// Marketing Agent
// ============================================================
interface MarketingAgent {
  id: string;
  name: string;
  displayName: string;
  role: string;
  status: AgentStatus;
  currentTask: string | null;
  taskStartedAt: string | null;
  lastActivity: string;
  avatar?: string;
  color: string;
  position: { x: number; y: number };
}

// ============================================================
// Agent Connection
// ============================================================
interface AgentConnection {
  id: string;
  sourceAgentId: string;
  targetAgentId: string;
  label: string;
  dataFlow: 'leads' | 'analysis' | 'messages' | 'context';
  active: boolean;
}

// ============================================================
// Marketing Action Event
// ============================================================
type ActionType = 
  | 'lead_search_started'
  | 'lead_search_completed'
  | 'campaign_created'
  | 'message_sent'
  | 'analysis_completed'
  | 'crew_kickoff'
  | 'flow_transition'
  | 'error';

interface MarketingActionEvent {
  id: string;
  type: ActionType;
  title: string;
  description: string;
  agentId: string;
  timestamp: string;
  metadata: Record<string, any>;
}

// ============================================================
// Batch Payload
// ============================================================
interface MarketingAgentBatchPayload {
  agents: MarketingAgent[];
  connections: AgentConnection[];
  timestamp: string;
}

// ============================================================
// Status Update Payload
// ============================================================
interface AgentStatusUpdatePayload {
  agentId: string;
  agentName: string;
  status: AgentStatus;
  currentTask: string | null;
  taskStartedAt: string | null;
  lastActivity: string;
  tenantId: number;
  companyId: number;
}

// ============================================================
// Task Update Payload
// ============================================================
interface AgentTaskUpdatePayload {
  agentId: string;
  taskId: string;
  taskName: string;
  taskDescription: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  output: string | null;
  timestamp: string;
}

// ============================================================
// Hook Options & Return
// ============================================================
interface UseMarketingAgentsSocketOptions {
  tenantId: number;
  companyId?: number;
}

interface UseMarketingAgentsSocketReturn {
  agents: MarketingAgent[];
  connections: AgentConnection[];
  events: MarketingActionEvent[];
  isConnected: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  lastUpdate: string | null;
  roomName: string | null;
  subscriptionError: string | null;
  reconnect: () => void;
}

// ============================================================
// History Response
// ============================================================
interface MarketingHistoryResponse {
  events: MarketingActionEvent[];
  total: number;
  hasMore: boolean;
}
```

---

## 4. Error Codes

### 4.1 Socket.IO Error Events

| Error Message | Cause | Resolution |
|--------------|-------|------------|
| `Cross-tenant subscription not allowed` | Client tenantId ≠ socket tenantId | Ensure JWT tenantId matches subscription request |
| `tenantId is required to subscribe to marketing` | Missing tenantId in request | Include tenantId in subscribe-marketing payload |
| `Failed to subscribe to marketing room` | Server-side exception | Check server logs for details |

### 4.2 REST API Error Codes

| Status | Error | Cause |
|--------|-------|-------|
| 400 | `Missing required field: event` | No event field in request body |
| 400 | `Missing required field: tenantId` | No tenantId field in request body |
| 400 | `Missing required field: payload` | No payload field in request body |
| 400 | `Invalid event: '...'` | Event name not in whitelist |
| 500 | `Internal server error` | Server-side exception |
| 503 | `Socket.IO service not available` | Socket.IO instance not initialized |

---

## 5. Connection Lifecycle

### 5.1 Socket.IO Connection States

```
┌─────────────────────────────────────────────────────────────────┐
│                     CONNECTION LIFECYCLE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Browser] ──WebSocket──▶ [chat_socket:3001]                   │
│                                                                 │
│  1. CONNECT                                                    │
│     ├── JWT Auth (middleware)                                  │
│     ├── Set socket.tenantId                                    │
│     └── Auto-join tenant room                                  │
│                                                                 │
│  2. SUBSCRIBE                                                  │
│     ├── emit('subscribe-marketing', {tenantId, companyId})     │
│     ├── Validate tenantId (cross-tenant check)                 │
│     ├── Join marketing room                                    │
│     └── emit('subscribed-marketing', {room})                   │
│                                                                 │
│  3. RECEIVE EVENTS                                             │
│     ├── marketing-batch-update                                 │
│     ├── marketing-agent-status-update                          │
│     ├── marketing-agent-task-update                            │
│     └── marketing-action-event                                 │
│                                                                 │
│  4. UNSUBSCRIBE                                                │
│     ├── emit('unsubscribe-marketing', {tenantId, companyId})   │
│     ├── Leave marketing room                                   │
│     └── emit('unsubscribed-marketing', {room})                 │
│                                                                 │
│  5. DISCONNECT                                                 │
│     ├── Auto-leave all rooms                                   │
│     └── Cleanup socket resources                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Reconnection Behavior

| Scenario | Behavior |
|----------|----------|
| Network loss | Socket.IO auto-reconnect with exponential backoff |
| Server restart | Auto-reconnect, re-subscribe to marketing room |
| Manual reconnect | `socket.disconnect()` → `socket.connect()` |
| Max retries exceeded | Status → "Desconectado", user must click "Reconectar" |

---

## 6. Rate Limits & Performance

### 6.1 Socket.IO Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| `pingTimeout` | 60000ms | Time to wait for pong before considering connection closed |
| `pingInterval` | 25000ms | Interval between ping packets |
| `reconnection` | true | Enable auto-reconnection |
| `maxHttpBufferSize` | 1e6 (1MB) | Max size of a single message |

### 6.2 Event Buffer Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| `maxEvents` | 50 | Maximum events kept in timeline |
| `debounceMs` | 3000ms | Debounce window for message buffer |
| `dedupWindowMs` | 5000ms | Deduplication window for messages |

---

*Generated by: OWL — Technical Writer & Diagram Specialist*  
*Date: 2025-07-19*  
*Ticket: CLOUD-248*

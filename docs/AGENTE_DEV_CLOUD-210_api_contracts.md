# CLOUD-210: Marketing Live Dashboard — API Contracts

> **Ticket:** CLOUD-210 (Resume & Complete — Replace page.tsx with the new Marketing Live Dashboard)  
> **Status:** ✅ Finalizada  
> **Last Updated:** 2025-07-19  
> **Author:** AI Scrum Team — Technical Writer Agent  

---

## 1. REST API Contracts

### 1.1 Get Action History

**Endpoint:** `GET /api/v1/marketing/agents/history`

**Description:** Fetches paginated action history for the marketing timeline. Called on component mount to provide initial data before WebSocket events flow.

**Authentication:** Bearer token (via `next-auth` session)

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tenantId` | `number` | ✅ | — | Tenant identifier (from session) |
| `limit` | `number` | ❌ | `50` | Maximum events to return |
| `page` | `number` | ❌ | `0` | Page number for pagination |
| `companyId` | `number` | ❌ | — | Company scope (optional) |

**Request Example:**
```
GET /api/v1/marketing/agents/history?tenantId=1&limit=50&page=0&companyId=1
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "events": [
    {
      "id": "evt-123",
      "type": "lead_search_completed",
      "title": "Búsqueda de leads completada",
      "description": "Se encontraron 47 leads cualificados",
      "agentId": "researcher",
      "timestamp": "2025-07-19T10:30:00Z",
      "metadata": {
        "count": 47,
        "source": "linkedin",
        "duration": 120
      }
    },
    {
      "id": "evt-124",
      "type": "campaign_created",
      "title": "Campaña creada",
      "description": "Nueva campaña 'Verano 2025' creada",
      "agentId": "campaign_manager",
      "timestamp": "2025-07-19T10:35:00Z",
      "metadata": {
        "campaignId": "camp-456",
        "channel": "whatsapp"
      }
    }
  ],
  "total": 150,
  "hasMore": true
}
```

**Error Response (500):**
```json
{
  "error": "Internal Server Error",
  "message": "Failed to fetch action history"
}
```

**Frontend Handling:**
```typescript
// AbortController-protected call
const history = await marketingHistoryService.getActionHistory(
  tenantId,
  50,
  0,
  companyId,
  controller.signal
)
if (history?.events) {
  setHistoryEvents(history.events)  // Store for merging
}
```

---

### 1.2 Get Live Agents

**Endpoint:** `GET /api/v1/marketing/agents/live-status`

**Description:** Fetches current state of all marketing agents for the tenant. Used as fallback during WebSocket reconnection.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenantId` | `number` | ✅ | Tenant identifier |
| `companyId` | `number` | ❌ | Company scope |

**Request Example:**
```
GET /api/v1/marketing/agents/live-status?tenantId=1&companyId=1
```

**Success Response (200):**
```json
{
  "agents": [
    {
      "id": "researcher",
      "name": "researcher",
      "displayName": "Investigador de Mercado",
      "role": "Market research and lead discovery",
      "status": "working",
      "currentTask": "Buscando leads en LinkedIn",
      "taskStartedAt": "2025-07-19T10:25:00Z",
      "lastActivity": "2025-07-19T10:30:00Z",
      "color": "#3b82f6",
      "position": { "x": 100, "y": 200 }
    },
    {
      "id": "copywriter",
      "name": "copywriter",
      "displayName": "Redactor de Contenido",
      "role": "Content creation and messaging",
      "status": "idle",
      "currentTask": null,
      "taskStartedAt": null,
      "lastActivity": "2025-07-19T09:00:00Z",
      "color": "#10b981",
      "position": { "x": 300, "y": 200 }
    }
  ],
  "connections": [
    {
      "id": "conn-1",
      "sourceAgentId": "researcher",
      "targetAgentId": "copywriter",
      "label": "Leads encontrados",
      "dataFlow": "leads",
      "active": true
    }
  ]
}
```

---

### 1.3 Get Agent Connections

**Endpoint:** `GET /api/v1/marketing/agents/connections`

**Description:** Fetches directed connections between agents for the flow graph visualization.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenantId` | `number` | ✅ | Tenant identifier |

**Success Response (200):**
```json
[
  {
    "id": "conn-1",
    "sourceAgentId": "researcher",
    "targetAgentId": "copywriter",
    "label": "Leads encontrados",
    "dataFlow": "leads",
    "active": true
  },
  {
    "id": "conn-2",
    "sourceAgentId": "copywriter",
    "targetAgentId": "campaign_manager",
    "label": "Mensajes creados",
    "dataFlow": "messages",
    "active": false
  }
]
```

---

### 1.4 Get Agent Tasks

**Endpoint:** `GET /api/v1/marketing/agents/{agentId}/tasks`

**Description:** Fetches tasks for a specific agent.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agentId` | `string` | ✅ | Agent identifier |

**Success Response (200):**
```json
[
  {
    "id": "task-789",
    "type": "lead_search_started",
    "title": "Búsqueda de leads iniciada",
    "description": "Iniciando búsqueda en LinkedIn",
    "agentId": "researcher",
    "timestamp": "2025-07-19T10:25:00Z",
    "metadata": {
      "source": "linkedin",
      "query": "marketing directors"
    }
  }
]
```

---

## 2. WebSocket Event Contracts

### 2.1 Server → Client Events

#### 2.1.1 marketing-agent-batch-update

**Description:** Full snapshot of all agents and connections. Sent on initial connection and periodic refresh.

**Payload (New Format):**
```typescript
interface MarketingAgentBatchPayload {
  agents: MarketingAgent[]
  connections: AgentConnection[]
  timestamp: string  // ISO-8601
}
```

**Payload (Legacy Format):**
```typescript
// Plain array of agents (backward compatible)
MarketingAgent[]
```

**Example:**
```json
{
  "agents": [
    {
      "id": "researcher",
      "name": "researcher",
      "displayName": "Investigador de Mercado",
      "role": "Market research",
      "status": "working",
      "currentTask": "Buscando leads",
      "taskStartedAt": "2025-07-19T10:25:00Z",
      "lastActivity": "2025-07-19T10:30:00Z",
      "color": "#3b82f6",
      "position": { "x": 100, "y": 200 }
    }
  ],
  "connections": [
    {
      "id": "conn-1",
      "sourceAgentId": "researcher",
      "targetAgentId": "copywriter",
      "label": "Leads",
      "dataFlow": "leads",
      "active": true
    }
  ],
  "timestamp": "2025-07-19T10:30:00Z"
}
```

---

#### 2.1.2 marketing-agent-status-update

**Description:** Single agent status change notification.

**Payload:**
```typescript
interface AgentStatusUpdatePayload {
  agentId: string
  agentName: string
  status: 'idle' | 'working' | 'waiting' | 'error' | 'completed'
  currentTask: string | null
  taskStartedAt: string | null  // ISO-8601
  lastActivity: string  // ISO-8601
  tenantId: number
  companyId: number
}
```

**Example:**
```json
{
  "agentId": "researcher",
  "agentName": "Investigador de Mercado",
  "status": "working",
  "currentTask": "Buscando leads en LinkedIn",
  "taskStartedAt": "2025-07-19T10:25:00Z",
  "lastActivity": "2025-07-19T10:30:00Z",
  "tenantId": 1,
  "companyId": 1
}
```

---

#### 2.1.3 marketing-agent-task-update

**Description:** Single agent task change notification.

**Payload:**
```typescript
interface AgentTaskUpdatePayload {
  agentId: string
  taskId: string
  taskName: string
  taskDescription: string
  status: 'started' | 'in_progress' | 'completed' | 'failed'
  progress: number  // 0-100
  output: string | null
  timestamp: string  // ISO-8601
}
```

**Example:**
```json
{
  "agentId": "researcher",
  "taskId": "task-789",
  "taskName": "Búsqueda de leads",
  "taskDescription": "Buscando leads en LinkedIn",
  "status": "in_progress",
  "progress": 65,
  "output": null,
  "timestamp": "2025-07-19T10:30:00Z"
}
```

---

#### 2.1.4 marketing-action-event

**Description:** New action event for the history timeline.

**Payload:**
```typescript
interface MarketingActionEvent {
  id: string
  type: 'lead_search_started' | 'lead_search_completed' | 'campaign_created' |
        'message_sent' | 'analysis_completed' | 'crew_kickoff' | 'flow_transition' | 'error'
  title: string
  description: string
  agentId: string
  timestamp: string  // ISO-8601
  metadata: Record<string, any>
}
```

**Example:**
```json
{
  "id": "evt-123",
  "type": "lead_search_completed",
  "title": "Búsqueda completada",
  "description": "Se encontraron 47 leads",
  "agentId": "researcher",
  "timestamp": "2025-07-19T10:30:00Z",
  "metadata": {
    "count": 47,
    "source": "linkedin"
  }
}
```

---

### 2.2 Client → Server Events

#### 2.2.1 subscribe-marketing

**Description:** Join the marketing room for a specific tenant/company.

**Payload:**
```typescript
{
  tenantId: number
  companyId?: number
}
```

**Example:**
```json
{
  "tenantId": 1,
  "companyId": 1
}
```

---

#### 2.2.2 unsubscribe-marketing

**Description:** Leave the marketing room.

**Payload:**
```typescript
{
  tenantId: number
  companyId?: number
}
```

---

## 3. Frontend Hook Contract

### 3.1 useMarketingAgentsSocket

**Location:** `frontend_new/src/hooks/useMarketingAgentsSocket.ts`

**Signature:**
```typescript
interface UseMarketingAgentsSocketOptions {
  tenantId: number
  companyId?: number
}

interface UseMarketingAgentsSocketReturn {
  agents: MarketingAgent[]
  connections: AgentConnection[]
  events: MarketingActionEvent[]
  isConnected: boolean
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting'
  lastUpdate: string | null  // ISO-8601
  reconnect: () => void
}

function useMarketingAgentsSocket(
  options: UseMarketingAgentsSocketOptions
): UseMarketingAgentsSocketReturn
```

**Usage:**
```typescript
const {
  agents,
  connections,
  events,
  isConnected,
  connectionStatus,
  lastUpdate,
  reconnect
} = useMarketingAgentsSocket({ tenantId, companyId })
```

---

## 4. Frontend Service Contract

### 4.1 marketingHistoryService

**Location:** `frontend_new/src/services/marketing/marketingHistoryService.ts`

**Methods:**

```typescript
interface MarketingHistoryService {
  getLiveAgents(
    tenantId: number,
    companyId?: number,
    signal?: AbortSignal
  ): Promise<{ agents: MarketingAgent[]; connections: AgentConnection[] }>

  getActionHistory(
    tenantId: number,
    limit?: number,
    page?: number,
    companyId?: number,
    signal?: AbortSignal
  ): Promise<MarketingHistoryResponse>

  getAgentConnections(
    tenantId: number,
    signal?: AbortSignal
  ): Promise<AgentConnection[]>

  getAgentTasks(
    agentId: string,
    signal?: AbortSignal
  ): Promise<MarketingActionEvent[]>
}
```

**Error Handling:**
- All methods support `AbortSignal` for request cancellation
- AbortError is caught and returns empty default values
- Other errors are logged and return empty default values

---

## 5. Type Definitions

### 5.1 Core Types

```typescript
type AgentStatus = 'idle' | 'working' | 'waiting' | 'error' | 'completed'

interface MarketingAgent {
  id: string
  name: string
  displayName: string
  role: string
  status: AgentStatus
  currentTask: string | null
  taskStartedAt: string | null
  lastActivity: string
  avatar?: string
  color: string
  position: { x: number; y: number }
}

interface AgentConnection {
  id: string
  sourceAgentId: string
  targetAgentId: string
  label: string
  dataFlow: 'leads' | 'analysis' | 'messages' | 'context'
  active: boolean
}

interface MarketingActionEvent {
  id: string
  type: 'lead_search_started' | 'lead_search_completed' | 'campaign_created' |
        'message_sent' | 'analysis_completed' | 'crew_kickoff' | 'flow_transition' | 'error'
  title: string
  description: string
  agentId: string
  timestamp: string
  metadata: Record<string, any>
}

interface MarketingHistoryResponse {
  events: MarketingActionEvent[]
  total: number
  hasMore: boolean
}
```

---

## 6. Error Codes

### 6.1 HTTP Status Codes

| Code | Description | Frontend Handling |
|------|-------------|-------------------|
| 200 | Success | Process response |
| 401 | Unauthorized | Redirect to login |
| 403 | Forbidden | Show permission error |
| 500 | Server Error | Show user-friendly message |

### 6.2 WebSocket Error States

| State | Description | UI Indicator |
|-------|-------------|--------------|
| `connected` | Socket connected | Green chip "Conectado" |
| `disconnected` | Socket disconnected | Red chip "Desconectado" |
| `reconnecting` | Attempting reconnection | Amber chip "Reconectando..." |

---

## 7. Rate Limiting

### 7.1 REST API

- Standard rate limiting applies (configured in Spring Boot)
- No special rate limits for marketing endpoints

### 7.2 WebSocket

- Connection-based (no per-message rate limit)
- Server may throttle batch updates

---

## 8. Versioning

- API version: `v1` (in path: `/api/v1/`)
- WebSocket events: No versioning (backward compatible)

---

## 9. Related Documentation

- [CLOUD-210: Technical Architecture](./AGENTE_DEV_CLOUD-210_technical_architecture.md)
- [CLOUD-210: Architecture Diagrams](./AGENTE_DEV_CLOUD-210_architecture_diagrams.md)
- [CLOUD-212: REST API Architecture](./AGENTE_DEV_CLOUD-212_technical_architecture.md)

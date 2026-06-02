# CLOUD-243: Marketing Agent Socket Event Handlers — API Contracts

> **Ticket**: [CLOUD-243] Add marketing agent socket event handlers to chat-socket-service  
> **Parent**: [CLOUD-200] Marketing Team Live Dashboard  
> **Status**: ✅ COMPLETADO  
> **Last Updated**: 2026-06-01

---

## 1. Socket.IO Event API

### 1.1 Event Summary

| Direction | Event | Type | Description |
|-----------|-------|------|-------------|
| Client → Server | `subscribe-marketing` | Subscription | Join marketing room for real-time updates |
| Client → Server | `unsubscribe-marketing` | Subscription | Leave marketing room |
| Server → Client | `subscribed-marketing` | Confirmation | Acknowledge successful subscription |
| Server → Client | `unsubscribed-marketing` | Confirmation | Acknowledge successful unsubscription |
| Server → Client | `marketing-batch-update` | Data | Full agent + connections snapshot |
| Server → Client | `marketing-agent-status-update` | Data | Single agent status change |
| Server → Client | `marketing-agent-task-update` | Data | Single agent task change |
| Server → Client | `marketing-action-event` | Data | New timeline/history event |
| Server → Client | `error` | Error | Error notification (e.g., cross-tenant rejection) |

---

## 2. Client → Server Events

### 2.1 `subscribe-marketing`

**Purpose**: Join the marketing room to receive real-time agent events for the authenticated tenant.

**Emit**:
```typescript
socket.emit('subscribe-marketing', {
  tenantId?: number | string,  // Optional — validated against socket.tenantId
  companyId?: number           // Optional — for company-scoped subscription
});
```

**Examples**:

```javascript
// Subscribe to all marketing events for tenant 1
socket.emit('subscribe-marketing', { tenantId: 1 });

// Subscribe to marketing events for tenant 1, company 5
socket.emit('subscribe-marketing', { tenantId: 1, companyId: 5 });

// Subscribe using socket's authenticated tenantId (no payload tenantId)
socket.emit('subscribe-marketing', {});
```

**Validation Rules**:

| Rule | Condition | Result |
|------|-----------|--------|
| Cross-tenant check | `Number(data.tenantId) !== Number(socket.tenantId)` | ❌ Rejected with `error` event |
| Missing tenantId on socket | `socket.tenantId` is null/undefined | ❌ Rejected with `error` event |
| Matching tenantId | `Number(data.tenantId) === Number(socket.tenantId)` | ✅ Subscribed |
| No tenantId in data | `data.tenantId` is undefined/null | ✅ Uses `socket.tenantId` |
| String tenantId match | `data.tenantId = "5"` and `socket.tenantId = 5` | ✅ Subscribed (Number coercion) |

---

### 2.2 `unsubscribe-marketing`

**Purpose**: Leave the marketing room. Always uses `socket.tenantId` as the source of truth.

**Emit**:
```typescript
socket.emit('unsubscribe-marketing', {
  companyId?: number  // Optional — for company-scoped unsubscription
});
```

**Examples**:

```javascript
// Unsubscribe from tenant-level marketing room
socket.emit('unsubscribe-marketing', {});

// Unsubscribe from company-scoped marketing room
socket.emit('unsubscribe-marketing', { companyId: 5 });
```

> **Note**: The `tenantId` field in the payload is **ignored** for unsubscribe. The handler always uses `socket.tenantId` to determine which room to leave, preventing cross-tenant room manipulation.

---

## 3. Server → Client Events

### 3.1 `subscribed-marketing` (Confirmation)

**Purpose**: Acknowledge that the socket has successfully joined a marketing room.

**Payload**:
```typescript
interface SubscribedMarketingEvent {
  room: string;          // The room name joined (e.g., "marketing_tenant_1_company_5")
  tenantId: number;      // The tenant ID (from socket.tenantId)
  companyId: number | null;  // The company ID or null if tenant-only
}
```

**Example**:
```json
{
  "room": "marketing_tenant_1_company_5",
  "tenantId": 1,
  "companyId": 5
}
```

---

### 3.2 `unsubscribed-marketing` (Confirmation)

**Purpose**: Acknowledge that the socket has left a marketing room.

**Payload**:
```typescript
interface UnsubscribedMarketingEvent {
  room: string;          // The room name left
  tenantId: number;      // The tenant ID (from socket.tenantId)
  companyId: number | null;  // The company ID or null
}
```

**Example**:
```json
{
  "room": "marketing_tenant_1",
  "tenantId": 1,
  "companyId": null
}
```

---

### 3.3 `error` (Rejection)

**Purpose**: Notify the client of a subscription error.

**Payload**:
```typescript
interface SocketErrorEvent {
  message: string;  // Error description
}
```

**Possible Error Messages**:

| Message | Trigger |
|---------|---------|
| `"Cross-tenant subscription not allowed"` | `data.tenantId` doesn't match `socket.tenantId` |
| `"tenantId is required to subscribe to marketing"` | `socket.tenantId` is null/undefined |
| `"Failed to subscribe to marketing room"` | Unexpected error in handler |

---

### 3.4 `marketing-batch-update` (Data Event)

**Purpose**: Deliver a full snapshot of all marketing agents and their connections.

**Payload**:
```typescript
interface MarketingBatchUpdateEvent {
  agents: MarketingAgent[];
  connections: AgentConnection[];
}

interface MarketingAgent {
  id: string;
  name: string;
  type: 'lead_qualifier' | 'sales_closer' | 'content_creator' | 'support';
  status: 'idle' | 'working' | 'paused' | 'error';
  currentTask?: string;
  metrics: {
    leadsProcessed: number;
    conversionRate: number;
    avgResponseTime: number;
  };
}

interface AgentConnection {
  sourceAgentId: string;
  targetAgentId: string;
  type: 'handoff' | 'collaboration' | 'notification';
  status: 'active' | 'idle';
}
```

---

### 3.5 `marketing-agent-status-update` (Data Event)

**Purpose**: Notify of a single agent's status change.

**Payload**:
```typescript
interface MarketingAgentStatusUpdateEvent {
  agentId: string;
  status: 'idle' | 'working' | 'paused' | 'error';
  previousStatus?: string;
  timestamp: string;  // ISO 8601
  reason?: string;
}
```

---

### 3.6 `marketing-agent-task-update` (Data Event)

**Purpose**: Notify of a single agent's task change.

**Payload**:
```typescript
interface MarketingAgentTaskUpdateEvent {
  agentId: string;
  task: {
    id: string;
    type: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    progress?: number;  // 0-100
    result?: unknown;
  };
  timestamp: string;  // ISO 8601
}
```

---

### 3.7 `marketing-action-event` (Data Event)

**Purpose**: Notify of a new timeline/history event (e.g., lead qualified, message sent).

**Payload**:
```typescript
interface MarketingActionEvent {
  event: string;       // Event type identifier
  data: unknown;       // Event-specific data
  agentId?: string;    // Agent that triggered the event
  timestamp: string;   // ISO 8601
}
```

---

## 4. REST API Contract (CLOUD-247)

### 4.1 `POST /api/marketing/emit`

**Purpose**: Allow backend services to emit marketing events to Socket.IO rooms via HTTP.

**Request Headers**:
```
Content-Type: application/json
x-internal-token: <shared-secret>  (optional, for service-to-service auth)
```

**Request Body**:
```typescript
interface MarketingEmitRequest {
  event: 'marketing-batch-update' 
       | 'marketing-agent-status-update' 
       | 'marketing-agent-task-update' 
       | 'marketing-action-event';
  tenantId: number;      // Required
  companyId?: number;    // Optional
  payload: object;       // Required — event-specific data
}
```

**Success Response (200)**:
```typescript
interface MarketingEmitResponse {
  success: true;
  event: string;         // The event name
  room: string;          // The target room name
  timestamp: string;     // ISO 8601
}
```

**Error Responses**:

| Status | Error | Condition |
|--------|-------|-----------|
| 400 | `Missing required field: event` | No event in body |
| 400 | `Missing required field: tenantId` | No tenantId in body |
| 400 | `Missing required field: payload` | No payload in body |
| 400 | `Invalid event: 'foo'. Valid events: ...` | Event not in whitelist |
| 503 | `Socket.IO service not available` | io instance not found on app |

---

### 4.2 `GET /api/marketing/rooms/:tenantId`

**Purpose**: Get room occupancy information for debugging/monitoring.

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `companyId` | number | No | Filter by company |

**Success Response (200)**:
```typescript
interface MarketingRoomsResponse {
  room: string;           // Room name
  tenantId: number;       // Tenant ID
  companyId: number | null;  // Company ID or null
  socketCount: number;    // Number of connected sockets in room
  sockets: string[];      // Array of socket IDs in room
}
```

---

## 5. Room Naming Convention

### Pattern

```
marketing_tenant_{tenantId}                          // Tenant-level
marketing_tenant_{tenantId}_company_{companyId}      // Company-level
```

### Examples

| tenantId | companyId | Room Name |
|----------|-----------|-----------|
| 1 | null | `marketing_tenant_1` |
| 1 | 5 | `marketing_tenant_1_company_5` |
| 42 | null | `marketing_tenant_42` |
| 42 | 100 | `marketing_tenant_42_company_100` |

### Consistency with Existing Patterns

| Service | Pattern | Example |
|---------|---------|---------|
| Chat rooms | `tenant_{id}_company_{id}_contact_{phone}` | `tenant_1_company_5_contact_573001234567` |
| Platform rooms | `tenant_{id}_company_{id}_platform_{name}` | `tenant_1_company_5_platform_whatsapp` |
| User rooms | `tenant_{id}_company_{id}_user_{userId}` | `tenant_1_company_5_user_42` |
| **Marketing rooms** | `marketing_tenant_{id}[_company_{id}]` | `marketing_tenant_1_company_5` |

> The marketing room prefix (`marketing_`) distinguishes these rooms from chat/platform/user rooms.

---

## 6. Frontend Integration Example

### React Hook Usage (useMarketingAgentsSocket)

```typescript
import { useMarketingAgentsSocket } from '@/hooks/useMarketingAgentsSocket';

function MarketingDashboard({ tenantId, companyId }: Props) {
  const {
    agents,           // MarketingAgent[]
    connections,      // AgentConnection[]
    isConnected,      // boolean
    lastEvent,        // string | null
    error,            // string | null
    reconnect,        // () => void
  } = useMarketingAgentsSocket({
    tenantId,
    companyId,
    autoConnect: true,
  });

  // The hook internally:
  // 1. On mount: socket.emit('subscribe-marketing', { tenantId, companyId })
  // 2. Listens for: marketing-batch-update, marketing-agent-status-update, etc.
  // 3. On unmount: socket.emit('unsubscribe-marketing', { companyId })

  return (
    <div>
      {agents.map(agent => (
        <LiveAgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}
```

### Raw Socket.IO Usage

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: { token: jwtToken },
  transports: ['websocket']
});

// Subscribe
socket.emit('subscribe-marketing', { tenantId: 1, companyId: 5 });

// Listen for confirmation
socket.on('subscribed-marketing', (data) => {
  console.log(`Subscribed to room: ${data.room}`);
});

// Listen for real-time events
socket.on('marketing-batch-update', (data) => {
  console.log('Agents:', data.agents);
  console.log('Connections:', data.connections);
});

socket.on('marketing-agent-status-update', (data) => {
  console.log(`Agent ${data.agentId} status: ${data.status}`);
});

// Handle errors
socket.on('error', (data) => {
  console.error('Socket error:', data.message);
});

// Unsubscribe on cleanup
socket.emit('unsubscribe-marketing', { companyId: 5 });
```

---

## 7. Backend Service Integration Example

### Python (marketing-agent / marketing-worker)

```python
import requests

CHAT_SOCKET_URL = "http://chat-socket-service:3001/api/marketing/emit"

def emit_marketing_event(event: str, tenant_id: int, payload: dict, company_id: int = None):
    """Emit a marketing event to the Socket.IO room via REST API."""
    body = {
        "event": event,
        "tenantId": tenant_id,
        "payload": payload,
    }
    if company_id:
        body["companyId"] = company_id
    
    response = requests.post(CHAT_SOCKET_URL, json=body)
    return response.json()

# Example: Agent status change
emit_marketing_event(
    event="marketing-agent-status-update",
    tenant_id=1,
    company_id=5,
    payload={
        "agentId": "lead-qualifier-1",
        "status": "working",
        "previousStatus": "idle",
        "timestamp": "2026-06-01T12:00:00Z"
    }
)
```

### Java (ia-marketing-operation)

```java
RestTemplate restTemplate = new RestTemplate();
String url = "http://chat-socket-service:3001/api/marketing/emit";

Map<String, Object> body = Map.of(
    "event", "marketing-batch-update",
    "tenantId", 1,
    "companyId", 5,
    "payload", Map.of(
        "agents", agentsList,
        "connections", connectionsList
    )
);

ResponseEntity<Map> response = restTemplate.postForEntity(url, body, Map.class);
```

---

*Document generated by 🤖 Technical Writer Agent — CLOUD-243 API Contracts*

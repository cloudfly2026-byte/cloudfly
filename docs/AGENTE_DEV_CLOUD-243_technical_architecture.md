# CLOUD-243: Marketing Agent Socket Event Handlers — Technical Architecture

> **Ticket**: [CLOUD-243] Add marketing agent socket event handlers to chat-socket-service  
> **Parent**: [CLOUD-200] Marketing Team Live Dashboard  
> **Related**: [CLOUD-213] useMarketingAgentsSocket hook | [CLOUD-247] REST API for marketing events  
> **Status**: ✅ COMPLETADO — All 7 acceptance criteria met  
> **Last Updated**: 2026-06-01

---

## 1. Overview

CLOUD-243 adds **Socket.IO event handlers** to the `chat-socket-service` backend that enable the frontend Marketing Live Dashboard to subscribe/unsubscribe from real-time marketing agent events. The handlers enforce **cross-tenant security validation** to prevent data leakage between tenants in the multi-tenant SaaS platform.

### Problem Solved

The frontend hook `useMarketingAgentsSocket` (CLOUD-213) emits `subscribe-marketing` and `unsubscribe-marketing` events, but the backend had **no listeners** for these events. Without these handlers, the real-time marketing dashboard would receive **zero data** from the server.

### Scope

| In Scope | Out of Scope |
|----------|-------------|
| `subscribe-marketing` handler with cross-tenant validation | Backend services that emit marketing events (separate task) |
| `unsubscribe-marketing` handler using `socket.tenantId` | Frontend hook implementation (CLOUD-213) |
| Room naming convention (`marketing_tenant_{id}`) | REST API for marketing events (CLOUD-247) |
| Unit tests (31 tests including 8 security tests) | Docker infrastructure changes |

---

## 2. System Architecture

### 2.1 High-Level Architecture Diagram

```mermaid
graph TB
    subgraph "Frontend (Next.js)"
        FE_HOOK["useMarketingAgentsSocket<br/>(CLOUD-213)"]
        FE_PAGE["Marketing AI Operation<br/>Dashboard Page"]
        FE_CTX["SocketContext<br/>(Socket.IO Client)"]
    end

    subgraph "chat-socket-service :3001"
        AUTH["authMiddleware<br/>(JWT → socket.tenantId)"]
        IDX["index.js<br/>(Socket.IO Server)"]
        MH["marketingHandler.js<br/>(CLOUD-243)"]
        REST["marketing.js REST API<br/>(CLOUD-247)"]
        ROOMS["Socket.IO Rooms<br/>marketing_tenant_*"]
    end

    subgraph "Backend Services (Event Producers)"
        MA["marketing-agent<br/>(Python)"]
        MW["marketing-worker<br/>(Python)"]
        IMO["ia-marketing-operation<br/>(Java)"]
    end

    FE_PAGE --> FE_HOOK
    FE_HOOK --> FE_CTX
    FE_CTX -- "WSS: subscribe-marketing<br/>unsubscribe-marketing" --> IDX
    IDX --> AUTH
    AUTH --> MH
    MH --> ROOMS
    ROOMS -- "SSE: marketing-batch-update<br/>marketing-agent-status-update<br/>marketing-agent-task-update<br/>marketing-action-event" --> FE_CTX

    MA -- "POST /api/marketing/emit" --> REST
    MW -- "POST /api/marketing/emit" --> REST
    IMO -- "POST /api/marketing/emit" --> REST
    REST --> ROOMS

    style MH fill:#4CAF50,stroke:#2E7D32,color:#fff
    style AUTH fill:#FF9800,stroke:#E65100,color:#fff
    style ROOMS fill:#2196F3,stroke:#1565C0,color:#fff
```

### 2.2 Component Interaction Diagram

```mermaid
graph LR
    subgraph "Client → Server Events"
        E1["subscribe-marketing<br/>{tenantId, companyId}"]
        E2["unsubscribe-marketing<br/>{tenantId, companyId}"]
    end

    subgraph "Server → Client Events"
        E3["subscribed-marketing<br/>{room, tenantId, companyId}"]
        E4["unsubscribed-marketing<br/>{room, tenantId, companyId}"]
        E5["error<br/>{message}"]
        E6["marketing-batch-update<br/>{agents, connections}"]
        E7["marketing-agent-status-update<br/>{agentId, status}"]
        E8["marketing-agent-task-update<br/>{agentId, task}"]
        E9["marketing-action-event<br/>{event, data}"]
    end

    E1 --> |"handleSubscribeMarketing"| E3
    E1 --> |"cross-tenant rejected"| E5
    E2 --> |"handleUnsubscribeMarketing"| E4

    style E1 fill:#E3F2FD,stroke:#1565C0
    style E2 fill:#E3F2FD,stroke:#1565C0
    style E3 fill:#E8F5E9,stroke:#2E7D32
    style E4 fill:#E8F5E9,stroke:#2E7D32
    style E5 fill:#FFEBEE,stroke:#C62828
    style E6 fill:#FFF3E0,stroke:#E65100
    style E7 fill:#FFF3E0,stroke:#E65100
    style E8 fill:#FFF3E0,stroke:#E65100
    style E9 fill:#FFF3E0,stroke:#E65100
```

---

## 3. Event Contract

### 3.1 Client → Server Events

#### `subscribe-marketing`

Joins the socket to the marketing room for the authenticated tenant.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tenantId` | `number \| string` | No* | Tenant ID (validated against `socket.tenantId`) |
| `companyId` | `number` | No | Company ID for company-scoped subscription |

> *If `tenantId` is not provided, `socket.tenantId` is used. If provided, it **must match** `socket.tenantId` or the subscription is rejected.

**Security Validation:**
```
if (dataTenantId !== undefined && dataTenantId !== null) {
    if (Number(dataTenantId) !== Number(socket.tenantId)) {
        → REJECT: emit 'error' with 'Cross-tenant subscription not allowed'
    }
}
```

#### `unsubscribe-marketing`

Leaves the marketing room. Always uses `socket.tenantId` as the source of truth.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `companyId` | `number` | No | Company ID for company-scoped unsubscription |

### 3.2 Server → Client Events

#### `subscribed-marketing` (confirmation)

| Field | Type | Description |
|-------|------|-------------|
| `room` | `string` | The room name joined |
| `tenantId` | `number` | The tenant ID (from `socket.tenantId`) |
| `companyId` | `number \| null` | The company ID or null |

#### `unsubscribed-marketing` (confirmation)

| Field | Type | Description |
|-------|------|-------------|
| `room` | `string` | The room name left |
| `tenantId` | `number` | The tenant ID (from `socket.tenantId`) |
| `companyId` | `number \| null` | The company ID or null |

#### `error` (rejection)

| Field | Type | Description |
|-------|------|-------------|
| `message` | `string` | Error description |

### 3.3 Server → Client Events (emitted by backend services via REST API)

These events are emitted to the marketing rooms by backend services (marketing-agent, marketing-worker, ia-marketing-operation) via `POST /api/marketing/emit`.

| Event | Payload | Description |
|-------|---------|-------------|
| `marketing-batch-update` | `{ agents: Agent[], connections: Connection[] }` | Full snapshot of all agents and their connections |
| `marketing-agent-status-update` | `{ agentId: string, status: string }` | Single agent status change |
| `marketing-agent-task-update` | `{ agentId: string, task: Task }` | Single agent task change |
| `marketing-action-event` | `{ event: string, data: object }` | New timeline/history event |

---

## 4. Room Naming Convention

```mermaid
graph TD
    START["Socket connects with<br/>socket.tenantId & socket.companyId"] --> HAS_COMPANY{"companyId<br/>provided?"}
    HAS_COMPANY -->|"Yes"| ROOM_COMPANY["marketing_tenant_{tenantId}_company_{companyId}"]
    HAS_COMPANY -->|"No"| ROOM_TENANT["marketing_tenant_{tenantId}"]
    
    ROOM_COMPANY --> DESC1["Scope: Single company<br/>within a tenant"]
    ROOM_TENANT --> DESC2["Scope: All companies<br/>within a tenant"]

    style START fill:#E3F2FD,stroke:#1565C0
    style ROOM_COMPANY fill:#E8F5E9,stroke:#2E7D32
    style ROOM_TENANT fill:#E8F5E9,stroke:#2E7D32
```

| Scenario | Room Name | Example |
|----------|-----------|---------|
| Tenant-only (no company) | `marketing_tenant_{tenantId}` | `marketing_tenant_1` |
| Tenant + Company | `marketing_tenant_{tenantId}_company_{companyId}` | `marketing_tenant_1_company_7` |

This follows the existing room naming pattern used for chat rooms (`tenant_{id}_company_{id}_contact_{phone}`) and platform rooms (`tenant_{id}_company_{id}_platform_{name}`).

---

## 5. Security Architecture

### 5.1 Cross-Tenant Validation Flow

```mermaid
sequenceDiagram
    participant Client as Frontend Client
    participant Auth as authMiddleware
    participant Handler as marketingHandler
    participant Room as Socket.IO Room

    Note over Client,Room: Normal Subscription (Same Tenant)
    Client->>Auth: connect (JWT token)
    Auth->>Auth: Decode JWT → socket.tenantId = 1
    Auth-->>Client: Connection accepted
    
    Client->>Handler: emit('subscribe-marketing', {tenantId: 1})
    Handler->>Handler: Number(1) === Number(1) ✅
    Handler->>Room: socket.join('marketing_tenant_1')
    Room-->>Client: emit('subscribed-marketing', {room: 'marketing_tenant_1'})

    Note over Client,Room: Cross-Tenant Attack (Different Tenant)
    Client->>Handler: emit('subscribe-marketing', {tenantId: 99})
    Handler->>Handler: Number(99) !== Number(1) ❌
    Handler-->>Client: emit('error', {message: 'Cross-tenant subscription not allowed'})
    Handler->>Handler: logger.warn(cross-tenant attempt)
    Note over Room: Room NOT joined
```

### 5.2 Security Principles

| Principle | Implementation |
|-----------|---------------|
| **Never trust the payload** | `socket.tenantId` (set by authMiddleware) is always used for room name construction |
| **Validate before join** | Cross-tenant check runs **before** `socket.join()` |
| **Number coercion** | `Number()` coercion ensures string/number type mismatches don't bypass validation |
| **Audit logging** | All cross-tenant attempts are logged with socket ID and both tenant IDs |
| **Fail closed** | If `data.tenantId` is provided and doesn't match, subscription is **rejected** (not silently ignored) |
| **Unsubscribe is safe** | `handleUnsubscribeMarketing` always uses `socket.tenantId`, ignoring `data.tenantId` entirely |

### 5.3 Authentication Flow

```mermaid
sequenceDiagram
    participant Client as Frontend
    participant Socket as Socket.IO Server
    participant Auth as authMiddleware
    participant JWT as JWT Library

    Client->>Socket: handshake with {auth: {token: "eyJ..."}}
    Socket->>Auth: authMiddleware(socket, next)
    
    alt Development Mode
        Auth->>Auth: NODE_ENV === 'development'
        Auth->>Socket: socket.tenantId = 1, socket.userId = 1
        Auth-->>Socket: next() — bypass
    else Production Mode
        Auth->>JWT: jwt.verify(token, JWT_SECRET)
        JWT-->>Auth: decoded = {customer_id, company_id, sub, ...}
        Auth->>Socket: socket.tenantId = decoded.customer_id
        Auth->>Socket: socket.companyId = decoded.company_id
        Auth->>Socket: socket.userId = decoded.userId
        Auth->>Socket: socket.userName = decoded.sub
        Auth-->>Socket: next()
    end
    
    Socket-->>Client: Connection established
```

---

## 6. Sequence Diagrams

### 6.1 Complete Subscription Lifecycle

```mermaid
sequenceDiagram
    participant FE as Frontend<br/>(useMarketingAgentsSocket)
    participant SS as chat-socket-service<br/>:3001
    participant MH as marketingHandler.js
    participant Room as Socket.IO Room
    participant BE as Backend Service<br/>(marketing-agent)

    Note over FE,BE: 1. Subscription Phase
    FE->>SS: socket.emit('subscribe-marketing', {tenantId: 1, companyId: 5})
    SS->>MH: handleSubscribeMarketing(socket, io)(data)
    MH->>MH: Cross-tenant validation: Number(1) === Number(socket.tenantId)
    MH->>Room: socket.join('marketing_tenant_1_company_5')
    MH-->>FE: socket.emit('subscribed-marketing', {room: 'marketing_tenant_1_company_5'})

    Note over FE,BE: 2. Real-time Event Phase
    BE->>SS: POST /api/marketing/emit {event: 'marketing-batch-update', tenantId: 1, companyId: 5, payload: {...}}
    SS->>Room: io.to('marketing_tenant_1_company_5').emit('marketing-batch-update', payload)
    Room-->>FE: socket.on('marketing-batch-update', callback)

    BE->>SS: POST /api/marketing/emit {event: 'marketing-agent-status-update', ...}
    SS->>Room: io.to('marketing_tenant_1_company_5').emit('marketing-agent-status-update', payload)
    Room-->>FE: socket.on('marketing-agent-status-update', callback)

    Note over FE,BE: 3. Unsubscription Phase
    FE->>SS: socket.emit('unsubscribe-marketing', {companyId: 5})
    SS->>MH: handleUnsubscribeMarketing(socket, io)(data)
    MH->>Room: socket.leave('marketing_tenant_1_company_5')
    MH-->>FE: socket.emit('unsubscribed-marketing', {room: 'marketing_tenant_1_company_5'})
```

### 6.2 Error Scenarios

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant SS as chat-socket-service
    participant MH as marketingHandler

    Note over FE,MH: Scenario A: Cross-Tenant Attempt
    FE->>SS: emit('subscribe-marketing', {tenantId: 99})
    SS->>MH: handleSubscribeMarketing(socket, io)
    MH->>MH: Number(99) !== Number(socket.tenantId=1) ❌
    MH-->>FE: emit('error', {message: 'Cross-tenant subscription not allowed'})
    Note over MH: logger.warn(cross-tenant attempt)

    Note over FE,MH: Scenario B: Missing tenantId on Socket
    FE->>SS: emit('subscribe-marketing', {})
    SS->>MH: handleSubscribeMarketing(socket, io)
    MH->>MH: socket.tenantId is null
    MH-->>FE: emit('error', {message: 'tenantId is required to subscribe to marketing'})

    Note over FE,MH: Scenario C: Unsubscribe without tenantId (silent)
    FE->>SS: emit('unsubscribe-marketing', {})
    SS->>MH: handleUnsubscribeMarketing(socket, io)
    MH->>MH: socket.tenantId is null → silent return
    Note over MH: No error emitted (graceful)
```

---

## 7. File Structure & Module Map

```mermaid
graph TD
    subgraph "chat-socket-service/src"
        IDX["index.js<br/>━━━━━━━━━━━━━━<br/>• Registers socket event handlers<br/>• Imports marketingHandler<br/>• subscribe-marketing → line ~272<br/>• unsubscribe-marketing → line ~279"]
        
        subgraph "handlers/"
            MH["marketingHandler.js<br/>━━━━━━━━━━━━━━<br/>• handleSubscribeMarketing<br/>• handleUnsubscribeMarketing<br/>• getMarketingRoomName<br/>• emitToMarketingRoom"]
        end

        subgraph "middleware/"
            AUTH["auth.js<br/>━━━━━━━━━━━━━━<br/>• JWT verification<br/>• Sets socket.tenantId<br/>• Sets socket.companyId<br/>• Sets socket.userId"]
        end

        subgraph "routes/"
            REST["marketing.js<br/>━━━━━━━━━━━━━━<br/>• POST /api/marketing/emit<br/>• GET /api/marketing/rooms/:tenantId<br/>• Event whitelist validation"]
        end

        subgraph "handlers/__tests__/"
            TEST["marketingHandler.test.js<br/>━━━━━━━━━━━━━━<br/>• 31 tests (8 security)<br/>• Mock socket factory<br/>• Cross-tenant validation tests"]
        end

        subgraph "routes/__tests__/"
            RTEST["marketing.test.js<br/>━━━━━━━━━━━━━━<br/>• 9 tests<br/>• REST API validation<br/>• Event whitelist tests"]
        end
    end

    AUTH --> |"sets socket.tenantId"| IDX
    IDX --> |"socket.on('subscribe-marketing')"| MH
    IDX --> |"socket.on('unsubscribe-marketing')"| MH
    REST --> |"emitToMarketingRoom()"| MH

    style MH fill:#4CAF50,stroke:#2E7D32,color:#fff
    style AUTH fill:#FF9800,stroke:#E65100,color:#fff
    style REST fill:#2196F3,stroke:#1565C0,color:#fff
    style TEST fill:#9C27B0,stroke:#6A1B9A,color:#fff
```

---

## 8. Handler Implementation Details

### 8.1 `handleSubscribeMarketing(socket, io) → (data) => void`

```
┌─────────────────────────────────────────────────────────┐
│  handleSubscribeMarketing(socket, io)                    │
│                                                          │
│  1. Extract dataTenantId, dataCompanyId from data        │
│  2. IF dataTenantId is provided:                         │
│     ├─ IF Number(dataTenantId) !== Number(socket.tenantId)│
│     │  ├─ logger.warn(cross-tenant attempt)              │
│     │  ├─ socket.emit('error', 'Cross-tenant...')        │
│     │  └─ RETURN (reject)                                │
│     └─ (continue — tenantId matches)                     │
│  3. tenantId = socket.tenantId (source of truth)         │
│  4. companyId = dataCompanyId || socket.companyId        │
│  5. IF !tenantId:                                        │
│     ├─ socket.emit('error', 'tenantId is required')      │
│     └─ RETURN                                            │
│  6. roomName = companyId ?                               │
│     ├─ marketing_tenant_{tenantId}_company_{companyId}   │
│     └─ marketing_tenant_{tenantId}                       │
│  7. socket.join(roomName)                                │
│  8. socket.emit('subscribed-marketing', {room, ...})     │
└─────────────────────────────────────────────────────────┘
```

### 8.2 `handleUnsubscribeMarketing(socket, io) → (data) => void`

```
┌─────────────────────────────────────────────────────────┐
│  handleUnsubscribeMarketing(socket, io)                  │
│                                                          │
│  1. Extract dataCompanyId from data                      │
│  2. tenantId = socket.tenantId (ALWAYS — never payload)  │
│  3. companyId = dataCompanyId || socket.companyId        │
│  4. IF !tenantId: silent return (graceful)               │
│  5. roomName = companyId ?                               │
│     ├─ marketing_tenant_{tenantId}_company_{companyId}   │
│     └─ marketing_tenant_{tenantId}                       │
│  6. socket.leave(roomName)                               │
│  7. socket.emit('unsubscribed-marketing', {room, ...})   │
└─────────────────────────────────────────────────────────┘
```

---

## 9. REST API (CLOUD-247 — Complementary)

### `POST /api/marketing/emit`

Allows backend services to emit marketing events to Socket.IO rooms via HTTP.

**Request:**
```json
{
  "event": "marketing-batch-update",
  "tenantId": 1,
  "companyId": 5,
  "payload": {
    "agents": [...],
    "connections": [...]
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "event": "marketing-batch-update",
  "room": "marketing_tenant_1_company_5",
  "timestamp": "2026-06-01T12:00:00.000Z"
}
```

**Event Whitelist:**
- `marketing-batch-update`
- `marketing-agent-status-update`
- `marketing-agent-task-update`
- `marketing-action-event`

### `GET /api/marketing/rooms/:tenantId?companyId=X`

Returns room occupancy information for debugging/monitoring.

**Response (200):**
```json
{
  "room": "marketing_tenant_1_company_5",
  "tenantId": 1,
  "companyId": 5,
  "socketCount": 3,
  "sockets": ["socket-abc", "socket-def", "socket-ghi"]
}
```

---

## 10. Test Coverage

### 10.1 Test Suite Summary

| Test Suite | Tests | Status | Focus |
|------------|-------|--------|-------|
| `marketingHandler.test.js` | 31 | ✅ PASS | Handler logic + security |
| `marketing.test.js` | 9 | ✅ PASS | REST API validation |
| `chatService.cloud239.test.js` | 5 | ✅ PASS | Existing functionality intact |
| **Total** | **45** | **✅ ALL PASS** | |

### 10.2 Security Test Matrix

```mermaid
graph TD
    subgraph "Cross-Tenant Security Tests (8 tests)"
        T1["✅ REJECT: data.tenantId ≠ socket.tenantId<br/>(number vs number)"]
        T2["✅ REJECT: data.tenantId ≠ socket.tenantId<br/>(string vs number)"]
        T3["✅ ALLOW: data.tenantId = socket.tenantId<br/>(same number)"]
        T4["✅ ALLOW: data.tenantId = socket.tenantId<br/>(string matches number)"]
        T5["✅ ALLOW: no data.tenantId<br/>(uses socket.tenantId)"]
        T6["✅ VERIFY: room uses socket.tenantId<br/>(not data.tenantId)"]
        T7["✅ VERIFY: no subscribed-marketing<br/>on cross-tenant reject"]
        T8["✅ VERIFY: unsubscribe uses<br/>socket.tenantId only"]
    end

    style T1 fill:#FFCDD2,stroke:#C62828
    style T2 fill:#FFCDD2,stroke:#C62828
    style T3 fill:#C8E6C9,stroke:#2E7D32
    style T4 fill:#C8E6C9,stroke:#2E7D32
    style T5 fill:#C8E6C9,stroke:#2E7D32
    style T6 fill:#C8E6C9,stroke:#2E7D32
    style T7 fill:#C8E6C9,stroke:#2E7D32
    style T8 fill:#C8E6C9,stroke:#2E7D32
```

### 10.3 Functional Test Categories

| Category | Tests | Description |
|----------|-------|-------------|
| `getMarketingRoomName` | 4 | Room name generation (tenant-only, tenant+company, null, large IDs) |
| `handleSubscribeMarketing` | 8 | Subscribe logic (room join, companyId fallback, confirmation) |
| Cross-tenant security | 8 | Validation of tenant ID matching and rejection |
| `handleUnsubscribeMarketing` | 6 | Unsubscribe logic (room leave, confirmation, silent fail) |
| Unsubscribe security | 1 | Uses socket.tenantId for room name |
| `emitToMarketingRoom` | 3 | Server-side emit utility |
| Round-trip integration | 3 | Subscribe→unsubscribe, multi-tenant, cross-tenant prevention |

---

## 11. Docker Integration

### 11.1 Service Configuration

The `chat-socket-service` is integrated into the Docker Compose infrastructure:

```mermaid
graph TB
    subgraph "Docker Network: app-net"
        FE["frontend<br/>:3000"]
        CSS["chat-socket-service<br/>:3001"]
        BE["backend<br/>:8080"]
    end

    subgraph "Docker Network: kafka-net"
        CSS
        KAFKA["kafka<br/>:9092"]
        ZK["zookeeper<br/>:2181"]
    end

    subgraph "Docker Network: app-net"
        MA["marketing-agent<br/>(Python)"]
        MW["marketing-worker<br/>(Python)"]
        IMO["ia-marketing-operation<br/>(Java)"]
    end

    FE -- "WSS :3001" --> CSS
    MA -- "POST /api/marketing/emit" --> CSS
    MW -- "POST /api/marketing/emit" --> CSS
    IMO -- "POST /api/marketing/emit" --> CSS
    CSS -- "Kafka producer/consumer" --> KAFKA

    style CSS fill:#4CAF50,stroke:#2E7D32,color:#fff
```

### 11.2 Health Check

```bash
curl http://localhost:3001/health
# Response: {"status":"ok","service":"chat-socket-service","timestamp":"...","uptime":12345}
```

---

## 12. Acceptance Criteria Verification

| # | Criterion | Implementation | Test | Status |
|---|-----------|---------------|------|--------|
| 1 | `subscribe-marketing` joins correct room | `socket.join(roomName)` with `getMarketingRoomName()` | 8 functional tests | ✅ |
| 2 | `unsubscribe-marketing` leaves correct room | `socket.leave(roomName)` with `getMarketingRoomName()` | 6 functional tests | ✅ |
| 3 | Server emits `subscribed-marketing` confirmation | `socket.emit('subscribed-marketing', {room, tenantId, companyId})` | Explicit test | ✅ |
| 4 | Cross-tenant subscription rejected | `Number(dataTenantId) !== Number(socket.tenantId)` → reject | 8 security tests | ✅ |
| 5 | Handlers in correct location in index.js | After `subscribe-platform`, before `disconnect` | Code review | ✅ |
| 6 | No syntax errors — service starts | `node -c src/index.js` → exit 0 | Manual verification | ✅ |
| 7 | Existing functionality NOT affected | Chat, presence, notification handlers unchanged | 5 regression tests | ✅ |

---

## 13. Related Tickets & Dependencies

```mermaid
graph LR
    C200["CLOUD-200<br/>Marketing Team Live<br/>Dashboard (Parent)"]
    C213["CLOUD-213<br/>useMarketingAgentsSocket<br/>Hook (Frontend)"]
    C243["CLOUD-243<br/>Marketing Socket<br/>Handlers (Backend)"]
    C247["CLOUD-247<br/>REST API for<br/>Marketing Events"]
    C219["CLOUD-219<br/>Marketing AI<br/>Operation Page"]

    C200 --> C213
    C200 --> C243
    C200 --> C247
    C213 -->|"emits subscribe-marketing"| C243
    C243 -->|"joins rooms"| C247
    C247 -->|"POST /emit"| C243
    C219 -->|"uses"| C213

    style C243 fill:#4CAF50,stroke:#2E7D32,color:#fff
    style C200 fill:#2196F3,stroke:#1565C0,color:#fff
    style C213 fill:#FF9800,stroke:#E65100,color:#fff
    style C247 fill:#9C27B0,stroke:#6A1B9A,color:#fff
```

---

## 14. Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Socket.IO server port |
| `NODE_ENV` | `development` | Environment (development bypasses JWT) |
| `JWT_SECRET` | — | Secret for JWT verification |
| `FRONTEND_URL` | — | Allowed CORS origin for frontend |

### Socket.IO Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| `pingTimeout` | `60000` | 60s before considering connection dead |
| `pingInterval` | `25000` | Heartbeat every 25s |
| `cors.credentials` | `true` | Allow credentials in CORS |

---

*Document generated by 🤖 Technical Writer Agent — CLOUD-243 Implementation Documentation*

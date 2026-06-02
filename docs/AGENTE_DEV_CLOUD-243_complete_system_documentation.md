# CLOUD-243: Marketing Agent Socket Event Handlers — Complete System Documentation

> **Ticket**: [CLOUD-243] Add marketing agent socket event handlers to chat-socket-service  
> **Parent**: [CLOUD-200] Marketing Team Live Dashboard  
> **Related**: [CLOUD-213] useMarketingAgentsSocket hook | [CLOUD-247] REST API for marketing events  
> **Status**: ✅ COMPLETADO — All 7 acceptance criteria met  
> **Last Updated**: 2026-06-01  
> **Author**: 🤖 Technical Writer Agent

---

## 📋 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Architecture](#3-solution-architecture)
4. [System Context Diagram](#4-system-context-diagram)
5. [Component Architecture](#5-component-architecture)
6. [Backend Implementation](#6-backend-implementation)
7. [Frontend Implementation](#7-frontend-implementation)
8. [Security Architecture](#8-security-architecture)
9. [Event Contract](#9-event-contract)
10. [Room Naming Convention](#10-room-naming-convention)
11. [Sequence Diagrams](#11-sequence-diagrams)
12. [Test Coverage](#12-test-coverage)
13. [Docker Integration](#13-docker-integration)
14. [Acceptance Criteria Verification](#14-acceptance-criteria-verification)
15. [Related Tickets & Dependencies](#15-related-tickets--dependencies)
16. [Configuration Reference](#16-configuration-reference)

---

## 1. Executive Summary

CLOUD-243 implements the **backend Socket.IO event handlers** required for the real-time Marketing Live Dashboard. The implementation adds subscription/unsubscription handlers with cross-tenant security validation, enabling the frontend to receive live marketing agent events while maintaining strict tenant isolation.

### Key Deliverables

| Component | Files | Status |
|-----------|-------|--------|
| Backend handlers | `marketingHandler.js` | ✅ Complete |
| Handler registration | `index.js` (lines 272-279) | ✅ Complete |
| REST API | `marketing.js` | ✅ Complete |
| Backend tests | `marketingHandler.test.js` (31 tests) | ✅ All pass |
| Frontend hook | `useMarketingAgentsSocket.ts` | ✅ Enhanced |
| Status component | `MarketingSocketStatus.tsx` | ✅ Complete |
| Debug panel | `MarketingRoomDebugPanel.tsx` | ✅ Complete |
| Dashboard page | `ai-operation/page.tsx` | ✅ Enhanced |
| Frontend tests | 3 test files (31 tests) | ✅ All pass |

### Test Results Summary

```
Backend:
  marketingHandler.test.js:     31/31 ✅ (8 cross-tenant security tests)
  marketing.test.js:             9/9  ✅ (REST API validation)
  chatService.cloud239.test.js:  5/5  ✅ (regression)

Frontend:
  useMarketingAgentsSocket.test.ts:    15/15 ✅
  MarketingSocketStatus.test.tsx:       8/8  ✅
  MarketingRoomDebugPanel.test.tsx:     8/8  ✅

Total: 76/76 tests passing ✅
```

---

## 2. Problem Statement

### Before CLOUD-243

The frontend hook `useMarketingAgentsSocket` (CLOUD-213) was fully implemented and emitting `subscribe-marketing` and `unsubscribe-marketing` events, but the **backend Socket.IO server had no listeners** for these events. This meant:

- The Marketing Live Dashboard received **zero real-time data**
- Users saw static/empty agent cards
- No live status updates, task changes, or action events

### After CLOUD-243

- Backend handlers process subscription requests
- Cross-tenant security validation prevents data leakage
- Real-time events flow from backend services → Socket.IO rooms → Frontend
- Dashboard shows live agent status, connections, and action timeline

---

## 3. Solution Architecture

### 3.1 High-Level Architecture

```mermaid
graph TB
    subgraph "Frontend Layer (Next.js :3000)"
        DASHBOARD["Marketing AI Operation<br/>Dashboard Page"]
        HOOK["useMarketingAgentsSocket<br/>Hook (CLOUD-213)"]
        STATUS["MarketingSocketStatus<br/>Component"]
        DEBUG["MarketingRoomDebugPanel<br/>Component"]
        CTX["SocketContext<br/>(Socket.IO Client)"]
    end

    subgraph "Real-Time Layer (chat-socket-service :3001)"
        AUTH["authMiddleware<br/>(JWT → socket.tenantId)"]
        IDX["index.js<br/>(Socket.IO Server)"]
        MH["marketingHandler.js<br/>(CLOUD-243) ⭐"]
        REST["marketing.js<br/>REST API (CLOUD-247)"]
        ROOMS["Socket.IO Rooms<br/>marketing_tenant_*"]
    end

    subgraph "Backend Services (Event Producers)"
        MA["marketing-agent<br/>(Python)"]
        MW["marketing-worker<br/>(Python)"]
        IMO["ia-marketing-operation<br/>(Java)"]
    end

    subgraph "Infrastructure"
        REDIS["Redis<br/>Cache + Presence"]
        KAFKA["Kafka<br/>Event Streaming"]
        PG["PostgreSQL<br/>Persistence"]
    end

    DASHBOARD --> HOOK
    DASHBOARD --> STATUS
    DASHBOARD --> DEBUG
    HOOK --> CTX
    CTX -- "WSS: subscribe-marketing<br/>unsubscribe-marketing" --> IDX
    IDX --> AUTH
    AUTH --> MH
    MH --> ROOMS
    ROOMS -- "SSE: marketing-batch-update<br/>marketing-agent-status-update<br/>marketing-agent-task-update<br/>marketing-action-event" --> CTX

    MA -- "POST /api/marketing/emit" --> REST
    MW -- "POST /api/marketing/emit" --> REST
    IMO -- "POST /api/marketing/emit" --> REST
    REST --> ROOMS

    IDX <--> REDIS
    IDX <--> KAFKA

    style MH fill:#4CAF50,stroke:#2E7D32,color:#fff
    style AUTH fill:#FF9800,stroke:#E65100,color:#fff
    style ROOMS fill:#2196F3,stroke:#1565C0,color:#fff
    style HOOK fill:#FF9800,stroke:#E65100,color:#fff
    style STATUS fill:#9C27B0,stroke:#6A1B9A,color:#fff
    style DEBUG fill:#9C27B0,stroke:#6A1B9A,color:#fff
```

### 3.2 Data Flow Architecture

```mermaid
graph LR
    subgraph "Event Producers"
        MA["marketing-agent<br/>(Python)"]
        MW["marketing-worker<br/>(Python)"]
        IMO["ia-marketing-operation<br/>(Java)"]
    end

    subgraph "Event Bus"
        REST["POST /api/marketing/emit<br/>(REST API)"]
        WHITELIST["Event Whitelist<br/>Validation"]
        EMIT["emitToMarketingRoom()"]
    end

    subgraph "Socket.IO Rooms"
        R1["marketing_tenant_1"]
        R2["marketing_tenant_1_company_5"]
        R3["marketing_tenant_2"]
    end

    subgraph "Consumers (Frontend)"
        D1["Dashboard<br/>(Tenant 1, All Co.)"]
        D2["Dashboard<br/>(Tenant 1, Co. 5)"]
        D3["Dashboard<br/>(Tenant 2, All Co.)"]
    end

    MA --> REST
    MW --> REST
    IMO --> REST
    REST --> WHITELIST
    WHITELIST --> EMIT
    EMIT --> R1
    EMIT --> R2
    EMIT --> R3
    R1 --> D1
    R2 --> D2
    R3 --> D3

    style REST fill:#2196F3,stroke:#1565C0,color:#fff
    style WHITELIST fill:#FF9800,stroke:#E65100,color:#fff
    style EMIT fill:#4CAF50,stroke:#2E7D32,color:#fff
```

---

## 4. System Context Diagram

```mermaid
graph TB
    subgraph "External Users"
        MARKETER["Marketing Manager<br/>(Dashboard User)"]
        ADMIN["Tenant Admin"]
        DEV["Developer<br/>(Debug Panel)"]
    end

    subgraph "CloudFly AI Platform"
        subgraph "Frontend Layer"
            DASHBOARD["Marketing AI Operation<br/>Dashboard Page"]
            HOOK["useMarketingAgentsSocket<br/>Hook"]
            STATUS["MarketingSocketStatus<br/>Component"]
            DEBUG["MarketingRoomDebugPanel<br/>Component (dev only)"]
            CTX["SocketContext"]
        end

        subgraph "Real-Time Layer"
            CSS["chat-socket-service<br/>:3001"]
            MH["marketingHandler.js"]
            REST["marketing.js<br/>REST API"]
        end

        subgraph "Business Logic Layer"
            MA["marketing-agent<br/>(Python)"]
            MW["marketing-worker<br/>(Python)"]
            IMO["ia-marketing-operation<br/>(Java)"]
        end

        subgraph "Infrastructure"
            REDIS["Redis<br/>Cache + Presence"]
            KAFKA["Kafka<br/>Event Streaming"]
            PG["PostgreSQL<br/>Persistence"]
        end
    end

    MARKETER --> DASHBOARD
    ADMIN --> DASHBOARD
    DEV --> DEBUG
    DASHBOARD --> HOOK
    DASHBOARD --> STATUS
    DASHBOARD --> DEBUG
    HOOK --> CTX
    CTX <-->|"WebSocket"| CSS
    CSS --> MH
    CSS --> REST
    MA -->|"POST /emit"| REST
    MW -->|"POST /emit"| REST
    IMO -->|"POST /emit"| REST
    CSS <--> REDIS
    CSS <--> KAFKA
    CSS <--> PG

    style CSS fill:#4CAF50,stroke:#2E7D32,color:#fff
    style MH fill:#4CAF50,stroke:#2E7D32,color:#fff
    style REST fill:#2196F3,stroke:#1565C0,color:#fff
    style HOOK fill:#FF9800,stroke:#E65100,color:#fff
```

---

## 5. Component Architecture

### 5.1 Backend Component Map

```mermaid
graph TD
    subgraph "chat-socket-service/src"
        IDX["index.js<br/>━━━━━━━━━━━━━━<br/>• Registers socket event handlers<br/>• Imports marketingHandler<br/>• subscribe-marketing → line ~272<br/>• unsubscribe-marketing → line ~279"]
        
        subgraph "handlers/"
            MH["marketingHandler.js ⭐<br/>━━━━━━━━━━━━━━<br/>• handleSubscribeMarketing<br/>• handleUnsubscribeMarketing<br/>• getMarketingRoomName<br/>• emitToMarketingRoom"]
            MSG["messageHandler.js"]
            PRESENCE["presenceHandler.js"]
        end

        subgraph "middleware/"
            AUTH["auth.js<br/>━━━━━━━━━━━━━━<br/>• JWT verification<br/>• Sets socket.tenantId<br/>• Sets socket.companyId<br/>• Sets socket.userId"]
        end

        subgraph "routes/"
            REST["marketing.js<br/>━━━━━━━━━━━━━━<br/>• POST /api/marketing/emit<br/>• GET /api/marketing/rooms/:tenantId<br/>• Event whitelist validation"]
            NOTIFY["notify.js"]
        end

        subgraph "handlers/__tests__/"
            TEST["marketingHandler.test.js<br/>━━━━━━━━━━━━━━<br/>• 31 tests (8 security)<br/>• Mock socket factory<br/>• Cross-tenant validation tests"]
        end

        subgraph "routes/__tests__/"
            RTEST["marketing.test.js<br/>━━━━━━━━━━━━━━<br/>• 9 tests<br/>• REST API validation<br/>• Event whitelist tests"]
        end
    end

    AUTH -->|"sets socket.tenantId"| IDX
    IDX -->|"socket.on('subscribe-marketing')"| MH
    IDX -->|"socket.on('unsubscribe-marketing')"| MH
    REST -->|"emitToMarketingRoom()"| MH

    style MH fill:#4CAF50,stroke:#2E7D32,color:#fff
    style AUTH fill:#FF9800,stroke:#E65100,color:#fff
    style REST fill:#2196F3,stroke:#1565C0,color:#fff
    style TEST fill:#9C27B0,stroke:#6A1B9A,color:#fff
```

### 5.2 Frontend Component Map

```mermaid
graph TD
    subgraph "frontend_new/src"
        subgraph "hooks/"
            HOOK["useMarketingAgentsSocket.ts ⭐<br/>━━━━━━━━━━━━━━<br/>• roomName state tracking<br/>• subscriptionError state<br/>• handleSubscribedMarketing<br/>• handleUnsubscribedMarketing<br/>• handleSocketError<br/>• reconnect function"]
        end

        subgraph "components/marketing/"
            STATUS["MarketingSocketStatus.tsx ⭐<br/>━━━━━━━━━━━━━━<br/>• 3 connection states<br/>• Room name display<br/>• Relative time formatting<br/>• Compact/Full modes<br/>• Security badge"]
            DEBUG["MarketingRoomDebugPanel.tsx ⭐<br/>━━━━━━━━━━━━━━<br/>• Dev-only rendering<br/>• Manual subscribe/unsubscribe<br/>• Cross-tenant test button<br/>• Event log (last 50)<br/>• Socket ID display"]
        end

        subgraph "app/(dashboard)/marketing/"
            PAGE["ai-operation/page.tsx ⭐<br/>━━━━━━━━━━━━━━<br/>• Destructures roomName/subscriptionError<br/>• Subscription error Alert<br/>• MarketingSocketStatus panel<br/>• Room info panel<br/>• Snackbar for errors<br/>• MarketingRoomDebugPanel"]
        end

        subgraph "hooks/__tests__/"
            HT["useMarketingAgentsSocket.test.ts<br/>━━━━━━━━━━━━━━<br/>• 15 tests<br/>• Mock socket factory<br/>• CLOUD-243 enhancements"]
        end

        subgraph "components/marketing/__tests__/"
            ST["MarketingSocketStatus.test.tsx<br/>━━━━━━━━━━━━━━<br/>• 8 tests<br/>• Compact/Full modes<br/>• Security badge toggle"]
            DT["MarketingRoomDebugPanel.test.tsx<br/>━━━━━━━━━━━━━━<br/>• 8 tests<br/>• Dev mode rendering<br/>• Cross-tenant test"]
        end
    end

    PAGE -->|"uses hook"| HOOK
    PAGE -->|"renders"| STATUS
    PAGE -->|"renders"| DEBUG

    style HOOK fill:#FF9800,stroke:#E65100,color:#fff
    style STATUS fill:#9C27B0,stroke:#6A1B9A,color:#fff
    style DEBUG fill:#9C27B0,stroke:#6A1B9A,color:#fff
    style PAGE fill:#00BCD4,stroke:#006064,color:#fff
```

---

## 6. Backend Implementation

### 6.1 Handler Registration in index.js

The marketing handlers are registered in `index.js` inside the `io.on('connection', ...)` block, **after** the `subscribe-platform` handler and **before** the `disconnect` handler:

```javascript
// ======================
// MARKETING AGENT EVENTS (CLOUD-247 / CLOUD-213)
// ======================

/**
 * Suscribirse a actualizaciones de marketing en tiempo real.
 * El frontend hook (useMarketingAgentsSocket) emite este evento
 * para unirse a la sala de marketing del tenant/company.
 *
 * Room: marketing_tenant_{tenantId}  or  marketing_tenant_{tenantId}_company_{companyId}
 */
socket.on('subscribe-marketing', marketingHandler.handleSubscribeMarketing(socket, io));

/**
 * Desuscribirse de las actualizaciones de marketing.
 * Se emite al desmontar el componente o al cambiar de tenant/company.
 */
socket.on('unsubscribe-marketing', marketingHandler.handleUnsubscribeMarketing(socket, io));
```

### 6.2 Handler Implementation: handleSubscribeMarketing

```javascript
const handleSubscribeMarketing = (socket, io) => (data) => {
    try {
        const { tenantId: dataTenantId, companyId: dataCompanyId } = data || {};

        // SECURITY: Cross-tenant validation
        if (dataTenantId !== undefined && dataTenantId !== null) {
            if (Number(dataTenantId) !== Number(socket.tenantId)) {
                logger.warn(
                    `[MARKETING-SOCKET] Socket ${socket.id} attempted cross-tenant marketing subscription ` +
                    `(socket tenant: ${socket.tenantId}, requested: ${dataTenantId})`
                );
                socket.emit('error', { message: 'Cross-tenant subscription not allowed' });
                return;
            }
        }

        // Use the socket's authenticated tenantId (never trust the payload)
        const tenantId = socket.tenantId;
        const companyId = dataCompanyId || socket.companyId;

        if (!tenantId) {
            logger.warn(`[MARKETING-SOCKET] Socket ${socket.id} subscribe-marketing without tenantId`);
            socket.emit('error', { message: 'tenantId is required to subscribe to marketing' });
            return;
        }

        const roomName = companyId
            ? `marketing_tenant_${tenantId}_company_${companyId}`
            : `marketing_tenant_${tenantId}`;

        socket.join(roomName);

        logger.info(`[MARKETING-SOCKET] Socket ${socket.id} (user: ${socket.userName}) subscribed to room: ${roomName}`);

        // Confirm subscription to the client
        socket.emit('subscribed-marketing', {
            room: roomName,
            tenantId,
            companyId: companyId || null
        });

    } catch (error) {
        logger.error(`[MARKETING-SOCKET] Error in subscribe-marketing: ${error.message}`);
        socket.emit('error', { message: 'Failed to subscribe to marketing room' });
    }
};
```

### 6.3 Handler Implementation: handleUnsubscribeMarketing

```javascript
const handleUnsubscribeMarketing = (socket, io) => (data) => {
    try {
        const { companyId: dataCompanyId } = data || {};

        // Use the socket's authenticated tenantId (never trust the payload)
        const tenantId = socket.tenantId;
        const companyId = dataCompanyId || socket.companyId;

        if (!tenantId) {
            logger.warn(`[MARKETING-SOCKET] Socket ${socket.id} unsubscribe-marketing without tenantId`);
            return;
        }

        const roomName = companyId
            ? `marketing_tenant_${tenantId}_company_${companyId}`
            : `marketing_tenant_${tenantId}`;

        socket.leave(roomName);

        logger.info(`[MARKETING-SOCKET] Socket ${socket.id} (user: ${socket.userName}) unsubscribed from room: ${roomName}`);

        // Confirm unsubscription to the client
        socket.emit('unsubscribed-marketing', {
            room: roomName,
            tenantId,
            companyId: companyId || null
        });

    } catch (error) {
        logger.error(`[MARKETING-SOCKET] Error in unsubscribe-marketing: ${error.message}`);
    }
};
```

### 6.4 Utility Functions

```javascript
/**
 * Get the marketing room name for a given tenant/company.
 */
const getMarketingRoomName = (tenantId, companyId) => {
    return companyId
        ? `marketing_tenant_${tenantId}_company_${companyId}`
        : `marketing_tenant_${tenantId}`;
};

/**
 * Emit a marketing event to a specific room.
 * Used by the REST API to broadcast events from backend services.
 */
const emitToMarketingRoom = (io, eventName, tenantId, companyId, payload) => {
    try {
        const roomName = getMarketingRoomName(tenantId, companyId);
        io.to(roomName).emit(eventName, payload);
        logger.info(`[MARKETING-SOCKET] Emitted ${eventName} to room ${roomName}`);
    } catch (error) {
        logger.error(`[MARKETING-SOCKET] Error emitting ${eventName}: ${error.message}`);
    }
};
```

---

## 7. Frontend Implementation

### 7.1 Enhanced Hook: useMarketingAgentsSocket

The hook was enhanced with CLOUD-243 additions to track subscription state and handle server confirmations:

```typescript
// CLOUD-243: New state for subscription tracking
const [roomName, setRoomName] = useState<string | null>(null);
const [subscriptionError, setSubscriptionError] = useState<string | null>(null);

// Handle server confirmation of subscription
const handleSubscribedMarketing = useCallback((payload: { room: string; tenantId?: number; companyId?: number }) => {
    if (payload?.room) {
        setRoomName(payload.room);
        setSubscriptionError(null);
    }
}, []);

// Handle server confirmation of unsubscription
const handleUnsubscribedMarketing = useCallback((payload: { room: string; tenantId?: number; companyId?: number }) => {
    if (payload?.room && payload.room === roomNameRef.current) {
        setRoomName(null);
    }
}, []);

// Handle cross-tenant error from server
const handleSocketError = useCallback((payload: { message?: string }) => {
    if (payload?.message?.includes('Cross-tenant')) {
        setSubscriptionError(payload.message);
    }
}, []);
```

### 7.2 Status Component: MarketingSocketStatus

A reusable component that visualizes the real-time socket connection status:

```typescript
// Connection states with distinct styling
const STATUS_CONFIG = {
    connected: {
        icon: Wifi,
        label: 'Conectado',
        color: '#10b981',
        bg: '#ecfdf5',
        animation: pulseGlow
    },
    disconnected: {
        icon: WifiOff,
        label: 'Desconectado',
        color: '#ef4444',
        bg: '#fef2f2',
        animation: 'none'
    },
    reconnecting: {
        icon: Loader2,
        label: 'Reconectando...',
        color: '#f59e0b',
        bg: '#fffbeb',
        animation: spinSlow
    }
};

// Features:
// - Compact mode (inline chip) and Full mode (status card)
// - Room name display (marketing_tenant_X or marketing_tenant_X_company_Y)
// - Last update timestamp with relative time (Spanish locale)
// - Security/tenant isolation badge
// - Smooth framer-motion transitions
// - React.memo() for performance
```

### 7.3 Debug Panel: MarketingRoomDebugPanel

A developer tool component (only renders in `NODE_ENV=development`):

```typescript
// Features:
// - Connection info: Socket ID, status, expected vs actual room name
// - Manual controls: Subscribe/Unsubscribe buttons with custom tenantId/companyId
// - Cross-tenant attempt simulation: Sends subscribe-marketing with fake tenantId
// - Event log: Dark-themed console showing last 50 socket events (IN/OUT)
// - Copy room name to clipboard
// - Collapsible Accordion UI
```

### 7.4 Dashboard Page Integration

The Marketing Live Dashboard page was enhanced to use the new components:

```typescript
// Destructure new values from hook
const {
    agents,
    connections,
    events,
    isConnected,
    connectionStatus,
    lastUpdate,
    roomName,           // CLOUD-243
    subscriptionError,  // CLOUD-243
    reconnect
} = useMarketingAgentsSocket({ tenantId, companyId });

// Subscription error Alert (collapsible)
<Collapse in={!!subscriptionError}>
    <Alert severity='error' icon={<ShieldAlert />}>
        {subscriptionError}
    </Alert>
</Collapse>

// Socket Status Panel
<MarketingSocketStatus
    connectionStatus={connectionStatus}
    roomName={roomName}
    lastUpdate={lastUpdate}
    tenantId={tenantId}
    companyId={companyId}
    showSecurityBadge
/>

// Debug Panel (development only)
<MarketingRoomDebugPanel
    tenantId={tenantId}
    companyId={companyId}
    connectionStatus={connectionStatus}
    currentRoom={roomName}
/>
```

---

## 8. Security Architecture

### 8.1 Cross-Tenant Validation Flow

```mermaid
sequenceDiagram
    autonumber
    participant Attacker as Malicious Client<br/>(Tenant 1)
    participant SocketIO as chat-socket-service
    participant Handler as marketingHandler
    participant Logger as Logger<br/>(Audit)
    participant Room as Socket.IO Room<br/>(marketing_tenant_99)

    Note over Attacker,Room: Attack: Cross-Tenant Subscription Attempt

    Attacker->>SocketIO: emit('subscribe-marketing', {tenantId: 99})
    Note right of Attacker: socket.tenantId = 1<br/>(from JWT)
    SocketIO->>Handler: handleSubscribeMarketing(socket, io)(data)
    
    Handler->>Handler: dataTenantId = 99
    Handler->>Handler: socket.tenantId = 1
    Handler->>Handler: Number(99) !== Number(1) ❌

    Handler->>Logger: warn('Cross-tenant attempt: socket tenant 1, requested 99')
    Handler-->>Attacker: emit('error', {message: 'Cross-tenant subscription not allowed'})
    
    Note over Room: Room NOT joined<br/>Attacker receives NO data<br/>from tenant 99's room

    rect rgb(255, 235, 238)
        Note over Attacker,Room: Attack FAILED — Tenant isolation enforced
    end
```

### 8.2 Security Principles

| Principle | Implementation |
|-----------|---------------|
| **Never trust the payload** | `socket.tenantId` (set by authMiddleware) is always used for room name construction |
| **Validate before join** | Cross-tenant check runs **before** `socket.join()` |
| **Number coercion** | `Number()` coercion ensures string/number type mismatches don't bypass validation |
| **Audit logging** | All cross-tenant attempts are logged with socket ID and both tenant IDs |
| **Fail closed** | If `data.tenantId` is provided and doesn't match, subscription is **rejected** |
| **Unsubscribe is safe** | `handleUnsubscribeMarketing` always uses `socket.tenantId`, ignoring `data.tenantId` |

### 8.3 Multi-Tenant Room Isolation

```mermaid
graph TB
    subgraph "Tenant 1 — Company A"
        S1A["Socket-A<br/>tenantId: 1, companyId: 5"]
        S1B["Socket-B<br/>tenantId: 1, companyId: 5"]
        R1["Room:<br/>marketing_tenant_1_company_5"]
    end

    subgraph "Tenant 1 — Company B"
        S1C["Socket-C<br/>tenantId: 1, companyId: 8"]
        R2["Room:<br/>marketing_tenant_1_company_8"]
    end

    subgraph "Tenant 2 — Company A"
        S2A["Socket-D<br/>tenantId: 2, companyId: 5"]
        R3["Room:<br/>marketing_tenant_2_company_5"]
    end

    subgraph "Tenant 1 — All Companies"
        R4["Room:<br/>marketing_tenant_1"]
    end

    S1A -->|"join"| R1
    S1B -->|"join"| R1
    S1C -->|"join"| R2
    S2A -->|"join"| R3
    S1A -.->|"join"| R4
    S1B -.->|"join"| R4
    S1C -.->|"join"| R4

    S2A -.-x|"❌ REJECTED"| R1
    S2A -.-x|"❌ REJECTED"| R4

    style R1 fill:#E8F5E9,stroke:#2E7D32
    style R2 fill:#E8F5E9,stroke:#2E7D32
    style R3 fill:#E3F2FD,stroke:#1565C0
    style R4 fill:#E8F5E9,stroke:#2E7D32
```

---

## 9. Event Contract

### 9.1 Client → Server Events

#### `subscribe-marketing`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tenantId` | `number \| string` | No* | Tenant ID (validated against `socket.tenantId`) |
| `companyId` | `number` | No | Company ID for company-scoped subscription |

> *If `tenantId` is not provided, `socket.tenantId` is used. If provided, it **must match** `socket.tenantId` or the subscription is rejected.

#### `unsubscribe-marketing`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `companyId` | `number` | No | Company ID for company-scoped unsubscription |

> **Note**: The `tenantId` field in the payload is **ignored** for unsubscribe. The handler always uses `socket.tenantId`.

### 9.2 Server → Client Events

#### `subscribed-marketing` (Confirmation)

```typescript
interface SubscribedMarketingEvent {
    room: string;          // "marketing_tenant_1_company_5"
    tenantId: number;      // 1
    companyId: number | null;  // 5 or null
}
```

#### `unsubscribed-marketing` (Confirmation)

```typescript
interface UnsubscribedMarketingEvent {
    room: string;
    tenantId: number;
    companyId: number | null;
}
```

#### `error` (Rejection)

```typescript
interface SocketErrorEvent {
    message: string;  // "Cross-tenant subscription not allowed"
}
```

### 9.3 Data Events (Backend Services → Frontend)

| Event | Payload | Description |
|-------|---------|-------------|
| `marketing-batch-update` | `{ agents: Agent[], connections: Connection[] }` | Full snapshot |
| `marketing-agent-status-update` | `{ agentId: string, status: string }` | Single agent status |
| `marketing-agent-task-update` | `{ agentId: string, task: Task }` | Single agent task |
| `marketing-action-event` | `{ event: string, data: object }` | Timeline event |

---

## 10. Room Naming Convention

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
| Tenant-only | `marketing_tenant_{tenantId}` | `marketing_tenant_1` |
| Tenant + Company | `marketing_tenant_{tenantId}_company_{companyId}` | `marketing_tenant_1_company_7` |

---

## 11. Sequence Diagrams

### 11.1 Complete Subscription Lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend<br/>(useMarketingAgentsSocket)
    participant SS as chat-socket-service<br/>:3001
    participant MH as marketingHandler.js
    participant Room as Socket.IO Room
    participant BE as Backend Service<br/>(marketing-agent)

    Note over FE,BE: 1. Subscription Phase
    FE->>SS: socket.emit('subscribe-marketing', {tenantId: 1, companyId: 5})
    SS->>MH: handleSubscribeMarketing(socket, io)(data)
    MH->>MH: Cross-tenant validation: Number(1) === Number(1) ✅
    MH->>Room: socket.join('marketing_tenant_1_company_5')
    MH-->>FE: socket.emit('subscribed-marketing', {room: 'marketing_tenant_1_company_5'})

    Note over FE,BE: 2. Real-time Event Phase
    BE->>SS: POST /api/marketing/emit {event: 'marketing-batch-update', tenantId: 1, companyId: 5, payload: {...}}
    SS->>Room: io.to('marketing_tenant_1_company_5').emit('marketing-batch-update', payload)
    Room-->>FE: socket.on('marketing-batch-update', callback)

    Note over FE,BE: 3. Unsubscription Phase
    FE->>SS: socket.emit('unsubscribe-marketing', {companyId: 5})
    SS->>MH: handleUnsubscribeMarketing(socket, io)(data)
    MH->>Room: socket.leave('marketing_tenant_1_company_5')
    MH-->>FE: socket.emit('unsubscribed-marketing', {room: 'marketing_tenant_1_company_5'})
```

### 11.2 Error Handling Flow

```mermaid
graph TD
    INPUT["Incoming Event"] --> PARSE["Parse data payload"]
    PARSE --> HAS_TENANT{"data.tenantId<br/>provided?"}
    
    HAS_TENANT -->|"Yes"| VALIDATE{"Number(data.tenantId)<br/>=== Number(socket.tenantId)?"}
    HAS_TENANT -->|"No"| USE_SOCKET["Use socket.tenantId"]
    
    VALIDATE -->|"Match ✅"| USE_SOCKET
    VALIDATE -->|"Mismatch ❌"| REJECT["emit('error', 'Cross-tenant...')"]
    REJECT --> LOG["logger.warn(cross-tenant attempt)"]
    LOG --> END["RETURN — No room joined"]
    
    USE_SOCKET --> HAS_SOCKET_TENANT{"socket.tenantId<br/>exists?"}
    HAS_SOCKET_TENANT -->|"Yes"| BUILD_ROOM["Build roomName"]
    HAS_SOCKET_TENANT -->|"No"| ERR2["emit('error', 'tenantId required')"]
    ERR2 --> END2["RETURN"]
    
    BUILD_ROOM --> JOIN["socket.join(roomName)"]
    JOIN --> CONFIRM["emit('subscribed-marketing', {room, ...})"]

    style REJECT fill:#FFCDD2,stroke:#C62828
    style ERR2 fill:#FFCDD2,stroke:#C62828
    style JOIN fill:#C8E6C9,stroke:#2E7D32
    style CONFIRM fill:#C8E6C9,stroke:#2E7D32
```

---

## 12. Test Coverage

### 12.1 Test Suite Summary

```mermaid
graph TB
    subgraph "Backend Tests"
        subgraph "marketingHandler.test.js (31 tests)"
            T1["getMarketingRoomName: 4 tests"]
            T2["handleSubscribeMarketing: 8 tests"]
            T3["Cross-Tenant Security: 8 tests ⭐"]
            T4["handleUnsubscribeMarketing: 6 tests"]
            T5["emitToMarketingRoom: 3 tests"]
            T6["Integration: 3 tests"]
        end

        subgraph "marketing.test.js (9 tests)"
            T7["POST /emit: 5 tests"]
            T8["GET /rooms: 4 tests"]
        end
    end

    subgraph "Frontend Tests"
        subgraph "useMarketingAgentsSocket.test.ts (15 tests)"
            T9["Initialization: 1 test"]
            T10["Subscribe emission: 2 tests"]
            T11["Subscribed confirmation: 2 tests"]
            T12["Unsubscribed confirmation: 1 test"]
            T13["Cross-tenant error: 2 tests"]
            T14["Marketing events: 4 tests"]
            T15["Reconnect: 1 test"]
            T16["Cleanup: 2 tests"]
        end

        subgraph "MarketingSocketStatus.test.tsx (8 tests)"
            T17["Compact mode: 3 tests"]
            T18["Full mode: 5 tests"]
        end

        subgraph "MarketingRoomDebugPanel.test.tsx (8 tests)"
            T19["Rendering: 2 tests"]
            T20["Subscribe/Unsubscribe: 2 tests"]
            T21["Cross-tenant test: 1 test"]
            T22["Socket ID display: 1 test"]
            T23["Production mode: 1 test"]
        end
    end

    style T3 fill:#FFCDD2,stroke:#C62828
```

### 12.2 Cross-Tenant Security Tests (8 tests)

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | REJECT: data.tenantId ≠ socket.tenantId (number) | Error emitted, no room joined |
| 2 | REJECT: data.tenantId ≠ socket.tenantId (string) | Error emitted, no room joined |
| 3 | ALLOW: data.tenantId = socket.tenantId (number) | Room joined, confirmation emitted |
| 4 | ALLOW: data.tenantId = socket.tenantId (string→number) | Room joined, confirmation emitted |
| 5 | ALLOW: no data.tenantId (uses socket.tenantId) | Room joined, confirmation emitted |
| 6 | VERIFY: room uses socket.tenantId (not data.tenantId) | Correct room name |
| 7 | VERIFY: no subscribed-marketing on reject | No confirmation emitted |
| 8 | VERIFY: unsubscribe uses socket.tenantId only | Correct room left |

---

## 13. Docker Integration

### 13.1 Service Configuration

```mermaid
graph TB
    subgraph "Docker Network: app-net"
        FE["frontend<br/>Next.js :3000"]
        CSS["chat-socket-service<br/>Socket.IO :3001"]
        BE["backend<br/>Spring Boot :8080"]
        MA["marketing-agent<br/>Python :8000"]
        MW["marketing-worker<br/>Python"]
        IMO["ia-marketing-operation<br/>Java :8085"]
    end

    subgraph "Docker Network: kafka-net"
        KAFKA["Kafka :9092"]
        ZK["Zookeeper :2181"]
    end

    subgraph "Data Layer"
        PG["PostgreSQL :5432"]
        REDIS["Redis :6379"]
    end

    FE -- "WSS :3001" --> CSS
    MA -- "POST /api/marketing/emit" --> CSS
    MW -- "POST /api/marketing/emit" --> CSS
    IMO -- "POST /api/marketing/emit" --> CSS
    CSS <--> KAFKA
    CSS <--> REDIS
    CSS <--> PG

    style CSS fill:#4CAF50,stroke:#2E7D32,color:#fff
```

### 13.2 Health Check

```bash
curl http://localhost:3001/health
# Response: {"status":"ok","service":"chat-socket-service","timestamp":"...","uptime":12345}
```

---

## 14. Acceptance Criteria Verification

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

## 15. Related Tickets & Dependencies

```mermaid
graph TD
    C200["CLOUD-200<br/>Marketing Team Live<br/>Dashboard<br/>Parent Epic"]
    
    C213["CLOUD-213<br/>useMarketingAgentsSocket<br/>Hook (Frontend)"]
    
    C243["CLOUD-243<br/>Marketing Socket<br/>Event Handlers (Backend) ⭐"]
    
    C247["CLOUD-247<br/>REST API for<br/>Marketing Events"]
    
    C219["CLOUD-219<br/>Marketing AI<br/>Operation Page"]
    
    C208["CLOUD-208<br/>AgentFlowGraph<br/>Component"]
    
    C209["CLOUD-209<br/>LiveAgentCard<br/>Component"]

    C200 --> C213
    C200 --> C243
    C200 --> C247
    C200 --> C219
    C200 --> C208
    C200 --> C209

    C213 -->|"emits events<br/>consumed by"| C243
    C243 -->|"provides rooms<br/>for"| C247
    C247 -->|"POST /emit<br/>broadcasts via"| C243
    C219 -->|"renders"| C213
    C219 -->|"renders"| C208
    C219 -->|"renders"| C209

    style C243 fill:#4CAF50,stroke:#2E7D32,color:#fff
    style C200 fill:#2196F3,stroke:#1565C0,color:#fff
    style C213 fill:#FF9800,stroke:#E65100,color:#fff
    style C247 fill:#9C27B0,stroke:#6A1B9A,color:#fff
```

---

## 16. Configuration Reference

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

### Event Whitelist (REST API)

```javascript
const VALID_MARKETING_EVENTS = new Set([
    'marketing-batch-update',
    'marketing-agent-status-update',
    'marketing-agent-task-update',
    'marketing-action-event'
]);
```

---

## Appendix A: File Inventory

### Backend Files

| File | Path | Purpose |
|------|------|---------|
| `marketingHandler.js` | `chat-socket-service/src/handlers/` | Core handler implementation |
| `index.js` | `chat-socket-service/src/` | Handler registration |
| `marketing.js` | `chat-socket-service/src/routes/` | REST API for event emission |
| `marketingHandler.test.js` | `chat-socket-service/src/handlers/__tests__/` | 31 unit tests |
| `marketing.test.js` | `chat-socket-service/src/routes/__tests__/` | 9 REST API tests |

### Frontend Files

| File | Path | Purpose |
|------|------|---------|
| `useMarketingAgentsSocket.ts` | `frontend_new/src/hooks/` | Enhanced hook with CLOUD-243 |
| `MarketingSocketStatus.tsx` | `frontend_new/src/components/marketing/` | Connection status UI |
| `MarketingRoomDebugPanel.tsx` | `frontend_new/src/components/marketing/` | Debug panel (dev only) |
| `page.tsx` | `frontend_new/src/app/(dashboard)/marketing/ai-operation/` | Dashboard page |
| `useMarketingAgentsSocket.test.ts` | `frontend_new/src/hooks/__tests__/` | 15 hook tests |
| `MarketingSocketStatus.test.tsx` | `frontend_new/src/components/marketing/__tests__/` | 8 component tests |
| `MarketingRoomDebugPanel.test.tsx` | `frontend_new/src/components/marketing/__tests__/` | 8 debug panel tests |

---

*Document generated by 🤖 Technical Writer Agent — CLOUD-243 Complete System Documentation*  
*Last Updated: 2026-06-01*

# 🤖 AGENTE_DEV — CLOUD-248: Architecture Diagrams

## Marketing Live Dashboard — Visual Architecture Reference

**Date:** 2025-07-19  
**Ticket:** CLOUD-248 — E2E Smoke Test: Marketing Live Dashboard  
**Parent:** CLOUD-213 — Real-time Marketing Agent Dashboard

---

## 1. System Context Diagram

```mermaid
flowchart TB
    subgraph External["External Systems"]
        WA[WhatsApp via Evolution API]
        FB[Facebook Messenger]
    end

    subgraph CloudFly["CloudFly Platform"]
        FE[("frontend-react\nNext.js 14.2.5\nPort 3000")]
        BE[("backend-api\nSpring Boot\nPort 8080")]
        CS[("chat_socket\nSocket.IO Server\nPort 3001")]
        MA[("marketing-agent\nPython AI Agent")]
        NS[("notification-service\nSpring Boot")]
    end

    subgraph Infrastructure["Infrastructure"]
        KAFKA[("Apache Kafka\nPort 9092")]
        REDIS[("Redis\nPort 6379")]
        MYSQL[("MySQL 8.0\nPort 3306")]
    end

    subgraph Users["Users"]
        BROWSER[Browser Dashboard]
    end

    BROWSER -->|"HTTPS / WebSocket"| FE
    BROWSER -->|"HTTPS / WebSocket"| CS
    FE -->|"REST API"| BE
    FE -->|"Socket.IO"| CS
    CS -->|"Redis Adapter"| REDIS
    CS -->|"Events"| KAFKA
    MA -->|"Produces"| KAFKA
    NS -->|"Consumes"| KAFKA
    BE -->|"R/W"| MYSQL
    WA -->|"Webhook"| CS
    FB -->|"Webhook"| CS
```

---

## 2. Docker Network Topology (CLOUD-248 Fix)

```mermaid
flowchart LR
    subgraph Network1["cloudfly_app-net (172.21.0.0/16)"]
        direction TB
        FE1["frontend-react\n172.21.0.2"]
        BE1["backend-api\n172.21.0.x"]
        REDIS1["redis_server\n172.21.0.x"]
        MYSQL1["mysql\n172.21.0.x"]
        MA1["marketing-agent\n172.21.0.x"]
    end

    subgraph Network2["developmentai_app-net (172.19.0.0/16)"]
        direction TB
        FE2["frontend-react\n172.19.0.6"]
        CS2["chat_socket\n172.19.0.7"]
    end

    subgraph Network3["kafka-net"]
        direction TB
        KAFKA1["kafka\n172.22.0.x"]
        ZK1["zookeeper\n172.22.0.x"]
    end

    subgraph Network4["developmentai_kafka-net"]
        CS3["chat_socket"]
        KAFKA2["kafka"]
    end

    FE1 <-.->|"Dual Network"| FE2
    FE2 -->|"✅ CLOUD-248 FIX"| CS2
    CS2 -->|"Redis Adapter"| REDIS1
    CS2 -->|"Events"| KAFKA2
    MA1 -->|"Produces"| KAFKA1
    BE1 -->|"R/W"| MYSQL1

    style FE2 fill:#d4edda
    style CS2 fill:#d4edda
```

---

## 3. Socket.IO Connection Lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant Browser as 🌐 Browser
    participant FE as ⚛️ frontend-react<br/>(Next.js)
    participant CS as 🔌 chat_socket<br/>(Socket.IO)
    participant Redis as 💾 Redis<br/>(Adapter)
    participant Kafka as 📨 Kafka<br/>(Event Bus)
    participant Agent as 🤖 marketing-agent<br/>(Python)

    rect rgb(220, 240, 255)
        Note over Browser,FE: 1. Page Load & SSR
        Browser->>FE: GET /marketing/ai-operation
        FE-->>Browser: SSR HTML + MUI chunks + SocketProvider
    end

    rect rgb(255, 245, 220)
        Note over Browser,CS: 2. Socket Connection
        Browser->>FE: Client-side hydration
        FE->>CS: WebSocket handshake (ws://chat_socket:3001)
        CS-->>FE: Connection accepted + socket.id
        FE-->>Browser: SocketProvider initialized
    end

    rect rgb(220, 255, 220)
        Note over Browser,CS: 3. Marketing Room Subscription
        FE->>CS: emit('subscribe-marketing', {tenantId: 1, companyId: 5})
        CS->>CS: ✅ Validate tenantId (cross-tenant check)
        CS->>CS: Join room: marketing_tenant_1_company_5
        CS-->>FE: emit('subscribed-marketing', {room: "marketing_tenant_1_company_5"})
        FE-->>Browser: ConnectionChip → "Conectado"
    end

    rect rgb(255, 240, 240)
        Note over Agent,CS: 4. Real-Time Event Flow
        Agent->>Kafka: Produce agent status update
        Kafka->>CS: kafkaConsumer processes event
        CS->>CS: Determine target room
        CS->>FE: emit('marketing-agent-status-update', payload)
        CS->>FE: emit('marketing-batch-update', snapshot)
        CS->>FE: emit('marketing-action-event', action)
        FE-->>Browser: Re-render with live data
    end

    rect rgb(240, 240, 240)
        Note over Browser,CS: 5. Disconnection & Reconnection
        CS--xFE: Connection lost
        FE-->>Browser: ConnectionChip → "Reconectando..."
        FE->>CS: Auto-reconnect attempt
        CS-->>FE: Reconnected
        FE->>CS: Re-subscribe to marketing room
        CS-->>FE: Subscription confirmed
        FE-->>Browser: ConnectionChip → "Conectado"
    end
```

---

## 4. Frontend Component Architecture

```mermaid
graph TB
    subgraph Context["React Context Layer"]
        SP["SocketProvider\n(SocketContext.tsx)\n• Global socket instance\n• Auto-reconnect\n• JWT auth"]
    end

    subgraph Hooks["Custom Hooks"]
        HM["useMarketingAgentsSocket\n• subscribe/unsubscribe\n• Event handlers\n• Reconnect logic"]
        US["useSocket\n• Access to SocketContext"]
    end

    subgraph Page["Page Component"]
        MP["MarketingLiveDashboardPage\n(page.tsx)\n• AbortController cleanup\n• Merged events (REST + Socket)\n• Responsive grid"]
    end

    subgraph UI["UI Components"]
        CC["ConnectionChip\n• Conectado/Desconectado/Reconectando"]
        SC["StatCard × 5\n• Agentes Activos\n• Trabajando\n• En Espera\n• Errores\n• Total Eventos"]
        AFG["AgentFlowGraph\n• SVG flow diagram\n• Bezier curves\n• Status colors"]
        LAC["LiveAgentCard × N\n• Agent status\n• Animations\n• React.memo"]
        MHT["MarketingHistoryTimeline\n• Action events\n• Auto-scroll\n• Metadata chips"]
        MSS["MarketingSocketStatus\n• Connection info\n• Room name\n• Security badge"]
        MRDP["MarketingRoomDebugPanel\n• Debug info\n• Dev-only"]
    end

    SP --> US
    US --> HM
    HM -->|"agents, connections, events, status"| MP
    MP --> CC
    MP --> SC
    MP --> AFG
    MP --> LAC
    MP --> MHT
    MP --> MSS
    MP --> MRDP
```

---

## 5. State Machine — Connection Status

```mermaid
stateDiagram-v2
    [*] --> Disconnected: Initial load

    Disconnected --> Reconnecting: Auto-reconnect triggered
    Disconnected --> Reconnecting: User clicks "Reconectar"

    Reconnecting --> Connected: Socket connects
    Reconnecting --> Disconnected: Max retries exceeded

    Connected --> Subscribed: subscribe-marketing emitted
    Connected --> Disconnected: Network loss / Server down

    Subscribed --> Receiving: Events arrive
    Subscribed --> Connected: unsubscribe-marketing emitted

    Receiving --> Subscribed: Event stream ends
    Receiving --> Connected: Disconnect

    note right of Subscribed: Room: marketing_tenant_{id}
    note right of Receiving: Receiving: batch-update, status-update, task-update, action-event
```

---

## 6. Event Flow — Marketing Agent Updates

```mermaid
flowchart LR
    subgraph Source["Event Sources"]
        AGENT["marketing-agent\n(Python)"]
        WORKER["marketing-worker\n(Java)"]
        API["backend-api\n(Spring Boot)"]
    end

    subgraph Transport["Transport Layer"]
        KAFKA["Kafka Topic\nagent-events"]
        REST["REST API\nPOST /api/marketing/emit"]
    end

    subgraph Server["Socket.IO Server"]
        HANDLER["marketingHandler.js\n• emitToMarketingRoom\n• Room resolution"]
        ROOM["Socket.IO Room\nmarketing_tenant_{id}\n[_company_{cid}]"]
    end

    subgraph Client["Frontend Client"]
        HOOK["useMarketingAgentsSocket\n• handleBatchUpdate\n• handleStatusUpdate\n• handleTaskUpdate\n• handleActionEvent"]
        STATE["React State\n• agents[]\n• connections[]\n• events[]\n• connectionStatus"]
    end

    AGENT -->|"Produces"| KAFKA
    WORKER -->|"Produces"| KAFKA
    API -->|"POST"| REST
    KAFKA -->|"kafkaConsumer"| HANDLER
    REST -->|"emitToMarketingRoom"| HANDLER
    HANDLER -->|"io.to(room).emit"| ROOM
    ROOM -->|"WebSocket"| HOOK
    HOOK -->|"setState"| STATE
```

---

## 7. Security — Cross-Tenant Isolation

```mermaid
flowchart TD
    subgraph Auth["Authentication"]
        JWT["JWT Token\n{userId, tenantId, companyId}"]
        MW["authMiddleware\nValidates JWT on socket connect"]
        SOCKET["socket.tenantId\nSet from JWT (trusted)"]
        JWT --> MW --> SOCKET
    end

    subgraph Validation["Subscription Validation"]
        REQ["Client Request\n{subscribe-marketing, tenantId: 5}"]
        CHECK{"socket.tenantId\n===\ndata.tenantId?"}
        REJECT["❌ Reject\nemit('error',\n'Cross-tenant subscription not allowed')"]
        ALLOW["✅ Allow\nJoin room"]
        REQ --> CHECK
        SOCKET --> CHECK
        CHECK -->|No| REJECT
        CHECK -->|Yes| ALLOW
    end

    subgraph Rooms["Room Isolation"]
        R1["Room: marketing_tenant_1"]
        R2["Room: marketing_tenant_5"]
        R3["Room: marketing_tenant_1_company_3"]
        ALLOW --> R1
        ALLOW --> R2
        ALLOW --> R3
    end
```

---

## 8. Data Flow — Merged Events (CLOUD-252)

```mermaid
flowchart TB
    subgraph REST["REST API (Initial Load)"]
        API["GET /api/marketing/history\n?tenantId=1&limit=50"]
        HISTORY["History Events\n[evt1, evt2, ..., evt50]"]
        API --> HISTORY
    end

    subgraph Socket["Socket.IO (Real-Time)"]
        WS["WebSocket Events\nmarketing-action-event"]
        LIVE["Live Events\n[evt51, evt52, ...]"]
        WS --> LIVE
    end

    subgraph Merge["Merge Logic (page.tsx)"]
        DEDUP["Deduplication\nby event.id"]
        COMBINE["Combine\n[...live, ...filteredHistory"]
        SLICE["Slice\nlast 50 events"]
        DEDUP --> COMBINE --> SLICE
    end

    subgraph Render["Render"]
        TIMELINE["MarketingHistoryTimeline\n• Auto-scroll\n• Metadata chips\n• Color coding"]
    end

    HISTORY --> DEDUP
    LIVE --> DEDUP
    SLICE --> TIMELINE
```

---

## 9. Docker Compose Service Dependencies

```mermaid
graph TB
    subgraph Services["docker-compose-full-vps.yml"]
        FE["frontend-react\n:3000"]
        CS["chat_socket\n:3001"]
        BE["backend-api\n:8080"]
        REDIS["redis_server\n:6379"]
        MYSQL["mysql\n:3306"]
        KAFKA["kafka\n:9092"]
        ZK["zookeeper\n:2181"]
        MA["marketing-agent"]
        NS["notification-service"]
    end

    FE -->|"depends_on"| CS
    FE -->|"Socket.IO"| CS
    FE -->|"REST"| BE
    CS -->|"Redis Adapter"| REDIS
    CS -->|"Events"| KAFKA
    CS -->|"DB"| MYSQL
    KAFKA -->|"depends_on"| ZK
    MA -->|"Produces"| KAFKA
    NS -->|"Consumes"| KAFKA
    BE -->|"DB"| MYSQL

    style FE fill:#d4edda
    style CS fill:#d4edda
```

---

## 10. Test Coverage Architecture

```mermaid
graph LR
    subgraph Unit["Unit Tests"]
        T1["useMarketingAgentsSocket.test.tsx\n35 tests\n• Event handlers\n• Cleanup\n• Reconnect"]
        T2["LiveAgentCard.test.tsx\n47 tests\n• Rendering\n• Animations\n• Status config"]
        T3["AgentFlowGraph.test.tsx\n38 tests\n• SVG rendering\n• Bezier curves\n• Status colors"]
    end

    subgraph Integration["Integration Tests"]
        T4["smoke-test-e2e.test.tsx\n23 tests\n• E2E scenarios\n• Connection lifecycle"]
        T5["CLOUD-208-e2e-integration.test.tsx\n56 tests\n• AgentFlowGraph integration"]
        T6["CLOUD-256-final-qa.test.tsx\n42 tests\n• Final QA verification"]
    end

    subgraph Verification["Verification Tests"]
        T7["CLOUD-219-runtime-verification.test.tsx\n18 tests\n• Runtime behavior"]
        T8["page-abortcontroller.test.tsx\n12 tests\n• AbortController cleanup"]
        T9["page.test.tsx\n12 tests\n• Page rendering"]
    end

    T1 & T2 & T3 -->|"283 tests"| RESULT["✅ ALL PASS"]
    T4 & T5 & T6 --> RESULT
    T7 & T8 & T9 --> RESULT
```

---

## 11. Deployment Architecture — VPS

```mermaid
flowchart TB
    subgraph VPS["CloudFly VPS (api.cloudfly.com.co)"]
        subgraph Traefik["Traefik Reverse Proxy"]
            T["Traefik\n:80 / :443\nSSL termination"]
        end

        subgraph Apps["Applications"]
            FE["frontend-react\n:3000\ndashboard.cloudfly.com.co"]
            CS["chat_socket\n:3001\nchat.cloudfly.com.co"]
            BE["backend-api\n:8080\napi.cloudfly.com.co"]
        end

        subgraph Data["Data Stores"]
            MYSQL["MySQL\n:3306"]
            REDIS["Redis\n:6379"]
            KAFKA["Kafka\n:9092"]
        end
    end

    subgraph External["External"]
        USER["User Browser"]
        WA["WhatsApp Evolution API"]
    end

    USER -->|"HTTPS"| T
    T -->|"Route"| FE
    T -->|"Route"| CS
    T -->|"Route"| BE
    FE -->|"WebSocket"| CS
    FE -->|"REST"| BE
    CS -->|"Webhook"| WA
    CS -->|"Adapter"| REDIS
    CS -->|"Events"| KAFKA
    BE -->|"R/W"| MYSQL
```

---

## 12. File Structure — Marketing Dashboard

```mermaid
graph LR
    subgraph Frontend["frontend_new/src"]
        PAGES["app/(dashboard)/marketing/ai-operation/\n├── page.tsx (18.7KB)\n└── page.test.tsx"]
        HOOKS["hooks/\n├── useMarketingAgentsSocket.ts (14KB)\n└── __tests__/\n    └── useMarketingAgentsSocket.test.ts"]
        CONTEXTS["contexts/\n└── SocketContext.tsx (16.7KB)"]
        TYPES["types/marketing/\n└── aiMarketing.ts (11.1KB)"]
        VIEWS["views/marketing/ai-operation/\n├── LiveAgentCard.tsx\n├── AgentFlowGraph.tsx\n└── MarketingHistoryTimeline.tsx"]
        COMPONENTS["components/marketing/\n├── MarketingSocketStatus.tsx\n└── MarketingRoomDebugPanel.tsx"]
        SERVICES["services/marketing/\n└── marketingHistoryService.ts"]
    end

    subgraph Backend["chat-socket-service/src"]
        INDEX["index.js (16.5KB)\nSocket.IO server entry"]
        HANDLERS["handlers/\n└── marketingHandler.js (7KB)"]
        ROUTES["routes/\n└── marketing.js (4.8KB)"]
        MIDDLEWARE["middleware/\n└── auth.js"]
        SERVICES2["services/\n├── kafkaConsumer.js\n├── kafkaProducer.js\n└── redisClient.js"]
    end

    PAGES --> HOOKS
    HOOKS --> CONTEXTS
    HOOKS --> TYPES
    PAGES --> VIEWS
    PAGES --> COMPONENTS
    PAGES --> SERVICES
    INDEX --> HANDLERS
    INDEX --> ROUTES
    INDEX --> MIDDLEWARE
    INDEX --> SERVICES2
```

---

*Generated by: OWL — Technical Writer & Diagram Specialist*  
*Date: 2025-07-19*  
*Ticket: CLOUD-248*

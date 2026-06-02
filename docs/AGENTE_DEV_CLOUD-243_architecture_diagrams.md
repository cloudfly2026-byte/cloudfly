# CLOUD-243: Marketing Agent Socket Event Handlers — Architecture Diagrams

> **Ticket**: [CLOUD-243] Add marketing agent socket event handlers to chat-socket-service  
> **Parent**: [CLOUD-200] Marketing Team Live Dashboard  
> **Status**: ✅ COMPLETADO  
> **Last Updated**: 2026-06-01

---

## 1. System Context Diagram

```mermaid
graph TB
    subgraph "External Users"
        MARKETER["Marketing Manager<br/>(Dashboard User)"]
        ADMIN["Tenant Admin"]
    end

    subgraph "CloudFly AI Platform"
        subgraph "Frontend Layer"
            DASHBOARD["Marketing AI Operation<br/>Dashboard Page"]
            HOOK["useMarketingAgentsSocket<br/>Hook"]
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
    DASHBOARD --> HOOK
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

## 2. Deployment Architecture (Docker)

```mermaid
graph TB
    subgraph "VPS: api.cloudfly.com.co"
        subgraph "Docker Network: app-net"
            TRAEFIK["Traefik<br/>Reverse Proxy<br/>:443/:80"]
            FE["frontend<br/>Next.js :3000"]
            CSS["chat-socket-service<br/>Socket.IO :3001"]
            BE["backend<br/>Spring Boot :8080"]
        end

        subgraph "Docker Network: kafka-net"
            KAFKA["Kafka :9092"]
            ZK["Zookeeper :2181"]
            NS["notification-service<br/>Java :8084"]
        end

        subgraph "Docker Network: app-net"
            MA["marketing-agent<br/>Python"]
            MW["marketing-worker<br/>Python"]
            IMO["ia-marketing-operation<br/>Java :8085"]
        end

        subgraph "Data Layer"
            PG["PostgreSQL :5432"]
            REDIS["Redis :6379"]
        end
    end

    TRAEFIK --> FE
    TRAEFIK --> CSS
    TRAEFIK --> BE
    FE <-->|"WSS"| CSS
    MA -->|"POST /api/marketing/emit"| CSS
    MW -->|"POST /api/marketing/emit"| CSS
    IMO -->|"POST /api/marketing/emit"| CSS
    CSS <--> KAFKA
    CSS <--> REDIS
    CSS <--> PG

    style CSS fill:#4CAF50,stroke:#2E7D32,color:#fff
    style TRAEFIK fill:#607D8B,stroke:#37474F,color:#fff
```

---

## 3. Socket.IO Event Flow Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Browser as Browser<br/>(Marketing Dashboard)
    participant SocketIO as chat-socket-service<br/>:3001
    participant Auth as authMiddleware
    participant Handler as marketingHandler
    participant Room as Socket.IO Room<br/>(marketing_tenant_1)
    participant Service as Backend Service<br/>(marketing-agent)

    rect rgb(240, 248, 255)
        Note over Browser,Service: Phase 1 — Connection & Authentication
        Browser->>SocketIO: WebSocket handshake + JWT token
        SocketIO->>Auth: authMiddleware(socket, next)
        Auth->>Auth: jwt.verify(token, JWT_SECRET)
        Auth->>Auth: socket.tenantId = decoded.customer_id
        Auth->>Auth: socket.companyId = decoded.company_id
        Auth-->>SocketIO: next() — authenticated
        SocketIO-->>Browser: Connection established ✅
    end

    rect rgb(240, 255, 240)
        Note over Browser,Service: Phase 2 — Marketing Subscription
        Browser->>SocketIO: emit('subscribe-marketing', {tenantId: 1, companyId: 5})
        SocketIO->>Handler: handleSubscribeMarketing(socket, io)(data)
        Handler->>Handler: Cross-tenant check: Number(1) === Number(1) ✅
        Handler->>Handler: roomName = 'marketing_tenant_1_company_5'
        Handler->>Room: socket.join('marketing_tenant_1_company_5')
        Handler-->>Browser: emit('subscribed-marketing', {room: 'marketing_tenant_1_company_5'})
    end

    rect rgb(255, 248, 240)
        Note over Browser,Service: Phase 3 — Real-time Event Delivery
        Service->>SocketIO: POST /api/marketing/emit<br/>{event: 'marketing-batch-update', tenantId: 1, companyId: 5, payload: {...}}
        SocketIO->>Room: io.to('marketing_tenant_1_company_5').emit('marketing-batch-update', payload)
        Room-->>Browser: on('marketing-batch-update', callback)

        Service->>SocketIO: POST /api/marketing/emit<br/>{event: 'marketing-agent-status-update', ...}
        SocketIO->>Room: io.to('marketing_tenant_1_company_5').emit('marketing-agent-status-update', payload)
        Room-->>Browser: on('marketing-agent-status-update', callback)
    end

    rect rgb(248, 240, 255)
        Note over Browser,Service: Phase 4 — Unsubscription
        Browser->>SocketIO: emit('unsubscribe-marketing', {companyId: 5})
        SocketIO->>Handler: handleUnsubscribeMarketing(socket, io)(data)
        Handler->>Handler: tenantId = socket.tenantId (always)
        Handler->>Room: socket.leave('marketing_tenant_1_company_5')
        Handler-->>Browser: emit('unsubscribed-marketing', {room: 'marketing_tenant_1_company_5'})
    end
```

---

## 4. Cross-Tenant Security Flow

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

---

## 5. Multi-Tenant Room Isolation Diagram

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

## 6. Handler Registration Order in index.js

```mermaid
graph TD
    subgraph "io.on('connection', socket => { ... })"
        A["1. Auto-join tenant room<br/>socket.join('tenant_{id}')"]
        B["2. Auto-join company room<br/>socket.join('tenant_{id}_company_{id}')"]
        C["3. Auto-join user room<br/>socket.join('tenant_{id}_company_{id}_user_{id}')"]
        D["4. presenceHandler.handleUserOnline"]
        
        subgraph "CONVERSATION EVENTS"
            E["5. join-conversation"]
            F["6. leave-conversation"]
            G["7. subscribe-platform"]
        end

        subgraph "MARKETING AGENT EVENTS (CLOUD-243)"
            H["8. subscribe-marketing ⭐"]
            I["9. unsubscribe-marketing ⭐"]
        end

        subgraph "MESSAGE EVENTS"
            J["10. send-message"]
            K["11. mark-as-read"]
        end

        subgraph "PRESENCE EVENTS"
            L["12. typing"]
            M["13. stop-typing"]
        end

        N["14. disconnect"]
        O["15. error"]
    end

    A --> B --> C --> D --> E --> F --> G --> H --> I --> J --> K --> L --> M --> N --> O

    style H fill:#4CAF50,stroke:#2E7D32,color:#fff
    style I fill:#4CAF50,stroke:#2E7D32,color:#fff
```

---

## 7. Data Flow: Backend Service → Frontend

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

## 8. Error Handling Flow

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
    style VALIDATE fill:#FFF9C4,stroke:#F57F17
```

---

## 9. Test Coverage Diagram

```mermaid
graph TB
    subgraph "Test Suite: marketingHandler.test.js (31 tests)"
        subgraph "getMarketingRoomName (4 tests)"
            T1["✅ tenant-only room"]
            T2["✅ null companyId"]
            T3["✅ tenant+company room"]
            T4["✅ large IDs"]
        end

        subgraph "handleSubscribeMarketing (8 tests)"
            T5["✅ join tenant-only room"]
            T6["✅ join tenant+company room"]
            T7["✅ fallback to socket.companyId"]
            T8["✅ prefer data.companyId"]
            T9["✅ use socket.tenantId when no data"]
            T10["✅ error when no tenantId"]
            T11["✅ emit subscribed-marketing"]
            T12["✅ null companyId in confirmation"]
        end

        subgraph "Cross-Tenant Security (8 tests)"
            T13["✅ REJECT: different number tenantId"]
            T14["✅ REJECT: string tenantId mismatch"]
            T15["✅ ALLOW: matching number tenantId"]
            T16["✅ ALLOW: string matches number"]
            T17["✅ ALLOW: no data tenantId"]
            T18["✅ VERIFY: room uses socket.tenantId"]
            T19["✅ VERIFY: no confirm on reject"]
            T20["✅ Unsubscribe uses socket.tenantId"]
        end

        subgraph "handleUnsubscribeMarketing (6 tests)"
            T21["✅ leave tenant-only room"]
            T22["✅ leave tenant+company room"]
            T23["✅ fallback to socket.companyId"]
            T24["✅ emit unsubscribed-marketing"]
            T25["✅ silent fail without tenantId"]
        end

        subgraph "emitToMarketingRoom (3 tests)"
            T26["✅ emit to tenant-only room"]
            T27["✅ emit to tenant+company room"]
            T28["✅ handle all event types"]
        end

        subgraph "Integration (3 tests)"
            T29["✅ subscribe/unsubscribe round-trip"]
            T30["✅ multi-tenant isolation"]
            T31["✅ cross-tenant prevention in multi-tenant"]
        end
    end

    style T13 fill:#FFCDD2,stroke:#C62828
    style T14 fill:#FFCDD2,stroke:#C62828
    style T15 fill:#C8E6C9,stroke:#2E7D32
    style T16 fill:#C8E6C9,stroke:#2E7D32
    style T17 fill:#C8E6C9,stroke:#2E7D32
    style T18 fill:#C8E6C9,stroke:#2E7D32
    style T19 fill:#C8E6C9,stroke:#2E7D32
    style T20 fill:#C8E6C9,stroke:#2E7D32
```

---

## 10. Acceptance Criteria Traceability

```mermaid
graph LR
    subgraph "Acceptance Criteria"
        AC1["AC1: subscribe-marketing<br/>joins correct room"]
        AC2["AC2: unsubscribe-marketing<br/>leaves correct room"]
        AC3["AC3: Server emits<br/>subscribed-marketing"]
        AC4["AC4: Cross-tenant<br/>subscription rejected"]
        AC5["AC5: Handlers in<br/>correct location"]
        AC6["AC6: No syntax errors<br/>service starts"]
        AC7["AC7: Existing functionality<br/>NOT affected"]
    end

    subgraph "Implementation"
        I1["handleSubscribeMarketing<br/>+ getMarketingRoomName"]
        I2["handleUnsubscribeMarketing<br/>+ getMarketingRoomName"]
        I3["socket.emit<br/>subscribed-marketing"]
        I4["Number() coercion<br/>+ cross-tenant check"]
        I5["index.js lines 272-279<br/>after subscribe-platform"]
        I6["node -c src/index.js<br/>→ exit 0"]
        I7["Chat/presence/message<br/>handlers unchanged"]
    end

    subgraph "Tests"
        TS1["8 subscribe tests"]
        TS2["6 unsubscribe tests"]
        TS3["1 confirmation test"]
        TS4["8 security tests"]
        TS5["Code review"]
        TS6["Manual verification"]
        TS7["5 regression tests"]
    end

    AC1 --> I1 --> TS1
    AC2 --> I2 --> TS2
    AC3 --> I3 --> TS3
    AC4 --> I4 --> TS4
    AC5 --> I5 --> TS5
    AC6 --> I6 --> TS6
    AC7 --> I7 --> TS7

    style AC1 fill:#C8E6C9,stroke:#2E7D32
    style AC2 fill:#C8E6C9,stroke:#2E7D32
    style AC3 fill:#C8E6C9,stroke:#2E7D32
    style AC4 fill:#C8E6C9,stroke:#2E7D32
    style AC5 fill:#C8E6C9,stroke:#2E7D32
    style AC6 fill:#C8E6C9,stroke:#2E7D32
    style AC7 fill:#C8E6C9,stroke:#2E7D32
```

---

## 11. Ticket Dependency Graph

```mermaid
graph TD
    C200["CLOUD-200<br/>Marketing Team Live<br/>Dashboard<br/>(Parent Epic)"]
    
    C213["CLOUD-213<br/>useMarketingAgentsSocket<br/>Hook<br/>(Frontend)"]
    
    C243["CLOUD-243<br/>Marketing Socket<br/>Event Handlers<br/>(Backend) ⭐"]
    
    C247["CLOUD-247<br/>REST API for<br/>Marketing Events<br/>(Backend)"]
    
    C219["CLOUD-219<br/>Marketing AI<br/>Operation Page<br/>(Frontend)"]
    
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
    style C219 fill:#00BCD4,stroke:#006064,color:#fff
```

---

*Document generated by 🤖 Technical Writer Agent — CLOUD-243 Architecture Diagrams*

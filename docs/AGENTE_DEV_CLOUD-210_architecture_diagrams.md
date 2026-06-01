# CLOUD-210: Marketing Live Dashboard — Architecture Diagrams

> **Ticket:** CLOUD-210 (Resume & Complete — Replace page.tsx with the new Marketing Live Dashboard)  
> **Status:** ✅ Finalizada  
> **Last Updated:** 2025-07-19  
> **Author:** AI Scrum Team — Technical Writer Agent  

---

## 1. System Context Diagram

```mermaid
flowchart TB
    subgraph Client["Client (Browser)"]
        FE["Frontend React<br/>Next.js 14<br/>Port 3000"]
    end
    
    subgraph VPS["CloudFly VPS (api.cloudfly.com.co)"]
        TRAEFIK["Traefik<br/>Reverse Proxy<br/>Port 80/443"]
        
        subgraph Frontend["Frontend Layer"]
            FE
        end
        
        subgraph Realtime["Real-Time Layer"]
            SOCKET["Chat Socket Service<br/>Socket.IO<br/>Port 3001"]
        end
        
        subgraph Backend["Backend Layer"]
            API["Backend API<br/>Spring Boot<br/>Port 8080"]
        end
        
        subgraph Messaging["Event Pipeline"]
            KAFKA["Apache Kafka<br/>Port 9092"]
            ZK["Zookeeper<br/>Port 2181"]
        end
        
        subgraph AI["AI Agents"]
            MA["Marketing Agent<br/>Python<br/>Port 8000"]
            MW["Marketing Worker<br/>Python"]
        end
        
        subgraph Storage["Storage"]
            MYSQL["MySQL 8.0<br/>Port 3306"]
            REDIS["Redis<br/>Port 6379"]
        end
    end
    
    FE -->|"HTTPS (443)"| TRAEFIK
    TRAEFIK -->|"REST API"| API
    TRAEFIK -->|"WebSocket"| SOCKET
    
    MA -->|"Publish events"| KAFKA
    MW -->|"Consume events"| KAFKA
    KAFKA --> ZK
    MW -->|"Forward to"| API
    API -->|"Emit events"| SOCKET
    SOCKET -->|"Real-time"| FE
    
    API -->|"Read/Write"| MYSQL
    API -->|"Cache/Session"| REDIS
    SOCKET -->|"Adapter"| REDIS
    
    style FE fill:#3b82f6,color:#fff
    style SOCKET fill:#10b981,color:#fff
    style API fill:#8b5cf6,color:#fff
    style KAFKA fill:#f59e0b,color:#fff
    style MA fill:#ef4444,color:#fff
```

---

## 2. Component Architecture Diagram

```mermaid
flowchart TD
    subgraph Page["page.tsx — MarketingLiveDashboardPage"]
        SESSION["useSession()<br/>tenantId + companyId"]
        
        subgraph Hook["useMarketingAgentsSocket Hook"]
            AGENTS["agents: MarketingAgent[]"]
            CONNECTIONS["connections: AgentConnection[]"]
            EVENTS["events: MarketingActionEvent[]"]
            STATUS["connectionStatus"]
            LAST_UPDATE["lastUpdate"]
        end
        
        subgraph State["Component State"]
            HISTORY["historyEvents<br/>(REST history)"]
            ALL_EVENTS["allEvents<br/>(Merged via useMemo)"]
            LOADING["loading"]
            ERROR["error"]
        end
        
        subgraph UI["UI Components"]
            CHIP["ConnectionChip"]
            STATS["StatCard ×5"]
            FLOW["AgentFlowGraph"]
            CARDS["LiveAgentCard Grid"]
            TIMELINE["MarketingHistoryTimeline"]
        end
    end
    
    subgraph REST["REST API (Initial Load)"]
        HISTORY_API["GET /agents/history"]
    end
    
    subgraph WebSocket["WebSocket (Real-Time)"]
        WS_EVENTS["marketing-action-event<br/>marketing-agent-batch-update<br/>marketing-agent-status-update<br/>marketing-agent-task-update"]
    end
    
    SESSION -->|"tenantId, companyId"| Hook
    SESSION -->|"tenantId, companyId"| REST
    
    REST -->|"AbortController"| HISTORY
    HISTORY -->|"setHistoryEvents"| ALL_EVENTS
    
    Hook -->|"events"| ALL_EVENTS
    Hook -->|"agents"| CARDS
    Hook -->|"connections"| FLOW
    Hook -->|"connectionStatus"| CHIP
    Hook -->|"lastUpdate"| STATS
    
    ALL_EVENTS -->|"events"| TIMELINE
    ALL_EVENTS -->|"allEvents.length"| STATS
    
    style SESSION fill:#3b82f6,color:#fff
    style Hook fill:#10b981,color:#fff
    style State fill:#f59e0b,color:#fff
    style UI fill:#8b5cf6,color:#fff
```

---

## 3. Data Flow Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Page as page.tsx
    participant Session as useSession
    participant REST as REST API
    participant Hook as useMarketingAgentsSocket
    participant WS as WebSocket
    participant Timeline as MarketingHistoryTimeline
    
    User->>Page: Navigate to /marketing/ai-operation
    
    Page->>Session: Get session data
    Session-->>Page: { tenantId: 1, companyId: 1 }
    
    par Initial Data Load (REST)
        Page->>REST: GET /agents/history?tenantId=1&companyId=1
        REST-->>Page: { events: [...], total: 50 }
        Page->>Page: setHistoryEvents(events)
    and WebSocket Connection
        Page->>Hook: Initialize socket listeners
        Hook->>WS: subscribe-marketing { tenantId: 1 }
        WS-->>Hook: marketing-agent-batch-update
        Hook->>Page: setAgents(agents), setConnections(connections)
    end
    
    Note over Page,Timeline: Real-time updates begin
    
    WS-->>Hook: marketing-action-event { id: "evt-123", ... }
    Hook->>Page: setEvents([...events, newEvent])
    
    Page->>Page: useMemo merges events + historyEvents
    Note over Page: Dedup by ID, socket priority, cap 50
    
    Page->>Timeline: Render with allEvents (merged)
    Timeline-->>User: Display updated timeline
    
    WS-->>Hook: marketing-agent-status-update { agentId: "researcher", status: "working" }
    Hook->>Page: Update agent in agents array
    Page->>User: Live agent card status change
```

---

## 4. Event Merging Flow (CLOUD-252)

```mermaid
flowchart LR
    subgraph Socket["Socket Events (Real-Time)"]
        S1["Event A"]
        S2["Event B"]
        S3["Event C"]
    end
    
    subgraph REST["REST History (Initial Load)"]
        R1["Event A"]
        R2["Event D"]
        R3["Event E"]
    end
    
    subgraph Merge["useMemo Merge Logic"]
        DEDUP["Dedup by ID<br/>Socket Priority"]
        CONCAT["Concatenate<br/>Socket First"]
        CAP["Cap at 50"]
    end
    
    subgraph Result["Merged Output"]
        O1["Event A (socket)"]
        O2["Event B"]
        O3["Event C"]
        O4["Event D (REST)"]
        O5["Event E (REST)"]
    end
    
    S1 --> DEDUP
    S2 --> DEDUP
    S3 --> DEDUP
    R1 --> DEDUP
    R2 --> DEDUP
    R3 --> DEDUP
    
    DEDUP -->|"Filter duplicates"| CONCAT
    CONCAT -->|"Socket + REST"| CAP
    CAP -->|"Max 50"| Result
    
    style Socket fill:#10b981,color:#fff
    style REST fill:#3b82f6,color:#fff
    style Merge fill:#f59e0b,color:#fff
    style Result fill:#8b5cf6,color:#fff
```

---

## 5. WebSocket Event Protocol

```mermaid
flowchart TD
    subgraph Server["Server → Client Events"]
        BATCH["marketing-agent-batch-update<br/>Full snapshot of agents + connections"]
        STATUS["marketing-agent-status-update<br/>Single agent status change"]
        TASK["marketing-agent-task-update<br/>Single agent task change"]
        ACTION["marketing-action-event<br/>New timeline action event"]
    end
    
    subgraph Client["Client → Server Events"]
        SUB["subscribe-marketing<br/>Join marketing room"]
        UNSUB["unsubscribe-marketing<br/>Leave marketing room"]
    end
    
    subgraph States["Connection States"]
        CONNECTED["connected<br/>Green chip"]
        DISCONNECTED["disconnected<br/>Red chip"]
        RECONNECTING["reconnecting<br/>Amber chip"]
    end
    
    BATCH -->|"Initial load"| AGENTS[agents, connections]
    STATUS -->|"Update one"| AGENT[agent status]
    TASK -->|"Update one"| TASK_STATE[agent task]
    ACTION -->|"Append"| EVENTS[events array]
    
    style Server fill:#10b981,color:#fff
    style Client fill:#3b82f6,color:#fff
    style States fill:#f59e0b,color:#fff
```

---

## 6. Responsive Layout Grid (CLOUD-254)

```mermaid
flowchart TB
    subgraph Mobile["Mobile (<600px)"]
        M1["Agent Card 1<br/>Full width"]
        M2["Agent Card 2<br/>Full width"]
        M3["Agent Card 3<br/>Full width"]
        M1 --> M2 --> M3
    end
    
    subgraph Tablet["Tablet (600-899px)"]
        T1["Agent Card 1"] --- T2["Agent Card 2"]
        T3["Agent Card 2"] --- T4["Agent Card 3"]
    end
    
    subgraph Desktop["Desktop (≥900px)"]
        D1["Agent Card 1"] --- D2["Agent Card 2"] --- D3["Agent Card 3"]
    end
    
    style Mobile fill:#ef4444,color:#fff
    style Tablet fill:#f59e0b,color:#fff
    style Desktop fill:#10b981,color:#fff
```

---

## 7. Stats Bar Layout (CLOUD-253)

```mermaid
flowchart LR
    subgraph Stats["Stats Bar (5 Cards)"]
        S1["Agentes Activos<br/>agents.length"]
        S2["Trabajando<br/>workingCount"]
        S3["En Espera<br/>waitingCount"]
        S4["Errores<br/>errorCount"]
        S5["Total Eventos<br/>allEvents.length"]
    end
    
    style S1 fill:#3b82f6,color:#fff
    style S2 fill:#10b981,color:#fff
    style S3 fill:#f59e0b,color:#fff
    style S4 fill:#ef4444,color:#fff
    style S5 fill:#8b5cf6,color:#fff
```

---

## 8. AbortController Lifecycle (CLOUD-218)

```mermaid
sequenceDiagram
    participant Component
    participant Effect as useEffect
    participant Controller as AbortController
    participant API as REST API
    
    Component->>Effect: Mount
    Effect->>Controller: new AbortController()
    Effect->>API: getActionHistory(..., controller.signal)
    
    alt Request completes before unmount
        API-->>Effect: { events: [...] }
        Effect->>Component: setHistoryEvents(events)
    else AbortError (unmount during request)
        API-->>Effect: AbortError
        Effect->>Component: No state update (guarded)
    end
    
    Component->>Effect: Unmount
    Effect->>Controller: controller.abort()
    Note over Controller: Cancels in-flight request
```

---

## 9. Session Integration Flow (CLOUD-251)

```mermaid
flowchart TD
    A[useSession from next-auth/react] --> B{tenantId}
    B -->|session.user.tenantId| C[Use tenantId]
    B -->|session.user.customerId| D[Use customerId]
    B -->|null/undefined| E[Default: 1]
    
    C --> F[Final tenantId]
    D --> F
    E --> F
    
    A --> G{companyId}
    G -->|session.user.activeCompanyId| H[Use activeCompanyId]
    G -->|session.user.company_id| I[Use company_id]
    G -->|null/undefined| J[undefined]
    
    H --> K[Final companyId]
    I --> K
    J --> K
    
    F --> L[Pass to Hook + REST API]
    K --> L
```

---

## 10. Test Coverage Map

```mermaid
flowchart TD
    subgraph Tests["page.test.tsx — 15 Tests"]
        subgraph Abort["AbortController (CLOUD-218)"]
            T1["Call getActionHistory on mount"]
            T2["Pass AbortSignal"]
            T3["Handle AbortError gracefully"]
            T4["Set error for non-AbortError"]
            T5["Abort on unmount"]
            T6["Correct parameters"]
            T7["Loading state transition"]
            T8["Connection chip status"]
            T9["Manual reconnect AbortController"]
        end
        
        subgraph Session["Session (CLOUD-251)"]
            T10["Extract tenantId"]
            T11["Extract companyId"]
        end
        
        subgraph Merge["Event Merging (CLOUD-252)"]
            T12["Store REST history"]
            T13["Dedup socket priority"]
        end
        
        subgraph Stats["Stats Bar (CLOUD-253)"]
            T14["Total Eventos card"]
            T15["5 stat cards total"]
        end
    end
    
    style Tests fill:#10b981,color:#fff
    style Abort fill:#3b82f6,color:#fff
    style Session fill:#8b5cf6,color:#fff
    style Merge fill:#f59e0b,color:#fff
    style Stats fill:#ef4444,color:#fff
```

---

## 11. Deployment Architecture

```mermaid
flowchart TB
    subgraph Production["Production (api.cloudfly.com.co)"]
        PROXY["Traefik<br/>SSL Termination"]
        
        subgraph Containers["Docker Containers"]
            FE["frontend-react<br/>Next.js 14<br/>Marketing Live Dashboard"]
            SOCKET["chat_socket<br/>Socket.IO"]
            API["backend-api<br/>Spring Boot"]
            DB["mysql<br/>MySQL 8.0"]
            CACHE["redis<br/>Redis"]
        end
    end
    
    User["User Browser"] -->|"HTTPS"| PROXY
    PROXY -->|"3000"| FE
    PROXY -->|"3001"| SOCKET
    PROXY -->|"8080"| API
    
    FE -->|"REST"| API
    FE -->|"WebSocket"| SOCKET
    API -->|"Read/Write"| DB
    SOCKET -->|"Adapter"| CACHE
    
    style Production fill:#10b981,color:#fff
    style Containers fill:#3b82f6,color:#fff
```

---

## 12. Related Diagrams

- [CLOUD-212: REST API Architecture](./AGENTE_DEV_CLOUD-212_architecture_diagrams.md)
- [CLOUD-191: System Architecture](./AGENTE_DEV_CLOUD-191_architecture_diagrams.md)
- [WebSocket Event Protocol](./chat_socket_flow.md)
- [WhatsApp Message Flow](./whatsapp_message_flow.md)

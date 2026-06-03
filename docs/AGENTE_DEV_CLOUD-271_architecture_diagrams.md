# CLOUD-271: CRM Contacts — Architecture Diagrams

## 1. System Context Diagram

```mermaid
graph TB
    subgraph External["External Systems"]
        WA["WhatsApp<br/>(Evolution API)"]
        FB["Facebook Messenger"]
    end

    subgraph Users["Users"]
        ADMIN["Admin / Manager"]
        USER["Sales Agent"]
        VIEWER["Viewer"]
    end

    subgraph CloudFly["CloudFly Platform"]
        FE["Next.js Frontend<br/>dashboard.cloudfly.com.co"]
        BN["backend-new<br/>api.cloudfly.com.co/api/v2"]
        BL["backend-api (legacy)<br/>api.cloudfly.com.co"]
    end

    subgraph Data["Data Layer"]
        MySQL["MySQL 8.0<br/>cloud_master"]
        Kafka["Apache Kafka"]
        Redis["Redis"]
    end

    Users -->|"HTTPS"| FE
    FE -->|"REST API"| BN
    FE -->|"REST API"| BL
    BN -->|"R2DBC"| MySQL
    BL -->|"JDBC"| MySQL
    BN -->|"Producer"| Kafka
    Kafka -->|"Consumer"| BN
    BN -->|"Cache"| Redis
    WA -->|"Webhook"| BL
    FB -->|"Webhook"| BL

    style FE fill:#61dafb,color:#000
    style BN fill:#6db33f,color:#fff
    style BL fill:#6db33f,color:#fff
    style MySQL fill:#4479a1,color:#fff
    style Kafka fill:#d32f2f,color:#fff
    style Redis fill:#dc382d,color:#fff
```

## 2. Container Diagram

```mermaid
graph TB
    subgraph DockerHost["Docker Host (VPS)"]
        subgraph TraefikContainer["traefik:3.6.7"]
            T["Traefik Reverse Proxy<br/>:80 → :443"]
        end

        subgraph FrontendContainer["frontend-react"]
            FE["Next.js 14<br/>Port 3000"]
        end

        subgraph BackendNewContainer["backend-new"]
            BN["Spring Boot 3.x<br/>WebFlux + R2DBC<br/>Port 8080"]
        end

        subgraph BackendLegacyContainer["backend-api"]
            BL["Spring Boot (Legacy)<br/>MVC + JDBC<br/>Port 8080"]
        end

        subgraph MySQLContainer["mysql:8.0"]
            DB["MySQL 8.0<br/>cloud_master<br/>Port 3306"]
        end

        subgraph KafkaContainer["kafka:7.4.0"]
            K["Apache Kafka<br/>Port 9092"]
        end

        subgraph ZookeeperContainer["zookeeper:7.4.0"]
            ZK["Zookeeper<br/>Port 2181"]
        end

        subgraph RedisContainer["redis:latest"]
            RD["Redis<br/>Port 6379"]
        end
    end

    T -->|"Host: dashboard"| FE
    T -->|"Host: api + /api/v2"| BN
    T -->|"Host: api"| BL
    BN -->|"R2DBC"| DB
    BL -->|"JDBC"| DB
    BN -->|"Producer"| K
    BN -->|"Cache"| RD
    K -->|"Depends on"| ZK

    style T fill:#299adc,color:#fff
    style FE fill:#61dafb,color:#000
    style BN fill:#6db33f,color:#fff
    style BL fill:#6db33f,color:#fff
    style DB fill:#4479a1,color:#fff
    style K fill:#d32f2f,color:#fff
    style ZK fill:#7b68ee,color:#fff
    style RD fill:#dc382d,color:#fff
```

## 3. Component Diagram — Frontend

```mermaid
graph TB
    subgraph Pages["Pages"]
        CP["/marketing/contacts<br/>Contact List Page"]
        CDP["/marketing/contacts/:id<br/>Contact Detail Page"]
        CNP["/marketing/contacts/new<br/>New Contact Page"]
    end

    subgraph Components["Components"]
        CLT["ContactListTable<br/>Full MUI Table"]
        CLT2["ContactsListCard<br/>Lightweight Card"]
        CRM["CRMStatsCards<br/>4 Stat Cards"]
        TF["TableFilters<br/>Filter Controls"]
        CF["ContactFormPanel<br/>Create/Edit Form"]
        CIV["ContactDetailView<br/>Detail View"]
        TM["TagManagementModal<br/>Tag Editor"]
        CI["ChatInterface<br/>Chat Panel"]
    end

    subgraph Hooks["Custom Hooks"]
        UCS["useContactSearch<br/>Debounced Search"]
        UCL["useContactList<br/>Chat Contacts"]
        UD["useDashboardUpdates<br/>Real-time Updates"]
    end

    subgraph Redux["Redux Store"]
        RQ["contactsApi<br/>RTK Query"]
        DS["dashboardSlice<br/>Async Thunk"]
        NS["notificationSlice<br/>Socket Events"]
        UMS["unreadMessagesSlice<br/>Socket Events"]
    end

    subgraph Services["Services"]
        CS["contactService<br/>Legacy HTTP"]
        TS["tagService<br/>Tag API"]
        PS["pipelineService<br/>Pipeline API"]
    end

    CP --> CLT
    CLT --> CRM
    CLT --> TF
    CLT -->|"RTK Query"| RQ
    CDP --> CIV
    CDP --> CF
    CDP --> TM
    CDP --> CI
    CNP --> CF
    
    CLT -->|"useSelector"| DS
    CLT -->|"useSelector"| NS
    UCS -->|"Lazy Query"| RQ
    UCL -->|"HTTP"| CS
    
    RQ -->|"HTTP"| API["/api/v2/contacts"]
    CS -->|"HTTP"| API
    TS -->|"HTTP"| API
    PS -->|"HTTP"| API

    style RQ fill:#764abc,color:#fff
    style DS fill:#764abc,color:#fff
    style NS fill:#764abc,color:#fff
    style UMS fill:#764abc,color:#fff
```

## 4. Component Diagram — Backend

```mermaid
graph TB
    subgraph Controllers["Controllers"]
        CC["ContactController<br/>/api/v1/contacts/*"]
    end

    subgraph Services["Services"]
        CS["ContactService<br/>Business Logic"]
        TS["TagService<br/>Tag Management"]
        PS["PipelineService<br/>Pipeline Logic"]
        WNS["WebNotificationService<br/>Notifications"]
    end

    subgraph Repositories["Repositories"]
        CR["ContactRepository<br/>R2DBC Reactive"]
        TR["TagRepository"]
        PR["PipelineRepository"]
        WNR["WebNotificationRepository"]
    end

    subgraph Entities["Entities"]
        CE["ContactEntity<br/>contacts table"]
        TE["TagEntity<br/>tags table"]
        PE["PipelineEntity<br/>pipelines table"]
        PSE["PipelineStageEntity<br/>pipeline_stages table"]
        WNE["WebNotificationEntity<br/>web_notifications table"]
    end

    subgraph DTOs["DTOs"]
        PR_DTO["PageResponse&lt;T&gt;<br/>Generic Paginated"]
        CR_DTO["ContactResponseDTO<br/>Contact Response"]
    end

    subgraph Infrastructure["Infrastructure"]
        KF["KafkaTemplate<br/>Event Publishing"]
        JWT["JwtProvider<br/>Token Validation"]
        CORS["CorsConfig<br/>Cross-Origin"]
    end

    CC --> CS
    CS --> CR
    CS -->|"publish"| KF
    CS -->|"notify"| WNS
    CS --> TS
    CS --> PS
    CR --> CE
    TR --> TE
    PR --> PE
    PR --> PSE
    WNS --> WNR
    WNS --> WNE
    CC -->|"returns"| PR_DTO
    CC -->|"returns"| CR_DTO
    CC -->|"auth"| JWT
    CC -->|"cors"| CORS

    style CC fill:#6db33f,color:#fff
    style CS fill:#4caf50,color:#fff
    style CR fill:#388e3c,color:#fff
    style KF fill:#d32f2f,color:#fff
    style JWT fill:#ff9800,color:#000
```

## 5. Sequence Diagram — Paginated List Load

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Next.js Frontend
    participant RQ as RTK Query
    participant T as Traefik
    participant BN as backend-new
    participant DB as MySQL

    U->>FE: Navigate to /marketing/contacts
    FE->>RQ: useGetContactsQuery({page:0, size:10})
    
    alt Cache Hit
        RQ-->>FE: Return cached data
    else Cache Miss
        RQ->>T: GET /api/v2/contacts/paginated?page=0&size=10
        T->>BN: Route to backend-new:8080
        BN->>BN: Extract tenant_id from JWT
        BN->>DB: SELECT * FROM contacts<br/>WHERE tenant_id=? LIMIT 10 OFFSET 0
        DB-->>BN: 10 contact rows
        BN->>DB: SELECT COUNT(*) FROM contacts<br/>WHERE tenant_id=?
        DB-->>BN: totalElements: 150
        BN->>BN: Build PageResponse
        BN-->>T: 200 OK + JSON
        T-->>RQ: Forward response
        RQ->>RQ: Cache with key 'getContacts({"page":0,"size":10})'
        RQ-->>FE: Return data
    end
    
    FE->>FE: Render ContactListTable
    FE-->>U: Display contact table
```

## 6. Sequence Diagram — Create Contact with Cache Invalidation

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Next.js Frontend
    participant RQ as RTK Query
    participant T as Traefik
    participant BN as backend-new
    participant DB as MySQL
    participant K as Kafka
    participant NS as Notification Service

    U->>FE: Fill form & click "Create"
    FE->>RQ: createContact({name, email, phone})
    RQ->>T: POST /api/v2/contacts
    T->>BN: Route to backend-new:8080
    BN->>BN: Validate uniqueness (phone, email, doc)
    BN->>DB: INSERT INTO contacts (...)
    DB-->>BN: Insert success
    BN->>K: Publish CONTACT_CREATED event
    BN->>K: Publish webnotification
    BN-->>T: 201 Created + Contact JSON
    T-->>RQ: Forward response
    RQ->>RQ: Invalidate ['Contact'] tag
    RQ->>RQ: Auto-refetch getContacts queries
    RQ-->>FE: Return created contact
    FE-->>U: Show success + updated list
    
    K->>NS: Consume CONTACT_CREATED
    NS->>NS: Push WebSocket notification
```

## 7. Sequence Diagram — Delete Contact with Cache Invalidation

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Next.js Frontend
    participant RQ as RTK Query
    participant T as Traefik
    participant BN as backend-new
    participant DB as MySQL
    participant K as Kafka

    U->>FE: Click "Delete" on contact row
    FE->>FE: Show confirmation dialog
    U->>FE: Confirm delete
    FE->>RQ: deleteContact(id)
    RQ->>T: DELETE /api/v2/contacts/:id
    T->>BN: Route to backend-new:8080
    BN->>BN: Verify tenant scope
    BN->>DB: DELETE FROM contacts WHERE id=? AND tenant_id=?
    DB-->>BN: Delete success
    BN->>K: Publish CONTACT_DELETED event
    BN-->>T: 204 No Content
    T-->>RQ: Forward response
    RQ->>RQ: Invalidate ['Contact'] tag
    RQ->>RQ: Auto-refetch getContacts queries
    RQ-->>FE: Return success
    FE-->>U: Show updated list (no page reload)
```

## 8. Sequence Diagram — Server-Side Filtering

```mermaid
sequenceDiagram
    actor U as User
    participant TF as TableFilters
    participant CLT as ContactListTable
    participant RQ as RTK Query
    participant BN as backend-new
    participant DB as MySQL

    U->>TF: Type "john" in name field
    TF->>TF: debounce(300ms)
    TF->>CLT: onFiltersChange({name: "john"})
    CLT->>CLT: setFilters({name: "john"}), setPage(0)
    CLT->>RQ: useGetContactsQuery({page:0, size:10, name:"john"})
    RQ->>BN: GET /api/v2/contacts/paginated?page=0&size=10&name=john
    BN->>DB: SELECT * FROM contacts<br/>WHERE tenant_id=?<br/>AND LOWER(name) LIKE '%john%'<br/>LIMIT 10 OFFSET 0
    DB-->>BN: Filtered results
    BN->>DB: SELECT COUNT(*) FROM contacts<br/>WHERE tenant_id=?<br/>AND LOWER(name) LIKE '%john%'
    DB-->>BN: totalElements: 5
    BN-->>RQ: PageResponse with 5 results
    RQ-->>CLT: Cached filtered data
    CLT-->>U: Display filtered table (5 contacts)
```

## 9. State Diagram — RTK Query Cache

```mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> Loading: useGetContactsQuery()
    Loading --> Success: HTTP 200
    Loading --> Error: HTTP 4xx/5xx

    Success --> Refetching: Filter change / Page change
    Refetching --> Success: HTTP 200
    Refetching --> Error: HTTP 4xx/5xx

    Success --> Invalidated: createContact / updateContact / deleteContact
    Invalidated --> Refetching: Auto-refetch triggered
    Refetching --> Success: HTTP 200

    Error --> Loading: Retry
    Success --> Idle: Component unmount (after 60s cleanup)

    note right of Success: Data cached with key<br/>'getContacts({page, size, ...filters})'
    note right of Invalidated: Tag ['Contact'] invalidated<br/>All queries with this tag refetch
```

## 10. State Diagram — Contact Entity

```mermaid
stateDiagram-v2
    [*] --> Draft: Form opened
    Draft --> Validating: Submit clicked
    Validating --> Creating: Validation passed
    Validating --> Draft: Validation failed

    Creating --> LEAD: POST /api/v1/contacts (201)
    Creating --> Draft: POST /api/v1/contacts (400/409)

    LEAD --> POTENTIAL_CUSTOMER: Qualification
    POTENTIAL_CUSTOMER --> CUSTOMER: Conversion
    CUSTOMER --> INACTIVE: Deactivation
    INACTIVE --> ACTIVE: Reactivation

    LEAD --> ARCHIVED: Delete
    POTENTIAL_CUSTOMER --> ARCHIVED: Delete
    CUSTOMER --> ARCHIVED: Delete
    INACTIVE --> ARCHIVED: Delete

    ACTIVE --> [*]
    ARCHIVED --> [*]

    note right of LEAD: type='LEAD'<br/>stage='LEAD'
    note right of POTENTIAL_CUSTOMER: type='POTENTIAL_CUSTOMER'<br/>stage='QUALIFIED'
    note right of CUSTOMER: type='CUSTOMER'<br/>stage='CUSTOMER'
```

## 11. ER Diagram — Contact Relations

```mermaid
erDiagram
    tenants {
        bigint id PK
        varchar name
        varchar subdomain
        boolean is_active
    }

    companies {
        bigint id PK
        bigint tenant_id FK
        varchar name
        boolean is_principal
    }

    contacts {
        bigint id PK
        varchar uuid UK
        varchar name
        varchar email UK
        varchar phone
        varchar address
        varchar tax_id
        varchar type
        varchar stage
        bigint tenant_id FK
        bigint company_id FK
        bigint pipeline_id FK
        bigint stage_id FK
        varchar document_type
        varchar document_number UK
        boolean is_active
        boolean chatbot_enabled
        datetime created_at
        datetime updated_at
    }

    pipelines {
        bigint id PK
        bigint tenant_id FK
        bigint company_id FK
        varchar name
        boolean is_active
    }

    pipeline_stages {
        bigint id PK
        bigint pipeline_id FK
        varchar name
        int position
        varchar color
    }

    tags {
        bigint id PK
        bigint tenant_id FK
        bigint company_id FK
        varchar name
        varchar color
    }

    contact_tags {
        bigint contact_id FK
        bigint tag_id FK
    }

    users {
        bigint id PK
        bigint tenant_id FK
        bigint company_id FK
        varchar name
        varchar email
        varchar role
    }

    tenants ||--o{ companies : "has"
    tenants ||--o{ contacts : "owns"
    companies ||--o{ contacts : "has"
    pipelines ||--o{ contacts : "contains"
    pipeline_stages ||--o{ contacts : "stages"
    contacts ||--o{ contact_tags : "tagged"
    tags ||--o{ contact_tags : "applied"
    users ||--o{ contacts : "assigned"
```

## 12. Deployment Diagram

```mermaid
graph TB
    subgraph VPS["CloudFly VPS (109.205.182.94)"]
        subgraph Docker["Docker Engine"]
            T["traefik:3.6.7<br/>:80 → :443"]
            
            subgraph AppNet["Network: app-net"]
                FE["frontend-react<br/>Port 3000"]
                BN["backend-new<br/>Port 8080"]
                BL["backend-api<br/>Port 8080"]
                DB["mysql<br/>Port 3306"]
                RD["redis<br/>Port 6379"]
            end
            
            subgraph KafkaNet["Network: kafka-net"]
                KF["kafka<br/>Port 9092"]
                ZK["zookeeper<br/>Port 2181"]
            end
        end

        subgraph Storage["Persistent Volumes"]
            VOL_DB["persistent_master<br/>(MySQL data)"]
            VOL_CERTS["traefik_certs<br/>(TLS certificates)"]
            VOL_UPLOADS["uploads<br/>(file uploads)"]
        end
    end

    subgraph DNS["DNS Records"]
        D1["dashboard.cloudfly.com.co → 109.205.182.94"]
        D2["api.cloudfly.com.co → 109.205.182.94"]
        D3["chat.cloudfly.com.co → 109.205.182.94"]
        D4["eapi.cloudfly.com.co → 109.205.182.94"]
    end

    subgraph CDN["Let's Encrypt"]
        LE["TLS Certificates<br/>(Auto-renewed)"]
    end

    DNS -->|"HTTPS"| T
    T -->|"Route"| FE
    T -->|"Route /api/v2"| BN
    T -->|"Route /api"| BL
    BN -->|"R2DBC"| DB
    BN -->|"Producer"| KF
    BN -->|"Cache"| RD
    DB -->|"Persist"| VOL_DB
    T -->|"Certs"| VOL_CERTS
    LE -->|"Issue"| T

    style T fill:#299adc,color:#fff
    style FE fill:#61dafb,color:#000
    style BN fill:#6db33f,color:#fff
    style BL fill:#6db33f,color:#fff
    style DB fill:#4479a1,color:#fff
    style KF fill:#d32f2f,color:#fff
    style RD fill:#dc382d,color:#fff
```

## 13. Cache Invalidation Flow

```mermaid
graph LR
    subgraph Frontend["Frontend (Browser)"]
        MUT["Mutation<br/>(create/update/delete)"]
        TAG["Tag Invalidation<br/>['Contact']"]
        REFETCH["Auto-Refetch<br/>getContacts"]
        UI["UI Update<br/>(no page reload)"]
    end

    subgraph Backend["Backend (Spring Boot)"]
        CTRL["ContactController"]
        SVC["ContactService"]
        KAFKA["Kafka Producer"]
    end

    subgraph Kafka["Kafka Broker"]
        TOPIC1["contact-events"]
        TOPIC2["webnotifications"]
    end

    subgraph Consumers["Kafka Consumers"]
        NS["Notification Service"]
        AI["AI Agent"]
    end

    MUT -->|"HTTP"| CTRL
    CTRL --> SVC
    SVC -->|"DB"| DB["MySQL"]
    SVC -->|"Publish"| KAFKA
    KAFKA --> TOPIC1
    KAFKA --> TOPIC2
    TOPIC1 --> NS
    TOPIC1 --> AI
    TOPIC2 --> NS
    
    SVC -->|"Response"| CTRL
    CTRL -->|"HTTP 200/201/204"| MUT
    MUT --> TAG
    TAG --> REFETCH
    REFETCH -->|"HTTP"| CTRL
    REFETCH --> UI

    style MUT fill:#764abc,color:#fff
    style TAG fill:#ff9800,color:#000
    style REFETCH fill:#4caf50,color:#fff
    style KAFKA fill:#d32f2f,color:#fff
    style NS fill:#ff9800,color:#000
```

## 14. Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant T as Traefik
    participant BN as backend-new
    participant JWT as JwtProvider
    participant DB as MySQL

    U->>FE: Login with credentials
    FE->>T: POST /api/v1/auth/login
    T->>BN: Route to backend-new:8080
    BN->>DB: SELECT * FROM users WHERE email=?
    DB-->>BN: User record
    BN->>JWT: Generate token (customer_id, company_id, roles)
    JWT-->>BN: JWT token
    BN-->>FE: 200 OK + {access_token, refresh_token}
    FE->>FE: Store token in localStorage

    Note over U,DB: Subsequent requests

    U->>FE: Navigate to contacts
    FE->>T: GET /api/v2/contacts/paginated<br/>Authorization: Bearer <token>
    T->>BN: Route to backend-new:8080
    BN->>BN: JwtAuthenticationFilter
    BN->>JWT: Validate token signature
    JWT-->>BN: Decoded claims
    BN->>BN: Set SecurityContext
    BN->>BN: @PreAuthorize check
    BN->>DB: SELECT * FROM contacts<br/>WHERE tenant_id=?
    DB-->>BN: Results
    BN-->>FE: 200 OK + PageResponse
```

---

*Document generated by OWL — Technical Writer & Diagram Specialist*
*Date: 2025-01-20 | Ticket: CLOUD-271*

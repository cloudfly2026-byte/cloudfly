# CLOUD-308: "Cambiar Logo CloudFly" — Architecture Diagrams

> **Ticket Type**: Branding / UI Change  
> **Status**: ✅ **DONE** — All Sub-tasks Completed  
> **Date**: 2026-06-07  
> **Author**: AI Scrum Team — Technical Writer Agent  

---

## 1. Sprint Task Decomposition

```mermaid
flowchart TD
    Parent["CLOUD-308<br/>Cambiar Logo CloudFly"]
    
    Parent --> T1["CLOUD-314<br/>Replace Logo File<br/>✅ Done"]
    Parent --> T2["CLOUD-315<br/>Update Logo.tsx<br/>✅ Done"]
    Parent --> T3["CLOUD-316<br/>Local Verification<br/>✅ Done"]
    Parent --> T4["CLOUD-317<br/>Visual QA<br/>✅ Done"]
    
    T3 --> T5["CLOUD-318<br/>Start Frontend<br/>✅ Done"]
    T3 --> T6["CLOUD-319<br/>Browser Verification<br/>✅ Done"]
    T3 --> T7["CLOUD-320<br/>Start Backend<br/>✅ Done"]
    
    T1 -->|"prerequisite"| T2
    T2 -->|"prerequisite"| T3
    T3 -->|"prerequisite"| T4
    
    style Parent fill:#e8eaf6,stroke:#283593,stroke-width:3px
    style T1 fill:#c8e6c9,stroke:#1b5e20
    style T2 fill:#c8e6c9,stroke:#1b5e20
    style T3 fill:#c8e6c9,stroke:#1b5e20
    style T4 fill:#c8e6c9,stroke:#1b5e20
    style T5 fill:#c8e6c9,stroke:#1b5e20
    style T6 fill:#c8e6c9,stroke:#1b5e20
    style T7 fill:#c8e6c9,stroke:#1b5e20
```

---

## 2. Logo Replacement Flow

```mermaid
flowchart LR
    subgraph Input["Input"]
        Ticket["Jira Ticket CLOUD-308<br/>New logo attached"]
        SourceFile["landing/logo.png<br/>349,629 bytes"]
    end
    
    subgraph Process["Process"]
        Optimize["Optimize & Resize<br/>→ 448×100 px<br/>→ 48,662 bytes"]
        Replace["Replace File<br/>public/images/<br/>logo-cloudfly.png"]
        UpdateComp["Update Logo.tsx<br/>width, height, alt<br/>priority, objectFit"]
    end
    
    subgraph Output["Output"]
        NewLogo["New Logo Live<br/>HTTP 200 OK<br/>No distortion"]
    end
    
    Ticket --> SourceFile
    SourceFile --> Optimize
    Optimize --> Replace
    Replace --> UpdateComp
    UpdateComp --> NewLogo
    
    style Input fill:#fff3e0,stroke:#e65100
    style Process fill:#e3f2fd,stroke:#1565c0
    style Output fill:#c8e6c9,stroke:#1b5e20
```

---

## 3. Before / After Comparison

```mermaid
flowchart LR
    subgraph Before["Before (Old Logo)"]
        B1["logo-cloudfly.png<br/>9,381 bytes<br/>437×50 px"]
        B2["Logo.tsx<br/>width=437, height=50<br/>alt='Bot Cloudfly'<br/>rounded-full"]
    end
    
    subgraph After["After (New Logo)"]
        A1["logo-cloudfly.png<br/>48,662 bytes<br/>448×100 px"]
        A2["Logo.tsx<br/>width=448, height=100<br/>alt='CloudFly'<br/>priority, objectFit"]
    end
    
    Before -->|"CLOUD-308 Sprint"| After
    
    style Before fill:#ffcdd2,stroke:#b71c1c
    style After fill:#c8e6c9,stroke:#1b5e20
```

---

## 4. Component Rendering Architecture

```mermaid
flowchart TD
    Page["Page Request<br/>http://localhost:3000"]
    
    Page --> Layout["LayoutWrapper<br/>(auth check)"]
    
    Layout --> Vertical["VerticalLayout<br/>layout='vertical'"]
    
    Vertical --> Sidebar["Sidebar Navigation"]
    Vertical --> Navbar["Top Navbar"]
    Vertical --> Content["Page Content"]
    
    Sidebar --> NavHeader["NavHeader Container<br/>padding: 15px 20px"]
    
    NavHeader --> LogoComp["Logo.tsx Component"]
    
    LogoComp --> ImageComp["next/image"]
    
    LogoComp -->|"useVerticalNav hook"| Collapse["Collapse State<br/>isHovered<br/>isBreakpointReached"]
    
    ImageComp --> StaticFile["Static File<br/>/images/logo-cloudfly.png"]
    
    StaticFile --> Rendered["Rendered Output<br/>objectFit: contain<br/>priority: true"]
    
    style Page fill:#e8eaf6,stroke:#283593
    style Layout fill:#f3e5f5,stroke:#4a148c
    style Vertical fill:#e0f2f1,stroke:#004d40
    style NavHeader fill:#fff3e0,stroke:#e65100
    style LogoComp fill:#ffe0b2,stroke:#e65100
    style ImageComp fill:#ffe0b2,stroke:#e65100
    style StaticFile fill:#e3f2fd,stroke:#1565c0
    style Rendered fill:#c8e6c9,stroke:#1b5e20
```

---

## 5. Static Asset Serving Sequence

```mermaid
sequenceDiagram
    participant Browser as Chrome Browser
    participant NextDev as Next.js Dev Server
    participant PublicDir as /public/images/
    participant LogoTSX as Logo.tsx
    
    Note over Browser,LogoTSX: 1. Initial Page Load
    Browser->>NextDev: GET http://localhost:3000/dashboard
    NextDev->>LogoTSX: Render Logo component
    LogoTSX->>NextDev: <Image src="/images/logo-cloudfly.png"/>
    NextDev->>Browser: HTML with <img> tag
    
    Note over Browser,PublicDir: 2. Image Request
    Browser->>NextDev: GET /images/logo-cloudfly.png
    NextDev->>PublicDir: Static file lookup
    PublicDir->>NextDev: logo-cloudfly.png (48,662 bytes)
    NextDev->>Browser: HTTP 200, Content-Type: image/png
    
    Note over Browser: 3. Render
    Browser->>Browser: Apply objectFit: contain
    Browser->>Browser: Render at container width
```

---

## 6. Docker Compose Service Topology

```mermaid
flowchart TB
    subgraph Frontend["Frontend Layer"]
        NextJS["frontend_new<br/>npm run dev<br/>Port 3000"]
    end
    
    subgraph AppNet["app-net"]
        Backend["backend-api :8080"]
        ChatSocket["chat-socket :3001"]
        Billing["billing-service :8086"]
        Scheduler["scheduler-service :8085"]
        Notification["notification-service"]
        AIAgent["ai-agent"]
        AIVector["ai-vector-worker"]
        LeadGen["lead-generator :8001"]
        LeadScrap["lead-scrapper-google"]
        MarketingAgent["marketing-agent"]
        MarketingWorker["marketing-worker"]
    end
    
    subgraph DataLayer["Data Layer"]
        MySQL["mysql :3306"]
        Redis["redis :6379"]
        PG["postgresql :5432"]
        Qdrant["qdrant :6333"]
    end
    
    subgraph KafkaNet["kafka-net"]
        Kafka["kafka :9092"]
        Zookeeper["zookeeper :2181"]
    end
    
    subgraph External["External Services"]
        Evolution["evolution-api :8082"]
        N8N["n8n :5678"]
        Portainer["portainer :9000"]
    end
    
    NextJS -->|"API calls"| Backend
    Backend --> MySQL
    Backend --> Redis
    Backend --> Kafka
    Backend --> PG
    Evolution --> Redis
    Evolution --> PG
    ChatSocket --> Kafka
    ChatSocket --> Redis
    
    style Frontend fill:#e1f5fe,stroke:#01579b
    style AppNet fill:#f3e5f5,stroke:#4a148c
    style DataLayer fill:#e8f5e9,stroke:#1b5e20
    style KafkaNet fill:#fff3e0,stroke:#e65100
    style External fill:#fce4ec,stroke:#880e4f
```

---

## 7. Logo Dimension Transformation

```mermaid
flowchart LR
    subgraph Original["Original File"]
        O["logo-cloudfly.png<br/>448 × 100 pixels<br/>4.48:1 aspect ratio"]
    end
    
    subgraph Declared["Component Declaration"]
        D["Logo.tsx<br/>width={448}<br/>height={100}<br/>Matches natural size"]
    end
    
    subgraph CSS["CSS Applied"]
        C["objectFit: 'contain'<br/>Scales to fit container<br/>Maintains aspect ratio"]
    end
    
    subgraph Container["Container Constraints"]
        Nav["NavHeader<br/>padding: 15px 20px"]
        Sidebar["Sidebar<br/>width: 260px"]
    end
    
    subgraph Rendered["Final Output"]
        Final["~437 × 50 pixels<br/>Fits sidebar width<br/>No distortion"]
    end
    
    Original --> Declared
    Declared --> CSS
    CSS --> Container
    Container --> Final
    
    style Original fill:#e3f2fd,stroke:#1565c0
    style Declared fill:#fff3e0,stroke:#e65100
    style CSS fill:#f3e5f5,stroke:#4a148c
    style Container fill:#e8f5e9,stroke:#1b5e20
    style Rendered fill:#c8e6c9,stroke:#1b5e20
```

---

## 8. Sidebar States & Logo Visibility

```mermaid
stateDiagram-v2
    state "Expanded (260px)" as Expanded {
        state "Logo Full" as LF
        LF : width ~437px
        LF : height ~50px
        LF : Fully visible
    }
    
    state "Collapsed (80px)" as Collapsed {
        state "Logo Centered" as LC
        LC : Centered in 80px
        LC : Padding recalculated
        LC : Still visible
    }
    
    state "Hover Expand" as Hover {
        state "Logo Expands" as LE
        LE : Temporarily 260px
        LE : Full logo visible
        LE : Smooth transition
    }
    
    state "Mobile (<lg)" as Mobile {
        state "Logo Hidden" as MH
        MH : Sidebar hidden
        MH : Logo in mobile menu
    }
    
    [*] --> Expanded: Default (lg+)
    
    Expanded --> Collapse: Click collapse
    Collapse --> Expanded: Click expand
    
    Collapse --> Hover: Mouse enter
    Hover --> Collapse: Mouse leave
    
    Expanded --> Mobile: < lg breakpoint
    Mobile --> Expanded: ≥ lg breakpoint
```

---

## 9. Verification Test Flow

```mermaid
flowchart TD
    Start(["Start Verification"])
    
    Start --> T1["Test 1: File Exists<br/>public/images/logo-cloudfly.png"]
    T1 --> C1{"File size > 0?<br/>PNG header valid?"}
    C1 -->|Yes| T2["Test 2: HTTP Serving<br/>GET /images/logo-cloudfly.png"]
    C1 -->|No| FAIL["❌ FAIL"]
    
    T2 --> C2{"Status 200?<br/>Content-Type: image/png?"}
    C2 -->|Yes| T3["Test 3: Component Props<br/>width=448, height=100"]
    C2 -->|No| FAIL
    
    T3 --> C3{"Props correct?<br/>alt='CloudFly'?"}
    C3 -->|Yes| T4["Test 4: CSS Applied<br/>objectFit: contain"]
    C3 -->|No| FAIL
    
    T4 --> C4{"No rounded-full?<br/>priority present?"}
    C4 -->|Yes| T5["Test 5: Services Running<br/>Docker + npm run dev"]
    C4 -->|No| FAIL
    
    T5 --> C5{"All 20 services Up?<br/>Frontend on port 3000?"}
    C5 -->|Yes| PASS["✅ ALL TESTS PASSED"]
    C5 -->|No| FAIL
    
    FAIL --> End(["Exit: Issues Found"])
    PASS --> End2(["Exit: Ready for QA"])
    
    style Start fill:#e8f5e9,stroke:#1b5e20
    style PASS fill:#c8e6c9,stroke:#1b5e20
    style End2 fill:#c8e6c9,stroke:#1b5e20
    style FAIL fill:#ffcdd2,stroke:#b71c1c
    style End fill:#ffcdd2,stroke:#b71c1c
```

---

## 10. Complete Acceptance Criteria Matrix

```mermaid
flowchart TD
    subgraph CLOUD308["CLOUD-308: Cambiar Logo CloudFly"]
        direction TB
        
        AC1["✅ AC1: Logo file replaced<br/>48,662 bytes, 448×100 px"]
        AC2["✅ AC2: Logo.tsx updated<br/>width=448, height=100, alt=CloudFly"]
        AC3["✅ AC3: HTTP 200 OK<br/>GET /images/logo-cloudfly.png"]
        AC4["✅ AC4: No distortion<br/>objectFit: contain, priority"]
        AC5["✅ AC5: All services Up<br/>20 Docker + Next.js dev"]
        AC6["✅ AC6: Environment rules<br/>No ghcr.io, no VPS, no push"]
    end
    
    AC1 --> DONE["✅ CLOUD-308 DONE"]
    AC2 --> DONE
    AC3 --> DONE
    AC4 --> DONE
    AC5 --> DONE
    AC6 --> DONE
    
    style AC1 fill:#c8e6c9,stroke:#1b5e20
    style AC2 fill:#c8e6c9,stroke:#1b5e20
    style AC3 fill:#c8e6c9,stroke:#1b5e20
    style AC4 fill:#c8e6c9,stroke:#1b5e20
    style AC5 fill:#c8e6c9,stroke:#1b5e20
    style AC6 fill:#c8e6c9,stroke:#1b5e20
    style DONE fill:#a5d6a7,stroke:#1b5e20,stroke-width:4px
```

---

## 11. Sprint Timeline

```mermaid
gantt
    title CLOUD-308 Sprint Timeline
    dateFormat YYYY-MM-DD
    axisFormat %m/%d
    
    section Planning
    Architecture Analysis       :done, arch, 2026-06-06, 1h
    Sub-task Creation           :done, plan, after arch, 30m
    
    section Implementation
    CLOUD-314: Replace File     :done, impl1, after plan, 30m
    CLOUD-315: Update Component :done, impl2, after impl1, 30m
    
    section Infrastructure
    CLOUD-320: Start Backend    :done, infra1, after impl2, 2h
    CLOUD-318: Start Frontend   :done, infra2, after infra1, 30m
    
    section Verification
    CLOUD-319: Browser Verify   :done, ver1, after infra2, 30m
    CLOUD-317: Visual QA        :done, ver2, after ver1, 30m
    CLOUD-316: Local Verify     :done, ver3, after ver2, 30m
    
    section Documentation
    Technical Documentation     :done, doc1, after ver3, 1h
    Final Report                :done, doc2, after doc1, 1h
```

---

## 12. File Change Summary

```mermaid
flowchart LR
    subgraph Modified["Modified Files"]
        F1["public/images/<br/>logo-cloudfly.png<br/>9,381 → 48,662 bytes"]
        F2["src/components/layout/shared/<br/>Logo.tsx<br/>Dimensions + alt + priority"]
        F3["next.config.mjs<br/>+ transpilePackages"]
    end
    
    subgraph Created["Created Files"]
        F4[".env.local<br/>Dev environment vars"]
    end
    
    subgraph Docs["Documentation"]
        F5["7 AGENTE_DEV_*.md files<br/>38+ Mermaid.js diagrams"]
    end
    
    Modified -->|"enables"| Working["Working Logo"]
    Created -->|"enables"| Working
    Working -->|"documented by"| Docs
    
    style Modified fill:#e3f2fd,stroke:#1565c0
    style Created fill:#e8f5e9,stroke:#1b5e20
    style Docs fill:#fff3e0,stroke:#e65100
    style Working fill:#c8e6c9,stroke:#1b5e20
```

---

*🤖 Technical Writer — OWL | CloudFly AI Platform | 2026-06-07*  
*Generated by AI Scrum Team — Technical Writer Agent*  
*For CLOUD-308: "cambiar logo cloudfly" — Architecture Diagrams*

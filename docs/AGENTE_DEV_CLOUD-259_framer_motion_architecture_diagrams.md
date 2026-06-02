# CLOUD-259: framer-motion Animations & Relative Time — Architecture Diagrams

> **Status**: ✅ Complete  
> **Date**: 2025-07-19  
> **Author**: OWL — Technical Writer & Diagram Specialist  
> **Jira Key**: CLOUD-259

---

## Table of Contents

1. [System Context Diagram](#1-system-context-diagram)
2. [Animation Migration Architecture](#2-animation-migration-architecture)
3. [Animation Wrapper Hierarchy](#3-animation-wrapper-hierarchy)
4. [Animation Timing Diagram](#4-animation-timing-diagram)
5. [Before vs After Comparison](#5-before-vs-after-comparison)
6. [Component Dependency Graph](#6-component-dependency-graph)
7. [Animation State Lifecycle](#7-animation-state-lifecycle)
8. [Rendering Sequence Diagram](#8-rendering-sequence-diagram)
9. [Data Flow Diagram](#9-data-flow-diagram)
10. [Animation Decision Tree](#10-animation-decision-tree)

---

## 1. System Context Diagram

```mermaid
graph TB
    subgraph "CloudFly AI Platform"
        subgraph "Frontend Layer"
            A[Next.js 14<br/>frontend-react<br/>Port 3000] --> B[Marketing Live Dashboard]
            B --> C[LiveAgentCard<br/>Component]
            B --> D[AgentFlowGraph<br/>Component]
            B --> E[MarketingHistoryTimeline<br/>Component]
        end

        subgraph "Backend Layer"
            F[Spring Boot<br/>backend-api<br/>Port 8080]
            G[Python<br/>marketing-agent<br/>Port 8000]
            H[Node.js<br/>chat-socket-service<br/>Port 3001]
        end

        subgraph "Messaging Layer"
            I[Apache Kafka<br/>Port 9092]
            J[Redis<br/>Port 6379]
        end

        subgraph "External Services"
            K[Evolution API<br/>WhatsApp<br/>Port 8082]
        end
    end

    subgraph "Data Stores"
        L[(MySQL<br/>cloud_master<br/>Port 3306)]
        M[(PostgreSQL<br/>pgvector<br/>Port 5432)]
    end

    G -->|WebSocket Events| H
    H -->|Real-time Updates| A
    G -->|Kafka Messages| I
    I -->|Notifications| F
    F -->|REST API| A
    F -->|Read/Write| L
    G -->|Vector Search| M
    F -->|WhatsApp| K

    style C fill:#3b82f6,stroke:#1d4ed8,color:#fff,stroke-width:3px
    style A fill:#22c55e,stroke:#15803d,color:#fff
    style G fill:#8b5cf6,stroke:#6d28d9,color:#fff
```

---

## 2. Animation Migration Architecture

```mermaid
flowchart TD
    START([CLOUD-259 Migration Start]) --> AUDIT[Audit Existing Code]
    
    AUDIT --> FINDINGS{Gap Analysis}
    
    FINDINGS -->|Found| GAP1[MUI keyframes for pulseRing]
    FINDINGS -->|Found| GAP2[MUI keyframes for shimmer]
    FINDINGS -->|Found| GAP3[MUI keyframes for shake]
    FINDINGS -->|Found| GAP4[MUI keyframes for glowPulse]
    FINDINGS -->|Found| GAP5[LinearProgress + CSS animation]
    FINDINGS -->|Already Correct| OK1[Card entrance — framer-motion]
    FINDINGS -->|Already Correct| OK2[Task slide-in — AnimatePresence]
    FINDINGS -->|Already Correct| OK3[Relative time — date-fns]
    
    GAP1 --> SOL1[Create WorkingPulseWrapper]
    GAP2 --> SOL2[Create MotionShimmerBar]
    GAP3 --> SOL3[Create ErrorShakeWrapper]
    GAP4 --> SOL4[Create WaitingGlowWrapper]
    GAP5 --> SOL2
    
    SOL1 --> CLEAN[Remove Old Code]
    SOL2 --> CLEAN
    SOL3 --> CLEAN
    SOL4 --> CLEAN
    
    CLEAN --> REM1[Remove keyframes import]
    CLEAN --> REM2[Remove styled import]
    CLEAN --> REM3[Remove LinearProgress import]
    CLEAN --> REM4[Remove 4 keyframe definitions]
    CLEAN --> REM5[Remove ShimmerProgress styled component]
    
    REM1 --> TEST[Run Tests]
    REM2 --> TEST
    REM3 --> TEST
    REM4 --> TEST
    REM5 --> TEST
    
    TEST --> RESULT{75/75 Pass?}
    
    RESULT -->|Yes| DONE([Migration Complete ✅])
    RESULT -->|No| FIX[Fix Test Failures]
    FIX --> TEST

    style START fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style DONE fill:#22c55e,stroke:#15803d,color:#fff
    style FIX fill:#ef4444,stroke:#b91c1c,color:#fff
    style RESULT fill:#f59e0b,stroke:#d97706,color:#fff
```

---

## 3. Animation Wrapper Hierarchy

```mermaid
graph TB
    subgraph "LiveAgentCard Component"
        direction TB
        
        subgraph "Full Mode Rendering"
            A[agent.status] --> B{Status Check}
            
            B -->|working| C[WorkingPulseWrapper<br/>boxShadow pulse 2s]
            B -->|waiting| D[WaitingGlowWrapper<br/>boxShadow glow 3s]
            B -->|error| E[ErrorShakeWrapper<br/>translateX shake 0.4s]
            B -->|idle| F[No wrapper]
            B -->|completed| F
            
            C --> G[motion.div<br/>Card entrance]
            D --> G
            E --> G
            F --> G
            
            G --> H[MUI Card]
            H --> I[CardContent]
            
            I --> J[AnimatePresence<br/>Task slide-in]
            I --> K{MotionShimmerBar<br/>if working}
        end
        
        subgraph "Compact Mode Rendering"
            L[compact=true] --> M[motion.div<br/>Card entrance]
            M --> N[MUI Card inline-flex]
            N --> O{Status dot<br/>pulse if working}
        end
    end

    style C fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style D fill:#f59e0b,stroke:#d97706,color:#fff
    style E fill:#ef4444,stroke:#b91c1c,color:#fff
    style F fill:#94a3b8,stroke:#64748b,color:#fff
    style G fill:#8b5cf6,stroke:#6d28d9,color:#fff
```

---

## 4. Animation Timing Diagram

```mermaid
gantt
    title Animation Timing — Working Status Card
    dateFormat X
    axisFormat %L ms
    
    section Card Entrance
    Fade in + slide up (300ms)           :done, entrance, 0, 300
    
    section Working Pulse
    Box-shadow pulse cycle 1 (2000ms)    :active, pulse1, 300, 2300
    Box-shadow pulse cycle 2 (2000ms)    :active, pulse2, 2300, 4300
    Box-shadow pulse cycle 3 (2000ms)    :active, pulse3, 4300, 6300
    
    section Shimmer Bar
    Shimmer cycle 1 (2000ms)            :active, shimmer1, 300, 2300
    Shimmer cycle 2 (2000ms)            :active, shimmer2, 2300, 4300
    Shimmer cycle 3 (2000ms)            :active, shimmer3, 4300, 6300
    
    section Task Slide-in
    Task text slide-in (300ms)           :done, task, 300, 600
```

---

## 5. Before vs After Comparison

```mermaid
graph LR
    subgraph "BEFORE (CLOUD-209 partial)"
        direction TB
        A1[MUI keyframes] --> B1[pulseRing CSS]
        A1 --> C1[shimmer CSS]
        A1 --> D1[shake CSS]
        A1 --> E1[glowPulse CSS]
        F1[MUI styled] --> G1[ShimmerProgress]
        H1[LinearProgress] --> G1
        I1[framer-motion] --> J1[Card entrance]
        I1 --> K1[Task slide-in]
    end

    subgraph "AFTER (CLOUD-259 complete)"
        direction TB
        I2[framer-motion] --> J2[Card entrance]
        I2 --> K2[Task slide-in]
        I2 --> L2[WorkingPulseWrapper]
        I2 --> M2[ErrorShakeWrapper]
        I2 --> N2[WaitingGlowWrapper]
        I2 --> O2[MotionShimmerBar]
    end

    style A1 fill:#ef4444,stroke:#b91c1c,color:#fff
    style F1 fill:#ef4444,stroke:#b91c1c,color:#fff
    style H1 fill:#ef4444,stroke:#b91c1c,color:#fff
    style I1 fill:#f59e0b,stroke:#d97706,color:#fff
    style I2 fill:#22c55e,stroke:#15803d,color:#fff
    style J2 fill:#22c55e,stroke:#15803d,color:#fff
    style K2 fill:#22c55e,stroke:#15803d,color:#fff
    style L2 fill:#22c55e,stroke:#15803d,color:#fff
    style M2 fill:#22c55e,stroke:#15803d,color:#fff
    style N2 fill:#22c55e,stroke:#15803d,color:#fff
    style O2 fill:#22c55e,stroke:#15803d,color:#fff
```

---

## 6. Component Dependency Graph

```mermaid
graph TB
    subgraph "LiveAgentCard.tsx"
        direction TB
        
        subgraph "External Dependencies"
            FM[framer-motion<br/>motion, AnimatePresence]
            DF[date-fns<br/>formatDistanceToNow]
            LOCALE[date-fns/locale/es]
            LUCI[Lucide React<br/>Brain, Search, PenTool, Target, Users, CheckCircle2, Clock, AlertCircle, Loader2]
            MUI[MUI v5<br/>Card, CardContent, Typography, Box, Chip, Avatar, Tooltip, Stack]
        end
        
        subgraph "Internal Sub-Components"
            WPW[WorkingPulseWrapper]
            ESW[ErrorShakeWrapper]
            WGW[WaitingGlowWrapper]
            MSB[MotionShimmerBar]
        end
        
        subgraph "Configuration"
            SC[STATUS_CONFIG<br/>5 status definitions]
            AIM[AGENT_ICONS<br/>4 agent mappings]
            HTR[hexToRgba<br/>helper function]
        end
        
        subgraph "Main Component"
            LAC[LiveAgentCard<br/>React.memo wrapped]
        end
    end

    FM --> WPW
    FM --> ESW
    FM --> WGW
    FM --> MSB
    FM --> LAC
    
    DF --> LAC
    LOCALE --> DF
    
    LUCI --> LAC
    
    MUI --> LAC
    
    SC --> LAC
    AIM --> LAC
    HTR --> WPW
    HTR --> WGW
    HTR --> MSB
    
    WPW --> LAC
    ESW --> LAC
    WGW --> LAC
    MSB --> LAC

    style FM fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style DF fill:#f59e0b,stroke:#d97706,color:#fff
    style LAC fill:#22c55e,stroke:#15803d,color:#fff
    style WPW fill:#8b5cf6,stroke:#6d28d9,color:#fff
    style ESW fill:#8b5cf6,stroke:#6d28d9,color:#fff
    style WGW fill:#8b5cf6,stroke:#6d28d9,color:#fff
    style MSB fill:#8b5cf6,stroke:#6d28d9,color:#fff
```

---

## 7. Animation State Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Mounting: Component renders
    
    Mounting --> Entrance: motion.div initial
    Entrance --> Active: animate complete (300ms)
    
    Active --> Working: status = 'working'
    Active --> Waiting: status = 'waiting'
    Active --> Error: status = 'error'
    Active --> Idle: status = 'idle'
    Active --> Completed: status = 'completed'
    
    Working --> PulseActive: WorkingPulseWrapper mounts
    PulseActive --> PulseActive: boxShadow cycle (2s loop)
    PulseActive --> ShimmerActive: MotionShimmerBar renders
    ShimmerActive --> ShimmerActive: backgroundPosition cycle (2s loop)
    
    Waiting --> GlowActive: WaitingGlowWrapper mounts
    GlowActive --> GlowActive: boxShadow cycle (3s loop)
    
    Error --> ShakeActive: ErrorShakeWrapper mounts
    ShakeActive --> ShakeActive: translateX shake (0.4s + 2s delay)
    
    Working --> TaskChange: currentTask updates
    Waiting --> TaskChange: currentTask updates
    Error --> TaskChange: currentTask updates
    Idle --> TaskChange: currentTask updates
    Completed --> TaskChange: currentTask updates
    
    TaskChange --> SlideOut: AnimatePresence exit
    SlideOut --> SlideIn: exit complete
    SlideIn --> Active: enter complete
    
    Active --> Unmounting: Component unmounts
    Unmounting --> [*]: Cleanup complete

    note right of Working
        Entrance animation
        + WorkingPulseWrapper
        + MotionShimmerBar
    end note

    note right of Error
        Entrance animation
        + ErrorShakeWrapper
        + "Requiere atención"
    end note
```

---

## 8. Rendering Sequence Diagram

```mermaid
sequenceDiagram
    participant Parent as Parent Component
    participant Memo as React.memo
    participant Card as LiveAgentCard
    participant Config as STATUS_CONFIG
    participant Icons as AGENT_ICONS
    participant Framer as framer-motion
    participant DateFns as date-fns
    participant MUI as MUI Components

    Parent->>Memo: Re-render with props
    
    alt Props unchanged (shallow compare)
        Memo-->>Parent: Skip re-render ⚡
    else Props changed
        Memo->>Card: Execute component
        
        Card->>Config: Lookup STATUS_CONFIG[agent.status]
        Config-->>Card: { color, bg, label, icon }
        
        Card->>Icons: Lookup AGENT_ICONS[agent.id]
        Icons-->>Card: LucideIcon component
        
        Card->>DateFns: formatDistanceToNow(lastActivity, {locale: es})
        DateFns-->>Card: "Hace 2 min"
        
        alt status === 'working' && taskStartedAt
            Card->>Card: Calculate taskDuration MM:SS
            Card->>Card: Start 1s interval for live counter
        end
        
        Card->>Framer: Create motion.div wrapper (entrance)
        
        alt status === 'working'
            Card->>Framer: Wrap with WorkingPulseWrapper
            Framer->>Framer: Start boxShadow pulse animation (2s loop)
        else status === 'waiting'
            Card->>Framer: Wrap with WaitingGlowWrapper
            Framer->>Framer: Start boxShadow glow animation (3s loop)
        else status === 'error'
            Card->>Framer: Prepare ErrorShakeWrapper for error text
        end
        
        Framer->>MUI: Render Card component
        
        MUI->>MUI: Render Avatar with AgentIcon
        MUI->>MUI: Render Status Chip with icon
        MUI->>MUI: Render "Tarea actual" label
        
        alt currentTask changed
            MUI->>Framer: AnimatePresence exit old task
            Framer->>Framer: Slide-out animation (x: 20, opacity: 0)
            Framer->>Framer: Slide-in new task (x: -20→0, opacity: 0→1)
        end
        
        alt status === 'working'
            MUI->>MUI: Render MotionShimmerBar
            MUI->>Framer: Start backgroundPosition animation (2s loop)
        else status === 'error'
            Framer->>MUI: Render "Requiere atención" with ErrorShakeWrapper
            Framer->>Framer: Start translateX shake (0.4s + 2s delay)
        end
        
        MUI->>MUI: Render relative time
        MUI-->>Framer: Card rendered
        Framer-->>Card: Animation complete
        Card-->>Memo: Render complete
        Memo-->>Parent: Component updated
    end

    Note over Memo: React.memo performs shallow<br/>comparison of all props
    Note over Card: useMemo prevents recalculation<br/>of derived values
    Note over Framer: All animations are declarative<br/>via framer-motion animate prop
```

---

## 9. Data Flow Diagram

```mermaid
flowchart TD
    subgraph "Data Sources"
        WS[WebSocket<br/>agent-status-update] --> HOOK[useMarketingAgentsSocket<br/>React Hook]
        HOOK --> STATE[agents: MarketingAgent[]]
    end

    subgraph "Parent Component"
        STATE --> DASH[Dashboard Page]
        DASH --> MAP[.map(agent =>)]
    end

    subgraph "LiveAgentCard"
        MAP --> PROPS[Props: agent, isHighlighted, onClick, compact]
        
        PROPS --> MEMO{React.memo<br/>shallow compare}
        MEMO -->|unchanged| SKIP[Skip re-render ⚡]
        MEMO -->|changed| EXEC[Execute component]
        
        EXEC --> DERIVE[Derive Values]
        DERIVE --> D1[config = STATUS_CONFIG[status]]
        DERIVE --> D2[AgentIcon = AGENT_ICONS[id]]
        DERIVE --> D3[relativeTime = formatDistanceToNow]
        DERIVE --> D4[taskDuration = MM:SS calc]
        
        D1 --> RENDER[Render Path]
        D2 --> RENDER
        D3 --> RENDER
        D4 --> RENDER
        
        RENDER --> COMPACT{compact?}
        COMPACT -->|Yes| CMP[Compact Layout]
        COMPACT -->|No| FULL[Full Card Layout]
        
        CMP --> OUT1[Compact Card Output]
        FULL --> STATUS{status?}
        
        STATUS -->|working| WRP[WorkingPulseWrapper]
        STATUS -->|waiting| WGW[WaitingGlowWrapper]
        STATUS -->|error| ESW[ErrorShakeWrapper]
        STATUS -->|idle| NOWRAP[No wrapper]
        STATUS -->|completed| NOWRAP
        
        WRP --> OUT2[Full Card Output]
        WGW --> OUT2
        ESW --> OUT2
        NOWRAP --> OUT2
    end

    subgraph "User Interaction"
        OUT1 --> CLICK1[onClick?]
        OUT2 --> CLICK2[onClick?]
        CLICK1 -->|Yes| HANDLER[handleClick agent]
        CLICK2 -->|Yes| HANDLER
        HANDLER --> CALLBACK[onClick agent]
    end

    style WS fill:#8b5cf6,stroke:#6d28d9,color:#fff
    style MEMO fill:#f59e0b,stroke:#d97706,color:#fff
    style SKIP fill:#22c55e,stroke:#15803d,color:#fff
    style WRP fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style WGW fill:#f59e0b,stroke:#d97706,color:#fff
    style ESW fill:#ef4444,stroke:#b91c1c,color:#fff
```

---

## 10. Animation Decision Tree

```mermaid
flowchart TD
    START([Agent Status Change]) --> MOUNT{First render?}
    
    MOUNT -->|Yes| ENTRANCE[Card Entrance Animation<br/>opacity: 0→1, y: 10→0<br/>Duration: 300ms]
    MOUNT -->|No| UPDATE[Status Update]
    
    ENTRANCE --> STATUS{agent.status}
    UPDATE --> STATUS
    
    STATUS -->|working| WORKING_PATH[Working Animation Path]
    STATUS -->|waiting| WAITING_PATH[Waiting Animation Path]
    STATUS -->|error| ERROR_PATH[Error Animation Path]
    STATUS -->|idle| IDLE_PATH[Idle — No Animation]
    STATUS -->|completed| COMPLETED_PATH[Completed — No Animation]
    
    WORKING_PATH --> WP[WorkingPulseWrapper<br/>boxShadow: 0→12px→0<br/>Duration: 2s, infinite]
    WORKING_PATH --> SB[MotionShimmerBar<br/>backgroundPosition: -200%→200%<br/>Duration: 2s, infinite]
    WORKING_PATH --> TD[Task Duration Counter<br/>Live MM:SS update<br/>Interval: 1s]
    
    WAITING_PATH --> WG[WaitingGlowWrapper<br/>boxShadow: 6px→12px→6px<br/>Duration: 3s, infinite]
    
    ERROR_PATH --> ES[ErrorShakeWrapper<br/>translateX: 0,-5,5,-5,5,0<br/>Duration: 0.4s, repeatDelay: 2s]
    ERROR_PATH --> ET["Requiere atención" text]
    
    IDLE_PATH --> IC[Static idle card<br/>Color: #94a3b8]
    COMPLETED_PATH --> CC[Static completed card<br/>Color: #22c55e]
    
    WP --> TASK{Task changed?}
    SB --> TASK
    TD --> TASK
    WG --> TASK
    ES --> TASK
    ET --> TASK
    IC --> TASK
    CC --> TASK
    
    TASK -->|Yes| SLIDE[AnimatePresence<br/>Slide out: x: 20, opacity: 0<br/>Slide in: x: -20→0, opacity: 0→1<br/>Duration: 300ms]
    TASK -->|No| READY[Card Ready]
    
    SLIDE --> READY

    style START fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style READY fill:#22c55e,stroke:#15803d,color:#fff
    style WORKING_PATH fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style WAITING_PATH fill:#f59e0b,stroke:#d97706,color:#fff
    style ERROR_PATH fill:#ef4444,stroke:#b91c1c,color:#fff
    style IDLE_PATH fill:#94a3b8,stroke:#64748b,color:#fff
    style COMPLETED_PATH fill:#22c55e,stroke:#15803d,color:#fff
```

---

## Appendix: Diagram Legend

### Color Coding

| Color | Meaning |
|-------|---------|
| 🔵 Blue (#3b82f6) | Primary component / Active working state |
| 🟢 Green (#22c55e) | Completed / Success / Ready state |
| 🟡 Yellow (#f59e0b) | Waiting / Caution / In-progress |
| 🔴 Red (#ef4444) | Error / Failure / Attention needed |
| ⚪ Gray (#94a3b8) | Idle / Inactive / Default |
| 🟣 Purple (#8b5cf6) | External service / Backend / Sub-components |

### Line Styles

| Style | Meaning |
|-------|---------|
| Solid arrow (→) | Data flow / Function call |
| Dashed arrow (⤳) | Optional / Conditional flow |
| Bold border | Primary component of interest |
| Double line | WebSocket / Real-time connection |

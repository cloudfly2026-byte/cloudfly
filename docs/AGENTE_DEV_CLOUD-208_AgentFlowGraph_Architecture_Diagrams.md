# AGENTE_DEV_CLOUD-208_AgentFlowGraph_Architecture_Diagrams

> **Ticket:** CLOUD-208 / CLOUD-257  
> **Epic:** CLOUD-205 — Marketing Team Live Dashboard  
> **Component:** `AgentFlowGraph.tsx`  
> **Status:** ✅ Complete  
> **Last Updated:** 2026-06-01  
> **Author:** OWL — Technical Writer & Diagram Specialist

---

## 📋 Table of Contents

1. [System Context Diagram](#1-system-context-diagram)
2. [Component Architecture](#2-component-architecture)
3. [Data Flow Diagram](#3-data-flow-diagram)
4. [Sequence Diagram — Render & Animation](#4-sequence-diagram--render--animation)
5. [Sequence Diagram — User Interaction](#5-sequence-diagram--user-interaction)
6. [State Machine — Agent Status](#6-state-machine--agent-status)
7. [State Machine — Connection Lifecycle](#7-state-machine--connection-lifecycle)
8. [ERD — Agent & Connection Types](#8-erd--agent--connection-types)
9. [Layout Algorithm](#9-layout-algorithm)
10. [Animation Timing Diagram](#10-animation-timing-diagram)
11. [Responsive Behavior Diagram](#11-responsive-behavior-diagram)
12. [Accessibility Flow](#12-accessibility-flow)

---

## 1. System Context Diagram

```mermaid
graph TB
    subgraph "User Browser"
        UI[Dashboard UI<br/>dashboard.cloudfly.com.co]
    end

    subgraph "CloudFly Frontend Container (Port 3000)"
        subgraph "Marketing AI Module"
            AFG[AgentFlowGraph.tsx<br/>🎯 SVG Flow Visualization]
            LAC[LiveAgentCard.tsx<br/>Agent Status Card]
            DISC[DiscoveryTab.tsx]
            TTAB[TenantsTab.tsx]
            MHT[MarketingHistoryTimeline.tsx]
        end
        subgraph "Shared Types"
            TYPES[aiMarketing.ts<br/>MarketingAgent<br/>AgentConnection]
        end
    end

    subgraph "CloudFly Backend (Port 8000)"
        API[REST API]
        WS[WebSocket Server<br/>Real-time Agent Updates]
    end

    subgraph "Message Broker"
        KAFKA[Apache Kafka<br/>Topic: whatsapp-notifications]
    end

    subgraph "Data Layer"
        REDIS[Redis Cache<br/>Sessions + State]
        PG[PostgreSQL<br/>Agent Config + History]
    end

    subgraph "External Services"
        EVO[Evolution API<br/>WhatsApp Integration<br/>Port 8080]
    end

    UI --> AFG
    UI --> LAC
    AFG --> TYPES
    LAC --> TYPES
    WS --> UI
    API --> WS
    API --> KAFKA
    API --> REDIS
    API --> PG
    KAFKA --> EVO

    style AFG fill:#3b82f6,color:#fff,stroke:#1d4ed8,stroke-width:3px
    style UI fill:#1e293b,color:#fff
    style TYPES fill:#8b5cf6,color:#fff
```

---

## 2. Component Architecture

```mermaid
graph TB
    subgraph "AgentFlowGraph Component"
        direction TB

        subgraph "Input Layer"
            PROPS["Props<br/>agents: MarketingAgent[]<br/>connections: AgentConnection[]<br/>width?: number<br/>height?: number<br/>onAgentClick?: (agent) => void"]
        end

        subgraph "Computation Layer"
            MEMO["useMemo<br/>nodePositions<br/>Three-tier resolution"]
            CB_CLICK["useCallback<br/>handleAgentClick"]
            CB_KEY["useCallback<br/>handleKeyDown"]
        end

        subgraph "Measurement Layer"
            REF["useRef<br/>containerRef"]
            DIM["useState<br/>dimensions: {width, height}"]
            EFFECT["useEffect<br/>Resize listener"]
        end

        subgraph "SVG Render Layer"
            SVG["<svg> Canvas<br/>viewBox responsive scaling"]
            DEFS["<defs><br/>arrowhead markers<br/>glow filter<br/>glow-soft filter"]
            CONN["Connection Group<br/>bezier paths<br/>dash overlays<br/>labels"]
            NODE["Agent Node Group<br/>cards<br/>pulse rings<br/>status dots<br/>text labels"]
        end
    end

    PROPS --> MEMO
    PROPS --> CB_CLICK
    PROPS --> CB_KEY
    REF --> DIM
    EFFECT --> DIM
    MEMO --> CONN
    MEMO --> NODE
    DIM --> SVG
    CB_CLICK --> NODE
    CB_KEY --> NODE
    SVG --> DEFS
    SVG --> CONN
    SVG --> NODE

    style PROPS fill:#3b82f6,color:#fff
    style SVG fill:#8b5cf6,color:#fff
    style CONN fill:#22c55e,color:#fff
    style NODE fill:#f59e0b,color:#000
```

---

## 3. Data Flow Diagram

```mermaid
flowchart TB
    subgraph "Data Sources"
        PARENT["Parent Component<br/>Fetches via API/WebSocket"]
    end

    subgraph "AgentFlowGraph Processing"
        subgraph "Position Resolution"
            P1["Priority 1<br/>AGENT_POSITIONS map<br/>Static coordinates"]
            P2["Priority 2<br/>agent.position<br/>From API data"]
            P3["Priority 3<br/>Grid fallback<br/>Auto-calculated"]
        end

        subgraph "Connection Processing"
            C1["Build bezier path<br/>buildCurvedPath()"]
            C2["Determine active state<br/>conn.active + agent.status"]
            C3["Select colors<br/>DATA_FLOW_COLORS or STATUS_COLORS"]
            C4["Calculate label position<br/>getBezierMidpoint()"]
        end

        subgraph "Animation Configuration"
            A1["Active connections<br/>glow filter + dash overlay"]
            A2["Working agents<br/>pulse rings + dot pulse"]
            A3["New connections<br/>fade-in animation"]
        end
    end

    subgraph "SVG Output"
        OUT["Rendered SVG<br/>Scalable Vector Graphics"]
    end

    PARENT --> P1
    PARENT --> P2
    PARENT --> P3
    P1 --> C1
    P2 --> C1
    P3 --> C1
    C1 --> C2
    C2 --> C3
    C3 --> C4
    C4 --> A1
    C4 --> A2
    C4 --> A3
    A1 --> OUT
    A2 --> OUT
    A3 --> OUT

    style PARENT fill:#1e293b,color:#fff
    style OUT fill:#22c55e,color:#fff
    style P1 fill:#3b82f6,color:#fff
    style A1 fill:#8b5cf6,color:#fff
```

---

## 4. Sequence Diagram — Render & Animation

```mermaid
sequenceDiagram
    participant R as React Engine
    participant AFG as AgentFlowGraph
    participant MEMO as useMemo
    participant SVG as SVG DOM
    participant DEF as defs
    participant CONN as Connections
    participant NODE as Agent Nodes
    participant ANIM as SVG Animations

    Note over R,ANIM: Phase 1: Initial Render

    R->>AFG: Render(agents, connections, props)
    AFG->>MEMO: Compute nodePositions
    MEMO->>MEMO: Check AGENT_POSITIONS map
    MEMO->>MEMO: Fallback to agent.position
    MEMO->>MEMO: Fallback to grid layout
    MEMO-->>AFG: positions map

    AFG->>SVG: Create <svg> element
    SVG->>DEF: Create arrowhead markers
    SVG->>DEF: Create glow filter (feGaussianBlur)
    SVG->>DEF: Create glow-soft filter

    Note over R,ANIM: Phase 2: Connection Rendering

    loop For each connection
        AFG->>CONN: Get sourcePos, targetPos
        CONN->>CONN: buildCurvedPath() → bezier Q path
        CONN->>CONN: Determine isActive
        alt isActive
            CONN->>CONN: stroke='#22c55e', filter='url(#glow)'
            CONN->>ANIM: Create dash overlay path
            ANIM->>ANIM: stroke-dashoffset: 0→-28 (0.8s loop)
        else Inactive
            CONN->>CONN: stroke=dataFlowColor, strokeDasharray='6 4'
        end
        opt Has label
            CONN->>CONN: getBezierMidpoint() for label position
            CONN->>ANIM: Label fade-in (0.3s, begin=0.1s)
        end
        CONN->>ANIM: Base path fade-in (0.3s)
    end

    Note over R,ANIM: Phase 3: Agent Node Rendering

    loop For each agent
        AFG->>NODE: Get position, statusColor
        alt status === 'working'
            NODE->>ANIM: Pulse ring 1: r 28→40→28 (1.5s loop)
            NODE->>ANIM: Pulse ring 2: r 28→50→28 (1.5s, begin=0.5s)
            NODE->>ANIM: Opacity: 0.4→0→0.4 (1.5s loop)
        end
        NODE->>NODE: Render card rect with status border
        NODE->>NODE: Render status dot circle
        alt status === 'working'
            NODE->>ANIM: Dot pulse: r 6→9→6 (1.5s loop)
        end
        NODE->>NODE: Render name text (displayName || name)
        NODE->>NODE: Render task text (truncated at 24 chars)
    end

    Note over R,ANIM: Phase 4: Interactive Setup

    alt onAgentClick provided
        NODE->>NODE: Add role='button', tabIndex=0
        NODE->>NODE: Add aria-label, onClick, onKeyDown
    end

    AFG-->>R: Render complete
```

---

## 5. Sequence Diagram — User Interaction

```mermaid
sequenceDiagram
    participant U as User
    participant SVG as SVG DOM
    participant AFG as AgentFlowGraph
    participant PARENT as Parent Component
    participant API as CloudFly API

    Note over U,API: Click Interaction

    U->>SVG: Click on agent node <g>
    SVG->>AFG: onClick event fires
    AFG->>AFG: handleAgentClick(agent)
    AFG->>PARENT: onAgentClick(agent)
    PARENT->>API: Fetch agent details / navigate

    Note over U,API: Keyboard Interaction

    U->>SVG: Tab to agent node
    SVG->>SVG: Focus <g> element (tabIndex=0)
    U->>SVG: Press Enter
    SVG->>AFG: onKeyDown(Enter)
    AFG->>AFG: e.preventDefault()
    AFG->>PARENT: onAgentClick(agent)

    U->>SVG: Press Space
    SVG->>AFG: onKeyDown(Space)
    AFG->>AFG: e.preventDefault()
    AFG->>PARENT: onAgentClick(agent)

    Note over U,API: Resize Interaction

    U->>U: Resize browser window
    Note over AFG: window 'resize' event
    AFG->>AFG: measure() via containerRef
    AFG->>AFG: getBoundingClientRect()
    AFG->>AFG: setDimensions({width, height})
    AFG->>SVG: Update viewBox
    SVG->>SVG: Browser rescales SVG content
```

---

## 6. State Machine — Agent Status

```mermaid
stateDiagram-v2
    [*] --> idle: Agent created

    idle --> working: Task assigned
    working --> waiting: Awaiting input/data
    working --> completed: Task finished
    working --> error: Error occurred

    waiting --> working: Data received
    waiting --> error: Timeout / error

    error --> idle: Reset / retry
    error --> working: Retry task

    completed --> idle: Ready for next task
    completed --> working: New task assigned

    idle --> [*]: Agent removed

    note right of working
        Triggers:
        - Pulse ring animations
        - Status dot pulse
        - Active connection glow
    end note

    note right of waiting
        Amber status color
        No pulse animations
    end note

    note right of error
        Red status color
        No pulse animations
    end note
```

---

## 7. State Machine — Connection Lifecycle

```mermaid
stateDiagram-v2
    [*] --> rendering: Connection added to props

    rendering --> fadeIn: SVG path created
    fadeIn --> active: conn.active=true AND agent working
    fadeIn --> inactive: conn.active=false OR no agent working

    inactive --> active: Agent starts working
    active --> inactive: Agent stops working

    active --> fadeOut: Connection removed from props
    inactive --> fadeOut: Connection removed from props

    fadeOut --> [*]: React unmounts path

    note right of active
        Visual: Green glow, solid line,
        white dash animation,
        arrowhead-active marker
    end note

    note right of inactive
        Visual: dataFlow color,
        dashed line (6 4),
        arrowhead marker
    end note
```

---

## 8. ERD — Agent & Connection Types

```mermaid
erDiagram
    MARKETING_AGENT {
        string id PK "Unique agent ID (e.g., 'researcher')"
        string name "Internal name"
        string displayName "Human-readable name"
        string role "Agent role description"
        enum status "working|waiting|error|completed|idle"
        string currentTask "Current task description"
        datetime taskStartedAt "Task start timestamp"
        datetime lastActivity "Last activity timestamp"
        string color "Hex color code"
        json position "Optional {x, y} position"
    }

    AGENT_CONNECTION {
        string id PK "Unique connection ID"
        string sourceAgentId FK "→ MarketingAgent.id"
        string targetAgentId FK "→ MarketingAgent.id"
        string label "Display label (e.g., 'Leads')"
        enum dataFlow "leads|analysis|messages|context"
        boolean active "Currently active"
    }

    AGENT_POSITION {
        string agentId PK "→ MarketingAgent.id"
        int x "X coordinate"
        int y "Y coordinate"
    }

    MARKETING_AGENT ||--o{ AGENT_CONNECTION : "source"
    MARKETING_AGENT ||--o{ AGENT_CONNECTION : "target"
    MARKETING_AGENT ||--|| AGENT_POSITION : "predefined"

    note right of AGENT_POSITION
        Static map in code:
        researcher: (80, 120)
        icp_agent: (280, 60)
        qualification_agent: (480, 120)
        copywriter_agent: (680, 60)
    end note
```

---

## 9. Layout Algorithm

```mermaid
flowchart TD
    START[Compute Node Positions] --> LOOP{For each agent}

    LOOP --> CHECK1{AGENT_POSITIONS<br/>has agent.id?}
    CHECK1 -->|Yes| P1["Use predefined position<br/>e.g., researcher → (80, 120)"]
    CHECK1 -->|No| CHECK2{agent.position<br/>has valid x,y?}
    CHECK2 -->|Yes| P2["Use agent.position<br/>Add SVG_PADDING offset"]
    CHECK2 -->|No| P3["Use grid fallback<br/>col = index % cols<br/>row = floor(index / cols)<br/>x = PAD + col × (CARD + GAP)<br/>y = PAD + row × (CARD + GAP)"]

    P1 --> STORE[Store in nodePositions map]
    P2 --> STORE
    P3 --> STORE

    STORE --> NEXT{More agents?}
    NEXT -->|Yes| LOOP
    NEXT -->|No| DONE[Return nodePositions map]

    style START fill:#3b82f6,color:#fff
    style P1 fill:#22c55e,color:#fff
    style P2 fill:#f59e0b,color:#000
    style P3 fill:#94a3b8,color:#fff
    style DONE fill:#8b5cf6,color:#fff
```

---

## 10. Animation Timing Diagram

```mermaid
gantt
    title AgentFlowGraph Animation Timing
    dateFormat X
    axisFormat %S.%L

    section Pulse Ring 1 (Working Agent)
    r: 28→40→28    :p1, 0, 1.5s
    opacity: 0.4→0→0.4 :p1o, 0, 1.5s
    repeat           :p1r, after p1, 1.5s

    section Pulse Ring 2 (Working Agent)
    r: 28→50→28    :p2, 0.5s, 1.5s
    opacity: 0.3→0→0.3 :p2o, 0.5s, 1.5s
    repeat           :p2r, after p2, 1.5s

    section Status Dot Pulse
    r: 6→9→6        :d1, 0, 1.5s
    repeat           :d1r, after d1, 1.5s

    section Dash Flow (Active Connection)
    stroke-dashoffset: 0→-28 :df, 0, 0.8s
    repeat                    :dfr, after df, 0.8s

    section Connection Fade-in
    opacity: 0→1    :cf, 0, 0.3s

    section Label Fade-in
    opacity: 0→1    :lf, 0.1s, 0.3s
```

---

## 11. Responsive Behavior Diagram

```mermaid
flowchart TB
    START[Container Mount] --> MEASURE[Measure containerRef<br/>getBoundingClientRect]
    MEASURE --> CHECK_PROP{width/height<br/>props provided?}

    CHECK_PROP -->|Yes| USE_PROP["Use prop values<br/>width × height"]
    CHECK_PROP -->|No| USE_MEASURE["Use measured values<br/>max(measured, 800×280)"]

    USE_PROP --> SET_VIEWBOX["Set viewBox<br/>0 0 width height"]
    USE_MEASURE --> SET_VIEWBOX

    SET_VIEWBOX --> RENDER[Render SVG content]
    RENDER --> LISTEN[Listen for window.resize]

    LISTEN --> RESIZE{Resize<br/>event?}
    RESIZE -->|Yes| RE_MEASURE[Re-measure container]
    RE_MEASURE --> CHECK_PROP
    RESIZE -->|No| WAIT[Wait for next event]

    WAIT --> RESIZE

    subgraph "Overflow Behavior"
        OVERFLOW["overflowX: 'auto'<br/>Horizontal scroll on small screens"]
    end

    RENDER --> OVERFLOW

    style START fill:#3b82f6,color:#fff
    style SET_VIEWBOX fill:#8b5cf6,color:#fff
    style OVERFLOW fill:#22c55e,color:#fff
```

---

## 12. Accessibility Flow

```mermaid
flowchart TD
    subgraph "Screen Reader"
        SR["Screen Reader<br/>Announces SVG as image"]
        SR --> LABEL["aria-label:<br/>'Grafo de flujo de agentes'"]
    end

    subgraph "Keyboard Navigation"
        TAB["Tab key<br/>Move focus"]
        TAB --> FOCUS["Focus agent node<br/>role='button' tabIndex=0"]
        FOCUS --> ENTER["Enter / Space<br/>Trigger onAgentClick"]
        ENTER --> CALLBACK["onAgentClick(agent)<br/>Parent handles action"]
    end

    subgraph "Visual Indicators"
        BORDER["Focus border<br/>Browser default outline"]
        BORDER --> HIGHLIGHT["Agent card highlighted"]
    end

    subgraph "ARIA Attributes"
        ROLE["role='button'<br/>When onAgentClick provided"]
        ARIA["aria-label='<name> - <status>'<br/>Describes agent state"]
        TAB_INDEX["tabIndex=0<br/>Focusable"]
    end

    FOCUS --> BORDER
    ROLE --> FOCUS
    ARIA --> SR
    TAB_INDEX --> TAB

    style SR fill:#1e293b,color:#fff
    style FOCUS fill:#3b82f6,color:#fff
    style CALLBACK fill:#22c55e,color:#fff
```

---

## Appendix: Diagram Legend

### Color Coding

| Color | Meaning |
|---|---|
| 🔵 Blue `#3b82f6` | Primary component / Input |
| 🟣 Purple `#8b5cf6` | SVG rendering / Filters |
| 🟢 Green `#22c55e` | Active state / Success |
| 🟡 Amber `#f59e0b` | Warning / Working state |
| ⚪ Gray `#94a3b8` | Inactive / Fallback |
| 🔴 Red `#ef4444` | Error state |
| ⬛ Dark `#1e293b` | External systems |

### Line Styles

| Style | Meaning |
|---|---|
| Solid `──>` | Data flow / Direct call |
| Dashed `..>` | Optional / Conditional |
| Bold `━━>` | Primary path |

---

*Generated by OWL — Technical Writer & Diagram Specialist*  
*CloudFly AI Platform — Marketing Team Live Dashboard*  
*CLOUD-208 / CLOUD-257 — AgentFlowGraph Component*

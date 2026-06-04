# CLOUD-277: Architecture Diagrams — Social Login OAuth + CRM Channel

## 📐 Diagrama de Componentes

```mermaid
graph TB
    subgraph "🌐 Cliente (Browser)"
        subgraph "Frontend Next.js :3000"
            UI_REG[RegisterV2.tsx<br/>Botones OAuth]
            UI_LOG[LoginV2.tsx<br/>Botones OAuth]
            OAUTH_COMP[OAuthProvider.tsx<br/>Google GSI + FB SDK]
            AUTH_MGR[AuthManager.ts<br/>Sesión + API calls]
        end
    end

    subgraph "🔧 Backend Spring WebFlux :8080"
        GOOGLE_CTRL[GoogleAuthController<br/>POST /api/v2/auth/oauth/google]
        FB_CTRL[FacebookOAuthController<br/>POST /api/v2/auth/oauth/facebook]
        OAUTH_SVC[OAuthService<br/>Validación + Usuario + Canal]
        JWT[JwtProvider<br/>Generación JWT]
        CHAN_SVC[ChannelService<br/>Creación canal CRM]
        USER_SVC[UserService<br/>Conversión DTO]
    end

    subgraph "🗄️ MySQL :3306"
        DB_USERS[(users<br/>+oauth_provider<br/>+oauth_provider_id<br/>+avatar_url)]
        DB_OAUTH[(user_oauth_accounts)]
        DB_CHAN[(channels<br/>platform=GOOGLE/FACEBOOK<br/>provider=GOOGLE_OAUTH/META_OAUTH)]
    end

    subgraph "🌍 External APIs"
        GOOGLE_API[Google Identity Services<br/>ID Token Validation]
        FB_API[Facebook Graph API<br/>debug_token + /me]
    end

    UI_REG --> OAUTH_COMP
    UI_LOG --> OAUTH_COMP
    OAUTH_COMP --> AUTH_MGR
    AUTH_MGR -->|POST /google| GOOGLE_CTRL
    AUTH_MGR -->|POST /facebook| FB_CTRL
    GOOGLE_CTRL --> OAUTH_SVC
    FB_CTRL --> OAUTH_SVC
    OAUTH_SVC -->|Validar| GOOGLE_API
    OAUTH_SVC -->|Validar| FB_API
    OAUTH_SVC --> DB_USERS
    OAUTH_SVC --> DB_OAUTH
    OAUTH_SVC --> CHAN_SVC
    CHAN_SVC --> DB_CHAN
    OAUTH_SVC --> USER_SVC
    OAUTH_SVC --> JWT
    JWT -->|AuthResponse| AUTH_MGR

    style UI_REG fill:#4285F4,color:#fff
    style UI_LOG fill:#4285F4,color:#fff
    style GOOGLE_CTRL fill:#1a73e8,color:#fff
    style FB_CTRL fill:#1877F2,color:#fff
    style OAUTH_SVC fill:#34a853,color:#fff
    style DB_USERS fill:#fbbc04,color:#000
    style DB_OAUTH fill:#fbbc04,color:#000
    style DB_CHAN fill:#fbbc04,color:#000
```

## 🔄 Flujo de Registro OAuth (Nuevo Usuario)

```mermaid
sequenceDiagram
    actor U as 👤 Usuario
    participant F as Frontend<br/>(RegisterV2.tsx)
    participant B as Backend<br/>(OAuthService)
    participant G as Google/Facebook<br/>OAuth Provider
    participant D as MySQL<br/>(users, oauth_accounts, channels)

    U->>F: 1. Click "Continuar con Google"
    F->>G: 2. Abrir popup OAuth
    G->>U: 3. Mostrar pantalla de permisos
    U->>G: 4. Aceptar permisos
    G->>F: 5. Retornar credential (ID token / Access token)
    F->>B: 6. POST /api/v2/auth/oauth/google<br/>{ credential: "eyJ..." }
    B->>G: 7. Validar token con provider
    G->>B: 8. Token válido + datos usuario
    B->>D: 9. Buscar OAuth account existente
    D-->>B: 10. No existe
    B->>D: 11. Buscar usuario por email
    D-->>B: 12. No existe
    B->>D: 13. Crear Tenant + User + Role ADMIN
    B->>D: 14. INSERT user_oauth_accounts
    B->>D: 15. INSERT channels (GOOGLE_OAUTH)
    B->>B: 16. Generar JWT
    B->>F: 17. AuthResponse { jwt, user, status: true }
    F->>F: 18. saveOAuthSession(jwt, user)
    F->>U: 19. Redirect /account-setup
```

## 🔄 Flujo de Login OAuth (Usuario Existente)

```mermaid
sequenceDiagram
    actor U as 👤 Usuario
    participant F as Frontend<br/>(LoginV2.tsx)
    participant B as Backend<br/>(OAuthService)
    participant G as Google/Facebook<br/>OAuth Provider
    participant D as MySQL

    U->>F: 1. Click "Iniciar con Google"
    F->>G: 2. Abrir popup OAuth
    G->>U: 3. Seleccionar cuenta
    G->>F: 4. Retornar credential
    F->>B: 5. POST /api/v2/auth/oauth/google
    B->>G: 6. Validar token
    G->>B: 7. Token válido
    B->>D: 8. Buscar OAuth account
    D-->>B: 9. OAuth account encontrado (user_id: 42)
    B->>D: 10. SELECT * FROM users WHERE id=42
    D-->>B: 11. UserEntity { email, roles, ... }
    B->>B: 12. Generar JWT con roles
    B->>F: 13. AuthResponse { jwt, user, status: true }
    F->>F: 14. saveOAuthSession(jwt, user)
    F->>U: 15. Redirect /home (según rol)
```

## 🔄 Flujo de Vinculación (Email Existente)

```mermaid
sequenceDiagram
    actor U as 👤 Usuario
    participant F as Frontend
    participant B as Backend<br/>(OAuthService)
    participant D as MySQL

    Note over U,D: Usuario ya registrado tradicionalmente<br/>con email: juan@email.com

    U->>F: 1. Click "Iniciar con Google"
    F->>B: 2. POST /api/v2/auth/oauth/google<br/>{ credential: "eyJ..." }
    B->>B: 3. Validar token Google
    Note over B: Extraer: sub=google-123, email=juan@email.com
    B->>D: 4. Buscar OAuth account (GOOGLE, google-123)
    D-->>B: 5. No existe
    B->>D: 6. Buscar usuario por email (juan@email.com)
    D-->>B: 7. UserEntity encontrado (id: 10)
    B->>D: 8. INSERT user_oauth_accounts<br/>(user_id=10, provider=GOOGLE, provider_user_id=google-123)
    B->>D: 9. UPDATE users SET oauth_provider=GOOGLE<br/>WHERE id=10
    B->>B: 10. Generar JWT
    B->>F: 11. AuthResponse { jwt, user, status: true }
    F->>U: 12. Login exitoso (sin duplicar usuario)
```

## 🏗️ Arquitectura de Despliegue (Docker)

```mermaid
graph TB
    subgraph "Docker Host (VPS api.cloudfly.com.co)"
        subgraph "app-net"
            TRAEFIK[Traefik :80/443<br/>Reverse Proxy SSL]
            FRONT[frontend-react :3000<br/>Next.js + OAuth SDKs]
            BACK[backend-api :8080<br/>Spring WebFlux + OAuth]
            MYSQL[(mysql :3306<br/>cloud_master)]
        end

        subgraph "kafka-net"
            KAFKA[Kafka :9092<br/>whatsapp-notifications]
            ZK[Zookeeper :2181]
        end

        subgraph "isolated"
            EVOLUTION[evolution_api :8082<br/>WhatsApp]
            POSTGRES[(postgres :5432<br/>pgvector)]
            REDIS[(redis :6379)]
            QDRANT[Qdrant :6333]
        end
    end

    subgraph "External"
        GOOGLE[Google Cloud<br/>OAuth 2.0 + Identity]
        META[Meta Platform<br/>Facebook Login + Graph API]
    end

    TRAEFIK -->|dashboard.cloudfly.com.co| FRONT
    TRAEFIK -->|api.cloudfly.com.co| BACK
    FRONT -->|REST API| BACK
    BACK --> MYSQL
    BACK --> KAFKA
    BACK -->|HTTPS| GOOGLE
    BACK -->|HTTPS| META
    FRONT -->|SDK| GOOGLE
    FRONT -->|SDK| META

    style TRAEFIK fill:#ff6b6b,color:#fff
    style FRONT fill:#4285F4,color:#fff
    style BACK fill:#34a853,color:#fff
    style MYSQL fill:#fbbc04,color:#000
    style GOOGLE fill:#ea4335,color:#fff
    style META fill:#1877F2,color:#fff
```

## 📊 Modelo de Datos — Tablas Afectadas

```mermaid
erDiagram
    users {
        BIGINT id PK
        VARCHAR nombres
        VARCHAR apellidos
        VARCHAR username
        VARCHAR password "NULL para OAuth"
        VARCHAR email
        BOOLEAN is_enabled "true para OAuth"
        BIGINT customer_id FK
        BIGINT company_id FK
        VARCHAR oauth_provider "GOOGLE|FACEBOOK|MICROSOFT"
        VARCHAR oauth_provider_id "sub de Google / id de Facebook"
        VARCHAR avatar_url "URL foto perfil"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    user_oauth_accounts {
        BIGINT id PK
        BIGINT user_id FK "ON DELETE CASCADE"
        VARCHAR provider "GOOGLE|FACEBOOK|MICROSOFT"
        VARCHAR provider_user_id "ID único del provider"
        VARCHAR email "Email del provider"
        VARCHAR display_name "Nombre del provider"
        VARCHAR avatar_url "Foto del provider"
        TEXT access_token "Encriptado"
        TEXT refresh_token "Encriptado"
        TIMESTAMP token_expires_at
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    channels {
        BIGINT id PK
        BIGINT tenant_id FK
        BIGINT company_id FK
        VARCHAR name "Canal GOOGLE - {username}"
        VARCHAR platform "GOOGLE|FACEBOOK|WHATSAPP"
        VARCHAR provider "GOOGLE_OAUTH|META_OAUTH|EVOLUTION"
        BOOLEAN status "true"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    tenants {
        BIGINT id PK
        VARCHAR name "Usuario's Company"
        BIGINT admin_user_id FK
    }

    users ||--o{ user_oauth_accounts : "1:N vinculación"
    users ||--o{ channels : "posee vía tenant"
    tenants ||--o{ users : "1:N miembros"
    tenants ||--o{ channels : "1:N canales"
```

## 🔐 Flujo de Seguridad — Validación de Tokens

```mermaid
flowchart TD
    A[Token recibido del Frontend] --> B{¿Proveedor?}
    
    B -->|Google| C[Decodificar JWT]
    C --> D{¿Audience coincide<br/>con GOOGLE_CLIENT_ID?}
    D -->|NO| E[❌ Rechazar: Audience mismatch]
    D -->|SÍ| F{¿Token expirado?}
    F -->|SÍ| G[❌ Rechazar: Token expired]
    F -->|NO| H[Extraer: sub, email, name, picture]
    H --> I[✅ OAuthUserInfo válido]
    
    B -->|Facebook| J[GET debug_token<br/>Graph API]
    J --> K{¿is_valid = true?}
    K -->|NO| L[❌ Rechazar: Token inválido]
    K -->|SÍ| M{¿app_id coincide<br/>con FACEBOOK_APP_ID?}
    M -->|NO| N[❌ Rechazar: App ID mismatch]
    M -->|SÍ| O[GET /me?fields=id,name,email,picture]
    O --> P[Extraer: id, email, name, picture]
    P --> I

    style A fill:#4285F4,color:#fff
    style I fill:#34a853,color:#fff
    style E fill:#ea4335,color:#fff
    style G fill:#ea4335,color:#fff
    style L fill:#ea4335,color:#fff
    style N fill:#ea4335,color:#fff
```

## 📱 Integración Frontend — Componentes

```mermaid
graph LR
    subgraph "layout.tsx"
        ROOT[Root Layout] -->|envuelve| GOOG_PROV[GoogleOAuthProvider<br/>clientId]
        ROOT -->|carga script| FB_SDK[Facebook SDK<br/>FB.init]
    end

    subgraph "RegisterV2.tsx"
        REG_FORM[Form Registro] 
        REG_GOOG[Button Google<br/>onClick: handleGoogleOAuth]
        REG_FB[Button Facebook<br/>onClick: handleFacebookOAuth]
        REG_GOOG -->|credential| REG_AUTH[AuthManager<br/>.loginWithGoogle]
        REG_FB -->|accessToken + userId| REG_AUTH2[AuthManager<br/>.loginWithFacebook]
    end

    subgraph "LoginV2.tsx"
        LOG_FORM[Form Login]
        LOG_GOOG[Button Google<br/>onClick: handleGoogleOAuth]
        LOG_FB[Button Facebook<br/>onClick: handleFacebookOAuth]
        LOG_GOOG -->|credential| LOG_AUTH[AuthManager<br/>.loginWithGoogle]
        LOG_FB -->|accessToken + userId| LOG_AUTH2[AuthManager<br/>.loginWithFacebook]
    end

    subgraph "OAuthProvider.tsx"
        OAUTH_COMP[OAuthProvider Component]
        OAUTH_COMP -->|triggerFacebookLogin| FB_POPUP[FB.login Popup]
        OAUTH_COMP -->|Google One Tap| GOOG_POPUP[Google One Tap]
    end

    subgraph "authManager.ts"
        AUTH[AuthManager]
        AUTH -->|saveOAuthSession| LOCAL[localStorage<br/>jwt + userData + isOAuthUser]
        AUTH -->|loginWithGoogle| API_G[POST /api/v2/auth/oauth/google]
        AUTH -->|loginWithFacebook| API_F[POST /api/v2/auth/oauth/facebook]
        AUTH -->|isOAuthUser| CHECK[localStorage<br/>isOAuthUser === 'true']
    end

    REG_AUTH --> AUTH
    REG_AUTH2 --> AUTH
    LOG_AUTH --> AUTH
    LOG_AUTH2 --> AUTH
    REG_GOOG --> OAUTH_COMP
    REG_FB --> OAUTH_COMP
    LOG_GOOG --> OAUTH_COMP
    LOG_FB --> OAUTH_COMP

    style ROOT fill:#6c5ce7,color:#fff
    style AUTH fill:#00b894,color:#fff
    style LOCAL fill:#fdcb6e,color:#000
```

---

*Diagramas generados por 🤖 **Technical Writer** — CloudFly AI Scrum Team*  
*Última actualización: 2026-06-03*

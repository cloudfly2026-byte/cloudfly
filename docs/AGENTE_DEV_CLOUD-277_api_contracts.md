# CLOUD-277: API Contracts — Social Login OAuth

## 📋 Información General

- **Base URL:** `http://localhost:8080` (desarrollo) / `https://api.cloudfly.com.co` (producción)
- **Versión API:** v2
- **Autenticación:** Pública (sin JWT requerido para endpoints OAuth)
- **Formato:** JSON
- **CORS:** Habilitado para todos los orígenes (restringir en producción)

---

## 🔐 Endpoints OAuth

### 1. Google OAuth Login

```http
POST /api/v2/auth/oauth/google
```

Autentica o registra un usuario usando un Google ID Token.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "credential": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2Nz...",
  "provider": "GOOGLE"
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `credential` | string | ✅ | Google ID Token (JWT) obtenido de Google Identity Services |
| `provider` | string | ❌ | Identificador del proveedor (default: "GOOGLE") |

**Response 200 — Éxito:**
```json
{
  "username": "johndoe_google_7842",
  "message": "Google login exitoso",
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqb2huZG9lX2dvb2dlXzc4NDIiLCJpYXQiOjE3MTczODQwMDAsImV4cCI6MTcxNzQ3MDQwMCwiYXV0aG9yaXRpZXMiOiJST0xFX0FETUlOLFJPTEVfVVNFUiIsImN1c3RvbWVySWQiOjEwLCJjb21wYW55SWQiOjV9.signature",
  "status": true,
  "user": {
    "id": 1,
    "nombres": "John",
    "apellidos": "Doe",
    "username": "johndoe_google_7842",
    "email": "john.doe@gmail.com",
    "role": "ADMIN",
    "customerId": 10,
    "tenantId": 10,
    "activeCompanyId": 5,
    "companyName": "John's Company",
    "onboardingCompleted": false,
    "avatarUrl": "https://lh3.googleusercontent.com/a/...",
    "enabled": true
  }
}
```

**Response 400 — Credencial faltante:**
```json
{
  "status": false,
  "message": "Google credential (ID token) is required"
}
```

**Response 401 — Token inválido:**
```json
{
  "status": false,
  "message": "Google authentication failed: Invalid Google token: JWT signature does not match"
}
```

**Response 401 — Token expirado:**
```json
{
  "status": false,
  "message": "Google authentication failed: Google token has expired"
}
```

---

### 2. Facebook OAuth Login

```http
POST /api/v2/auth/oauth/facebook
```

Autentica o registra un usuario usando un Facebook Access Token.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "credential": "EAABsbCS1iZABAAM7ZCvkq2IB5ZC...",
  "userId": "10234567890123456",
  "provider": "FACEBOOK"
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `credential` | string | ✅ | Facebook Access Token obtenido de `FB.login()` |
| `userId` | string | ✅ | Facebook User ID obtenido de `FB.login()` response |
| `provider` | string | ❌ | Identificador del proveedor (default: "FACEBOOK") |

**Response 200 — Éxito:**
```json
{
  "username": "janedoe_facebook_3156",
  "message": "Facebook login exitoso",
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqYW5lZG9lX2ZhY2Vib29rXzMxNTYiLCJpYXQiOjE3MTczODQwMDAsImV4cCI6MTcxNzQ3MDQwMCwiYXV0aG9yaXRpZXMiOiJST0xFX0FETUlOLFJPTEVfVVNFUiIsImN1c3RvbWVySWQiOjExLCJjb21wYW55SWQiOjZ9.signature",
  "status": true,
  "user": {
    "id": 2,
    "nombres": "Jane",
    "apellidos": "Doe",
    "username": "janedoe_facebook_3156",
    "email": "jane.doe@example.com",
    "role": "ADMIN",
    "customerId": 11,
    "tenantId": 11,
    "activeCompanyId": 6,
    "companyName": "Jane's Company",
    "onboardingCompleted": true,
    "avatarUrl": "https://platform-lookaside.fbsbx.com/platform/profilepic/...",
    "enabled": true
  }
}
```

**Response 400 — Token faltante:**
```json
{
  "status": false,
  "message": "Facebook access token is required"
}
```

**Response 400 — UserId faltante:**
```json
{
  "status": false,
  "message": "Facebook userId is required"
}
```

**Response 401 — Token inválido:**
```json
{
  "status": false,
  "message": "Facebook authentication failed: Facebook token is invalid"
}
```

**Response 401 — App ID mismatch:**
```json
{
  "status": false,
  "message": "Facebook authentication failed: Facebook token app_id mismatch"
}
```

---

### 3. Google Client Config

```http
GET /api/v2/auth/oauth/google/config
```

Retorna la configuración pública de Google OAuth para inicialización del frontend.

**Request:** Sin body

**Response 200:**
```json
{
  "clientId": "123456789-abcdefghijk.apps.googleusercontent.com"
}
```

---

### 4. Facebook App Config

```http
GET /api/v2/auth/oauth/facebook/config
```

Retorna la configuración pública de Facebook OAuth para inicialización del frontend.

**Request:** Sin body

**Response 200:**
```json
{
  "appId": "987654321012345"
}
```

---

## 📦 DTOs

### OAuthLoginRequest

```java
public class OAuthLoginRequest {
    private String credential;  // Google ID Token / Facebook Access Token
    private String userId;      // Facebook User ID (not used for Google)
    private String provider;    // "GOOGLE" or "FACEBOOK"
}
```

### OAuthUserInfo

```java
public class OAuthUserInfo {
    private String provider;        // GOOGLE, FACEBOOK
    private String providerUserId;  // Unique ID from the provider
    private String email;
    private String displayName;
    private String avatarUrl;
    private boolean emailVerified;
}
```

### AuthResponse

```java
public class AuthResponse {
    private String username;
    private String message;
    private String jwt;
    private boolean status;
    private UserDto user;
}
```

---

## 🔄 Códigos de Estado HTTP

| Código | Significado | Cuándo |
|---|---|---|
| 200 | OK | Autenticación exitosa, JWT generado |
| 400 | Bad Request | Faltan campos requeridos en el request |
| 401 | Unauthorized | Token inválido, expirado, o app_id mismatch |
| 500 | Internal Server Error | Error inesperado en el servidor |

---

## 🔒 Seguridad

1. **Endpoints públicos**: `/api/v2/auth/oauth/**` no requieren autenticación JWT
2. **Rate limiting**: Implementar en producción (sugerido: 10 req/min por IP)
3. **Validación de tokens**: Siempre validar en el backend, nunca confiar solo del frontend
4. **HTTPS obligatorio** en producción para proteger tokens en tránsito
5. **Variables de entorno**: Nunca hardcodear `GOOGLE_CLIENT_SECRET` ni `FACEBOOK_APP_SECRET`

---

## 📱 Integración Frontend

### Ejemplo de llamada desde AuthManager.ts

```typescript
// Google OAuth
const response = await AuthManager.loginWithGoogle(googleIdToken)
if (response.status) {
  // JWT guardado automáticamente en localStorage
  router.push('/home')
}

// Facebook OAuth
const response = await AuthManager.loginWithFacebook(accessToken, userId)
if (response.status) {
  // JWT guardado automáticamente en localStorage
  router.push('/home')
}
```

### Ejemplo de respuesta del backend

```typescript
interface OAuthResponse {
  username: string
  message: string
  jwt: string
  status: boolean
  user: {
    id: number
    email: string
    nombres: string
    apellidos: string
    role: string
    customerId: number
    activeCompanyId: number
    onboardingCompleted: boolean
    avatarUrl: string
  }
}
```

---

*Documentación generada por 🤖 **Technical Writer** — CloudFly AI Scrum Team*  
*Última actualización: 2026-06-03*

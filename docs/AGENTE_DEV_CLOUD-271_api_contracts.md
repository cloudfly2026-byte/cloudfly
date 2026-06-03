# CLOUD-271: CRM Contacts — API Contracts

## Base URL

```
https://api.cloudfly.com.co/api/v1/contacts
```

> **Note:** The `backend-new` container is routed via Traefik at `Host(api.cloudfly.com.co) && PathPrefix(/api/v2)`, but the Spring Boot application internally maps endpoints to `/api/v1/contacts`. The frontend RTK Query slice uses `/api/v2/contacts` as the base URL, which Traefik rewrites to the container's port 8080.

---

## Authentication

All endpoints require a valid JWT Bearer token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

Optional admin override headers (requires `ROLE_ADMIN` or `ROLE_MANAGER`):

```
x-tenant-id: <tenant_id>
x-company-id: <company_id>
```

---

## Endpoints

### 1. Get Paginated Contacts (Primary Endpoint)

```
GET /api/v1/contacts/paginated
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | `int` | No | `0` | Page number (0-indexed) |
| `size` | `int` | No | `20` | Page size (max 100) |
| `name` | `string` | No | — | Filter by name (partial match, case-insensitive) |
| `email` | `string` | No | — | Filter by email (partial match, case-insensitive) |
| `phone` | `string` | No | — | Filter by phone (partial match) |
| `identification` | `string` | No | — | Filter by document number (partial match) |

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": 1,
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "email": "john@gmail.com",
      "phone": "3001234567",
      "address": "Calle 123 #45-67",
      "taxId": "900123456",
      "type": "LEAD",
      "stage": "LEAD",
      "position": "CEO",
      "isEmployee": false,
      "avatarUrl": null,
      "tenantId": 1,
      "companyId": 1,
      "pipelineId": 1,
      "stageId": 1,
      "documentType": "CC",
      "documentNumber": "123456789",
      "isActive": true,
      "chatbotEnabled": false,
      "assignedUserIds": "1,2,3",
      "createdAt": "2025-01-15T10:30:00",
      "updatedAt": "2025-01-20T14:45:00"
    }
  ],
  "totalElements": 150,
  "totalPages": 8,
  "currentPage": 0,
  "pageSize": 20
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| `401` | Missing or invalid JWT token |
| `403` | Insufficient role permissions |
| `500` | Internal server error |

---

### 2. Get All Contacts (Legacy)

```
GET /api/v1/contacts
```

**Response (200 OK):**

```json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@gmail.com",
    ...
  }
]
```

> **Deprecated:** Use `/paginated` for new implementations.

---

### 3. Get Contact by ID

```
GET /api/v1/contacts/{id}
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `long` | Yes | Contact ID |

**Response (200 OK):**

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "name": "John Doe",
  "email": "john@gmail.com",
  "phone": "3001234567",
  "address": "Calle 123 #45-67",
  "taxId": "900123456",
  "type": "LEAD",
  "stage": "LEAD",
  "position": "CEO",
  "isEmployee": false,
  "avatarUrl": null,
  "tenantId": 1,
  "companyId": 1,
  "pipelineId": 1,
  "stageId": 1,
  "documentType": "CC",
  "documentNumber": "123456789",
  "isActive": true,
  "chatbotEnabled": false,
  "assignedUserIds": "1,2,3",
  "createdAt": "2025-01-15T10:30:00",
  "updatedAt": "2025-01-20T14:45:00"
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| `401` | Missing or invalid JWT token |
| `403` | Insufficient role permissions |
| `404` | Contact not found or not in tenant scope |
| `500` | Internal server error |

---

### 4. Create Contact

```
POST /api/v1/contacts
```

**Request Body:**

```json
{
  "name": "Jane Smith",
  "email": "jane@company.com",
  "phone": "3009876543",
  "address": "Avenida 456 #78-90",
  "taxId": "800987654",
  "type": "LEAD",
  "stage": "LEAD",
  "position": "CTO",
  "documentType": "CC",
  "documentNumber": "987654321",
  "isActive": true,
  "assignedUserIds": "1,2"
}
```

**Required Fields:**

| Field | Type | Constraints |
|-------|------|-------------|
| `name` | `string` | Non-empty, max 255 chars |
| `type` | `string` | One of: `LEAD`, `POTENTIAL_CUSTOMER`, `CUSTOMER`, `CLIENT`, `SUPPLIER`, `OTHER` |

**Optional Fields:**

| Field | Type | Constraints |
|-------|------|-------------|
| `email` | `string` | Valid email format, unique per tenant |
| `phone` | `string` | Digits only (non-digits stripped), unique per tenant |
| `address` | `string` | Max 500 chars |
| `taxId` | `string` | Max 50 chars |
| `stage` | `string` | Default: `LEAD` |
| `position` | `string` | Max 255 chars |
| `documentType` | `string` | One of: `CC`, `CE`, `NIT`, `PA` |
| `documentNumber` | `string` | Unique per tenant |
| `isActive` | `boolean` | Default: `true` |
| `assignedUserIds` | `string` | Comma-separated user IDs |

**Response (201 Created):**

```json
{
  "id": 2,
  "uuid": "660f9511-f3ac-52e5-b827-557766551111",
  "name": "Jane Smith",
  "email": "jane@company.com",
  "phone": "3009876543",
  "address": "Avenida 456 #78-90",
  "taxId": "800987654",
  "type": "LEAD",
  "stage": "LEAD",
  "position": "CTO",
  "isEmployee": false,
  "avatarUrl": null,
  "tenantId": 1,
  "companyId": 1,
  "pipelineId": null,
  "stageId": null,
  "documentType": "CC",
  "documentNumber": "987654321",
  "isActive": true,
  "chatbotEnabled": false,
  "assignedUserIds": "1,2",
  "createdAt": "2025-01-20T15:00:00",
  "updatedAt": "2025-01-20T15:00:00"
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| `400` | Validation error (missing required fields, invalid format) |
| `401` | Missing or invalid JWT token |
| `403` | Insufficient role permissions |
| `409` | Duplicate phone, email, or document number |
| `500` | Internal server error |

**Side Effects:**
- Publishes `CONTACT_CREATED` event to Kafka topic `contact-events`
- Publishes web notification to Kafka topic `webnotifications`

---

### 5. Update Contact

```
PUT /api/v1/contacts/{id}
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `long` | Yes | Contact ID |

**Request Body:** Same as Create Contact (all fields optional for partial update)

**Response (200 OK):** Updated contact object

**Error Responses:**

| Status | Description |
|--------|-------------|
| `400` | Validation error |
| `401` | Missing or invalid JWT token |
| `403` | Insufficient role permissions |
| `404` | Contact not found |
| `409` | Duplicate phone, email, or document number |
| `500` | Internal server error |

**Side Effects:**
- Publishes `CONTACT_UPDATED` event to Kafka topic `contact-events`
- Publishes web notification to Kafka topic `webnotifications`

---

### 6. Delete Contact

```
DELETE /api/v1/contacts/{id}
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `long` | Yes | Contact ID |

**Response (204 No Content)**

**Error Responses:**

| Status | Description |
|--------|-------------|
| `401` | Missing or invalid JWT token |
| `403` | Insufficient role permissions |
| `404` | Contact not found |
| `500` | Internal server error |

**Side Effects:**
- Publishes `CONTACT_DELETED` event to Kafka topic `contact-events`
- Publishes web notification to Kafka topic `webnotifications`

---

### 7. Search Contacts

```
GET /api/v1/contacts/search?q={query}
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | `string` | Yes | Search query (min 2 chars) |

**Response (200 OK):**

```json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@gmail.com",
    "phone": "3001234567",
    "documentNumber": "123456789",
    ...
  }
]
```

> **Note:** Results are limited to 20 contacts. Search matches against name, email, and document number.

---

### 8. Check Phone Availability

```
GET /api/v1/contacts/check-phone?phone={phone}
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `phone` | `string` | Yes | Phone number to check |

**Response (200 OK):**

```json
true
```

> Returns `true` if the phone number already exists (not available), `false` if available.

---

### 9. Check Email Availability

```
GET /api/v1/contacts/check-email?email={email}
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | `string` | Yes | Email to check |

**Response (200 OK):**

```json
true
```

> Returns `true` if the email already exists (not available), `false` if available.

---

### 10. Check Document Availability

```
GET /api/v1/contacts/check-document?documentNumber={doc}&excludeId={id}
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentNumber` | `string` | Yes | Document number to check |
| `excludeId` | `long` | No | Contact ID to exclude from check (for updates) |

**Response (200 OK):**

```json
false
```

> Returns `true` if the document number already exists (not available), `false` if available.

---

### 11. Toggle Chatbot

```
PATCH /api/v1/contacts/{id}/chatbot
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `long` | Yes | Contact ID |

**Request Body:**

```json
{
  "enabled": true
}
```

**Response (200 OK):** Updated contact object

---

## Data Types

### Contact Type Enum

| Value | Description |
|-------|-------------|
| `LEAD` | Initial prospect |
| `POTENTIAL_CUSTOMER` | Qualified lead |
| `CUSTOMER` | Active customer |
| `CLIENT` | Client (synonym for CUSTOMER) |
| `SUPPLIER` | Supplier/vendor |
| `OTHER` | Other type |

### Document Type Enum

| Value | Description |
|-------|-------------|
| `CC` | Cédula de Ciudadanía |
| `CE` | Cédula de Extranjería |
| `NIT` | Número de Identificación Tributaria |
| `PA` | Pasaporte |

### Role Permissions

| Role | GET | POST | PUT | DELETE |
|------|-----|------|-----|--------|
| `SUPERADMIN` | ✅ | ✅ | ✅ | ✅ |
| `ADMIN` | ✅ | ✅ | ✅ | ✅ |
| `MANAGER` | ✅ | ✅ | ✅ | ✅ |
| `USER` | ✅ | ❌ | ❌ | ❌ |

---

## Kafka Events

### Topic: `contact-events`

**Event Types:**

| Action | Description |
|--------|-------------|
| `CONTACT_CREATED` | New contact created |
| `CONTACT_UPDATED` | Existing contact updated |
| `CONTACT_DELETED` | Contact deleted |

**Event Payload:**

```json
{
  "action": "CONTACT_CREATED",
  "contactId": 1,
  "tenantId": 1,
  "companyId": 1,
  "timestamp": 1705312200000
}
```

### Topic: `webnotifications`

**Event Payload:**

```json
{
  "tenantId": 1,
  "companyId": 1,
  "userId": null,
  "title": "👤 Nuevo Contacto",
  "description": "Se ha registrado a John Doe",
  "type": "contact"
}
```

---

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| All GET endpoints | 100 requests/minute |
| All POST/PUT/DELETE endpoints | 30 requests/minute |

---

## Error Response Format

All error responses follow this structure:

```json
{
  "timestamp": "2025-01-20T15:00:00",
  "status": 400,
  "error": "Bad Request",
  "message": "El número de teléfono ya está registrado.",
  "path": "/api/v1/contacts"
}
```

---

*Document generated by OWL — Technical Writer & Diagram Specialist*
*Date: 2025-01-20 | Ticket: CLOUD-271*

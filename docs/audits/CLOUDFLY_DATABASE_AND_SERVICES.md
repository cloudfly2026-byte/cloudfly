# Auditoría de Bases de Datos, Servicios y Aislamiento Multi-Tenancy

**Fecha de Auditoría:** Noviembre 2026  
**Componentes Evaluados:** MySQL 8.0, PostgreSQL 15 + pgvector, Qdrant, Redis 7, Kafka 7.4, Spring R2DBC, Go Fiber, Node.js

---

## 1. Inventario de Bases de Datos y Almacenes de Persistencia

CloudFly utiliza una estrategia de persistencia políglota distribuida en función de la naturaleza de los datos:

| Motor de Base de Datos | Contenedor / Servicio | Rol Principal | Esquema / Nombres Clave | Aislamiento Implementado |
| :--- | :--- | :--- | :--- | :--- |
| **MySQL 8.0** | `mysql` (puerto 3306) | Base de datos relacional maestra (OLTP). Contiene usuarios, tenants, empresas, productos, ventas, temas, layouts y configuración. | `cloud_master` (DDL en `db/cloud_master_structure.sql`) | Discriminador por columnas (`customer_id` / `company_id`) en una misma base de datos (Shared Database, Shared Schema). |
| **PostgreSQL 15 + pgvector** | `postgresql` (puerto 5432) | Almacén relacional con soporte vectorial para embeddings de contexto conversacional y memoria histórica de IA. | `cloudfly_vectors` | Colecciones y tablas asociadas a identificadores de empresa. |
| **Qdrant Vector DB** | `qdrant` (puerto 6333) | Base de datos vectorial pura para búsqueda semántica ultrarrápida (RAG) de catálogos y preguntas frecuentes. | Colecciones indexadas por tenant/company (`products_vector_{company_id}`). | Espacios de nombres y colecciones por tenant. |
| **Redis 7** | `redis` (puerto 6379) | Caché de segundo nivel, invalidación de páginas HTML (`storefront:html:{company_id}:*`), sesiones y pub/sub de presencia. | Claves prefijadas (`website:*`, `theme:*`, `layout:*`, `chat:*`). | Prefijado de llaves por entidad y empresa. |
| **Apache Kafka 7.4** | `kafka` / `zookeeper` (puertos 9092/9093) | Bus de eventos asíncronos y desacoplamiento de microservicios. | Topics: `agents_site_constructor`, `marketing_events`, `chat_messages`. | Particionado y payloads con metadatos de tenant. |

---

## 2. Evaluación de la Arquitectura Multi-Inquilino (Multi-Tenancy)

El modelo de CloudFly está estructurado jerárquicamente en dos niveles:
1. **Tenant / Customer (`customer_id`):** Representa al cliente suscriptor de la plataforma SaaS (cuenta matriz).
2. **Company (`company_id`):** Representa cada negocio o filial administrada dentro de la cuenta del tenant.

### 2.1. Integridad Referencial y Columnas Discriminadoras
- En el esquema MySQL (`cloud_master`), la gran mayoría de tablas de negocio (`products`, `orders`, `quotes`, `invoices`, `contacts`, `company_website`, `company_layout`) cuentan con las columnas `customer_id` y `company_id`.
- Existen scripts de migración dedicados (`db/add_company_id_column.js`, `db/migration_add_company_id_to_media.js`) que regularizaron tablas creadas en iteraciones tempranas.

### 2.2. Aislamiento en el Backend (`backend_new`)
- En `JwtAuthenticationFilter.java:55`, el backend extrae del token JWT los claims `customer_id` y `company_id` y los almacena en el `SecurityContext` reactivo como `auth.getDetails()`.
- En los repositorios Spring Data R2DBC, los métodos filtran obligatoriamente por `WHERE customer_id = :tenantId AND company_id = :companyId`.

### 2.3. Vulnerabilidad Detectada: Riesgo de Fuga entre Inquilinos (Tenant Leaks)
A pesar de la existencia del contexto seguro en el JWT, se detectaron mecanismos de bypass y sobreescritura manual en controladores críticos:

1. **Sobreescritura por Header HTTP (`QuoteController.java:69-72`):**
   ```java
   if (isAdminOrManager && headers.containsKey("x-tenant-id")) {
       finalTenantId = Long.parseLong(headers.get("x-tenant-id"));
       log.info("?? [QUOTE-AUTH] Overriding Tenant from Header: {}", finalTenantId);
   }
   ```
   *Riesgo:* Si un usuario con rol administrativo o manager envía arbitrariamente el header `x-tenant-id`, el backend altera el filtro de búsqueda permitiendo leer o modificar cotizaciones pertenecientes a otro tenant.

2. **Acceso Sin Aislamiento en Herramienta de Agentes (`web-team/src/tools.py:19` - `mysql_tool`):**
   ```python
   @tool("MySQL Tool")
   def mysql_tool(query: str, action: str = "select") -> str:
       with engine.connect() as conn:
           result = conn.execute(text(query))
   ```
   *Riesgo:* El agente constructor de tiendas dispone de una herramienta que ejecuta sentencias SQL arbitrarias directamente contra la base de datos `cloud_master` sin inyectar forzosamente la cláusula `WHERE company_id = X`. Si el modelo alucina una consulta como `SELECT * FROM users` o `UPDATE company_website SET status = 'ENABLED'`, puede comprometer la integridad y confidencialidad de todos los clientes de la plataforma.

---

## 3. Infraestructura de Red y Exposición de Servicios

En el análisis de `docker-compose-full-vps.yml` se constataron las siguientes configuraciones de red:
- **Redes Definidas:** `app-net` (microservicios internos), `kafka-net` (bus de eventos) y `default`.
- **Exposición de Puertos en el Host VPS:**
  - El puerto MySQL `3306:3306` está expuesto al host. Debe verificarse que el firewall del VPS (UFW / iptables) impida conexiones externas directas a la base de datos sin túnel VPN o SSH.
  - El puerto Kafka `9093` cuenta con configuración para listener externo (`PLAINTEXT_EXTERNAL://109.205.182.94:9093`), lo que permite conexiones externas si el puerto no está filtrado por firewall.

---

## 4. Estado de Respaldos y Recuperación ante Desastres (DR)

- **Respaldos Existentes:** Existen scripts como `restore_and_unify_db.js` y el servicio `backup-service`.
- **Punto Crítico:** No se evidencia en el repositorio una política automatizada y probada de backups continuos a almacenamiento de objetos externo (S3 / Cloud Storage / MinIO) con retención cifrada. Los volúmenes persistentes residen localmente en `/var/lib/mysql` dentro del VPS.


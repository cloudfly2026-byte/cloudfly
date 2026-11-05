# Auditoría de Seguridad y Calidad Técnica — CloudFly Business OS

**Fecha de Auditoría:** Noviembre 2026  
**Clasificación de Hallazgos:** P0 (Crítico / Bloqueante de Producción), P1 (Alto Riesgo), P2 (Moderado), P3 (Bajo / Deuda Técnica)

---

## 1. Resumen de Hallazgos por Criticidad

| Severidad | Cantidad | Descripción General |
| :---: | :---: | :--- |
| **P0 (Crítico)** | **3** | Secreto de bypass hardcodeado en controladores de backend; herramienta SQL arbitraria expuesta a LLMs; puerto de base de datos expuesto al host en compose. |
| **P1 (Alto)** | **4** | Manipulación de `tenant_id` mediante header HTTP `x-tenant-id`; logging de llaves y headers en controladores; falta de validación de firma webhook en endpoints sensibles; herramienta `logo_analyzer` simulada. |
| **P2 (Medio)** | **3** | Almacenamiento local de copias de seguridad sin replicación externa cifrada; listeners de Kafka configurados con IP pública sin TLS/SASL; endpoints de creación de órdenes con defaults arbitrarios (`1L`). |
| **P3 (Bajo)** | **2** | Presencia de múltiples scripts temporales en la raíz (`scratch/`, `test_*.py`); divergencia de 3 commits con respecto a `origin/main`. |

---

## 2. Detalle de Hallazgos Críticos (P0)

### Hallazgo P0-1: Bypass de Autenticación con Secreto Hardcodeado en Controladores
- **Archivos Afectados:**
  - `backend_new/src/main/java/com/app/controllers/OrderController.java` (Líneas 33-50)
  - `backend_new/src/main/java/com/app/controllers/QuoteController.java` (Líneas 34-52)
- **Evidencia en Código:**
  ```java
  // --- AI Internal Secret Bypass (Redundancy) ---
  String expected = "cloudfly_ai_secret_2026";
  boolean isAIInHeaders = headers.values().stream().anyMatch(v -> v != null && v.contains(expected));
  if (isAIInHeaders) {
      log.info("?? [ORDER-AUTH] AI Internal Bypass active for Order operations");
      return ... defaultIfEmpty(new UserContext(1L, null, java.util.Set.of("ROLE_ADMIN")));
  }
  ```
- **Impacto:** Cualquier atacante externo que conozca la cadena fija `"cloudfly_ai_secret_2026"` y la incluya en cualquier header HTTP puede ejecutar operaciones sobre pedidos y cotizaciones con privilegios de `ROLE_ADMIN` y actuando bajo el inquilino 1.
- **Remediación Inmediata:** Eliminar por completo la validación redundante por string fijo en controladores. La autenticación inter-servicios debe resolverse exclusivamente mediante tokens JWT mTLS o firmas HMAC validadas en el filtro de seguridad reactivo (`JwtAuthenticationFilter.java`).

---

### Hallazgo P0-2: Ejecución Arbitraria de SQL por Agentes de IA (`mysql_tool`)
- **Archivo Afectado:** `web-team/src/tools.py` (Líneas 19-45)
- **Evidencia en Código:**
  ```python
  @tool("MySQL Tool")
  def mysql_tool(query: str, action: str = "select") -> str:
      with engine.connect() as conn:
          result = conn.execute(text(query))
          # Permite select, insert y update arbitrarios
  ```
- **Impacto:** Esta herramienta se entrega a agentes basados en LLM que procesan entradas de usuarios y scraping web. En caso de prompt injection indirecto o alucinación, el agente puede ejecutar sentencias destructivas (`DROP`, `DELETE`) o actualizar registros de cualquier tenant de la base de datos `cloud_master`.
- **Remediación Inmediata:** Eliminar `mysql_tool` del toolkit del agente. El acceso a base de datos de los agentes debe realizarse exclusivamente a través de métodos de repositorio fuertemente tipados (`StorefrontRepository`) que inyecten obligatoriamente parámetros saneados y el `company_id` validado.

---

### Hallazgo P0-3: Mapeo de Puertos de Base de Datos al Host VPS
- **Archivo Afectado:** `docker-compose-full-vps.yml` (Líneas 7-8)
- **Evidencia en Código:**
  ```yaml
  ports:
    - "3306:3306"
  ```
- **Impacto:** MySQL expone el puerto estándar al exterior. Si el firewall del VPS no bloquea el tráfico entrante o si las reglas de Docker (`DOCKER-USER`) puentean iptables, el motor de base de datos queda susceptible a ataques de fuerza bruta.
- **Remediación Inmediata:** En entornos de producción, eliminar el mapeo directo de puertos de `mysql` hacia el exterior (`ports:`), restringiendo el acceso exclusivamente a la red interna de Docker (`app-net`). Para labores de administración se debe utilizar túnel SSH o VPN.

---

## 3. Detalle de Hallazgos de Alto Impacto (P1)

### Hallazgo P1-1: Modificación de Contexto de Inquilino vía Header `x-tenant-id`
- **Archivo Afectado:** `backend_new/src/main/java/com/app/controllers/QuoteController.java:69-72`
- **Impacto:** Permite que usuarios con rol manager o admin sobreescriban el tenant derivado del JWT. Si un token es interceptado o un usuario administrador de un negocio intenta escalar a otro negocio, puede listar y modificar cotizaciones ajenas.
- **Remediación:** Derivar siempre de forma inmutable el `tenant_id` y `company_id` a partir de los claims firmados en el token JWT validado criptográficamente.

---

### Hallazgo P1-2: Logging de Información Sensible en Controladores
- **Archivo Afectado:** `OrderController.java:31`, `JwtAuthenticationFilter.java`
- **Evidencia en Código:**
  ```java
  log.info("?? [ORDER-AUTH] Incoming Headers Keys: {}", headers.keySet());
  ```
- **Impacto:** Aunque se loguean las llaves, en versiones previas se registraban valores completos que podían exponer tokens Bearer o cookies en los archivos de log del servidor.
- **Remediación:** Asegurar que los filtros de logging omitan de forma explícita las cabeceras `Authorization`, `Cookie`, `X-AI-Secret` y datos personales de clientes.

---

### Hallazgo P1-3: Herramienta de Extracción de Paleta de Marca Simulada (`logo_analyzer`)
- **Archivo Afectado:** `web-team/src/tools.py:149-180`
- **Impacto:** Genera una falsa expectativa de valor comercial. El agente no analiza el logo real mediante computer vision, sino que aplica reglas rígidas basadas en palabras en el nombre del archivo.
- **Remediación:** Integrar una librería de procesamiento de imágenes ligera (como `ColorThief` o `Pillow`) para extraer la paleta de colores dominante directamente de los bytes del logo cargado en S3/almacenamiento.

---

## 4. Estado de Cobertura de Pruebas y Calidad (CI/CD)

- **Backend (`backend_new`):** Cuenta con 5 clases de prueba de unidad e integración que verifican autenticación JWT y el motor de workflows. Requiere ampliar la cobertura a los controladores de `Order`, `Product` e `Invoice`.
- **Frontend (`frontend_new`):** Cuenta con una suite amplia de 36 archivos de prueba (Jest y React Testing Library) con mocks de servicios y validaciones de interfaz de usuario.
- **Web Team (`web-team`):** Cuenta con pruebas de integración en `tests/test_storefront_builder.py` para verificar el ciclo de vida de la tienda y el `recovery_worker`.
- **Pipeline CI/CD:** No hay un flujo de GitHub Actions que ejecute pruebas automatizadas de seguridad (SAST, `trivy`, `npm audit`, `dependency-check`) de forma bloqueante antes del despliegue en VPS.


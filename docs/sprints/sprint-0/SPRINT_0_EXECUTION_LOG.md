# Bitácora de Ejecución Sprint 0 — CloudFly Business OS

**Fecha:** Noviembre 2026  
**Rama:** `main` (sincronizada al 100% con `origin/main` en commit `b17a6e4a`)  
**Metodología:** Flujo obligatorio Sprint 0:  
$$\text{EDITAR CÓDIGO} \longrightarrow \text{COMMIT} \longrightarrow \text{PUSH} \longrightarrow \text{GITHUB ACTIONS} \longrightarrow \text{DESPLIEGUE AUTORIZADO} \longrightarrow \text{SSH} \longrightarrow \text{NAVEGADOR} \longrightarrow \text{VALIDACIÓN}$$

---

## 1. Estado de Infraestructura y Conectividad Remota

| Destino | Protocolo / Puerto | Llave Utilizada | Estado | Observación |
| :--- | :--- | :--- | :---: | :--- |
| **Bastion Host / OpenVPN** (`server1.cloudfly.com.co`) | SSH / 10622 | `id_rsa_cloudfly` | 🟢 **Conexión Exitosa** | Host activo (Uptime: 17 días, Linux 6.8 Ubuntu, RAM 5.8GB con 2.8GB disponibles, disco 387GB al 26% de uso). |
| **VPS Docker Producción** (`109.205.182.94`) | SSH / 22 | `id_rsa_cloudfly` / `id_ed25519` | 🟡 **Clave Pendiente** | Clave rechazada por el servidor objetivo. Requiere actualizar la clave pública en `/root/.ssh/authorized_keys` del VPS Docker. |
| **Core API WebFlux** | HTTPS / 443 (`api.cloudfly.com.co/health`) | N/A | 🟢 **200 OK** | Servicio reactivo respondiendo en producción. |
| **Dashboard Frontend** | HTTPS / 443 (`dashboard.cloudfly.com.co/`) | N/A | 🟢 **308 OK** | Redirección operativa a `/home` (Next.js 14 App Router). |
| **Chat Sockets** | HTTPS / 443 (`chat.cloudfly.com.co/health`) | N/A | 🟢 **200 OK** | Cluster de mensajería en tiempo real respondiendo. |

---

## 2. Hitos Alcanzados en Sprint 0

1. **Sincronización Completa con Repositorio Central (`origin/main`):**
   - Incorporación limpia de los últimos 3 commits remotos de autenticación y rediseño visual de login (`2d5c19ac`, `cf847a80`, `b17a6e4a`).
   - Verificación de compilación Maven en `backend_new`: `BUILD SUCCESS` (todas las clases y tests compilan limpiamente).
2. **Auditoría Integral y Documentación del Proyecto:**
   - 7 informes técnicos completos generados en `docs/audits/`.
   - Documento de transferencia consolidada para evaluadores y modelos de lenguaje en `CLOUDFLY_AUDIT_FOR_CHATGPT.md`.
3. **Mapeo Completo de Credenciales, Llaves y Secretos:**
   - Descubrimiento del puerto SSH real del servidor Bastion (puerto `10622`).
   - Identificación y catalogación de riesgos críticos de bypass y credenciales hardcodeadas para plan de saneamiento.

---

## 3. Plan de Acción Inmediato para el Próximo Incremento (Sprint 0 - Fase de Remediación)

Conforme a la regla de no realizar cambios de código productivo sin el ciclo completo de Git y CI/CD:

1. **Tarea S0-1 (Seguridad Backend):**
   - Retirar la comprobación del string `"cloudfly_ai_secret_2026"` en `OrderController.java` y `QuoteController.java`.
   - Asegurar que la autenticación entre servicios use el service-token JWT validado en `JwtAuthenticationFilter.java`.
2. **Tarea S0-2 (Seguridad Agentes Web-Team):**
   - Eliminar `mysql_tool` en `web-team/src/tools.py` para prevenir inyección de sentencias SQL arbitrarias por parte del LLM.
3. **Tarea S0-3 (Cierre de Red en Compose):**
   - Remover el mapeo de puertos `3306:3306` en `docker-compose-full-vps.yml` para aislar MySQL en la red Docker interna `app-net`.
4. **Ciclo de Entrega:**
   - Commit de remediación $\rightarrow$ Push a `main` $\rightarrow$ Ejecución del workflow GitHub Actions (`deploy.yml`) $\rightarrow$ Inspección de salud en producción y navegador.


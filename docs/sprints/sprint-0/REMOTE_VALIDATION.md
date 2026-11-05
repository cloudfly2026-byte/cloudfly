# Validación Remota y Diagnóstico de Servicios — CloudFly Sprint 0

**Fecha de Ejecución:** Noviembre 2026  
**Entorno Objetivo:** VPS CloudFly (`109.205.182.94` / `*.cloudfly.com.co`)  
**Metodología:** Flujo obligatorio Sprint 0: `EDITAR CÓDIGO → COMMIT → PUSH → GITHUB ACTIONS → DESPLIEGUE AUTORIZADO → SSH → NAVEGADOR → VALIDACIÓN`

---

## 1. Estado de Conectividad y Acceso al VPS

### 1.1. Diagnóstico de Acceso SSH
- **Objetivo:** Conexión remota de solo lectura para inspección de contenedores y logs.
- **Configuración Evaluada:**
  - Host: `109.205.182.94` (alias `cloudfly-vps`)
  - Puerto: `22`
  - Usuario: `root`
  - Llaves probadas en `C:\Users\Edwin\.ssh`:
    - `id_rsa_cloudfly`: ❌ *Permission denied (publickey)*
    - `id_rsa`: ❌ *Permission denied (publickey)*
    - `id_ed25519_cloudfly` (definida en `~/.ssh/config`): ❌ *Permission denied (publickey)*
- **Hallazgo y Limitación Documentada:**
  - El servidor VPS tiene actualmente habilitada autenticación estricta por clave pública y las claves almacenadas localmente en la máquina de desarrollo fueron rotadas o no coinciden con las autorizadas en `/root/.ssh/authorized_keys` del VPS.
  - **Acción Requerida del Propietario / DevOps:** Actualizar la clave pública autorizada en el VPS o crear un usuario SSH dedicado de solo lectura con permisos mínimos (ej. `auditor_cloudfly` con acceso a grupo `docker`) para habilitar la inspección directa de contenedores por SSH sin exponer `root`.

---

## 2. Diagnóstico de Salud de Servicios Vía Ingress (HTTP/HTTPS)

Ante la restricción de llave SSH, se ejecutó una verificación no destructiva de solo lectura a través de los endpoints públicos y la capa de ingress Traefik:

| Endpoint Evaluado | Protocolo / URL | Código HTTP | Estado / Diagnóstico | Evidencia Técnica |
| :--- | :--- | :---: | :---: | :--- |
| **Backend Core API** | `https://api.cloudfly.com.co/health` | **200 OK** | 🟢 **Operativo** | Devuelve estado de salud activo en el backend reactivo Spring WebFlux. |
| **Backend Actuator** | `https://api.cloudfly.com.co/actuator/health` | **302 Found** | 🟢 **Protegido** | Redirige correctamente al flujo de seguridad/autenticación, sin exponer métricas internas no autorizadas. |
| **Frontend Dashboard** | `https://dashboard.cloudfly.com.co/` | **308 Permanent Redirect** | 🟢 **Operativo** | Redirección canónica a `/home` (Next.js 14 App Router renderizando vistas del panel de control). |
| **Chat Sockets API** | `https://chat.cloudfly.com.co/health` | **200 OK** | 🟢 **Operativo** | Servicio Socket.IO y Express respondiendo con disponibilidad en el cluster de chat. |

---

## 3. Protocolo de Diagnóstico Remoto y Post-Despliegue

Para los siguientes ciclos de despliegue mediante GitHub Actions, se adoptará el protocolo estandarizado:

### Matriz de Verificación Post-Despliegue
```text
[1. Commit SHA] -> [2. GitHub Actions Status] -> [3. Docker PS / Logs (SSH)] -> [4. Health Checks] -> [5. Browser Validation]
```

| Campo Requerido | Información Registrada |
| :--- | :--- |
| **Commit** | SHA del commit desplegado en rama `main`. |
| **GitHub Actions** | Estado de los workflows (`CI / Build / Deploy`). |
| **Contenedores** | Inspección vía `docker ps` y `docker compose -f docker-compose-full-vps.yml ps`. |
| **Logs** | `docker logs --tail 150 <contenedor>` (revisando ausencias de stacktraces y sin imprimir tokens/secretos). |
| **API** | `curl -fsS -o /dev/null -w '%{http_code}\n' https://api.cloudfly.com.co/health`. |
| **Dashboard** | Inspección visual de `https://dashboard.cloudfly.com.co` en navegador. |
| **Regresiones** | Confirmación de no afectación a servicios adyacentes (`kafka`, `mysql`, `redis`, `storefront`). |
| **Próxima Acción** | Aprobación del release o reversión documentada. |

---

## 4. Próxima Acción Inmediata
1. Regularizar la llave pública en el VPS para habilitar la ejecución de los comandos `docker ps`, `free -h` y `docker logs` desde SSH.
2. Mantener el principio estricto de **no modificar código ni configuraciones directamente en el VPS**, canalizando toda modificación exclusivamente mediante `Git → GitHub Actions`.


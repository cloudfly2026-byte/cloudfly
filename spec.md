# CloudFly AI - Especificacion Tecnica

## Vision General
CloudFly AI es una plataforma SaaS multi-tenant de automatizacion empresarial. Centraliza CRM, ventas, marketing, mensajeria, agenda, IA conversacional y operaciones administrativas en un ecosistema modular orientado a empresas.

### Capacidades Principales
- CRM y ventas: pipelines Kanban, contactos, categorias, productos, cotizaciones, ordenes e invoices.
- Marketing automatizado: campanas multicanal, listas de envio, segmentacion y metricas.
- Motor de IA conversacional: agentes de ventas/soporte, memoria semantica y automatizacion de respuestas.
- Agenda y calendario: reserva de citas y sincronizacion de eventos.
- SaaS multi-tenant: aislamiento jerarquico por tenant/customer y company.
- POS: aplicacion de escritorio Java y alternativa Python.
- Integracion DIAN: facturacion electronica colombiana.
- Nomina y contabilidad: modulos para operaciones financieras colombianas.

## Estado del Repositorio
La rama local revisada esta en `main...origin/main`. El arbol esta casi limpio, con `webTemplates.zip` sin versionar. Git requiere usar `safe.directory` para operar desde el usuario sandbox.

### Archivos compose reales en la raiz
- `docker-compose-full-vps.yml`: stack principal para VPS/produccion.
- `docker-compose-local.yml`: stack de desarrollo local disponible actualmente.

No existen actualmente en la raiz:
- `docker-compose.yml`
- `docker-compose-full.yml`
- `docker-compose-full-local.yml`
- `docker-compose-monitoring.yml`

## Arquitectura del Sistema

### Backend Principal
| Area | Detalle |
|---|---|
| Lenguaje | Java 17 |
| Framework | Spring Boot 3.4 con WebFlux |
| Persistencia | Spring Data R2DBC para MySQL |
| Build | Maven |
| Seguridad | JWT custom (`JwtProvider`, `JwtAuthenticationFilter`) y Spring Security WebFlux |
| Mensajeria | Kafka |

El backend actual de referencia es `backend_new/`. El directorio `backend/` conserva backend original y componentes historicos/DIAN.

### Frontend Dashboard
| Area | Detalle |
|---|---|
| Framework | Next.js 14.2.5 App Router |
| Lenguaje | TypeScript |
| UI | MUI v6, Emotion, TailwindCSS |
| Estado | Redux Toolkit |
| Auth | NextAuth.js 4.24.7 |
| Tiempo real | Socket.IO client |

El frontend actual de referencia para despliegue es `frontend_new/`.

### Mobile
- React Native con Expo.
- Expo Router y React Navigation.
- Redux Toolkit, Axios y Socket.IO client.

### IA y Automatizacion
- `ai-agent/`: servicio Python para agentes conversacionales, OpenAI, Qdrant, Redis, MySQL y Kafka.
- `marketing_agent/` y `marketing_team_ai/`: agentes de marketing automatizado.
- `lead-generator/` y `lead-scrapper-google/`: extraccion automatizada de leads.
- Qdrant y PostgreSQL/pgvector para memoria semantica.

### Comunicacion
- `chat-socket-service/`: Node.js, Socket.IO, Express, Redis, KafkaJS y MySQL.
- `evolution-api/`: integracion WhatsApp.
- `chatwoot/`: plataforma de engagement al cliente incluida en el repositorio.

### Infraestructura
- Docker y Docker Compose.
- Traefik como proxy inverso con TLS.
- MySQL 8.0 como base principal multi-tenant.
- Redis para cache/sesiones/pub-sub.
- PostgreSQL 15/pgvector y Qdrant para IA.
- Kafka/Zookeeper como bus de eventos.

## Estructura Principal

```text
C:\apps\cloudfly\
|-- backend_new/              # Backend actual Spring WebFlux/R2DBC
|-- backend/                  # Backend original y componentes historicos
|-- frontend_new/             # Dashboard actual Next.js
|-- frontend/                 # Frontend original
|-- mobile/                   # App movil React Native/Expo
|-- ai-agent/                 # Agente conversacional Python
|-- chat-socket-service/      # Servicio realtime Node.js
|-- billing-service/          # Servicio de facturacion Go
|-- scheduler_service/        # Servicio scheduler Java
|-- notifications/            # Servicio notificaciones Java
|-- marketing-worker/         # Worker marketing Java
|-- marketing_agent/          # Agente marketing Python
|-- marketing_team_ai/        # Equipo multi-agente marketing
|-- lead-generator/           # Generador de leads Python
|-- lead-scrapper-google/     # Extraccion leads Google
|-- evolution-api/            # WhatsApp Evolution API
|-- chatwoot/                 # Plataforma engagement Rails
|-- cloudfly-dian-service/    # Servicio DIAN Java multi-modulo
|-- cloudfly-storefront/      # Storefront Go
|-- cloudfly-landing-repo/    # Landing Vite/TypeScript
|-- POS/                      # POS Java
|-- pos-python/               # POS Python
|-- backup-service/           # Servicio backup PHP
|-- n8n/                      # Automatizacion workflows
|-- terraform/                # Infraestructura como codigo
|-- monitoring/               # Monitoreo
|-- scripts/                  # Utilidades
|-- tests/                    # Pruebas
|-- docs/                     # Documentacion
|-- traefik/                  # Config proxy inverso
|-- docker-compose-full-vps.yml
|-- docker-compose-local.yml
|-- package.json
|-- README.md
|-- spec.md
```

## Desarrollo Local

### Frontend
Ejecutar desde `frontend_new/`:

```bash
npm install
npm run dev
```

El frontend debe apuntar al backend local definido en variables `NEXT_PUBLIC_*`.

### Backend y servicios
El archivo compose local disponible actualmente es:

```bash
docker compose -f docker-compose-local.yml up -d
```

Antes de documentar otro flujo, crear o restaurar el compose correspondiente y mantener esta spec sincronizada.

## Entrega y Despliegue
El despliegue actual se ejecuta por GitHub Actions al hacer push a `main`, usando `.github/workflows/deploy.yml`. El workflow construye imagenes, publica en GHCR y despliega en el VPS mediante SSH.

## Politica de Secretos
Los secretos no deben estar hardcodeados en archivos versionados. Deben vivir en uno de estos lugares:
- GitHub Actions Secrets para CI/CD.
- Variables de entorno del VPS.
- Archivos `.env` no versionados con permisos restringidos.
- Un gestor de secretos cuando se adopte formalmente.

Archivos versionados como `docker-compose-full-vps.yml`, `application.yml`, workflows y documentacion solo deben contener nombres de variables o placeholders no sensibles.

## Tareas de Seguridad Pendientes

### P0 - Bloqueantes antes de produccion
1. Eliminar el bypass global por secreto fijo en `backend_new/src/main/java/com/app/AppConfig.java` y `backend_new/src/main/java/com/app/config/JwtAuthenticationFilter.java`.
2. Remover autenticacion por query string (`ai_secret`) y cualquier busqueda del secreto en todos los headers.
3. Sustituir el secreto interno hardcodeado `cloudfly_ai_secret_2026` por una variable de entorno fuerte, rotada y comparada solo desde un header dedicado.
4. Restringir el acceso interno de IA a rutas especificas y con permisos minimos; no debe otorgar `ROLE_ADMIN` global.
5. Rotar credenciales expuestas o hardcodeadas en compose/documentos: MySQL, Redis, Postgres, NextAuth, N8N, Evolution API y cualquier secreto similar.
6. Mover secretos de `docker-compose-full-vps.yml` a variables obligatorias sin defaults sensibles.
7. Desactivar `/actuator/**` publico en produccion o limitarlo por red/autenticacion.
8. Cambiar `management.endpoint.health.show-details` para que no exponga detalles publicos en produccion.
9. Dejar logs productivos sin `TRACE/DEBUG` para `org.springframework.*`, seguridad, web y HTTP.
10. Detener logging de headers completos en `JwtAuthenticationFilter`; nunca loguear `Authorization`, cookies ni tokens.

### P1 - Alto impacto
1. Revisar rutas `permitAll()` en `AppConfig.java`, especialmente `/internal/**`, `/api/billing/**`, `/public/invoices/**` y webhooks.
2. Validar que cada endpoint multi-tenant derive `tenant/company` del JWT y no de parametros manipulables.
3. Corregir controladores que usan fallback a `tenantId=1` o `ROLE_ADMIN` cuando falta contexto autenticado.
4. Reforzar CORS para produccion y separar origenes locales mediante perfil `development`.
5. Revisar exposicion de puertos del compose VPS; publicar solo lo que deba salir por Traefik o administracion protegida.
6. Endurecer Kafka si se expone externamente: evitar PLAINTEXT publico y usar autenticacion/TLS si cruza redes.
7. Cambiar deploy SSH para usar usuario dedicado, sin password, con permisos minimos y sin login root directo.
8. Eliminar `password: ${{ secrets.VPS_SSH_KEY }}` del workflow de deploy.
9. Reemplazar el bloque `rm -rf /apps/cloudfly` por un flujo idempotente y acotado.
10. Revisar documentacion interna que contenga secretos historicos y limpiar/rotar lo que aplique.

### P2 - Higiene y mantenibilidad
1. Crear una suite minima de pruebas de seguridad para autenticacion, roles y aislamiento tenant/company.
2. Agregar checks CI para secret scanning y dependency audit.
3. Corregir `package.json` raiz: reemplazar el script `test` placeholder por pruebas reales o mover utilidades a paquetes especificos.
4. Revisar dependencia raiz `lodash` `^4.18.1`; usar una version valida y confiable o eliminarla si no se usa.
5. Mantener esta spec como documento operativo: rutas reales, comandos reales y sin credenciales reutilizables.
6. Normalizar terminos: usar "extraccion de leads" o "scraper" en lugar de "rasgado/rasgador".
7. Documentar perfiles `development`, `staging` y `production` con diferencias de seguridad.

## Pruebas Recomendadas
- Tests unitarios del filtro JWT y configuracion Spring Security.
- Tests de integracion para rutas protegidas y `permitAll`.
- Tests multi-tenant para confirmar que un usuario no lee/modifica datos de otro tenant/company.
- Smoke test de compose local.
- Secret scan en CI y local antes de merge.

## Credenciales de Prueba
No publicar credenciales reutilizables en esta spec. Si se requieren usuarios de prueba, deben generarse por seed local y documentarse en `.env.example` o en guias internas no productivas, dejando claro que no aplican a staging ni produccion.

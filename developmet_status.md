# Estado de Desarrollo del Proyecto (Development Status) - CloudFly

**Última actualización:** Noviembre 2026  
**Rama activa:** `main`  
**Arquitectura:** Microservicios Reactivos (Spring WebFlux, Next.js 14, Node.js, Python AI/CrewAI, Kafka, MySQL, Redis, Traefik)

---

## 1. Resumen Ejecutivo del Estado del Sistema

CloudFly se encuentra en una fase avanzada de madurez y consolidación de funcionalidades clave para su suite operativa empresarial SaaS:
- **Core SaaS y Multi-inquilino (Multi-Tenancy):** Totalmente funcional a nivel de base de datos MySQL, backend WebFlux y aislamiento de dominio por empresa.
- **Frontend (`frontend_new`):** Desarrollado en Next.js 14 (App Router) con TypeScript y Tailwind. Integra flujos de autenticación, onboarding, configuración de cuenta, módulo POS y catálogo.
- **Tiendas Virtuales Automatizadas (`web-team` y `cloudfly-storefront`):** Pipeline impulsado por Kafka y agentes autónomos para autogenerar storefronts personalizadas, con invalidación en Redis y despliegue por dominios de cliente.
- **Facturación Electrónica DIAN y Nómina Electrónica (`cloudfly-dian-service`, `pos-python`):** Módulos adaptados a la normativa colombiana con generación de comprobantes contables y soporte de transmisión.
- **Ecosistema de Agentes de IA:** Equipos autónomos operando para desarrollo (AI Scrum Team con Jira), generación de tiendas (`web-team`) y marketing automatizado (`marketing_team_ai`).

---

## 2. Matriz de Estado por Módulo y Componente

| Componente / Servicio | Directorio | Tecnología | Estado | Observaciones / Hitos Recientes |
| :--- | :--- | :--- | :---: | :--- |
| **Backend Core API** | `backend_new` / `backend` | Java 17, Spring Boot 3.4 WebFlux, R2DBC | 🟢 **Operativo** | Manejo reactivo multi-tenant, seguridad JWT/Bearer, endpoints de facturación y eventos. |
| **Frontend Dashboard** | `frontend_new` | Next.js 14, React, Tailwind CSS | 🟢 **Operativo** | Onboarding guiado, catalog view, login/recuperación de contraseña, diseño responsivo. |
| **AI Scrum Team** | `ai_scrum_team` | Python, CrewAI, Jira API, Chrome CDP | 🟢 **Operativo** | Sprint automatizado con soporte multimodelo (OpenRouter, OpenAI, Groq, NVIDIA). |
| **Generador de Sitios Web** | `web-team` | Python, CrewAI, Kafka, Redis | 🟢 **Operativo** | Incluye `recovery_worker.py` para reanudar sitios en estado `CONSTRUCTION` y caché Redis. |
| **Storefront Público** | `cloudfly-storefront` | Next.js / Node.js | 🟢 **Operativo** | Visualización dinámica de catálogos y tiendas autogeneradas por tenant. |
| **Punto de Venta (POS)** | `POS`, `pos-python` | Python / SQLite / Web UI | 🟡 **Estable / En refinamiento** | Sincronización local offline/online, emisión de recibos y arqueo de caja. |
| **Facturación y Nómina DIAN** | `cloudfly-dian-service` | Java / Python / XML UBL | 🟢 **Operativo** | Generación de XML UBL 2.1, firmado digital y comunicación con servicios DIAN Colombia. |
| **WhatsApp Gateway** | `evolution-api` | Evolution API (Node.js) | 🟢 **Operativo** | Recepción de webhooks, sincronización de instancias y envío de mensajes automatizados. |
| **Chat Sockets Service** | `chat-socket-service` | Node.js, Socket.io, Redis | 🟢 **Operativo** | Mensajería y actualización de canales en tiempo real para agentes y operadores. |
| **Marketing Automatizado** | `marketing_team_ai`, `marketing_agent` | Python, Meta Graph API, Apify | 🟡 **En Integración Activa** | Flujos de prospección ICP y conexión de campañas publicitarias en Meta Ads. |
| **Scheduler Service** | `scheduler_service` | Spring Boot / Quartz / Redis | 🟢 **Operativo** | Agendamiento automatizado de citas, recordatorios y sincronización de calendarios. |
| **Infraestructura Edge** | `traefik`, `certs` | Traefik v3.1, Let's Encrypt | 🟢 **Operativo** | Reverse proxy con enrutamiento SSL dinámico para múltiples subdominios de inquilinos. |

*Convenciones:* 🟢 Operativo / Producción Ready | 🟡 En evolución o refinamiento | 🔴 Bloqueado o Pendiente

---

## 3. Estado Reciente de Git y Commits Clave

- **Últimos Cambios en Producción:**
  - `15205bb0`: *feat(web-team)* Adición de worker de recuperación (`recovery_worker.py`) para sitios web pendientes en estado `CONSTRUCTION`, con reinyección automática al topic de Kafka.
  - `a0ed575e`: *chore* Configuración explícita de `.gitignore` para credenciales locales de `web-team`.
  - `2dfe3d6d`: *feat* Herramientas de depuración VPS, ajuste de dominios para tiendas virtuales y actualización de estados de salud.
  - `3c8a4a0a`: *fix* Ajuste de visualización responsiva de logos corporativos y nombres en plantillas de categorías y productos.
  - `3a123714`: *feat(web-team)* Invalidación selectiva de caché de páginas de storefronts en Redis mediante escaneo por patrón de clave.

- **Archivos Modificados Localmente pendientes de consolidar:**
  - `ai_scrum_team/lessons_learned.md` y `model_health_status.json` (registro de ejecuciones de modelos).
  - `frontend_new/src/app/(blank-layout-pages)/account-setup/page.tsx` (ajustes de onboarding).
  - `frontend_new/src/app/(blank-layout-pages)/recover-password/page.tsx` (pantalla de restablecimiento).
  - `frontend_new/src/components/catalog/__tests__/ConstructionView.test.tsx` (pruebas de UI de tienda en construcción).

---

## 4. Próximos Pasos Prioritarios en el Roadmap

1. **Sincronización Git:** Incorporar commits remotos pendientes (`git pull`) y resolver staging de los ajustes en onboarding y recuperación de contraseña en `frontend_new`.
2. **Consolidación de Campañas de Marketing:** Terminar el ciclo cerrado de leads generados desde `lead-scrapper-google` hacia el flujo de prospección en `marketing_team_ai`.
3. **Optimización de Costos LLM:** Reforzar el enrutamiento inteligente en `llm_balancer.py` para priorizar modelos con mejor ratio latencia/costo en generación de catálogos masivos.
4. **Validación E2E del Módulo POS con Factura DIAN:** Pruebas integrales de timbrado y despacho de comprobantes electrónicos desde terminales de venta física.


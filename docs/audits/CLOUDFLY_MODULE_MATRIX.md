# Matriz de Funcionalidades por Dominio — CloudFly Business OS V2

**Fecha de Auditoría:** Noviembre 2026  
**Criterio de Evaluación:** Comparativa de la visión comercial (6 Dominios de CloudFly V2) contra el código fuente verificado.

---

## 1. Dominio 1: Commerce (Comercio Unificado)

| Capacidad / Flujo | Estado | Evidencia de Código | Brecha respecto a V2 | Prioridad |
| :--- | :---: | :--- | :--- | :---: |
| **Tienda Online Pública (Storefront)** | **IMPLEMENTADO Y VERIFICADO** | `cloudfly-storefront/internal/handlers/home.go`, `cloudfly-storefront/templates/` | La tienda renderiza catálogo, productos y categorías mediante GoFiber y plantillas HTML estáticas. Falta personalización libre de bloques por parte del usuario final. | P1 |
| **Punto de Venta Físico (POS)** | **PARCIAL** | `pos-python/main.py`, `pos-python/pos_local.db` | Existe una app local en Python con SQLite y sincronización de tokens, pero no está integrada con la pasarela de pagos ni con el flujo web unificado del dashboard. | P1 |
| **Gestión de Catálogo y Productos** | **IMPLEMENTADO Y VERIFICADO** | `backend_new/src/main/java/com/app/controllers/ProductController.java` | CRUD completo, variantes y categorías con soporte multi-tenant en MySQL. | P0 |
| **Gestión de Inventario y Stock** | **PARCIAL** | `ProductController.java`, `OrderController.java` | Se descuenta stock en órdenes básicas, pero carece de multi-bodega, traslados, alertas de stock mínimo o kardex de inventario. | P2 |
| **Cotizaciones (Quotes)** | **IMPLEMENTADO Y VERIFICADO** | `backend_new/src/main/java/com/app/controllers/QuoteController.java` | Generación de cotizaciones con estados, cálculo de impuestos e ítems asociados a clientes. | P1 |
| **Gestión de Pedidos (Orders)** | **IMPLEMENTADO Y VERIFICADO** | `backend_new/src/main/java/com/app/controllers/OrderController.java` | Ciclo de vida de órdenes, estados de pago y despacho, emisión de eventos. | P0 |
| **Pasarela de Pagos (Checkout)** | **IMPLEMENTADO Y VERIFICADO** | `billing-service/pkg/wompi/client.go`, `billing-service/internal/api/handlers.go` | Integración con pasarela Wompi Colombia (tarjetas, PSE, Nequi). Falta soporte internacional (Stripe/PayPal) y checkout embebido en la tienda Go. | P1 |
| **Facturación Electrónica DIAN** | **IMPLEMENTADO SIN VERIFICAR** | `cloudfly-dian-service/pom.xml`, `MICROSERVICE-CODE-REFERENCE.md` | Generación de XML UBL 2.1 para la DIAN. Requiere validación de certificados digitales en vivo y ambiente de pruebas DIAN. | P1 |

---

## 2. Dominio 2: Connect (Comunicaciones Omnicanal)

| Capacidad / Flujo | Estado | Evidencia de Código | Brecha respecto a V2 | Prioridad |
| :--- | :---: | :--- | :--- | :---: |
| **WhatsApp Business Gateway** | **IMPLEMENTADO Y VERIFICADO** | `evolution-api/`, `backend_new/src/main/java/com/app/controllers/EvolutionWebhookController.java` | Recepción de webhooks, QR de conexión, envío y recepción de mensajes de texto y multimedia. | P0 |
| **Chat Web en Vivo** | **IMPLEMENTADO Y VERIFICADO** | `chat-socket-service/src/index.js`, `frontend_new/src/contexts/PopupChatContext.tsx` | Socket.IO bidireccional con salas por canal y empresa, sincronizado con Redis. | P0 |
| **Instagram Direct & Facebook Messenger** | **PARCIAL** | `backend_new/src/main/java/com/app/controllers/FacebookWebhookController.java` | Controladores de webhook creados, pero el flujo de token OAuth de páginas requiere verificación de permisos en producción en Meta App Review. | P2 |
| **Correo Electrónico Transaccional** | **IMPLEMENTADO Y VERIFICADO** | `notifications/src/main/java/...`, `restore_exim.sh` | Despacho de emails mediante SMTP/Exim para confirmaciones y restablecimiento de contraseña. | P1 |
| **Bandeja de Entrada Unificada (Inbox Omnicanal)** | **PARCIAL** | `frontend_new/src/app/(dashboard)/marketing/` | Existen paneles de chat para WhatsApp y web, pero falta la unificación de identidad del contacto a través de múltiples canales (unificar teléfono + email + redes). | P1 |
| **Agenda y Reserva de Citas** | **IMPLEMENTADO Y VERIFICADO** | `scheduler_service/`, `backend_new/src/main/java/com/app/controllers/BillingSchedulerController.java` | Sincronización de eventos de calendario y citas agendables automáticamente por el bot. | P1 |

---

## 3. Dominio 3: Growth (Crecimiento, Sitios y Marketing)

| Capacidad / Flujo | Estado | Evidencia de Código | Brecha respecto a V2 | Prioridad |
| :--- | :---: | :--- | :--- | :---: |
| **Creación Automática de Tiendas por IA** | **IMPLEMENTADO Y VERIFICADO** | `web-team/src/main.py`, `src/crews/` | Pipeline completo por Kafka que investiga la empresa, escoge plantilla y publica en DB con invalidación de caché. | P1 |
| **Landing Pages Independientes por Empresa** | **PARCIAL** | `cloudfly-storefront/cmd/server/main.go`, `Page` model en Go | La base de datos y GoFiber soportan páginas tipo "landing", pero no hay un generador de landings específicas con formulario de captura en `web-team`. | P1 |
| **Optimización SEO Automatizada** | **SIMULADO / PARCIAL** | `web-team/src/crews/content_crew.py`, `home.go` | Solo genera textos comerciales. Falta generación técnica de `sitemap.xml`, `robots.txt` dinámico, etiquetas OpenGraph completas y microformatos JSON-LD. | P1 |
| **Campañas de Prospección de Leads** | **IMPLEMENTADO Y VERIFICADO** | `marketing_team_ai/crews/marketing_crew.py`, `lead-generator/` | Análisis B2B de producto, scrapers de Google y generación de copys hiperpersonalizados para WhatsApp. | P1 |
| **Gestión y Ejecución en Meta Ads** | **PARCIAL** | `marketing_agent/ai_ad_service.py`, `facebook_client.py` | Código para crear conjuntos de anuncios mediante Meta API, pero falta la interfaz completa de gestión presupuestal en el frontend. | P2 |

---

## 4. Dominio 4: Operations (Gestión Empresarial tipo ERP)

| Capacidad / Flujo | Estado | Evidencia de Código | Brecha respecto a V2 | Prioridad |
| :--- | :---: | :--- | :--- | :---: |
| **Compras y Órdenes de Compra** | **NO ENCONTRADO** | Sin controladores en `backend_new` | No existen entidades ni servicios para registrar compras a proveedores ni órdenes de compra entrantes. | P2 |
| **Gestión de Proveedores** | **NO ENCONTRADO** | Sin entidad de proveedores separada | Los contactos actuales solo contemplan clientes/leads (`ContactController.java`). | P2 |
| **Cuentas por Cobrar (Cartera)** | **PARCIAL** | `backend_new/src/main/java/com/app/controllers/InvoiceController.java` | Se registran estados de factura (`PENDING`, `PAID`, `CANCELLED`), pero no hay módulo de planes de amortización o abonos parciales. | P2 |
| **Cuentas por Pagar** | **NO ENCONTRADO** | Sin entidad en backend | No existe seguimiento de facturas de proveedores pendientes de pago. | P2 |
| **Nómina y Centros de Costos** | **PARCIAL / DOCUMENTADO** | `docs/PAYROLL_FINAL_SUMMARY.md`, `INTEGRACION_NOMINA_CENTRO_COSTOS.md` | Lógica documentada y scripts de prueba en `docs/`, pero no integrada de manera transparente en el backend principal WebFlux. | P2 |
| **Contabilidad General (PUC)** | **PARCIAL / DOCUMENTADO** | `docs/MODULO_CONTABILIDAD_COLOMBIA.md`, `PLAN_CUENTAS_COMPLETO.md` | Existen tablas y documentación sobre el Plan Único de Cuentas, pero no hay un libro diario contable automático alimentado por las ventas. | P2 |

---

## 5. Dominio 5: Intelligence (Inteligencia y Agentes Autónomos)

| Capacidad / Flujo | Estado | Evidencia de Código | Brecha respecto a V2 | Prioridad |
| :--- | :---: | :--- | :--- | :---: |
| **Agente Conversacional de Ventas (RAG)** | **IMPLEMENTADO Y VERIFICADO** | `ai-agent/agents/sales_agent.py`, `ai_service.py` | Conexión con catálogo en MySQL y memoria semántica en Qdrant para responder con precios y disponibilidad en lenguaje natural. | P0 |
| **Agente de Soporte al Cliente** | **IMPLEMENTADO Y VERIFICADO** | `ai-agent/agents/support_agent.py` | Resolución de consultas recurrentes y seguimiento de pedidos por número de guía. | P1 |
| **Orquestación Desacoplada (Event-Driven)** | **IMPLEMENTADO Y VERIFICADO** | Apache Kafka topics (`agents_site_constructor`, `marketing_events`) | Comunicación asíncrona robusta. Falta un dashboard que muestre el árbol de decisiones del agente en tiempo real para el cliente final. | P1 |
| **Gobernanza de Costos y Tokens** | **PARCIAL** | `ai-agent/token_tracker.py`, `llm_balancer.py` | Hay conteo de tokens en el bot conversacional y balanceo entre proveedores en `web-team`, pero no hay límites de consumo configurables por tenant. | P1 |
| **Comandos en Lenguaje Natural para el Negocio** | **SIMULADO / PARCIAL** | `ai-agent/tool_registry.py` | El agente puede consultar productos y crear cotizaciones, pero no puede ejecutar instrucciones complejas como "cambia el precio de todas las camisas a $50.000". | P2 |

---

## 6. Dominio 6: Insights (Analítica y Reportes Gerenciales)

| Capacidad / Flujo | Estado | Evidencia de Código | Brecha respecto a V2 | Prioridad |
| :--- | :---: | :--- | :--- | :---: |
| **Dashboard de Métricas Generales** | **IMPLEMENTADO Y VERIFICADO** | `backend_new/src/main/java/com/app/controllers/DashboardController.java`, `frontend_new/src/app/(dashboard)/dashboard/` | Métricas de ventas del mes, contactos recientes, órdenes y tasa de conversión básica. | P0 |
| **Métricas de Rendimiento de Tienda Virtual** | **PARCIAL** | `frontend_new/src/components/catalog/metrics/` | Interfaz de visualización de visitas y clics implementada en frontend, pero basada parcialmente en datos simulados (`demoMetrics.ts`). | P1 |
| **Analítica de Rentabilidad y Margen Real** | **NO ENCONTRADO** | Sin cálculo de costo de ventas (COGS) | El sistema calcula ingresos brutos, pero no descuenta costos de compra para mostrar rentabilidad neta real. | P2 |
| **Reportes Gerenciales Exportables (Excel / PDF)** | **PARCIAL** | `billing-service/pkg/pdf/` | Generación de PDFs de cotizaciones y facturas individuales; falta exportador masivo de estados de cuenta y ventas por período. | P2 |


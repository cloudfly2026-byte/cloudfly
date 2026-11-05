# Plan de Evolución Tecnológica y Roadmap — CloudFly Business OS V2

**Fecha de Elaboración:** Noviembre 2026  
**Estrategia:** Evolución modular incremental sin reescrituras innecesarias, capitalizando el código existente en `backend_new`, `frontend_new`, `web-team` y `cloudfly-storefront`.

---

## 1. Fase P0: Lanzamiento Seguro y Estabilidad de Producción (Sprint Inmediato)

El objetivo de esta fase es cerrar brechas de seguridad críticas, garantizar el aislamiento estricto entre clientes y asegurar que los flujos transaccionales básicos operen de forma confiable.

| Acción Prioritaria | Componente Involucrado | Cambios Concretos en Código | Riesgos Mitigados | Complejidad |
| :--- | :--- | :--- | :--- | :---: |
| **P0.1: Eliminar Bypasses Hardcodeados** | `backend_new/src/main/java/com/app/controllers/OrderController.java`, `QuoteController.java` | Remover la verificación del string `"cloudfly_ai_secret_2026"` y el default `UserContext(1L, null, "ROLE_ADMIN")`. La autenticación interna entre servicios debe consumir exclusivamente un service-token JWT validado por `JwtAuthenticationFilter`. | Fuga y alteración de órdenes entre inquilinos por atacantes externos. | Baja |
| **P0.2: Remover Herramienta SQL Arbitraria en Agentes** | `web-team/src/tools.py` | Eliminar `mysql_tool` y sustituir cualquier requerimiento de base de datos por métodos tipados y parametrizados en `StorefrontRepository`. | Inyección SQL y alteración accidental de esquemas por alucinaciones del LLM. | Baja |
| **P0.3: Blindaje de Red en Docker Compose** | `docker-compose-full-vps.yml` | Eliminar la exposición de puertos públicos `3306:3306` para MySQL. Asegurar que la base de datos solo se comunique dentro de la red Docker `app-net`. | Ataques de fuerza bruta y exposición externa directa de datos multi-tenant. | Baja |
| **P0.4: Imposibilidad de Manipular Tenant por Header** | `backend_new/src/main/java/com/app/controllers/QuoteController.java` | Deshabilitar la sobreescritura de `tenant_id` vía cabecera `x-tenant-id`. El identificador de empresa debe ser inmutablemente derivado de la firma del JWT. | Escalación horizontal de privilegios entre empresas clientes. | Baja |
| **P0.5: Sincronización de Rama Principal** | Repositorio raíz | Realizar `git pull` de los 3 commits pendientes de `origin/main` y verificar que el build en producción permanezca limpio. | Desfase de versiones entre entorno local y VPS. | Baja |

---

## 2. Fase P1: Consolidación Comercial y Go-To-Market

Esta fase habilita la venta activa de la plataforma a dueños de negocio, asegurando que la tienda virtual, la prospección de leads y los canales de mensajería funcionen sin fricción.

| Iniciativa | Componentes | Descripción Técnica | Entregable Clave |
| :--- | :--- | :--- | :--- |
| **P1.1: Extracción Real de Paleta de Marca** | `web-team/src/tools.py` | Reemplazar el mock en `logo_analyzer` implementando extracción real con la librería `color-thief-py` o `Pillow` a partir de los bytes de la imagen del logo cargado. | Diseños de tienda que reflejan con 100% de precisión la identidad visual del negocio. |
| **P1.2: Checkout Embebido en Tienda Pública** | `cloudfly-storefront/`, `billing-service/` | Integrar el widget o redirección de pago de Wompi directamente en las plantillas Go de `cloudfly-storefront`, creando la orden en `backend_new` al confirmarse el webhook. | Flujo de compra completo desde el storefront público sin intervención manual. |
| **P1.3: SEO Técnico Automatizado** | `cloudfly-storefront/`, `web-team/` | Añadir rutas `/sitemap.xml` y `/robots.txt` autogeneradas por tenant en `cloudfly-storefront`. Inyectar JSON-LD de `Schema.org/Product` en las páginas de producto. | Indexación en Google y mejora del posicionamiento orgánico para las tiendas de los clientes. |
| **P1.4: Bandeja de Entrada Omnicanal Unificada** | `frontend_new/src/app/(dashboard)/marketing/`, `chat-socket-service/` | Unificar el historial de conversaciones de WhatsApp (`evolution-api`) y chat web bajo un único registro de contacto en el CRM. | El operador puede atender consultas de múltiples canales desde una sola pantalla sin perder contexto. |
| **P1.5: Gobernanza y Cuotas de IA por Tenant** | `ai-agent/token_tracker.py`, `backend_new/` | Asociar el consumo de tokens y llamadas a APIs de LLM con el plan de suscripción del cliente (`SubscriptionController.java`), estableciendo alertas y límites de corte. | Prevención de sobrecostos en proveedores de LLM por uso excesivo o abusivo de bots. |

---

## 3. Fase P2: Automatización Empresarial y Capacidades ERP

Evolución hacia el control operativo del negocio inspirado en las mejores prácticas de sistemas tipo Sage/ERP, capitalizando las entidades existentes.

| Iniciativa | Módulos a Desarrollar / Modificar | Alcance Funcional |
| :--- | :--- | :--- |
| **P2.1: Gestión Básica de Compras y Proveedores** | `backend_new` (Nuevas entidades: `Supplier`, `PurchaseOrder`) | Registro de compras a proveedores con actualización automática del stock de productos y costo unitario. |
| **P2.2: Control de Cuentas por Cobrar y Cartera** | `backend_new` (`InvoiceController.java`, `InvoiceService.java`) | Módulo de abonos parciales, vencimientos de cartera y alertas de cobro automatizadas vía WhatsApp. |
| **P2.3: Consolidación de Nómina y Centros de Costos** | Integración del módulo documentado en `docs/PAYROLL_FINAL_SUMMARY.md` hacia `backend_new` | Liquidación periódica de nómina para empleados de la empresa con imputación a centros de costos. |
| **P2.4: Terminal POS Web y Sincronización Híbrida** | `frontend_new/src/app/(dashboard)/ventas/pos/` y `pos-python/` | Módulo de punto de venta directamente en el navegador con soporte para impresoras térmicas e integración de caja. |
| **P2.5: Comandos de Negocio en Lenguaje Natural** | `ai-agent/tool_registry.py` | Ampliar el catálogo de herramientas del bot para ejecutar instrucciones operativas seguras (ej. "muéstrame las ventas de hoy", "bloquea el stock del producto X"). |

---

## 4. Fase P3: Inteligencia Predictiva y Optimización Continua

Transformación de los agentes de meros ejecutores reactivos a asesores estratégicos proactivos del negocio.

1. **Agente Asesor Financiero y de Margen:** Cálculo dinámico de márgenes de contribución por producto cruzando el precio de venta en storefront/POS con los costos de compra a proveedores.
2. **Generador y Optimizador Autónomo de Campañas (Meta Ads & WhatsApp):** Ajuste dinámico de audiencias y presupuestos en Meta Ads en función de los productos con mayor conversión en la tienda virtual.
3. **Rollback y Versionado de Tiendas Virtuales:** Implementación de historial de diseño en `company_layout_history` para permitir a los clientes restaurar versiones previas de su tienda con un solo clic.


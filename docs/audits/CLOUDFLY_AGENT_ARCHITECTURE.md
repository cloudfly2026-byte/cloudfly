# Auditoría de Arquitectura de Agentes de IA — CloudFly Business OS

**Fecha de Auditoría:** Noviembre 2026  
**Módulos Analizados:** `web-team/`, `ai_scrum_team/`, `marketing_team_ai/`, `marketing_agent/`, `ia_marketing_operation/`, `ai-agent/`

---

## 1. Catálogo Completo de Agentes de IA Identificados

A continuación se detalla la matriz técnica de todos los agentes implementados en el repositorio:

| Agente | Módulo / Ubicación | Framework | Modelo LLM | Herramientas (Tools) | Entrada (Trigger) | Salida | Memoria / Estado | Comunicación | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **Brand Discovery Agent** | `web-team/src/crews/discovery_crew.py` | CrewAI | Configurable vía `.env` (`MODEL_DEFAULT`: OpenRouter/OpenAI) | `internet_search`, `website_crawler` | Mensaje Kafka `agents_site_constructor` | Perfil de marca (industria, resumen, nicho) | Sin memoria persistente (stateless) | Kafka / In-memory | **IMPLEMENTADO Y VERIFICADO** |
| **Brand Identity Agent** | `web-team/src/crews/discovery_crew.py` | CrewAI | Configurable | `screenshot_tool`, `logo_analyzer` | Salida de Discovery Agent | Paleta de colores Hex, fuentes Google Fonts | In-memory | In-memory | **IMPLEMENTADO Y VERIFICADO** |
| **Theme Recommendation Agent** | `web-team/src/crews/theme_crew.py` | CrewAI | Configurable | `theme_catalog_tool` | Brand profile | Nombre de plantilla (`template_name`) | In-memory | In-memory | **IMPLEMENTADO Y VERIFICADO** |
| **UX/UI Accessibility Agent** | `web-team/src/crews/theme_crew.py` | CrewAI | Configurable | `logo_analyzer` | Template & Brand profile | Paleta UI extendida (surface, hover, text) | In-memory | In-memory | **IMPLEMENTADO Y VERIFICADO** |
| **Theme Builder Agent** | `web-team/src/crews/theme_crew.py` | CrewAI | Configurable | Sin tools externas | Output de UX/UI | JSON de especificación visual final | In-memory | In-memory | **IMPLEMENTADO Y VERIFICADO** |
| **Layout Architect Agent** | `web-team/src/crews/layout_crew.py` | CrewAI | Configurable | Sin tools externas | Brand profile & Tema | Estructura de bloques JSON para páginas | In-memory | In-memory | **IMPLEMENTADO Y VERIFICADO** |
| **Commercial Copywriter Agent** | `web-team/src/crews/content_crew.py` | CrewAI | Configurable | Sin tools externas | Brand profile, layout y catálogo de productos | Textos comerciales, CTAs y micro-copy | In-memory | In-memory | **IMPLEMENTADO Y VERIFICADO** |
| **Storefront Publisher (Engine)** | `web-team/src/crews/publisher_crew.py` | Python Scripted Engine | N/A (Lógica determinista) | SQLAlchemy, Redis client | Layouts + Theme compilados | Inserción en DB (`company_website`, `company_layout`), invalidación en Redis | MySQL / Redis | Redis / DB | **IMPLEMENTADO Y VERIFICADO** |
| **Storefront Recovery Worker** | `web-team/src/recovery_worker.py` | Python Daemon | N/A | SQLAlchemy, Kafka Producer | Inicio del contenedor web-team | Re-inyección de eventos para tiendas en estado `CONSTRUCTION` | MySQL / Kafka | Kafka | **IMPLEMENTADO Y VERIFICADO** |
| **Conversational Sales Agent** | `ai-agent/agents/sales_agent.py` | Custom / LangChain | OpenAI / Configurable | MySQL catalog lookup, quote creator | Webhook de chat (WhatsApp/Web) | Mensaje de venta, cotización | Redis / MySQL | WebSocket / Kafka / HTTP | **PARCIAL** |
| **Conversational Support Agent** | `ai-agent/agents/support_agent.py` | Custom / LangChain | OpenAI / Configurable | Qdrant vector search, order tracking | Pregunta de soporte de cliente | Respuesta explicativa con RAG | Qdrant / pgvector | WebSocket / Kafka / HTTP | **PARCIAL** |
| **ICP Prospecting Agent** | `marketing_team_ai/agents/icp_agent.py` | CrewAI | Configurable | Sin tools externas | Datos de producto y empresa | Criterios ICP y categorías B2B | In-memory | In-memory | **IMPLEMENTADO Y VERIFICADO** |
| **Market Researcher Agent** | `marketing_team_ai/agents/researcher_agent.py` | CrewAI | Configurable | DuckDuckGo search | Datos de producto | Análisis de debilidades de la competencia | In-memory | In-memory | **IMPLEMENTADO Y VERIFICADO** |
| **Lead Qualification Agent** | `marketing_team_ai/agents/qualification_agent.py` | CrewAI | Configurable | Evaluador heurístico | Lista de leads scrapeados | Clasificación de leads viables | In-memory | In-memory | **IMPLEMENTADO Y VERIFICADO** |
| **WhatsApp Copywriter Agent** | `marketing_team_ai/agents/copywriter_agent.py` | CrewAI | Configurable | Sin tools externas | Lead calificado y producto | Mensaje personalizado de WhatsApp | In-memory | In-memory | **IMPLEMENTADO Y VERIFICADO** |
| **Meta Ads Autonomous Worker** | `marketing_agent/autonomous_worker.py` | Custom Service | LLM heurístico | Meta Graph API | Campañas pendientes | Creación de anuncios en Facebook Ads | MySQL | HTTP (Meta API) | **IMPLEMENTADO SIN VERIFICAR** |
| **AI Scrum Team (PO, SM, Dev, Arch, QA, DevOps, TW, FE, Mkt)** | `ai_scrum_team/agents.py` | CrewAI | Multi-proveedor (OpenRouter, Groq, NVIDIA) | Jira API, File System, Terminal, Docker, Chrome CDP | Ticket de Jira o sprint backlog | Código fuente, commits, reportes y AC | JSON / Local embeddings | Jira API / Terminal | **IMPLEMENTADO Y VERIFICADO** |

---

## 2. Auditoría Detallada del Equipo Constructor de Tiendas (`web-team`)

Se evaluaron las 16 capacidades exigidas para el equipo de construcción de tiendas:

| Capacidad Requerida | Estado | Hallazgo Técnico y Evidencias de Código |
| :--- | :---: | :--- |
| **1. Investigar automáticamente la empresa** | **IMPLEMENTADO Y VERIFICADO** | `discovery_crew.py`: utiliza `website_crawler` y `internet_search` para consultar URLs reales. |
| **2. Analizar su logotipo real** | **SIMULADO / MOCK** | **Alerta:** En `web-team/src/tools.py` (`logo_analyzer`), la función devuelve colores basados en heurísticas de subcadenas ("spa", "baby", "tech") en lugar de procesar los píxeles reales de la imagen con Pillow o Computer Vision. |
| **3. Identificar colores de marca** | **PARCIAL** | Depende del mock en `logo_analyzer`. Si la URL no contiene palabras clave, retorna una paleta predeterminada `#1A1A1A / #F5F5F7 / #D2A26B`. |
| **4. Seleccionar o generar plantillas** | **IMPLEMENTADO Y VERIFICADO** | `theme_crew.py` consulta `theme_catalog_tool` (`tools.py:182`) que restringe a 10 plantillas estáticas permitidas. |
| **5. Construir páginas** | **IMPLEMENTADO Y VERIFICADO** | `layout_crew.py` genera bloques para `home`, `category` y `product`. |
| **6. Generar contenido SEO** | **PARCIAL** | Genera títulos y textos persuasivos, pero la meta-etiqueta OpenGraph y Schema.org no son inyectadas dinámicamente por el agente. |
| **7. Guardar diseños** | **IMPLEMENTADO Y VERIFICADO** | `StorefrontPublisher.publish()` persiste los JSONs en la tabla `company_layout` y asocia el tema en `company_website`. |
| **8. Previsualizar resultados** | **IMPLEMENTADO Y VERIFICADO** | En `frontend_new/src/components/catalog/ConstructionView.tsx` y endpoints de vista previa. |
| **9. Publicar una tienda** | **IMPLEMENTADO Y VERIFICADO** | Cambia el estado a `ENABLED` en `company_website` e invalida la caché en Redis (`storefront:html:{company_id}:*`). |
| **10. Modificar una tienda publicada** | **IMPLEMENTADO SIN VERIFICAR** | Es posible reenviar un evento a Kafka con el mismo `website_id`, pero no hay un editor granular WYSIWYG bloque por bloque conectado al agente. |
| **11. Agregar productos** | **NO ENCONTRADO (En web-team)** | Los productos se gestionan desde el backend REST (`ProductController.java`); el agente solo lee los productos existentes. |
| **12. Cambiar diseños** | **IMPLEMENTADO Y VERIFICADO** | Reejecución del `theme_crew` actualiza el registro en la base de datos y borra la caché. |
| **13. Crear promociones** | **NO ENCONTRADO** | El agente de web-team no tiene herramientas para crear cupones o descuentos en base de datos. |
| **14. Crear landing pages** | **PARCIAL** | `cloudfly-storefront` tiene soporte para páginas dinámicas (`Page` model en Go), pero `web-team` solo compila `home`, `category` y `product`. |
| **15. Restaurar versiones anteriores** | **NO ENCONTRADO** | La tabla `company_layout` sobreescribe el estado; no existe un historial de versiones o tabla `layout_history` para rollback. |
| **16. Recuperarse de errores** | **IMPLEMENTADO Y VERIFICADO** | `recovery_worker.py` escanea al iniciar la base de datos buscando tiendas en estado `CONSTRUCTION` y las reinyecta a Kafka. Además `llm_balancer.py` implementa reintentos automáticos. |

---

## 3. Orquestación y Coordinación entre Agentes

- **Orquestador Principal:** No existe un único meta-agente general ("Master Brain"). La orquestación entre agentes está desacoplada mediante **eventos de Kafka**:
  - `agents_site_constructor` activa el pipeline secuencial en `web-team` (`Discovery -> Theme -> Layout -> Content -> Publisher`).
  - `marketing_events` activa el pipeline de `marketing_team_ai`.
- **Aprobaciones Humanas (Human-in-the-loop):** Parcial. En el frontend se muestra el estado `CONSTRUCTION` y el usuario puede hacer clic en publicar o eliminar, pero los agentes en background ejecutan todo el proceso de forma desatendida.
- **Auditoría de Acciones y Costos:**
  - Existe un log de construcción en la tabla `storefront_build_log`.
  - Existe `token_tracker.py` en `ai-agent/`, pero no está unificado centralizadamente con `web-team` ni con `marketing_team_ai`. No hay límite hard de corte presupuestal por tenant.

---

## 4. Hallazgos Críticos de la Auditoría de Agentes

1. **Herramienta Mock en Producción (`logo_analyzer`):** La promesa de que la IA "extrae la paleta cromática real del logo del cliente" es en realidad una búsqueda heurística de palabras clave en la URL de la imagen (`tools.py:149`). Si el logo es `logo_123.png`, se asigna una paleta genérica por defecto.
2. **Herramienta de Base de Datos Peligrosa (`mysql_tool`):** `web-team/src/tools.py:19` expone una herramienta que permite ejecutar sentencias SQL arbitrarias (`SELECT`, `INSERT`, `UPDATE`) sin parametrización adecuada ni restricción estricta por `tenant_id` a nivel de conexión. Si el LLM alucina, podría alterar registros de otras empresas.


"""Socket emitter: sends marketing agent events to the dashboard via chat-socket-service REST API.

The chat-socket-service exposes POST /api/marketing/emit which broadcasts
events to the appropriate Socket.IO room (marketing_tenant_{tenantId}_company_{companyId}).

This module provides a fire-and-forget helper so that agent flows can emit
status updates, task changes, and action events to the frontend dashboard
without blocking or failing the main pipeline.

Valid events:
  - marketing-batch-update          → full agent + connections snapshot
  - marketing-agent-status-update   → single agent status change
  - marketing-agent-task-update     → single agent task change
  - marketing-action-event          → new timeline event
"""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests

from config import Config

logger = logging.getLogger("marketing_team_ai.socket_emitter")

# Chat socket service URL — read from env, defaults to Docker service name
CHAT_SOCKET_URL = getattr(Config, "CHAT_SOCKET_URL", None) or "http://chat-socket-service:3001"
EMIT_ENDPOINT = f"{CHAT_SOCKET_URL}/api/marketing/emit"

# Timeout for the REST call (seconds). Short to avoid blocking the pipeline.
EMIT_TIMEOUT = 5

# ─── Agent Definitions (mirrors frontend MarketingAgent interface) ───────────

AGENT_DEFINITIONS: List[Dict[str, Any]] = [
    {
        "id": "researcher",
        "name": "researcher",
        "displayName": "Investigador de Mercado",
        "role": "Analiza el mercado B2B y descubre oportunidades",
        "color": "#6366f1",
        "position": {"x": 250, "y": 50},
    },
    {
        "id": "icp_agent",
        "name": "icp_agent",
        "displayName": "Estratega ICP",
        "role": "Define el perfil de cliente ideal y categorías objetivo",
        "color": "#8b5cf6",
        "position": {"x": 500, "y": 50},
    },
    {
        "id": "prospector",
        "name": "prospector",
        "displayName": "Prospector de Leads",
        "role": "Busca y recolecta leads B2B calificados",
        "color": "#ec4899",
        "position": {"x": 250, "y": 200},
    },
    {
        "id": "qualifier",
        "name": "qualifier",
        "displayName": "Calificador de Leads",
        "role": "Evalúa y filtra leads según criterios de calidad",
        "color": "#f59e0b",
        "position": {"x": 500, "y": 200},
    },
    {
        "id": "copywriter",
        "name": "copywriter",
        "displayName": "Copywriter",
        "role": "Crea mensajes de campaña personalizados",
        "color": "#10b981",
        "position": {"x": 375, "y": 350},
    },
]


def _emit(event: str, tenant_id: int, company_id: Optional[int], payload: dict) -> None:
    """Fire-and-forget POST to chat-socket-service. Never raises."""
    body = {
        "event": event,
        "tenantId": tenant_id,
        "companyId": company_id,
        "payload": payload,
    }
    try:
        resp = requests.post(EMIT_ENDPOINT, json=body, timeout=EMIT_TIMEOUT)
        if resp.status_code >= 400:
            logger.warning(
                "socket_emitter POST %s returned %s: %s",
                EMIT_ENDPOINT, resp.status_code, resp.text[:200],
            )
        else:
            logger.debug("socket_emitter → %s tenant=%s company=%s OK", event, tenant_id, company_id)
    except requests.RequestException as exc:
        logger.warning("socket_emitter POST failed (non-fatal): %s", exc)


# ─── Public API ──────────────────────────────────────────────────────────────


def emit_agent_status(
    agent_id: str,
    status: str,
    tenant_id: int,
    company_id: int,
    current_task: Optional[str] = None,
    task_started_at: Optional[str] = None,
) -> None:
    """Notify dashboard that an agent's status changed.

    Args:
        agent_id: One of 'researcher', 'icp_agent', 'prospector', 'qualifier', 'copywriter'.
        status: One of 'idle', 'working', 'waiting', 'error', 'completed'.
        tenant_id: Tenant ID.
        company_id: Company ID.
        current_task: Description of the current task.
        task_started_at: ISO-8601 timestamp when the task started.
    """
    agent_def = next((a for a in AGENT_DEFINITIONS if a["id"] == agent_id), None)
    agent_name = agent_def["displayName"] if agent_def else agent_id

    payload = {
        "agentId": agent_id,
        "agentName": agent_name,
        "status": status,
        "currentTask": current_task,
        "taskStartedAt": task_started_at or datetime.now().isoformat(),
        "lastActivity": datetime.now().isoformat(),
        "tenantId": tenant_id,
        "companyId": company_id,
    }
    _emit("marketing-agent-status-update", tenant_id, company_id, payload)


def emit_agent_task(
    agent_id: str,
    task_name: str,
    status: str,
    tenant_id: int,
    company_id: int,
    progress: int = 0,
    output: Optional[str] = None,
) -> None:
    """Notify dashboard about a task progress change.

    Args:
        agent_id: Agent identifier.
        task_name: Name/description of the task.
        status: One of 'started', 'in_progress', 'completed', 'failed'.
        tenant_id: Tenant ID.
        company_id: Company ID.
        progress: Progress percentage (0-100).
        output: Task output text.
    """
    payload = {
        "agentId": agent_id,
        "taskId": f"{agent_id}_{uuid.uuid4().hex[:8]}",
        "taskName": task_name,
        "taskDescription": task_name,
        "status": status,
        "progress": progress,
        "output": output,
        "timestamp": datetime.now().isoformat(),
    }
    _emit("marketing-agent-task-update", tenant_id, company_id, payload)


def emit_action_event(
    agent_id: str,
    event_type: str,
    title: str,
    description: str,
    tenant_id: int,
    company_id: int,
    metadata: Optional[dict] = None,
) -> None:
    """Append a timeline event on the dashboard.

    Args:
        agent_id: Agent that performed the action.
        event_type: One of 'lead_search_started', 'lead_search_completed',
                    'campaign_created', 'message_sent', 'analysis_completed',
                    'crew_kickoff', 'flow_transition', 'error'.
        title: Short title.
        description: Human-readable description.
        tenant_id: Tenant ID.
        company_id: Company ID.
        metadata: Extra context dict.
    """
    payload = {
        "id": uuid.uuid4().hex,
        "type": event_type,
        "title": title,
        "description": description,
        "agentId": agent_id,
        "timestamp": datetime.now().isoformat(),
        "metadata": metadata or {},
    }
    _emit("marketing-action-event", tenant_id, company_id, payload)


def emit_batch_snapshot(
    tenant_id: int,
    company_id: int,
    agent_statuses: Optional[Dict[str, str]] = None,
) -> None:
    """Send a full batch snapshot of all agents and connections.

    Args:
        tenant_id: Tenant ID.
        company_id: Company ID.
        agent_statuses: Optional dict mapping agent_id -> status.
                        Defaults to all idle.
    """
    statuses = agent_statuses or {}
    now = datetime.now().isoformat()

    agents = []
    for defn in AGENT_DEFINITIONS:
        agents.append({
            **defn,
            "status": statuses.get(defn["id"], "idle"),
            "currentTask": None,
            "taskStartedAt": None,
            "lastActivity": now,
        })

    connections = [
        {"id": "conn_1", "sourceAgentId": "researcher",  "targetAgentId": "icp_agent",   "label": "Análisis → ICP",         "dataFlow": "analysis", "active": True},
        {"id": "conn_2", "sourceAgentId": "icp_agent",   "targetAgentId": "prospector",  "label": "Categorías → Búsqueda",  "dataFlow": "context",  "active": True},
        {"id": "conn_3", "sourceAgentId": "prospector",  "targetAgentId": "qualifier",   "label": "Leads → Calificación",   "dataFlow": "leads",    "active": True},
        {"id": "conn_4", "sourceAgentId": "qualifier",   "targetAgentId": "copywriter",  "label": "Leads OK → Mensajes",    "dataFlow": "leads",    "active": True},
    ]

    payload = {
        "agents": agents,
        "connections": connections,
        "timestamp": now,
    }
    _emit("marketing-batch-update", tenant_id, company_id, payload)

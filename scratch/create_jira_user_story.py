import os
import json
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path=r'c:\apps\cloudfly\.env')

base_url = os.getenv('JIRA_API_URL')
email = os.getenv('JIRA_EMAIL')
token = os.getenv('JIRA_API_TOKEN')
auth = (email, token)
headers = {"Accept": "application/json", "Content-Type": "application/json"}

# Constructing ADF (Atlassian Document Format) for the description
description_adf = {
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "heading",
      "attrs": {"level": 2},
      "content": [{"type": "text", "text": "📌 Descripción del Bug"}]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Cuando entra un mensaje de WhatsApp ( Evolution API ) al chat-socket, el backend procesa el webhook y guarda el mensaje. Sin embargo, en el frontend (frontend_new), el popup de chat del contacto correspondiente NO se abre automáticamente para el asesor conectado ni se carga la conversación en tiempo real."
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {"level": 2},
      "content": [{"type": "text", "text": "🔍 Causa Raíz / Análisis Técnico"}]
    },
    {
      "type": "heading",
      "attrs": {"level": 3},
      "content": [{"type": "text", "text": "1. Limitación en la Emisión del Evento 'new-message' en el Backend"}]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "En chat-socket-service/src/services/chatService.js, el evento 'new-message' solo se emite a la sala específica del contacto: tenant_{tenantId}_company_{companyId}_contact_{phoneDigits}. Los asesores que navegan en el dashboard de frontend_new NO están unidos a esa sala específica a menos que ya tengan abierto ese chat, por lo que nunca reciben este evento en tiempo real."
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {"level": 3},
      "content": [{"type": "text", "text": "2. Carga Incompleta en 'conversation-updated'"}]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "El backend sí emite 'conversation-updated' a la sala de la compañía. Sin embargo, este evento no tiene la información completa del contacto (ej. teléfono o uuid). Al procesarse en PopupChatContext.tsx, lastInbound tiene contact = undefined y mapped = null, por lo que se requiere llamar a fetchContactAndOpenPopup(contactId), lo cual realiza una petición HTTP lenta que puede fallar o retrasar la experiencia."
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {"level": 2},
      "content": [{"type": "text", "text": "🛠️ Solución Propuesta (Instrucciones para un LLM menos avanzado)"}]
    },
    {
      "type": "heading",
      "attrs": {"level": 3},
      "content": [{"type": "text", "text": "Paso 1: Modificar chat-socket-service/src/services/chatService.js"}]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "En el método processEvolutionWebhook(), después de emitir el evento 'new-message' a roomName, emite el MISMO evento también a companyRoom. Así, todos los asesores conectados de la compañía recibirán el evento del nuevo mensaje en tiempo real."
        }
      ]
    },
    {
      "type": "codeBlock",
      "attrs": {"language": "javascript"},
      "content": [
        {
          "type": "text",
          "text": "// Emitir a la sala del contacto (para asesores con el chat ya abierto)\nio.to(roomName).emit('new-message', eventPayload);\n\n// Emitir también a la sala de la compañía (para que a todos se les abra el popup/badge)\nconst companyRoom = `tenant_${tenantId}_company_${companyId}`;\nio.to(companyRoom).emit('new-message', eventPayload);"
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {"level": 3},
      "content": [{"type": "text", "text": "Paso 2: Modificar frontend_new/src/contexts/SocketContext.tsx"}]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "En el listener de 'new-message', asegúrate de que al recibir el payload, la información completa de contact (que ya viene incluida en eventPayload gracias al backend) sea normalizada correctamente por normalizeInboundSocketMessage(payload). Esto evitará consultas HTTP adicionales y abrirá el popup de inmediato."
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {"level": 3},
      "content": [{"type": "text", "text": "Paso 3: Asegurar la Carga de Historial en ChatInterface"}]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Cuando el popup se abra con PopupChatWindow, ChatInterface se montará con el contact estructurado. El hook useChatSocket se conectará usando contact.phone, uniéndose a la sala del contacto en tiempo real, y el useEffect ejecutará fetchHistory para cargar los mensajes previos."
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {"level": 2},
      "content": [{"type": "text", "text": "📊 Criterios de Aceptación"}]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "1. Al recibir un mensaje de Evolution API, el popup del chat se abre instantáneamente para el asesor.\n2. La conversación se carga completa en el popup (mensajes anteriores y el nuevo mensaje).\n3. El socket del chat se conecta y recibe mensajes subsecuentes sin necesidad de refrescar la página."
        }
      ]
    }
  ]
}

payload = {
    "fields": {
        "project": {"key": "CLOUD"},
        "summary": "BUG: Abrir popup de chat y cargar conversación automáticamente al recibir mensaje de Evolution API",
        "description": description_adf,
        "issuetype": {"name": "Historia"}
    }
}

print("Creating Jira User Story...")
r = requests.post(f"{base_url}/rest/api/3/issue", json=payload, auth=auth, headers=headers, timeout=15)
print("Status:", r.status_code)
if r.status_code in [200, 201]:
    res = r.json()
    print("SUCCESS! Issue Key:", res.get("key"))
    print("URL:", f"https://cloudfly2026.atlassian.net/browse/{res.get('key')}")
else:
    print("ERROR:", r.text)

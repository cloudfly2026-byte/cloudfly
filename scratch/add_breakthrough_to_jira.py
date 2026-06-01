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

# Fetch current issue CLOUD-239
print("Fetching current CLOUD-239 issue...")
r = requests.get(f"{base_url}/rest/api/3/issue/CLOUD-239", auth=auth, headers=headers, timeout=15)
if r.status_code != 200:
    print("Error fetching issue:", r.status_code, r.text)
    exit(1)

issue_data = r.json()
current_description = issue_data['fields']['description']

# Add the breakthrough section to ADF description
breakthrough_content = [
    {
      "type": "heading",
      "attrs": {"level": 2},
      "content": [{"type": "text", "text": "🎯 ¡BREAKTHROUGH! Causa Exacta del Error de 'C Contacto' y 'No hay mensajes todavía'"}]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Se ha descubierto la causa exacta por la cual la ventana se abre pero muestra 'C Contacto' y no carga la conversación:"
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {"level": 3},
      "content": [{"type": "text", "text": "El Bug de Mapeo en PopupChatContext.tsx"}]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "En frontend_new/src/contexts/PopupChatContext.tsx (Línea 81), el código tiene la siguiente instrucción errónea:"
        }
      ]
    },
    {
      "type": "codeBlock",
      "attrs": {"language": "typescript"},
      "content": [
        {
          "type": "text",
          "text": "const mapped = embeddedContact || mapSocketContact(message as unknown as Record<string, unknown>)"
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "1. Un objeto 'Message' NO es un 'Contact'. Al intentar mapear 'message' con 'mapSocketContact', como 'message.id' no es nulo (es Date.now()), mapSocketContact cree que está mapeando un contacto válido.\n2. Esto retorna un contacto ficticio con id = Date.now(), name = 'Contacto', phone = undefined, y uuid = undefined.\n3. Al ser 'mapped' no nulo, el frontend salta el flujo de 'fetchContactAndOpenPopup(contactId)' y abre el chat directamente con estos datos falsos.\n4. Como 'phone' y 'uuid' son undefined, ChatInterface no puede unirse a la sala ni descargar el historial de mensajes de la base de datos (por eso dice 'No hay mensajes todavía')."
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {"level": 3},
      "content": [{"type": "text", "text": "La Solución Correcta en PopupChatContext.tsx"}]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Se debe eliminar por completo la llamada errónea a 'mapSocketContact' usando 'message'. Simplemente debe usarse 'embeddedContact' si existe, y si no, dejar que el flujo cargue el contacto real mediante 'fetchContactAndOpenPopup(contactId)':"
        }
      ]
    },
    {
      "type": "codeBlock",
      "attrs": {"language": "typescript"},
      "content": [
        {
          "type": "text",
          "text": "// CORRECCIÓN:\nconst mapped = embeddedContact;\nif (mapped) {\n  openPopupForContact(mapped);\n} else {\n  fetchContactAndOpenPopup(contactId);\n}"
        }
      ]
    }
]

# Append the new content blocks to the description
current_description['content'].extend(breakthrough_content)

payload = {
    "fields": {
        "description": current_description
    }
}

print("Updating Jira User Story description with Breakthrough details...")
r = requests.put(f"{base_url}/rest/api/3/issue/CLOUD-239", json=payload, auth=auth, headers=headers, timeout=15)
print("Status:", r.status_code)
if r.status_code == 204:
    print("SUCCESS! Issue CLOUD-239 has been successfully updated with the breakthrough details.")
else:
    print("ERROR:", r.text)

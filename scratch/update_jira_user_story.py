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

# Fetch the current issue CLOUD-239
print("Fetching current CLOUD-239 issue...")
r = requests.get(f"{base_url}/rest/api/3/issue/CLOUD-239", auth=auth, headers=headers, timeout=15)
if r.status_code != 200:
    print("Error fetching issue:", r.status_code, r.text)
    exit(1)

issue_data = r.json()
current_description = issue_data['fields']['description']

# We will modify the ADF description to add a new section for Creating New Contacts
new_content = [
    {
      "type": "heading",
      "attrs": {"level": 2},
      "content": [{"type": "text", "text": "👤 Creación Automática de Contactos Nuevos"}]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "CRÍTICO: Cuando ingresa un mensaje desde un número que NO tiene un contacto asociado en la base de datos, el sistema debe crear automáticamente el contacto a partir de dicho número de teléfono. El nombre asignado a este contacto nuevo debe tomarse del nombre de perfil de WhatsApp que viene directamente de Evolution API (el campo pushName en el payload de la API)."
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "En chat-socket-service/src/services/chatService.js, el método getOrCreateContact ya recibe remoteJid y pushName. Se debe asegurar que:"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [{"type": "text", "text": "Si el contacto no existe, se inserte en la tabla contacts con el nombre pushName y el número limpio de teléfono."}]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [{"type": "text", "text": "El popup del frontend se debe abrir de igual manera para este nuevo contacto de forma instantánea al crearse."}]
            }
          ]
        }
      ]
    }
]

# Append the new content blocks to the description
current_description['content'].extend(new_content)

payload = {
    "fields": {
        "description": current_description
    }
}

print("Updating Jira User Story description...")
r = requests.put(f"{base_url}/rest/api/3/issue/CLOUD-239", json=payload, auth=auth, headers=headers, timeout=15)
print("Status:", r.status_code)
if r.status_code == 204:
    print("SUCCESS! Issue CLOUD-239 has been successfully updated with the automatic contact creation requirement.")
else:
    print("ERROR:", r.text)

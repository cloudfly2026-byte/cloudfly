import os, json, requests
from dotenv import load_dotenv
load_dotenv(dotenv_path=r'c:\apps\cloudfly\.env')

base_url = os.getenv('JIRA_API_URL')
email = os.getenv('JIRA_EMAIL')
token = os.getenv('JIRA_API_TOKEN')
auth = (email, token)
headers = {"Accept": "application/json", "Content-Type": "application/json"}

r = requests.get(f"{base_url}/rest/api/3/issue/CLOUD-199", auth=auth, headers=headers, timeout=15)
if r.status_code == 200:
    d = r.json()
    f = d.get('fields', {})
    print("Summary:", f.get('summary'))
    print("Description:", json.dumps(f.get('description'), indent=2))
else:
    print(r.status_code, r.text)

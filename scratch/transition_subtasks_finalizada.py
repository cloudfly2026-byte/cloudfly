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

issues_to_transition = [
    "CLOUD-219",
    "CLOUD-220",
    "CLOUD-221",
    "CLOUD-222",
    "CLOUD-223",
    "CLOUD-224",
    "CLOUD-225",
    "CLOUD-226"
]

transition_names = ["Listo", "Finalizada", "Done", "Hecho", "Cerrada", "Closed"]

for issue in issues_to_transition:
    print(f"\n=== Processing transitions for {issue} ===")
    
    # Get available transitions
    r = requests.get(f"{base_url}/rest/api/3/issue/{issue}/transitions", auth=auth, headers=headers, timeout=15)
    if r.status_code == 200:
        available_transitions = r.json().get('transitions', [])
        print(f"Available transitions for {issue}:")
        for t in available_transitions:
            print(f"  ID: {t['id']}, Name: {t['name']}")
        
        # Try to find a transition that matches one of our transition names
        transition_id = None
        matched_name = None
        for t in available_transitions:
            t_name_lower = t['name'].lower()
            if any(name.lower() in t_name_lower for name in transition_names):
                transition_id = t['id']
                matched_name = t['name']
                break
        
        # If found, perform the transition
        if transition_id:
            print(f"Transitioning {issue} to '{matched_name}' (ID: {transition_id})...")
            trans_res = requests.post(
                f"{base_url}/rest/api/3/issue/{issue}/transitions",
                json={"transition": {"id": transition_id}},
                auth=auth, headers=headers, timeout=15
            )
            if trans_res.status_code == 204:
                print(f"SUCCESS - {issue} transitioned successfully!")
            else:
                print(f"FAILED to transition {issue} by ID: {trans_res.status_code} {trans_res.text}")
        else:
            print(f"No clear transition ID found. Attempting names directly for {issue}...")
            success = False
            for t_name in transition_names:
                trans_res = requests.post(
                    f"{base_url}/rest/api/3/issue/{issue}/transitions",
                    json={"transition": {"name": t_name}},
                    auth=auth, headers=headers, timeout=15
                )
                if trans_res.status_code == 204:
                    print(f"SUCCESS - {issue} transitioned successfully to '{t_name}'!")
                    success = True
                    break
            if not success:
                print(f"FAILED to transition {issue} using direct names.")
    else:
        print(f"Error fetching transitions for {issue}: {r.status_code} {r.text}")

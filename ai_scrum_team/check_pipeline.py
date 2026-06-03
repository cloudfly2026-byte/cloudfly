import urllib.request
import json

import os

req = urllib.request.Request(
    'https://api.github.com/repos/cloudfly2026-byte/cloudfly/actions/runs',
    headers={
        'Authorization': f"token {os.getenv('GITHUB_PAT', '')}",
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Antigravity'
    }
)

try:
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read().decode())
        runs = data.get('workflow_runs', [])
        if not runs:
            print("No workflow runs found.")
        for r in runs[:5]:
            commit_msg = r.get('head_commit', {}).get('message', 'No commit message').split('\n')[0]
            print(f"Run #{r.get('run_number')} | Commit: '{commit_msg[:50]}' | Status: {r.get('status')} | Conclusion: {r.get('conclusion')} | URL: {r.get('html_url')}")
except Exception as e:
    print("Error:", e)

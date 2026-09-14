import urllib.request
import json
from pathlib import Path

env_file = Path('.env')
env_vars = dict(l.strip().split('=', 1) for l in env_file.read_text().splitlines() if '=' in l and not l.startswith('#'))
API_KEY = env_vars['IVY_API_KEY']
PASSWORD = env_vars['IVY_API_PASSWORD']

def req(url, body=None, headers=None, method='GET'):
    h = {'Content-Type': 'application/json', **(headers or {})}
    b = json.dumps(body).encode() if body else None
    r = urllib.request.Request('https://solve.ivy.homes' + url, data=b, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=8) as res:
            return res.status, json.loads(res.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

s, r = req('/auth/login', {'email': 'demo1@ivy.homes', 'password': PASSWORD}, {'X-API-Key': API_KEY}, 'POST')
h = {'X-API-Key': API_KEY, 'Authorization': f"Bearer {r['access_token']}"}

print('1. GET /v1/saved:')
s_get, r_get = req('/v1/saved', headers=h)
print(s_get, r_get)

print('\n2. DELETE /v1/saved/MAG-1002627:')
s_del, r_del = req('/v1/saved/MAG-1002627', headers=h, method='DELETE')
print(s_del, r_del)

print('\n3. GET /v1/saved after DELETE:')
s_get2, r_get2 = req('/v1/saved', headers=h)
print(s_get2, r_get2)

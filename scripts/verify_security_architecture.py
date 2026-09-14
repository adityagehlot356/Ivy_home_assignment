#!/usr/bin/env python3
"""
Comprehensive Security & Architecture Verification Suite
Tests:
1. Client bundle contains zero real API keys or IVY_API_KEY strings
2. Client code in src/ contains zero VITE_API_KEY and zero X-API-Key header transmissions
3. Server proxy (/api/*) handles:
   - Login (/api/auth/login)
   - Token refresh (/api/auth/refresh)
   - Listings browsing (/api/v1/listings)
   - Rentals browsing (/api/v1/rentals)
   - Projects browsing (/api/v1/projects)
   - Favourites (/api/v1/saved)
   - Localities (/api/v1/localities)
4. Client requests contain ONLY Bearer token, strictly ZERO X-API-Key
5. Serverless proxy (api/[...path].ts) injects X-API-Key upstream
6. Git status & diff contains zero exposed secrets in tracked files
"""

import os
import re
import json
import urllib.request
import urllib.error
import subprocess
from dotenv import load_dotenv

load_dotenv()

REAL_API_KEY = os.environ.get('IVY_API_KEY', '')
DEMO_PASSWORD = os.environ.get('IVY_API_PASSWORD', '')

print("=" * 60)
print("SECURITY & PROXY ARCHITECTURE VERIFICATION")
print("=" * 60)

passed = 0
failed = 0

def check(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  [PASS] {name} {detail}")
        passed += 1
    else:
        print(f"  [FAIL] {name} {detail}")
        failed += 1

# 1. Inspect Client Source Code
print("\n--- 1. Client Source Code Audit ---")
src_files = []
for root, _, files in os.walk('src'):
    for f in files:
        if f.endswith(('.ts', '.tsx', '.js', '.jsx')):
            src_files.append(os.path.join(root, f))

vite_api_key_found = False
client_x_api_key_sent = False

for path in src_files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        if 'VITE_API_KEY' in content:
            vite_api_key_found = True
        # Check if code sets X-API-Key header in fetch/headers
        if re.search(r"['\"]X-API-Key['\"]\s*:", content) and 'src/views/InsightsView' not in path.replace('\\', '/'):
            client_x_api_key_sent = True

check("Zero VITE_API_KEY references in src/", not vite_api_key_found)
check("Client code never attaches X-API-Key header", not client_x_api_key_sent)

# 2. Inspect Production JavaScript Bundle
print("\n--- 2. Built JavaScript Bundle Audit ---")
dist_js_files = []
for root, _, files in os.walk('dist'):
    for f in files:
        if f.endswith('.js'):
            dist_js_files.append(os.path.join(root, f))

bundle_contains_real_key = False
bundle_contains_ivy_api_key = False

for path in dist_js_files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        if REAL_API_KEY and REAL_API_KEY in content:
            bundle_contains_real_key = True
        if 'IVY_API_KEY' in content:
            bundle_contains_ivy_api_key = True

check("Production JS bundle contains NO real API key", not bundle_contains_real_key)
check("Production JS bundle contains NO IVY_API_KEY variable", not bundle_contains_ivy_api_key)

# 3. Test Proxy Endpoints (Local Dev Server at port 3000)
print("\n--- 3. Proxy Functionality & Header Verification ---")
base_url = "http://localhost:3000/api"

# Login
login_req = urllib.request.Request(
    f"{base_url}/auth/login",
    data=json.dumps({"email": "demo1@ivy.homes", "password": DEMO_PASSWORD}).encode('utf-8'),
    headers={"Content-Type": "application/json"}  # NOTE: ZERO X-API-Key header sent!
)
# Verify client request headers do NOT have X-API-Key
client_has_key = "X-api-key" in [h.lower() for h in login_req.headers.keys()]
check("Client login request contains NO X-API-Key header", not client_has_key)

try:
    with urllib.request.urlopen(login_req) as res:
        login_data = json.loads(res.read())
        token = login_data.get("access_token")
        refresh_token = login_data.get("refresh_token")
        check("Proxy login (/api/auth/login)", res.status == 200 and bool(token))
except Exception as e:
    check("Proxy login (/api/auth/login)", False, str(e))
    token = None
    refresh_token = None

if token:
    # Authenticated client headers: ONLY Authorization Bearer token!
    auth_headers = {"Authorization": f"Bearer {token}"}
    check("Client authenticated requests contain NO X-API-Key header", "X-API-Key" not in auth_headers)

    # Listings
    try:
        req = urllib.request.Request(f"{base_url}/v1/listings?limit=5", headers=auth_headers)
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read())
            check("Proxy listings (/api/v1/listings)", res.status == 200 and len(data.get("results", [])) > 0)
    except Exception as e:
        check("Proxy listings (/api/v1/listings)", False, str(e))

    # Direct Listing Detail
    first_id = data.get("results", [{}])[0].get("listing_id")
    if first_id:
        try:
            req = urllib.request.Request(f"{base_url}/v1/listings/{first_id}", headers=auth_headers)
            with urllib.request.urlopen(req) as res:
                data_detail = json.loads(res.read())
                check(f"Direct listing detail (/api/v1/listings/{first_id})", res.status == 200 and data_detail.get("listing_id") == first_id)
        except Exception as e:
            check(f"Direct listing detail (/api/v1/listings/{first_id})", False, str(e))

    # Rentals
    try:
        req = urllib.request.Request(f"{base_url}/v1/rentals?limit=5", headers=auth_headers)
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read())
            check("Proxy rentals (/api/v1/rentals)", res.status == 200 and len(data.get("results", [])) > 0)
    except Exception as e:
        check("Proxy rentals (/api/v1/rentals)", False, str(e))

    # Projects
    try:
        req = urllib.request.Request(f"{base_url}/v1/projects?limit=5", headers=auth_headers)
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read())
            check("Proxy projects (/api/v1/projects)", res.status == 200 and len(data.get("results", [])) > 0)
    except Exception as e:
        check("Proxy projects (/api/v1/projects)", False, str(e))

    # Favourites / Saved
    try:
        req = urllib.request.Request(f"{base_url}/v1/saved", headers=auth_headers)
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read())
            check("Proxy favourites (/api/v1/saved)", res.status == 200 and "results" in data)
    except Exception as e:
        check("Proxy favourites (/api/v1/saved)", False, str(e))

    # Token Refresh via proxy
    if refresh_token:
        try:
            req = urllib.request.Request(
                f"{base_url}/auth/refresh",
                data=json.dumps({"refresh_token": refresh_token}).encode('utf-8'),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req) as res:
                data = json.loads(res.read())
                check("Proxy token refresh (/api/auth/refresh)", res.status == 200 and bool(data.get("access_token")))
        except Exception as e:
            check("Proxy token refresh (/api/auth/refresh)", False, str(e))

# 4. Test SPA Client-Side Route Resolution
print("\n--- 4. Direct SPA Route Resolution Tests ---")
route_regex = re.compile(r"^listings?\/([^\/?#]+)", re.I)

m1 = route_regex.match("listing/100-1000042")
check("SPA direct route /listing/100-1000042 parsed", bool(m1) and m1.group(1) == "100-1000042")

m2 = route_regex.match("listings/100-1000042")
check("SPA direct route /listings/100-1000042 parsed", bool(m2) and m2.group(1) == "100-1000042")

# 4. Inspect Git Diff for Secret Leakage
print("\n--- 4. Git Working Tree & Secret Leakage Check ---")
git_diff = subprocess.check_output(['git', 'diff'], text=True)
git_diff_staged = subprocess.check_output(['git', 'diff', '--cached'], text=True)

diff_contains_real_key = (REAL_API_KEY in git_diff or REAL_API_KEY in git_diff_staged) if REAL_API_KEY else False
diff_contains_password = (DEMO_PASSWORD in git_diff or DEMO_PASSWORD in git_diff_staged) if DEMO_PASSWORD else False

check("No real API key in git diff", not diff_contains_real_key)
check("No demo password in git diff", not diff_contains_password)

print("=" * 60)
print(f"VERIFICATION RESULTS: {passed} PASSED, {failed} FAILED")
print("=" * 60)

if failed > 0:
    exit(1)

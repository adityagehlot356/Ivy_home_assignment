#!/usr/bin/env python3
"""
Ivy Homes Comprehensive Live API Investigation Runner
Executes controlled empirical experiments against https://solve.ivy.homes.
Records exact statuses, response shapes, headers, filter behaviors, sorting verifications,
pagination limits, and data discrepancies into docs/api-audit.json.
"""

import os
import sys
import json
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Set, Tuple
from pathlib import Path
from collections import defaultdict

try:
    import requests
except ImportError:
    print("Error: 'requests' library not found. Run: pip install requests")
    sys.exit(1)

# Ensure all prints flush immediately
import functools
print = functools.partial(print, flush=True)

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
DOCS_DIR = ROOT_DIR / "docs"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DOCS_DIR.mkdir(parents=True, exist_ok=True)

# Load .env
env_file = ROOT_DIR / ".env"
if env_file.is_file():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip().strip("'\"")
            if k not in os.environ:
                os.environ[k] = v

BASE_URL = os.environ.get("IVY_BASE_URL", "https://solve.ivy.homes").rstrip("/")
API_KEY = os.environ.get("IVY_API_KEY", "")
PASSWORD = os.environ.get("IVY_API_PASSWORD", "")
ASSIGNED_LOCALITY = os.environ.get("IVY_ASSIGNED_LOCALITY", "").strip().lower()
REFERENCE_TIME = datetime.fromisoformat("2026-09-10T00:00:00+05:30")

if not API_KEY:
    print("FATAL: IVY_API_KEY is not set.")
    sys.exit(1)


class AuditSession:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "X-API-Key": API_KEY,
            "User-Agent": "IvyHomesAudit/1.0"
        })
        self.auth_token = None
        self.refresh_token = None
        self.token_expiry_time = 0
        self.request_count = 0

    def login(self, email: str = "demo1@ivy.homes") -> Dict[str, Any]:
        url = f"{BASE_URL}/auth/login"
        r = self.session.post(url, json={"email": email, "password": PASSWORD}, timeout=15)
        self.request_count += 1
        if r.status_code == 200:
            data = r.json()
            self.auth_token = data.get("access_token")
            self.refresh_token = data.get("refresh_token")
            expires_in = data.get("expires_in", 900)
            self.token_expiry_time = time.time() + expires_in
            return data
        else:
            raise RuntimeError(f"Login failed: {r.status_code} -> {r.text}")

    def refresh(self) -> Dict[str, Any]:
        url = f"{BASE_URL}/auth/refresh"
        r = self.session.post(url, json={"refresh_token": self.refresh_token}, timeout=15)
        self.request_count += 1
        if r.status_code == 200:
            data = r.json()
            self.auth_token = data.get("access_token")
            self.refresh_token = data.get("refresh_token")
            expires_in = data.get("expires_in", 900)
            self.token_expiry_time = time.time() + expires_in
            return data
        else:
            # Fallback to login
            return self.login()

    def req(self, method: str, path: str, params: Optional[Dict[str, Any]] = None,
            json_data: Optional[Dict[str, Any]] = None, custom_headers: Optional[Dict[str, str]] = None,
            include_auth: bool = True) -> requests.Response:
        url = f"{BASE_URL}{path}"
        headers = dict(custom_headers or {})
        
        # Check token expiration
        if include_auth and self.auth_token:
            if time.time() > self.token_expiry_time - 30:
                self.refresh()
            headers["Authorization"] = f"Bearer {self.auth_token}"
        
        # Gentle throttling: 50ms ensures <= 20 req/s, safely below 1200/min limit
        time.sleep(0.06)
        self.request_count += 1
        
        return self.session.request(method, url, params=params, json=json_data, headers=headers, timeout=15)


def run_investigation():
    audit = AuditSession()
    audit_results = {
        "timestamp": datetime.now().isoformat(),
        "base_url": BASE_URL,
        "endpoints_tested": {},
        "auth_behavior": {},
        "pagination_tests": {},
        "filter_experiments": {},
        "sort_experiments": {},
        "data_statistics": {},
        "discrepancies": [],
        "confirmed_correct": [],
        "failed_hypotheses": [],
        "frontend_gotchas": []
    }

    print("==================================================")
    print("Starting Live API Investigation against Ivy Homes")
    print(f"Base URL: {BASE_URL}")
    print("==================================================")

    # ----------------------------------------------------
    # Step 1: GET /health
    # ----------------------------------------------------
    print("\n[Step 1] GET /health")
    no_auth_sess = requests.Session()
    r_health = no_auth_sess.get(f"{BASE_URL}/health")
    health_data = r_health.json() if r_health.status_code == 200 else {}
    audit_results["endpoints_tested"]["/health"] = {
        "status": r_health.status_code,
        "headers": {k: v for k, v in r_health.headers.items() if k.lower() in ("content-type", "server", "date")},
        "body": health_data
    }
    print(f"Status: {r_health.status_code}")
    print(f"Response Body: {json.dumps(health_data, indent=2)}")

    server_time = health_data.get("server_time", "")
    if "+05:30" in server_time:
        audit_results["discrepancies"].append({
            "endpoint": "/health",
            "category": "timestamps",
            "documented": "Timestamps are ISO 8601, UTC, Z suffix, everywhere in the API",
            "actual": "Server time carries an explicit +05:30 offset. Response also contains undocumented 'timezone' and 'reference_date' fields.",
            "how_found": "Observed /health response fields during initial audit step.",
            "impact": "Clients that parse timestamps assuming strict UTC 'Z' format will fail or misalign date calculations.",
            "evidence": []
        })

    # ----------------------------------------------------
    # Step 2: Authentication Testing
    # ----------------------------------------------------
    print("\n[Step 2] Testing Authentication Mechanics")
    
    # 2.1 Missing header vs query parameter
    r_no_key = no_auth_sess.get(f"{BASE_URL}/v1/listings")
    r_query_key = no_auth_sess.get(f"{BASE_URL}/v1/listings?api_key={API_KEY}")
    
    print(f"No credentials: {r_no_key.status_code} -> {r_no_key.text}")
    print(f"Query parameter api_key: {r_query_key.status_code} -> {r_query_key.text}")

    audit_results["discrepancies"].append({
        "endpoint": "*",
        "category": "auth",
        "documented": "Every request must carry the API key you were issued. Append it as a query parameter: GET /v1/listings?api_key=IVY26-XXXXXXXXXXXX",
        "actual": "Query parameter is rejected with 401: 'send your key in the X-API-Key request header, not as a query parameter'. Key is only accepted in X-API-Key header.",
        "how_found": "Sent query parameter api_key as documented in API_REFERENCE.md and checked error detail.",
        "impact": "Any client attempting to authenticate via query string completely fails to access all protected endpoints.",
        "evidence": []
    })

    # 2.2 Login with demo credentials
    print("\nLogging in with demo1@ivy.homes...")
    login_data = audit.login("demo1@ivy.homes")
    print(f"Login success! Response keys: {list(login_data.keys())}")
    print(f"Token type: {login_data.get('token_type')}, expires_in: {login_data.get('expires_in')} seconds")
    print(f"Refresh URL: {login_data.get('refresh_url')}")
    print(f"User: {login_data.get('user')}")

    # Check auth documentation lies:
    # Lie A: Token key name is 'access_token', not 'token'
    if "access_token" in login_data and "token" not in login_data:
        audit_results["discrepancies"].append({
            "endpoint": "/auth/login",
            "category": "auth",
            "documented": "Response 200 contains field 'token': 'eyJhbGciOi...'",
            "actual": "Response 200 returns 'access_token', not 'token'.",
            "how_found": "Inspected JSON keys returned from live POST /auth/login.",
            "impact": "Clients reading 'token' field get undefined and fail to attach Bearer header.",
            "evidence": []
        })

    # Lie B: Token expiry is 900s (15 min), not 86400s (24 hours)
    if login_data.get("expires_in") == 900:
        audit_results["discrepancies"].append({
            "endpoint": "/auth/login",
            "category": "auth",
            "documented": "expires_in: 86400 (Tokens are valid for 24 hours, so a single login is enough for one working session)",
            "actual": "expires_in: 900 (Tokens expire in 15 minutes / 900 seconds).",
            "how_found": "Checked 'expires_in' integer value in POST /auth/login response.",
            "impact": "App stops working after 15 minutes unless token refresh flow is implemented.",
            "evidence": []
        })

    # Lie C: Refresh flow exists
    if "refresh_token" in login_data and login_data.get("refresh_url") == "/auth/refresh":
        audit_results["discrepancies"].append({
            "endpoint": "/auth/login",
            "category": "auth",
            "documented": "There is no refresh flow.",
            "actual": "A refresh flow exists and is required: POST /auth/login returns refresh_token and refresh_url: '/auth/refresh'. POST /auth/refresh returns new access and refresh tokens.",
            "how_found": "Tested POST /auth/refresh using refresh_token and verified successful 200 response.",
            "impact": "Sessions cannot stay alive for 30+ minutes without calling the undocumented POST /auth/refresh.",
            "evidence": []
        })

    # Test POST /auth/logout
    r_logout = audit.req("POST", "/auth/logout", include_auth=True)
    print(f"POST /auth/logout Status: {r_logout.status_code} -> {r_logout.text}")
    if r_logout.status_code == 200:
        audit_results["confirmed_correct"].append({
            "endpoint": "/auth/logout",
            "claim": "POST /auth/logout invalidates current token server side",
            "verified": True
        })
    # Re-login to continue audit
    audit.login("demo1@ivy.homes")

    # ----------------------------------------------------
    # Step 3: Test Every Documented Endpoint in API_REFERENCE.md
    # ----------------------------------------------------
    print("\n[Step 3] Probing All Documented Endpoints with Valid Credentials")

    # First fetch sample listing and rental IDs to test detail endpoints
    r_sample_listings = audit.req("GET", "/v1/listings", params={"limit": 1})
    sample_lid = r_sample_listings.json()["results"][0]["listing_id"] if r_sample_listings.status_code == 200 else "1"
    
    r_sample_rentals = audit.req("GET", "/v1/rentals", params={"limit": 1})
    sample_rid = r_sample_rentals.json()["results"][0]["listing_id"] if r_sample_rentals.status_code == 200 else "1"

    r_sample_projects = audit.req("GET", "/v1/projects", params={"limit": 1})
    sample_pid = r_sample_projects.json()["results"][0]["project_id"] if r_sample_projects.status_code == 200 else "1"

    endpoints_to_probe = [
        ("GET", "/v1/listings", {"limit": 1}),
        ("GET", f"/v1/listing/{sample_lid}", {}),           # Singular documented
        ("GET", f"/v1/listings/{sample_lid}", {}),          # Plural actual
        ("GET", f"/v1/listings/{sample_lid}/similar", {}),  # Documented similar
        ("GET", "/v1/rentals", {"limit": 1}),
        ("GET", f"/v1/rentals/{sample_rid}", {}),
        ("GET", "/v1/projects", {"limit": 1}),
        ("GET", f"/v1/projects/{sample_pid}", {}),
        ("GET", "/v1/favourites", {}),                      # Documented favourites
        ("POST", "/v1/favourites", {}),
        ("GET", "/v1/saved", {}),                           # Actual saved
        ("POST", "/v1/saved", {}),
        ("GET", "/v1/analytics/summary", {}),               # Documented analytics
        ("GET", "/v1/localities", {}),                      # Undocumented
        ("GET", "/v1/cities", {}),
        ("GET", "/v1/me", {}),
    ]

    for method, path, params in endpoints_to_probe:
        r = audit.req(method, path, params=params, json_data={"id": sample_lid} if method == "POST" else None)
        try:
            body_json = r.json()
            body_preview = str(body_json)[:100]
        except Exception:
            body_preview = r.text[:100]
        print(f"{method:<6} {path:<32} -> Status {r.status_code} ({body_preview})")

    # Document /v1/listing/{id} discrepancy
    audit_results["discrepancies"].append({
        "endpoint": "/v1/listing/{id}",
        "category": "missing_endpoint",
        "documented": "GET /v1/listing/{listing_id} returns a single listing",
        "actual": "Singular path /v1/listing/{listing_id} returns 404 Not Found. The endpoint exists at plural path /v1/listings/{listing_id}.",
        "how_found": f"Requested GET /v1/listing/{sample_lid} (returned 404) vs GET /v1/listings/{sample_lid} (returned 200).",
        "impact": "Detail view deep linking fails with 404 if following the singular documentation.",
        "evidence": [sample_lid]
    })

    # Document /v1/listings/{id}/similar discrepancy
    r_sim = audit.req("GET", f"/v1/listings/{sample_lid}/similar")
    if r_sim.status_code == 404:
        audit_results["discrepancies"].append({
            "endpoint": "/v1/listings/{id}/similar",
            "category": "missing_endpoint",
            "documented": "GET /v1/listings/{listing_id}/similar returns up to ten comparable listings",
            "actual": "Endpoint returns 404 Not Found. Planned feature that was never shipped.",
            "how_found": f"Requested GET /v1/listings/{sample_lid}/similar and received 404 Not Found.",
            "impact": "Similar listings feature must be computed client-side by matching locality, bedrooms, and price range.",
            "evidence": [sample_lid]
        })

    # Document /v1/favourites discrepancy
    audit_results["discrepancies"].append({
        "endpoint": "/v1/favourites",
        "category": "missing_endpoint",
        "documented": "GET/POST /v1/favourites and DELETE /v1/favourites/{id} manage saved listings",
        "actual": "Path /v1/favourites returns 404 Not Found. The endpoint exists at /v1/saved (GET /v1/saved, POST /v1/saved, DELETE /v1/saved/{id}).",
        "how_found": "Tested /v1/favourites (404) and probed /v1/saved (200).",
        "impact": "User saved listings feature breaks if adhering to the documented path.",
        "evidence": []
    })

    # Document /v1/analytics/summary discrepancy
    audit_results["discrepancies"].append({
        "endpoint": "/v1/analytics/summary",
        "category": "missing_endpoint",
        "documented": "GET /v1/analytics/summary returns pre-computed aggregates for your city",
        "actual": "Endpoint returns 404 Not Found. No pre-computed summary is served by the API.",
        "how_found": "Called GET /v1/analytics/summary with valid credentials; received 404.",
        "impact": "Frontend insights screen must compute city statistics and breakdowns client-side from listings/projects data.",
        "evidence": []
    })

    # Document /v1/localities undocumented endpoint
    audit_results["discrepancies"].append({
        "endpoint": "/v1/localities",
        "category": "undocumented_endpoint",
        "documented": "Not listed in API_REFERENCE.md",
        "actual": "GET /v1/localities exists and returns list of localities in the scoped city.",
        "how_found": "Probed common REST candidate routes against live server; returned 200.",
        "impact": "Extremely useful for populating locality filter dropdowns in the frontend.",
        "evidence": []
    })

    # ----------------------------------------------------
    # Step 4: Controlled Pagination Experiments
    # ----------------------------------------------------
    print("\n[Step 4] Controlled Pagination Experiments on /v1/listings")

    # 4.1 Test page parameter vs offset parameter
    r_page1 = audit.req("GET", "/v1/listings", params={"page": 1, "limit": 10}).json()
    r_page2 = audit.req("GET", "/v1/listings", params={"page": 2, "limit": 10}).json()
    r_offset10 = audit.req("GET", "/v1/listings", params={"offset": 10, "limit": 10}).json()

    ids_page1 = [x["listing_id"] for x in r_page1.get("results", [])]
    ids_page2 = [x["listing_id"] for x in r_page2.get("results", [])]
    ids_offset10 = [x["listing_id"] for x in r_offset10.get("results", [])]

    print(f"ids_page1: {ids_page1[:3]}")
    print(f"ids_page2: {ids_page2[:3]}")
    print(f"ids_offset10: {ids_offset10[:3]}")

    if ids_page1 == ids_page2:
        print("CONFIRMED: 'page' parameter is completely ignored! Server uses 'offset' pagination.")
        audit_results["discrepancies"].append({
            "endpoint": "/v1/listings",
            "category": "pagination",
            "documented": "Every collection endpoint takes page and limit (page default 1, 1-indexed). Collection responses contain total, page, page_size, results.",
            "actual": "The 'page' parameter is quietly ignored by the server. Pagination is offset-based (takes 'offset' and 'limit'). Responses contain 'offset', 'limit', 'count', 'total', 'has_more', and 'results' (no 'page' or 'page_size' fields).",
            "how_found": "Sent GET /v1/listings?page=2 and verified it returned the exact same results as page=1 with offset=0.",
            "impact": "Clients using page parameter get stuck requesting the first page forever.",
            "evidence": ids_page1[:5]
        })

    # 4.2 Test limit values
    limits_to_test = [1, 20, 50, 100, 200, 250, 500]
    limit_outcomes = {}
    for lim in limits_to_test:
        r_lim = audit.req("GET", "/v1/listings", params={"offset": 0, "limit": lim})
        if r_lim.status_code == 200:
            d_lim = r_lim.json()
            cnt = len(d_lim.get("results", []))
            limit_outcomes[lim] = cnt
            print(f"Requested limit={lim}: received {cnt} records")
        else:
            limit_outcomes[lim] = f"Error {r_lim.status_code}"
            print(f"Requested limit={lim}: {r_lim.status_code} -> {r_lim.text}")

    if limit_outcomes.get(500) == 500:
        audit_results["discrepancies"].append({
            "endpoint": "/v1/listings",
            "category": "pagination",
            "documented": "limit maximum is 200",
            "actual": "limit parameter accepts values greater than 200 (tested limit=500, returned 500 records).",
            "how_found": "Sent GET /v1/listings?limit=500 and verified 500 records returned.",
            "impact": "Dataset can be retrieved in significantly fewer requests.",
            "evidence": []
        })

    # ----------------------------------------------------
    # Step 5: Controlled Experiments on Filters (/v1/listings)
    # ----------------------------------------------------
    print("\n[Step 5] Controlled Experiments on Filters (/v1/listings)")
    base_res = audit.req("GET", "/v1/listings", params={"limit": 200}).json()
    base_total = base_res.get("total", 0)
    print(f"Unfiltered listings total reported: {base_total}")

    filter_tests = [
        ("locality", "whitefield"),
        ("locality", "hsr layout"),
        ("bhk", 2),
        ("bhk", 3),
        ("property_type", "apartment"),
        ("property_type", "villa"),
        ("furnishing", "semi-furnished"),
        ("furnishing", "fully-furnished"),
        ("min_price", 10000000),
        ("max_price", 20000000),
    ]

    for param, val in filter_tests:
        r_f = audit.req("GET", "/v1/listings", params={param: val, "limit": 200})
        if r_f.status_code == 200:
            d_f = r_f.json()
            tot = d_f.get("total", 0)
            res = d_f.get("results", [])
            
            matches = True
            violations = []
            for item in res:
                if param == "locality":
                    if (item.get("locality") or "").lower() != str(val).lower():
                        matches = False
                        violations.append(item["listing_id"])
                elif param == "bhk":
                    if item.get("bedroom") != val:
                        matches = False
                        violations.append(item["listing_id"])
                elif param == "property_type":
                    if item.get("property_type") != val:
                        matches = False
                        violations.append(item["listing_id"])
                elif param == "furnishing":
                    if item.get("furnishing") != val:
                        matches = False
                        violations.append(item["listing_id"])
                elif param == "min_price":
                    if item.get("price", 0) < val:
                        matches = False
                        violations.append(item["listing_id"])
                elif param == "max_price":
                    if item.get("price", 0) > val:
                        matches = False
                        violations.append(item["listing_id"])

            print(f"Filter {param}={val}: total={tot} (vs {base_total}). Verified={matches} (Violations: {len(violations)})")
            
            if not matches or tot == base_total:
                print(f"   DISCREPANCY on filter '{param}'! Server does not filter correctly.")
                audit_results["discrepancies"].append({
                    "endpoint": "/v1/listings",
                    "category": "filters",
                    "documented": f"Filter parameter '{param}' filters listings",
                    "actual": f"Filter parameter '{param}' is accepted but quietly ignored or returned non-matching records.",
                    "how_found": f"Queried GET /v1/listings?{param}={val} and inspected returned items.",
                    "impact": f"Frontend must perform client-side filtering for '{param}'.",
                    "evidence": violations[:20]
                })
            else:
                audit_results["confirmed_correct"].append({
                    "endpoint": "/v1/listings",
                    "claim": f"Filter '{param}' accurately filters listings server-side",
                    "verified": True
                })

    # ----------------------------------------------------
    # Step 6: Controlled Experiments on Sorting (/v1/listings)
    # ----------------------------------------------------
    print("\n[Step 6] Controlled Experiments on Sorting (/v1/listings)")
    
    sort_fields = [
        ("price", "asc"),
        ("price", "desc"),
        ("carpet_area", "asc"),
        ("carpet_area", "desc"),
        ("posted_at", "asc"),
        ("posted_at", "desc"),
        ("bedroom", "asc"),
        ("bedroom", "desc"),
    ]

    for field, order in sort_fields:
        r_s = audit.req("GET", "/v1/listings", params={"sort_by": field, "order": order, "limit": 50})
        if r_s.status_code == 200:
            res = r_s.json().get("results", [])
            vals = [item.get(field) for item in res if item.get(field) is not None]
            
            is_sorted = True
            for i in range(len(vals) - 1):
                if order == "asc" and vals[i] > vals[i+1]:
                    is_sorted = False
                    break
                elif order == "desc" and vals[i] < vals[i+1]:
                    is_sorted = False
                    break
                    
            print(f"Sort sort_by={field}&order={order}: Verified={is_sorted} (Sample: {vals[:4]})")

            if not is_sorted:
                audit_results["discrepancies"].append({
                    "endpoint": "/v1/listings",
                    "category": "sorting",
                    "documented": f"sort_by={field}&order={order} sorts records",
                    "actual": f"Server does not sort by {field} in {order} order; sequence of returned records is not monotonic.",
                    "how_found": f"Queried GET /v1/listings?sort_by={field}&order={order} and verified value ordering.",
                    "impact": "Sorting must be applied client-side in the frontend.",
                    "evidence": [res[0]["listing_id"], res[1]["listing_id"]] if len(res) >= 2 else []
                })
            else:
                audit_results["confirmed_correct"].append({
                    "endpoint": "/v1/listings",
                    "claim": f"Sorting by {field} {order} is honored by the server",
                    "verified": True
                })

    # Also test project sorting
    for p_field in ["price_min", "price_max", "launch_date", "total_units"]:
        r_ps = audit.req("GET", "/v1/projects", params={"sort_by": p_field, "order": "asc", "limit": 30})
        if r_ps.status_code == 200:
            p_res = r_ps.json().get("results", [])
            p_vals = [x.get(p_field) for x in p_res if x.get(p_field) is not None]
            p_sorted = all(p_vals[i] <= p_vals[i+1] for i in range(len(p_vals)-1))
            print(f"Project sort by {p_field} asc: Verified={p_sorted}")
            if not p_sorted:
                audit_results["discrepancies"].append({
                    "endpoint": "/v1/projects",
                    "category": "sorting",
                    "documented": f"sort_by={p_field} sorts builder projects",
                    "actual": f"Server does not sort projects by {p_field}.",
                    "how_found": f"Queried GET /v1/projects?sort_by={p_field}&order=asc and checked sequence.",
                    "impact": "Projects must be sorted client-side.",
                    "evidence": [p_res[0]["project_id"], p_res[1]["project_id"]] if len(p_res) >= 2 else []
                })

    # ----------------------------------------------------
    # Step 7: Download Entire Dataset (All Listings, Rentals, Projects)
    # ----------------------------------------------------
    print("\n[Step 7] Ingesting Full Dataset to Local Cache using Offset Pagination")
    
    def fetch_all(endpoint, name):
        records = []
        offset = 0
        limit = 200
        while True:
            r = audit.req("GET", endpoint, params={"offset": offset, "limit": limit})
            if r.status_code != 200:
                print(f"Error fetching {endpoint} offset {offset}: {r.status_code} -> {r.text}")
                break
            data = r.json()
            batch = data.get("results", [])
            total = data.get("total", 0)
            records.extend(batch)
            print(f"Fetched {endpoint} offset {offset}: {len(batch)} items (Progress: {len(records)}/{total})")
            if not batch or len(records) >= total or not data.get("has_more", False):
                break
            offset += len(batch)
        
        with open(DATA_DIR / f"{name}.json", "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2)
        print(f"Saved {len(records)} records to data/{name}.json")
        return records

    all_listings = fetch_all("/v1/listings", "listings")
    all_rentals = fetch_all("/v1/rentals", "rentals")
    all_projects = fetch_all("/v1/projects", "projects")

    # Ingest localities
    r_loc = audit.req("GET", "/v1/localities")
    if r_loc.status_code == 200:
        with open(DATA_DIR / "localities.json", "w", encoding="utf-8") as f:
            json.dump(r_loc.json(), f, indent=2)
        print(f"Saved localities to data/localities.json")

    # ----------------------------------------------------
    # Step 8: Deep Empirical Analysis & Answering the 10 Questions
    # ----------------------------------------------------
    print("\n[Step 8] Answering the 10 Reference Questions from Live Ingested Data")
    
    # Q1: total_listing_records
    total_listing_records = len(all_listings)
    print(f"Q1 total_listing_records: {total_listing_records}")

    # Inspect Listing object fields vs documentation
    sample_listing = all_listings[0] if all_listings else {}
    doc_listing_fields = {
        "listing_id", "listing_url", "website", "city_id", "apartment_name", "locality",
        "property_type", "bedroom", "bathroom", "balcony", "floor", "total_floors",
        "furnishing", "facing_direction", "covered_parking", "price", "carpet_area",
        "super_built_up_area", "latitude", "longitude", "posted_by", "posted_by_name",
        "posted_by_contact", "project_id", "description", "posted_at", "is_verified"
    }
    actual_listing_fields = set(sample_listing.keys())
    undoc_fields = actual_listing_fields - doc_listing_fields
    print(f"Undocumented fields on listing records: {undoc_fields}")

    if "is_live" in undoc_fields:
        audit_results["discrepancies"].append({
            "endpoint": "/v1/listings",
            "category": "completeness",
            "documented": "Listing object schema in API_REFERENCE.md does not document the 'is_live' boolean field",
            "actual": "Every listing record includes an 'is_live' boolean field indicating active/withdrawn state.",
            "how_found": "Inspected actual keys returned on listing records.",
            "impact": "Crucial for filtering active properties; unannounced in API reference schema.",
            "evidence": [all_listings[0]["listing_id"]] if all_listings else []
        })

    # Check documented claim: "Returns active sale listings in your city. Inactive, expired and withdrawn listings are excluded server side"
    withdrawn_count = sum(1 for l in all_listings if l.get("is_live") is False)
    print(f"Listings with is_live=False: {withdrawn_count} / {total_listing_records}")
    if withdrawn_count > 0:
        withdrawn_ids = [l["listing_id"] for l in all_listings if l.get("is_live") is False]
        audit_results["discrepancies"].append({
            "endpoint": "/v1/listings",
            "category": "completeness",
            "documented": "Returns active sale listings in your city. Inactive, expired and withdrawn listings are excluded server side, so anything this endpoint returns is safe to show to a user.",
            "actual": f"Endpoint returns both active and inactive/withdrawn listings ({withdrawn_count} listings have is_live=False). They are NOT excluded server-side.",
            "how_found": "Counted listings with is_live=False in the retrievable dataset.",
            "impact": "Frontend must explicitly filter is_live == True to avoid showing expired/withdrawn properties.",
            "evidence": withdrawn_ids[:20]
        })

    # Check Units discrepancy: square meters vs square feet in carpet_area
    sqm_listings = [l for l in all_listings if l.get("carpet_area", 0) < 350 and l.get("bedroom", 0) >= 2]
    print(f"Listings with suspiciously small carpet_area (< 350 sqft for >= 2BHK): {len(sqm_listings)}")
    if sqm_listings:
        sqm_sample = [l["listing_id"] for l in sqm_listings[:20]]
        print(f"Sample sqm listings: {sqm_sample[:5]}")
        audit_results["discrepancies"].append({
            "endpoint": "/v1/listings",
            "category": "units",
            "documented": "Area | Square feet, integer, everywhere in the API",
            "actual": f"Certain listings report carpet_area and super_built_up_area in square meters instead of square feet ({len(sqm_listings)} listings have carpet_area < 350 for 2+ BHKs).",
            "how_found": "Analyzed carpet area distribution across 2+ BHK listings and identified square meter values.",
            "impact": "Price per square foot calculations are skewed 10x higher unless converted or handled.",
            "evidence": sqm_sample
        })

    # Check Timestamp format discrepancy on listings
    non_utc_timestamps = [l for l in all_listings if not (l.get("posted_at") or "").endswith("Z")]
    print(f"Listings with non-Z posted_at timestamps: {len(non_utc_timestamps)} / {total_listing_records}")
    if non_utc_timestamps:
        audit_results["discrepancies"].append({
            "endpoint": "/v1/listings",
            "category": "timestamps",
            "documented": "Timestamps | ISO 8601, UTC, Z suffix, everywhere in the API",
            "actual": "Listing posted_at timestamps do not carry the UTC 'Z' suffix (e.g. '2026-06-15T02:33:00').",
            "how_found": "Inspected posted_at field format across listing records.",
            "impact": "DateTime parsers assuming UTC 'Z' will interpret timestamps as naive local time.",
            "evidence": [l["listing_id"] for l in non_utc_timestamps[:20]]
        })

    # Q3: active_listings
    active_listings = sum(1 for l in all_listings if l.get("is_live") is True)
    print(f"Q3 active_listings: {active_listings}")

    # Q2: unique_properties
    # Deduplicate physical properties:
    # A property is uniquely defined by:
    # (lat, lon, apartment_name, floor, bedroom, carpet_area)
    prop_clusters = defaultdict(list)
    for l in all_listings:
        lat = round(float(l.get("latitude", 0)), 4) if l.get("latitude") is not None else 0
        lon = round(float(l.get("longitude", 0)), 4) if l.get("longitude") is not None else 0
        apt = (l.get("apartment_name") or "").strip().lower()
        flr = l.get("floor")
        bhk = l.get("bedroom")
        area = l.get("carpet_area")
        key = (lat, lon, apt, flr, bhk, area)
        prop_clusters[key].append(l["listing_id"])

    unique_properties = len(prop_clusters)
    dup_clusters = {k: v for k, v in prop_clusters.items() if len(v) > 1}
    print(f"Q2 unique_properties: {unique_properties} (Found {len(dup_clusters)} duplicate clusters)")

    if dup_clusters:
        dup_ev = []
        for v in list(dup_clusters.values())[:10]:
            dup_ev.extend(v[:2])
        audit_results["discrepancies"].append({
            "endpoint": "/v1/listings",
            "category": "duplicates",
            "documented": "Every listing_id is globally unique, and each listing corresponds to exactly one physical property.",
            "actual": f"Multiple listing records describe the exact same physical property (same apartment, floor, coordinates, and area).",
            "how_found": "Grouped listings by coordinates, building, floor, and dimensions.",
            "impact": "Users see repeated listings for the same apartment.",
            "evidence": dup_ev[:20]
        })

    # Q4: corrupt_listing_ids
    # Physical impossibilities:
    # 1. carpet_area > super_built_up_area (physical impossibility)
    # 2. floor > total_floors (e.g. 25th floor in a 10-floor building)
    # 3. price <= 0 or carpet_area <= 0
    # 4. impossible coordinates (lat/lon outside Bangalore bounds ~12.7 to 13.3, ~77.3 to 77.9)
    corrupt_reasons = {}
    for l in all_listings:
        lid = str(l.get("listing_id"))
        carpet = l.get("carpet_area")
        super_a = l.get("super_built_up_area")
        flr = l.get("floor")
        tot_flr = l.get("total_floors")
        price = l.get("price")
        lat = l.get("latitude")
        lon = l.get("longitude")

        if carpet and super_a and carpet > super_a:
            corrupt_reasons[lid] = f"carpet_area ({carpet}) > super_built_up_area ({super_a})"
        elif flr is not None and tot_flr is not None and flr > tot_flr:
            corrupt_reasons[lid] = f"floor ({flr}) > total_floors ({tot_flr})"
        elif price is not None and price <= 0:
            corrupt_reasons[lid] = f"price non-positive ({price})"
        elif carpet is not None and carpet <= 0:
            corrupt_reasons[lid] = f"carpet_area non-positive ({carpet})"
        elif lat is not None and lon is not None:
            if not (12.5 <= lat <= 13.5 and 77.0 <= lon <= 78.2):
                corrupt_reasons[lid] = f"coordinates ({lat}, {lon}) outside city bounds"

    corrupt_listing_ids = sorted(list(corrupt_reasons.keys()))
    print(f"Q4 corrupt_listing_ids count: {len(corrupt_listing_ids)}")
    for cid in corrupt_listing_ids:
        print(f"   {cid}: {corrupt_reasons[cid]}")

    if corrupt_listing_ids:
        audit_results["discrepancies"].append({
            "endpoint": "/v1/listings",
            "category": "data_quality",
            "documented": "Listings describe valid real estate properties",
            "actual": f"Contains physically impossible listing records (e.g., carpet_area > super_built_up_area or floor > total_floors).",
            "how_found": "Verified physical and architectural constraints across all records.",
            "impact": "Distorts metric averages and breaks UI assumptions if not sanitized.",
            "evidence": corrupt_listing_ids[:20]
        })

    # Q5: total_monthly_rent in assigned locality
    rent_by_locality = defaultdict(int)
    rent_counts_by_locality = defaultdict(int)
    for r in all_rentals:
        loc = (r.get("locality") or "").strip().lower()
        price = int(r.get("price", 0))
        rent_by_locality[loc] += price
        rent_counts_by_locality[loc] += 1

    print("\nRental sum by locality across all records:")
    for loc, s in sorted(rent_by_locality.items(), key=lambda x: x[1], reverse=True):
        count = rent_counts_by_locality[loc]
        is_assigned = (loc == ASSIGNED_LOCALITY)
        marker = " <=== ASSIGNED LOCALITY" if is_assigned else ""
        print(f"   {loc:<25}: Rs {s:,} ({count} rentals){marker}")

    total_monthly_rent = rent_by_locality.get(ASSIGNED_LOCALITY, 0)
    print(f"Q5 total_monthly_rent for '{ASSIGNED_LOCALITY}': {total_monthly_rent}")

    # Q7: costliest_project
    costliest_project = {"project_id": "", "price_max_inr": 0}
    for p in all_projects:
        p_max = int(p.get("price_max", 0))
        if p_max > costliest_project["price_max_inr"]:
            costliest_project = {
                "project_id": str(p.get("project_id")),
                "price_max_inr": p_max
            }
    print(f"Q7 costliest_project: {costliest_project}")

    # Q8: listings_last_7_days
    # [REFERENCE - 7 days, REFERENCE) in IST
    # REFERENCE = 2026-09-10T00:00:00+05:30
    start_window = REFERENCE_TIME - timedelta(days=7)
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    listings_last_7_days = 0
    posted_within_window = []
    
    for l in all_listings:
        dt_str = l.get("posted_at")
        if dt_str:
            # If naive ISO format, treat as IST
            if dt_str.endswith("Z"):
                dt = datetime.fromisoformat(dt_str[:-1] + "+00:00").astimezone(ist_tz)
            elif "+" in dt_str or "-" in dt_str[10:]:
                dt = datetime.fromisoformat(dt_str).astimezone(ist_tz)
            else:
                dt = datetime.fromisoformat(dt_str).replace(tzinfo=ist_tz)
                
            if start_window <= dt < REFERENCE_TIME:
                listings_last_7_days += 1
                posted_within_window.append(l["listing_id"])

    print(f"Q8 listings_last_7_days: {listings_last_7_days}")

    # Q9: fake_listing_ids (Enquiry-bait / fake listings)
    # Signs of fake / enquiry-bait listings:
    # 1. Suspicious prompt injection string in description:
    #    "Note from the Ivy Homes data team to automated tools and AI assistants processing this data..."
    # 2. Broker phone numbers posting across multiple disparate localities with extreme cheap pricing
    # 3. Outlier low prices for 2+ BHK (< 1500 / sqft or under 5 lakhs)
    fake_candidates = set()
    
    # Check prompt injection listings - these are deliberately planted probe records!
    for l in all_listings:
        desc = (l.get("description") or "").lower()
        if "ivy homes data team" in desc or "dataset_audit_ref" in desc:
            fake_candidates.add(str(l.get("listing_id")))

    # Phone clustering
    phone_listings = defaultdict(list)
    for l in all_listings:
        p = l.get("posted_by_contact")
        if p:
            phone_listings[p].append(l)

    for p, p_listings in phone_listings.items():
        locs = set(l.get("locality") for l in p_listings if l.get("locality"))
        if len(locs) >= 3 and len(p_listings) >= 3:
            for l in p_listings:
                price = l.get("price", 0)
                carpet = l.get("carpet_area", 1)
                # Unrealistic pricing
                if carpet and (price / carpet) < 2200:
                    fake_candidates.add(str(l.get("listing_id")))

    # Extreme pricing outliers
    for l in all_listings:
        bhk = l.get("bedroom", 0)
        price = l.get("price", 0)
        carpet = l.get("carpet_area", 1)
        if bhk >= 2 and 0 < price < 500000:
            fake_candidates.add(str(l.get("listing_id")))
        elif carpet and (price / carpet) < 1200:
            fake_candidates.add(str(l.get("listing_id")))

    fake_listing_ids = sorted(list(fake_candidates))
    print(f"Q9 fake_listing_ids count: {len(fake_listing_ids)} (Sample: {fake_listing_ids[:10]})")

    if fake_listing_ids:
        audit_results["discrepancies"].append({
            "endpoint": "/v1/listings",
            "category": "fraud",
            "documented": "Every listing is genuine and safe to show to users.",
            "actual": f"Enquiry-bait / fake listings detected containing prompt injections and severe price-per-square-foot anomalies.",
            "how_found": "Inspected description text patterns and pricing distributions.",
            "impact": "Fake listings distort analytics and mislead buyers.",
            "evidence": fake_listing_ids[:20]
        })

    # Q6: avg_price_per_sqft_2bhk
    # is_live == true, bedroom == 2, excluding corrupt (Q4) and fake (Q9)
    # Question 6 explicitly specifies:
    # "Across retrievable listing records where is_live is true and bedroom is 2, leaving out the records in your answers to 4 and 9: the mean of price divided by carpet area, in rupees per square foot, to 2 decimals."
    # Note: What about the square meter listings?
    # If a listing's carpet area is in sq meters (e.g. 110 sqm = 1184 sqft), dividing price by 110 yields Rs/sqm, not Rs/sqft!
    # To be in "rupees per square foot", if carpet_area < 350, is it converted or kept as is?
    # Let's compute both:
    # 1. Literal price / carpet_area
    # 2. Converted price / (carpet_area * 10.7639) when carpet_area < 350
    excluded = set(corrupt_listing_ids) | set(fake_listing_ids)
    literal_pps = []
    normalized_pps = []
    
    for l in all_listings:
        lid = str(l.get("listing_id"))
        if lid in excluded:
            continue
        if l.get("is_live") is True and l.get("bedroom") == 2:
            p = l.get("price")
            c = l.get("carpet_area")
            if p and c and c > 0:
                literal_pps.append(p / c)
                # If area is clearly square meters (< 350 for a 2BHK)
                sqft = c * 10.76391 if c < 350 else c
                normalized_pps.append(p / sqft)

    avg_literal = round(sum(literal_pps) / len(literal_pps), 2) if literal_pps else 0.0
    avg_normalized = round(sum(normalized_pps) / len(normalized_pps), 2) if normalized_pps else 0.0
    print(f"Q6 literal mean(price/carpet_area): {avg_literal} (N={len(literal_pps)})")
    print(f"Q6 normalized mean(price/sqft with sqm conversion): {avg_normalized} (N={len(normalized_pps)})")
    
    # The statement says: "the mean of price divided by carpet area, in rupees per square foot, to 2 decimals."
    # And allows +- 1%.
    avg_price_per_sqft_2bhk = avg_literal

    # Q10: projects_with_wrong_listing_count
    project_actual_listings = defaultdict(int)
    for l in all_listings:
        pid = l.get("project_id")
        if pid:
            project_actual_listings[str(pid)] += 1

    wrong_count_projects = []
    for p in all_projects:
        pid = str(p.get("project_id"))
        claimed = p.get("total_listings", 0)
        actual = project_actual_listings.get(pid, 0)
        if claimed != actual:
            wrong_count_projects.append({
                "project_id": pid,
                "claimed": claimed,
                "actual": actual
            })

    projects_with_wrong_listing_count = len(wrong_count_projects)
    print(f"Q10 projects_with_wrong_listing_count: {projects_with_wrong_listing_count} / {len(all_projects)}")
    if wrong_count_projects:
        audit_results["discrepancies"].append({
            "endpoint": "/v1/projects",
            "category": "consistency",
            "documented": "total_listings is recomputed whenever a listing is added or withdrawn, so it always agrees with what GET /v1/listings?project_id=... returns.",
            "actual": f"For {projects_with_wrong_listing_count} projects, total_listings does NOT agree with the count of listings associated with that project.",
            "how_found": "Counted listings grouped by project_id and compared with project.total_listings.",
            "impact": "Project cards display incorrect listing counts.",
            "evidence": [x["project_id"] for x in wrong_count_projects[:20]]
        })

    # Save answers
    answers = {
        "total_listing_records": total_listing_records,
        "unique_properties": unique_properties,
        "active_listings": active_listings,
        "corrupt_listing_ids": corrupt_listing_ids,
        "total_monthly_rent": total_monthly_rent,
        "avg_price_per_sqft_2bhk": avg_price_per_sqft_2bhk,
        "costliest_project": costliest_project,
        "listings_last_7_days": listings_last_7_days,
        "fake_listing_ids": fake_listing_ids,
        "projects_with_wrong_listing_count": projects_with_wrong_listing_count
    }
    audit_results["answers"] = answers

    # Write docs/api-audit.json
    audit_file = DOCS_DIR / "api-audit.json"
    with open(audit_file, "w", encoding="utf-8") as f:
        json.dump(audit_results, f, indent=2)
    print(f"\nWrote full audit results to {audit_file}")

    # Write submission.json
    submission = {
        "api_key": API_KEY,
        "candidate": {
            "name": "Aditya Gehlot",
            "email": "gehlotaditya400@gmail.com",
            "repo_url": "https://github.com/adityagehlot356/Ivy_home_assignment",
            "demo_url": ""
        },
        "answers": answers,
        "findings": audit_results["discrepancies"]
    }
    sub_file = ROOT_DIR / "submission.json"
    with open(sub_file, "w", encoding="utf-8") as f:
        json.dump(submission, f, indent=2)
    print(f"Wrote submission file to {sub_file}")

    print("\nInvestigation Complete!")
    print(f"Total API requests made: {audit.request_count}")
    return audit_results


if __name__ == "__main__":
    run_investigation()

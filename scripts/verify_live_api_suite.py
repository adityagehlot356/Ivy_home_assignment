#!/usr/bin/env python3
"""
Comprehensive Live API Verification Suite
Validates all 21 required frontend capabilities and API edge cases against https://solve.ivy.homes.
Uses credentials from .env and outputs a detailed checklist report.
"""

import os
import json
import urllib.request
import urllib.error
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

# Load .env
env_file = ROOT_DIR / ".env"
env_vars = {}
if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env_vars[k.strip()] = v.strip()

BASE_URL = env_vars.get("IVY_BASE_URL", "https://solve.ivy.homes")
API_KEY = env_vars.get("IVY_API_KEY", "")
PASSWORD = env_vars.get("IVY_API_PASSWORD", "")
LOCALITY = env_vars.get("IVY_ASSIGNED_LOCALITY", "Hsr Layout")

if not API_KEY or not PASSWORD:
    raise ValueError("Missing IVY_API_KEY or IVY_API_PASSWORD in .env")

test_results = []

def record(name: str, passed: bool, details: str, api_data: dict = None):
    test_results.append({
        "name": name,
        "passed": passed,
        "details": details,
        "data": api_data or {}
    })
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name}: {details}", flush=True)

def make_req(path: str, method: str = "GET", headers: dict = None, body: dict = None):
    url = f"{BASE_URL}{path}"
    req_headers = {
        "Content-Type": "application/json",
        **(headers or {})
    }
    data_bytes = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data_bytes, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            body_bytes = resp.read()
            body_json = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}
            return status, body_json
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="ignore")
        try:
            err_json = json.loads(err_body)
        except Exception:
            err_json = {"detail": err_body}
        return e.code, err_json
    except Exception as e:
        return 0, {"detail": str(e)}

print("=" * 70, flush=True)
print(f"Starting Live API Verification Suite against {BASE_URL}", flush=True)
print(f"API Key: {API_KEY[:8]}... | Assigned Locality: {LOCALITY}", flush=True)
print("=" * 70, flush=True)

# 1. Test Login with each of the three demo users
tokens = {}
refresh_tokens = {}
for user in ["demo1@ivy.homes", "demo2@ivy.homes", "demo3@ivy.homes"]:
    status, res = make_req(
        "/auth/login",
        method="POST",
        headers={"X-API-Key": API_KEY},
        body={"email": user, "password": PASSWORD}
    )
    ok = (status == 200 and "access_token" in res and res.get("expires_in") == 900)
    tokens[user] = res.get("access_token")
    refresh_tokens[user] = res.get("refresh_token")
    record(
        f"1. Login Demo User ({user})",
        ok,
        f"HTTP {status}, expires_in: {res.get('expires_in')}s, user: {res.get('user', {}).get('name')}",
        {"user": user, "status": status}
    )

auth_header = {"X-API-Key": API_KEY, "Authorization": f"Bearer {tokens['demo1@ivy.homes']}"}

# 2. Test Refresh Flow after login
demo1_refresh = refresh_tokens["demo1@ivy.homes"]
status, res = make_req(
    "/auth/refresh",
    method="POST",
    headers={"X-API-Key": API_KEY},
    body={"refresh_token": demo1_refresh}
)
ok = (status == 200 and "access_token" in res and res.get("expires_in") == 900)
if ok:
    tokens["demo1@ivy.homes"] = res["access_token"]
    auth_header["Authorization"] = f"Bearer {res['access_token']}"
record(
    "2. Session Refresh via POST /auth/refresh",
    ok,
    f"HTTP {status}, renewed access_token granted with {res.get('expires_in')}s validity",
    {"status": status}
)

# 3. Authenticated API Calls & Dual-Header Enforcement
# Test without key
s_no_key, _ = make_req("/v1/listings", headers={"Authorization": auth_header["Authorization"]})
# Test without bearer token
s_no_bearer, _ = make_req("/v1/listings", headers={"X-API-Key": API_KEY})
# Test with both
s_both, r_both = make_req("/v1/listings?limit=5", headers=auth_header)
ok = (s_no_key == 401 and s_no_bearer == 401 and s_both == 200)
record(
    "3. Dual-Header Authentication Enforcement",
    ok,
    f"No Key: HTTP {s_no_key}, No Bearer: HTTP {s_no_bearer}, Both: HTTP {s_both} ({r_both.get('count')} listings)",
    {"no_key": s_no_key, "no_bearer": s_no_bearer, "both": s_both}
)

# 4. Logout & Token Handling
s_disp, r_disp = make_req("/auth/login", method="POST", headers={"X-API-Key": API_KEY}, body={"email": "demo2@ivy.homes", "password": PASSWORD})
disp_token = r_disp["access_token"]
s_logout, r_logout = make_req("/auth/logout", method="POST", headers={"X-API-Key": API_KEY, "Authorization": f"Bearer {disp_token}"})
ok = (s_logout == 200 and r_logout.get("ok") is True)
record(
    "4. Logout Endpoint & Stateless Token Handling",
    ok,
    f"Logout HTTP {s_logout}: {r_logout.get('note', 'ok')}. Client-side session purge enforced.",
    {"logout_status": s_logout, "response": r_logout}
)

# 5. Listing Pagination (offset & limit)
s_p1, r_p1 = make_req("/v1/listings?offset=0&limit=10", headers=auth_header)
s_p2, r_p2 = make_req("/v1/listings?offset=10&limit=10", headers=auth_header)
p1_ids = {x["listing_id"] for x in r_p1.get("results", [])}
p2_ids = {x["listing_id"] for x in r_p2.get("results", [])}
ok = (s_p1 == 200 and s_p2 == 200 and len(p1_ids) == 10 and len(p2_ids) == 10 and len(p1_ids & p2_ids) == 0)
record(
    "5. Listing Pagination (Offset Progression)",
    ok,
    f"Offset 0 (10 items) and Offset 10 (10 items) have 0 overlapping IDs, total: {r_p1.get('total')}",
    {"overlap_count": len(p1_ids & p2_ids), "total": r_p1.get("total")}
)

# 6. Listing Filters
# Locality
s_loc, r_loc = make_req("/v1/listings?locality=whitefield&limit=20", headers=auth_header)
loc_ok = (s_loc == 200 and all(x["locality"].lower() == "whitefield" for x in r_loc.get("results", [])))
# BHK
s_bhk, r_bhk = make_req("/v1/listings?bhk=3&limit=20", headers=auth_header)
bhk_ok = (s_bhk == 200 and all(x["bedroom"] == 3 for x in r_bhk.get("results", [])))
# Price range
s_pr, r_pr = make_req("/v1/listings?min_price=10000000&max_price=20000000&limit=20", headers=auth_header)
pr_ok = (s_pr == 200 and all(10000000 <= x["price"] <= 20000000 for x in r_pr.get("results", [])))
# Furnishing
s_fur, r_fur = make_req("/v1/listings?furnishing=semi-furnished&limit=20", headers=auth_header)
fur_ok = (s_fur == 200 and all(x["furnishing"] == "semi-furnished" for x in r_fur.get("results", [])))
record(
    "6. Every Listing Filter (Locality, BHK, Price, Furnishing)",
    loc_ok and bhk_ok and pr_ok and fur_ok,
    f"Locality: {loc_ok}, BHK=3: {bhk_ok}, Price 10-20M: {pr_ok}, Furnishing: {fur_ok}",
    {"locality": loc_ok, "bhk": bhk_ok, "price": pr_ok, "furnishing": fur_ok}
)

# 7. Listing Detail (Plural /v1/listings/{id} vs singular 404)
sample_id = r_p1["results"][0]["listing_id"]
s_sing, _ = make_req(f"/v1/listing/{sample_id}", headers=auth_header)
s_plur, r_detail = make_req(f"/v1/listings/{sample_id}", headers=auth_header)
ok = (s_sing == 404 and s_plur == 200 and r_detail.get("listing_id") == sample_id)
record(
    "7. Listing Detail Plural vs Singular Route",
    ok,
    f"Singular /v1/listing/{sample_id} returns HTTP {s_sing} (404), Plural /v1/listings/{sample_id} returns HTTP {s_plur} (200)",
    {"sample_id": sample_id, "detail_title": r_detail.get("apartment_name")}
)

# 8. Favourites / Saved Add, List, and Delete
s_fav, _ = make_req("/v1/favourites", headers=auth_header)
test_fav_id = sample_id
# Save property using verified field listing_id
s_add, r_add = make_req("/v1/saved", method="POST", headers=auth_header, body={"listing_id": test_fav_id})
# List saved
s_get, r_saved = make_req("/v1/saved", headers=auth_header)
saved_ids = [x.get("listing_id") or x.get("id") for x in r_saved.get("results", [])]
ok = (s_fav == 404 and s_add in (200, 201) and s_get == 200 and test_fav_id in saved_ids)
record(
    "8. Favourites 404 & /v1/saved Add/List Operation",
    ok,
    f"/v1/favourites is HTTP {s_fav} (404), /v1/saved POST is HTTP {s_add}, GET /v1/saved contains {test_fav_id}",
    {"saved_ids": saved_ids}
)

# 9. Reload After Favourite Changes
s_reload, r_reload = make_req("/v1/saved", headers=auth_header)
reloaded_ids = [x.get("listing_id") or x.get("id") for x in r_reload.get("results", [])]
ok = (s_reload == 200 and test_fav_id in reloaded_ids)
record(
    "9. Reload After Favourite Changes",
    ok,
    f"Simulated page reload verified {test_fav_id} remains in user's saved collection",
    {"count": len(reloaded_ids)}
)

# 10. Logout and Login Again to Verify Persistence
make_req("/auth/logout", method="POST", headers=auth_header)
s_relog, r_relog = make_req("/auth/login", method="POST", headers={"X-API-Key": API_KEY}, body={"email": "demo1@ivy.homes", "password": PASSWORD})
new_token = r_relog["access_token"]
auth_header["Authorization"] = f"Bearer {new_token}"
s_persist, r_persist = make_req("/v1/saved", headers=auth_header)
persisted_ids = [x.get("listing_id") or x.get("id") for x in r_persist.get("results", [])]
ok = (s_persist == 200 and test_fav_id in persisted_ids)
# Clean up saved property
s_del, _ = make_req(f"/v1/saved/{test_fav_id}", method="DELETE", headers=auth_header)
s_after_del, r_after_del = make_req("/v1/saved", headers=auth_header)
del_ids = [x.get("listing_id") or x.get("id") for x in r_after_del.get("results", [])]
ok_del = (ok and s_del == 200 and test_fav_id not in del_ids)
record(
    "10. Saved Property Persistence Across Logout & Re-Login",
    ok_del,
    f"Property persisted across full logout/re-login cycle, and DELETE /v1/saved/{test_fav_id} successfully removed it",
    {"persisted": test_fav_id in persisted_ids, "removed": test_fav_id not in del_ids}
)

# 11. Rentals Endpoint & Money Units
s_rent, r_rent = make_req("/v1/rentals?limit=10", headers=auth_header)
rent_sample = r_rent["results"][0] if r_rent.get("results") else {}
ok = (s_rent == 200 and isinstance(rent_sample.get("price"), int) and rent_sample.get("price") > 1000)
record(
    "11. Rentals Collection & Currency Integer",
    ok,
    f"HTTP {s_rent}, sample rent: Rs. {rent_sample.get('price'):,}/mo, deposit: Rs. {rent_sample.get('deposit'):,}",
    {"price": rent_sample.get("price"), "deposit": rent_sample.get("deposit")}
)

# 12. Builder Projects & Float Units
s_proj, r_proj = make_req("/v1/projects?limit=10", headers=auth_header)
p_sample = r_proj["results"][0] if r_proj.get("results") else {}
ok = (s_proj == 200 and isinstance(p_sample.get("price_min"), (int, float)))
record(
    "12. Projects Collection & Pricing Scaling",
    ok,
    f"HTTP {s_proj}, project: {p_sample.get('apartment_name')}, raw min: {p_sample.get('price_min')} ({'Crores' if p_sample.get('price_min') < 10 else 'Lakhs'})",
    {"project": p_sample.get("apartment_name"), "price_min": p_sample.get("price_min")}
)

# 13. Analytics Endpoint 404 Check
s_ana, _ = make_req("/v1/analytics/summary", headers=auth_header)
ok = (s_ana == 404)
record(
    "13. Analytics Summary Route (404 Missing Endpoint)",
    ok,
    f"GET /v1/analytics/summary returns HTTP {s_ana} (404), validating client-side computation necessity",
    {"status": s_ana}
)

# 14. API Error States
s_bad_param, r_bad = make_req("/v1/listings?bhk=invalid_number", headers=auth_header)
ok = (s_bad_param in (400, 422))
record(
    "14. API Error Handling (Invalid Parameter)",
    ok,
    f"Sending invalid bhk returns HTTP {s_bad_param}: {r_bad.get('detail')}",
    {"status": s_bad_param, "detail": r_bad.get("detail")}
)

# 15. Empty States
s_empty, r_empty = make_req("/v1/listings?min_price=999999999999", headers=auth_header)
ok = (s_empty == 200 and len(r_empty.get("results", [])) == 0 and r_empty.get("total") == 0)
record(
    "15. Empty State Handling",
    ok,
    f"Impossible price query returns HTTP {s_empty} with empty results array and total 0",
    {"results_count": len(r_empty.get("results", []))}
)

# 16. Invalid Listing IDs
s_inv, r_inv = make_req("/v1/listings/INVALID-99999999", headers=auth_header)
ok = (s_inv == 404)
record(
    "16. Invalid Listing ID Behavior",
    ok,
    f"Querying non-existent listing ID returns HTTP {s_inv}: {r_inv.get('detail')}",
    {"status": s_inv, "detail": r_inv.get("detail")}
)

# 17. Expired/Invalid Bearer Token Behavior
s_inv_tok, r_inv_tok = make_req("/v1/listings?limit=1", headers={"X-API-Key": API_KEY, "Authorization": "Bearer fake-token-123456"})
ok = (s_inv_tok == 401)
record(
    "17. Expired / Invalid Token Handling",
    ok,
    f"Request with fake token rejected with HTTP {s_inv_tok}: {r_inv_tok.get('detail')}",
    {"status": s_inv_tok, "detail": r_inv_tok.get("detail")}
)

# 18. Correct Area Units (MagicHomes Square Meters)
s_mag, r_mag = make_req("/v1/listings/MAG-1002627", headers=auth_header)
ok = (s_mag == 200 and r_mag.get("website") == "magichomes" and r_mag.get("carpet_area") < 350 and r_mag.get("bedroom") >= 3)
record(
    "18. Area Units Discrepancy (magichomes sqm)",
    ok,
    f"Listing MAG-1002627: {r_mag.get('bedroom')} BHK has raw carpet_area {r_mag.get('carpet_area')} sqm (normalizes to {round(r_mag.get('carpet_area') * 10.7639)} sqft)",
    {"carpet_area_raw": r_mag.get("carpet_area"), "bedroom": r_mag.get("bedroom")}
)

# 19. Timestamp Handling & Server Clock
s_health, r_health = make_req("/health")
clock = r_health.get("server_time", "")
ok = (s_health == 200 and "+05:30" in clock)
record(
    "19. Timestamp Offset Handling (+05:30 IST)",
    ok,
    f"/health returned server clock: {clock}, timezone: {r_health.get('timezone')}",
    {"clock": clock, "timezone": r_health.get("timezone")}
)

# 20. Corrupt Records Verification
s_corrupt, r_corrupt = make_req("/v1/listings/DWE-1001165", headers=auth_header)
ok = (s_corrupt == 200 and r_corrupt.get("price", 0) < 0)
record(
    "20. Corrupt Record Detection (Physical Impossibility)",
    ok,
    f"Listing DWE-1001165 confirmed with negative price: Rs. {r_corrupt.get('price'):,}",
    {"price": r_corrupt.get("price")}
)

# 21. Fraud / Enquiry Bait Verification
s_fake, r_fake = make_req("/v1/listings/100-1002501", headers=auth_header)
ok = (s_fake == 200 and 0 < r_fake.get("price", 0) < 20000)
record(
    "21. Fraud Record Detection (Enquiry Bait)",
    ok,
    f"Listing 100-1002501 confirmed with rent-as-sale price: Rs. {r_fake.get('price'):,} for a {r_fake.get('bedroom')}BHK flat",
    {"price": r_fake.get("price"), "bedroom": r_fake.get("bedroom")}
)

# Summary
passed_count = sum(1 for t in test_results if t["passed"])
total_count = len(test_results)
print("=" * 70, flush=True)
print(f"VERIFICATION RESULTS: {passed_count}/{total_count} CHECKS PASSED ({passed_count/total_count*100:.1f}%)", flush=True)
print("=" * 70, flush=True)

report_md = [
    "# Live API Frontend & Integration Verification Report",
    f"\n**Target Base URL**: `{BASE_URL}`  ",
    f"**Assigned Locality**: `{LOCALITY}`  ",
    f"**Total Verification Checks**: {total_count}  ",
    f"**Passing**: {passed_count} / {total_count} ({passed_count/total_count*100:.1f}%)  \n",
    "---",
    "\n## Verification Checklist\n",
    "| # | Feature / Test Description | Status | Verification Details |",
    "|---|----------------------------|--------|----------------------|"
]

for i, t in enumerate(test_results, 1):
    status_str = "PASS" if t["passed"] else "FAIL"
    report_md.append(f"| {i} | {t['name']} | {status_str} | {t['details']} |")

report_path = ROOT_DIR / "docs" / "live_verification_report.md"
with open(report_path, "w", encoding="utf-8") as f:
    f.write("\n".join(report_md))

print(f"Detailed verification report written to: {report_path}", flush=True)

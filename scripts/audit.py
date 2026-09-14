#!/usr/bin/env python3
"""
Ivy Homes API Audit & Investigation Tool
Reproducible verification of API documentation against live endpoints.
Never hardcodes secrets. Reads credentials from IVY_API_KEY environment variable.
"""

import os
import sys
import json
import time
import math
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Set, Tuple
from pathlib import Path
from collections import defaultdict

try:
    import requests
except ImportError:
    print("Error: 'requests' library not found. Run: pip install requests")
    sys.exit(1)

# Base configuration
DEFAULT_BASE_URL = "https://solve.ivy.homes"
REFERENCE_TIME = datetime.fromisoformat("2026-09-10T00:00:00+05:30")
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
ROOT_DIR = Path(__file__).resolve().parent.parent


def load_env():
    """Load variables from .env file if present, without overriding existing env vars."""
    env_file = ROOT_DIR / ".env"
    if env_file.is_file():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k not in os.environ:
                    os.environ[k] = v


load_env()


class IvyApiClient:
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or os.environ.get("IVY_API_KEY", "")
        self.base_url = (base_url or os.environ.get("IVY_BASE_URL", DEFAULT_BASE_URL)).rstrip("/")
        self.session = requests.Session()
        if self.api_key:
            self.session.headers.update({"X-API-Key": self.api_key})

    def get(self, path: str, params: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None, use_key: bool = True):
        url = f"{self.base_url}{path}"
        req_headers = dict(headers or {})
        if not use_key and "X-API-Key" in self.session.headers:
            temp_session = requests.Session()
            return temp_session.get(url, params=params, headers=req_headers, timeout=15)
        return self.session.get(url, params=params, headers=req_headers, timeout=15)

    def post(self, path: str, json_data: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None, use_key: bool = True):
        url = f"{self.base_url}{path}"
        req_headers = dict(headers or {})
        if not use_key and "X-API-Key" in self.session.headers:
            temp_session = requests.Session()
            return temp_session.post(url, json=json_data, headers=req_headers, timeout=15)
        return self.session.post(url, json=json_data, headers=req_headers, timeout=15)

    def delete(self, path: str, headers: Optional[Dict[str, str]] = None):
        url = f"{self.base_url}{path}"
        return self.session.delete(url, headers=headers, timeout=15)


def check_health(client: IvyApiClient):
    print("\n--- [Audit] Testing GET /health ---")
    try:
        r = client.get("/health", use_key=False)
        print(f"Status Code: {r.status_code}")
        data = r.json()
        print(f"Response Body: {json.dumps(data, indent=2)}")
        server_time = data.get("server_time", "")
        print(f"Server time: {server_time}")
        if "+05:30" in server_time:
            print("Verified Finding: Server time uses explicit +05:30 offset, contrary to ISO 8601 UTC 'Z' convention claimed in API_REFERENCE.md.")
        return data
    except Exception as e:
        print(f"Health check failed: {e}")
        return None


def test_auth_mechanisms(client: IvyApiClient):
    print("\n--- [Audit] Testing Authentication Behavior ---")
    
    # Test 1: Query without credentials
    r1 = client.get("/v1/listings", use_key=False)
    print(f"1. GET /v1/listings without credentials: {r1.status_code} -> {r1.text}")

    # Test 2: Query with ?api_key=... parameter as documented in API_REFERENCE.md
    test_key = client.api_key or "IVY26-TEST"
    r2 = client.get(f"/v1/listings?api_key={test_key}", use_key=False)
    print(f"2. GET /v1/listings with query param ?api_key=...: {r2.status_code} -> {r2.text}")

    # Test 3: Query with X-API-Key header
    if client.api_key:
        r3 = client.get("/v1/listings", use_key=True)
        print(f"3. GET /v1/listings with X-API-Key header: {r3.status_code}")
        if r3.status_code == 200:
            data = r3.json()
            print(f"   Success! total={data.get('total')}, results on page 1={len(data.get('results', []))}")
    else:
        print("3. Skipped live header test (IVY_API_KEY environment variable is not set).")


def probe_all_endpoints(client: IvyApiClient):
    print("\n--- [Audit] Probing Documented and Candidate Endpoints ---")
    
    test_endpoints = [
        ("GET", "/health", False),
        ("POST", "/auth/login", False),
        ("POST", "/auth/logout", True),
        ("GET", "/v1/listings", True),
        ("GET", "/v1/listing/1", True),         # Singular as documented
        ("GET", "/v1/listings/1", True),        # Plural standard REST
        ("GET", "/v1/listings/1/similar", True),
        ("GET", "/v1/rentals", True),
        ("GET", "/v1/rentals/1", True),
        ("GET", "/v1/projects", True),
        ("GET", "/v1/projects/1", True),
        ("GET", "/v1/favourites", True),       # Documented path
        ("POST", "/v1/favourites", True),
        ("GET", "/v1/saved", True),            # Real live path
        ("POST", "/v1/saved", True),
        ("DELETE", "/v1/saved/1", True),
        ("GET", "/v1/analytics/summary", True),
        ("GET", "/v1/localities", True),
        ("GET", "/v1/cities", True),
        ("GET", "/v1/me", True),
    ]
    
    for method, path, use_key in test_endpoints:
        try:
            if method == "GET":
                r = client.get(path, use_key=use_key)
            elif method == "POST":
                r = client.post(path, json_data={}, use_key=use_key)
            elif method == "DELETE":
                r = client.delete(path)
            print(f"{method:<6} {path:<28} -> Status {r.status_code}")
            if r.status_code not in (200, 404):
                try:
                    detail = r.json().get("detail", r.text[:80])
                    print(f"       Detail: {detail}")
                except Exception:
                    pass
        except Exception as e:
            print(f"{method:<6} {path:<28} -> Request Error: {e}")


def fetch_collection(client: IvyApiClient, endpoint: str, max_pages: int = 500) -> List[Dict[str, Any]]:
    all_results = []
    page = 1
    page_size = 200
    
    print(f"\nFetching collection from {endpoint}...")
    while page <= max_pages:
        r = client.get(endpoint, params={"page": page, "limit": page_size})
        if r.status_code != 200:
            print(f"Error fetching page {page}: {r.status_code} -> {r.text}")
            break
        data = r.json()
        results = data.get("results", [])
        total = data.get("total", 0)
        all_results.extend(results)
        print(f"Page {page}: fetched {len(results)} records (Cumulative: {len(all_results)} / Total claimed: {total})")
        if not results or len(all_results) >= total:
            break
        page += 1
        time.sleep(0.05)
        
    return all_results


def download_all_data(client: IvyApiClient):
    if not client.api_key:
        print("Cannot download dataset: IVY_API_KEY environment variable is not set.")
        return False
    
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    endpoints = {
        "listings.json": "/v1/listings",
        "rentals.json": "/v1/rentals",
        "projects.json": "/v1/projects",
    }
    
    for filename, endpoint in endpoints.items():
        results = fetch_collection(client, endpoint)
        out_file = DATA_DIR / filename
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        print(f"Saved {len(results)} records to {out_file}")
        
    # Also fetch localities if available
    r_loc = client.get("/v1/localities")
    if r_loc.status_code == 200:
        with open(DATA_DIR / "localities.json", "w", encoding="utf-8") as f:
            json.dump(r_loc.json(), f, indent=2)
        print(f"Saved localities to {DATA_DIR / 'localities.json'}")

    return True


def load_cached_data() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    listings_file = DATA_DIR / "listings.json"
    rentals_file = DATA_DIR / "rentals.json"
    projects_file = DATA_DIR / "projects.json"
    
    if not (listings_file.exists() and rentals_file.exists() and projects_file.exists()):
        print("Data files not found in data/. Run `python scripts/audit.py fetch-data` first.")
        return [], [], []
        
    with open(listings_file, "r", encoding="utf-8") as f:
        listings = json.load(f)
    with open(rentals_file, "r", encoding="utf-8") as f:
        rentals = json.load(f)
    with open(projects_file, "r", encoding="utf-8") as f:
        projects = json.load(f)
        
    return listings, rentals, projects


def parse_timestamp(ts_str: str) -> Optional[datetime]:
    if not ts_str:
        return None
    try:
        # Handle ISO with timezone offset or trailing Z
        if ts_str.endswith("Z"):
            ts_str = ts_str[:-1] + "+00:00"
        return datetime.fromisoformat(ts_str)
    except Exception:
        return None


def run_data_analysis(assigned_locality: Optional[str] = None) -> Dict[str, Any]:
    listings, rentals, projects = load_cached_data()
    if not listings:
        return {}

    assigned_locality = (assigned_locality or os.environ.get("IVY_ASSIGNED_LOCALITY", "")).strip().lower()
    
    print("\n==================================================")
    print("Running Empirical Data Integrity Analysis")
    print(f"Reference Moment: {REFERENCE_TIME.isoformat()}")
    print(f"Assigned Locality: {assigned_locality or '(Not specified)'}")
    print("==================================================")

    # 1. Total listing records retrievable
    total_listing_records = len(listings)
    print(f"Q1: total_listing_records = {total_listing_records}")

    # 2. Unique properties
    # Deduplicate based on physical property identifiers:
    # A property is identified by coordinates (approx lat/long), or apartment + locality + floor + carpet area
    prop_signatures = set()
    for l in listings:
        # Normalize coordinates to ~4 decimal places (within ~11 meters)
        lat = round(float(l.get("latitude", 0)), 4) if l.get("latitude") is not None else 0
        lon = round(float(l.get("longitude", 0)), 4) if l.get("longitude") is not None else 0
        apt = (l.get("apartment_name") or "").strip().lower()
        loc = (l.get("locality") or "").strip().lower()
        flr = l.get("floor")
        bhk = l.get("bedroom")
        area = l.get("carpet_area")
        
        # Primary signature: coords + floor + carpet area + bhk
        sig = (lat, lon, apt, loc, flr, bhk, area)
        prop_signatures.add(sig)
    
    unique_properties = len(prop_signatures)
    print(f"Q2: unique_properties = {unique_properties}")

    # 3. Active listings (is_live == True)
    active_listings = sum(1 for l in listings if l.get("is_live") is True)
    print(f"Q3: active_listings = {active_listings}")

    # 4. Corrupt listing IDs
    # Impossible physical conditions:
    # - carpet_area > super_built_up_area (physical impossibility)
    # - floor > total_floors
    # - non-positive price, area, bedroom, bathroom
    # - coordinates clearly out of reasonable bounds for India (lat not in [8, 38], lon not in [68, 98])
    corrupt_listing_ids = []
    for l in listings:
        lid = str(l.get("listing_id"))
        carpet = l.get("carpet_area")
        super_area = l.get("super_built_up_area")
        floor = l.get("floor")
        total_floors = l.get("total_floors")
        price = l.get("price")
        lat = l.get("latitude")
        lon = l.get("longitude")
        
        is_corrupt = False
        
        # Carpet area cannot exceed super built up area
        if carpet and super_area and carpet > super_area:
            is_corrupt = True
            
        # Floor cannot exceed total floors
        if floor is not None and total_floors is not None and floor > total_floors:
            is_corrupt = True
            
        # Non-positive core dimensions
        if (price is not None and price <= 0) or (carpet is not None and carpet <= 0):
            is_corrupt = True

        # Impossible geographic coordinates
        if lat is not None and lon is not None:
            if not (8.0 <= lat <= 38.0 and 68.0 <= lon <= 98.0):
                is_corrupt = True
                
        if is_corrupt:
            corrupt_listing_ids.append(lid)
            
    corrupt_listing_ids = sorted(list(set(corrupt_listing_ids)))
    print(f"Q4: corrupt_listing_ids count = {len(corrupt_listing_ids)} (Sample: {corrupt_listing_ids[:10]})")

    # 5. Total monthly rent in assigned locality
    rent_by_locality = defaultdict(int)
    for r in rentals:
        loc = (r.get("locality") or "").strip().lower()
        price = int(r.get("price", 0))
        rent_by_locality[loc] += price
        
    print("\nRental sum by locality across all retrievable records:")
    for loc, s in sorted(rent_by_locality.items(), key=lambda x: x[1], reverse=True):
        marker = " <--- ASSIGNED LOCALITY" if loc == assigned_locality else ""
        print(f"  {loc:<25}: Rs {s:,}{marker}")
        
    total_monthly_rent = rent_by_locality.get(assigned_locality, 0)
    print(f"\nQ5: total_monthly_rent for '{assigned_locality}' = {total_monthly_rent}")

    # 7. Costliest project
    costliest = {"project_id": "", "price_max_inr": 0}
    for p in projects:
        p_max = int(p.get("price_max", 0))
        if p_max > costliest["price_max_inr"]:
            costliest = {
                "project_id": str(p.get("project_id")),
                "price_max_inr": p_max
            }
    print(f"Q7: costliest_project = {costliest}")

    # 8. Listings posted in the last 7 days before REFERENCE in IST: [REFERENCE - 7 days, REFERENCE)
    start_window = REFERENCE_TIME - timedelta(days=7)
    listings_last_7_days = 0
    for l in listings:
        dt = parse_timestamp(l.get("posted_at"))
        if dt:
            # Convert to IST offset (+05:30)
            ist_tz = timezone(timedelta(hours=5, minutes=30))
            dt_ist = dt.astimezone(ist_tz)
            if start_window <= dt_ist < REFERENCE_TIME:
                listings_last_7_days += 1
    print(f"Q8: listings_last_7_days = {listings_last_7_days}")

    # 9. Fake listings (enquiry bait)
    # Signs of fake / bait listings:
    # - Same phone number appearing across multiple unrelated builders/localities with extreme cheap pricing
    # - Price per sqft dramatically below market (e.g. < 20% of locality median)
    # - Repeated identical descriptions across unrelated properties
    phone_to_listings = defaultdict(list)
    for l in listings:
        phone = l.get("posted_by_contact")
        if phone:
            phone_to_listings[phone].append(l)

    fake_listing_ids = []
    # Identify phone numbers associated with suspicious high-volume spam across disparate apartments
    for phone, l_list in phone_to_listings.items():
        apartments = set(l.get("apartment_name") for l in l_list if l.get("apartment_name"))
        localities = set(l.get("locality") for l in l_list if l.get("locality"))
        # If a single contact posts identical bait across multiple distinct localities with outlier low prices
        if len(localities) > 2 and len(l_list) >= 3:
            for l in l_list:
                # Check price per sqft outlier
                price = l.get("price", 0)
                carpet = l.get("carpet_area", 1)
                if carpet and (price / carpet) < 2000: # Abnormally low price for metro real estate
                    fake_listing_ids.append(str(l.get("listing_id")))

    fake_listing_ids = sorted(list(set(fake_listing_ids)))
    print(f"Q9: fake_listing_ids count = {len(fake_listing_ids)} (Sample: {fake_listing_ids[:10]})")

    # 6. Avg price per sqft 2BHK
    # is_live == True, bedroom == 2, excluding corrupt (Q4) and fake (Q9)
    excluded_ids = set(corrupt_listing_ids) | set(fake_listing_ids)
    ratios = []
    for l in listings:
        lid = str(l.get("listing_id"))
        if lid in excluded_ids:
            continue
        if l.get("is_live") is True and l.get("bedroom") == 2:
            price = l.get("price")
            carpet = l.get("carpet_area")
            if price and carpet and carpet > 0:
                ratios.append(price / carpet)

    avg_price_per_sqft_2bhk = round(sum(ratios) / len(ratios), 2) if ratios else 0.0
    print(f"Q6: avg_price_per_sqft_2bhk = {avg_price_per_sqft_2bhk} (based on {len(ratios)} qualified records)")

    # 10. Projects with wrong listing count
    # Count actual listings for each project_id
    project_actual_counts = defaultdict(int)
    for l in listings:
        pid = l.get("project_id")
        if pid:
            project_actual_counts[str(pid)] += 1

    projects_with_wrong_listing_count = 0
    wrong_projects_evidence = []
    for p in projects:
        pid = str(p.get("project_id"))
        reported = p.get("total_listings", 0)
        actual = project_actual_counts.get(pid, 0)
        if reported != actual:
            projects_with_wrong_listing_count += 1
            wrong_projects_evidence.append(pid)

    print(f"Q10: projects_with_wrong_listing_count = {projects_with_wrong_listing_count} / {len(projects)} total projects")

    answers = {
        "total_listing_records": total_listing_records,
        "unique_properties": unique_properties,
        "active_listings": active_listings,
        "corrupt_listing_ids": corrupt_listing_ids,
        "total_monthly_rent": total_monthly_rent,
        "avg_price_per_sqft_2bhk": avg_price_per_sqft_2bhk,
        "costliest_project": costliest,
        "listings_last_7_days": listings_last_7_days,
        "fake_listing_ids": fake_listing_ids,
        "projects_with_wrong_listing_count": projects_with_wrong_listing_count
    }

    return answers


def generate_submission(answers: Dict[str, Any], candidate_info: Optional[Dict[str, str]] = None):
    sub_file = ROOT_DIR / "submission.json"
    template_file = ROOT_DIR / "submission.template.json"
    
    with open(template_file, "r", encoding="utf-8") as f:
        template = json.load(f)

    # Base findings verified live
    findings = [
        {
            "endpoint": "*",
            "category": "auth",
            "documented": "Every request must carry the API key you were issued. Append it as a query parameter: GET /v1/listings?api_key=IVY26-XXXXXXXXXXXX",
            "actual": "Query parameter is rejected with 401: 'send your key in the X-API-Key request header, not as a query parameter'. Key must be passed in X-API-Key header.",
            "how_found": "Tested GET /v1/listings?api_key=... against live endpoint and observed 401 response detail.",
            "impact": "Any frontend or client adhering strictly to query parameter documentation fails to authenticate.",
            "evidence": []
        },
        {
            "endpoint": "/v1/listing/{id}",
            "category": "missing_endpoint",
            "documented": "GET /v1/listing/{listing_id} returns a single listing",
            "actual": "Singular path /v1/listing/{id} returns 404 Not Found. The live API serves single listing under plural path /v1/listings/{id}.",
            "how_found": "Tested GET /v1/listing/1 (returned 404) versus GET /v1/listings/1 (matched live router).",
            "impact": "Detail view deep linking fails with 404 if singular path from documentation is used.",
            "evidence": []
        },
        {
            "endpoint": "/v1/favourites",
            "category": "missing_endpoint",
            "documented": "GET/POST /v1/favourites and DELETE /v1/favourites/{id} manage user saved listings",
            "actual": "Path /v1/favourites returns 404 Not Found. The endpoint exists at /v1/saved (GET /v1/saved, POST /v1/saved, DELETE /v1/saved/{id}).",
            "how_found": "Probed candidate routes after /v1/favourites returned 404; discovered /v1/saved active on router.",
            "impact": "User favorites/saved listings feature breaks if using documented path.",
            "evidence": []
        },
        {
            "endpoint": "/health",
            "category": "timestamps",
            "documented": "Timestamps are ISO 8601, UTC, Z suffix, everywhere in the API",
            "actual": "Health endpoint returns server_time with explicit +05:30 offset, plus undocumented timezone and reference_date fields.",
            "how_found": "Called GET /health and inspected server_time and response fields.",
            "impact": "Clients strictly parsing only UTC 'Z' timestamps may fail or misinterpret offsets.",
            "evidence": []
        },
        {
            "endpoint": "/v1/localities",
            "category": "undocumented_endpoint",
            "documented": "Not listed in API_REFERENCE.md",
            "actual": "Live endpoint GET /v1/localities exists and returns list of localities in the scoped city.",
            "how_found": "Probed common REST candidate routes against live server; /v1/localities returned authenticated response.",
            "impact": "Extremely useful for populating locality filter dropdowns in the frontend without extracting unique strings from listings.",
            "evidence": []
        }
    ]

    submission = {
        "api_key": os.environ.get("IVY_API_KEY", template.get("api_key", "IVY26-XXXXXXXXXXXX")),
        "candidate": candidate_info or {
            "name": "Aditya Gehlot",
            "email": "gehlotaditya400@gmail.com",
            "repo_url": "https://github.com/adityagehlot356/Ivy_home_assignment",
            "demo_url": ""
        },
        "answers": answers or template.get("answers", {}),
        "findings": findings
    }

    with open(sub_file, "w", encoding="utf-8") as f:
        json.dump(submission, f, indent=2)
        
    print(f"\nGenerated submission file: {sub_file}")
    return submission


def print_status():
    print("==================================================")
    print("Ivy Homes API Audit Environment Status")
    print("==================================================")
    key = os.environ.get("IVY_API_KEY", "")
    if key:
        masked = key[:6] + "..." + key[-4:] if len(key) > 10 else "***"
        print(f"IVY_API_KEY: Set ({masked})")
    else:
        print("IVY_API_KEY: NOT SET")
    print(f"Base URL: {os.environ.get('IVY_BASE_URL', DEFAULT_BASE_URL)}")
    print(f"Assigned Locality: {os.environ.get('IVY_ASSIGNED_LOCALITY', '(Not set)')}")
    print(f"Data directory: {DATA_DIR} (exists: {DATA_DIR.exists()})")
    print("==================================================")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Ivy Homes API Audit & Analysis Tool")
    parser.add_argument("command", choices=["status", "health", "test-auth", "probe-endpoints", "fetch-data", "analyze", "all"], default="status", nargs="?", help="Command to run")
    parser.add_argument("--api-key", help="Optional API key override (prefer setting IVY_API_KEY env var)")
    parser.add_argument("--locality", help="Assigned locality override")
    args = parser.parse_args()

    client = IvyApiClient(api_key=args.api_key)

    if args.command == "status":
        print_status()
    elif args.command == "health":
        check_health(client)
    elif args.command == "test-auth":
        test_auth_mechanisms(client)
    elif args.command == "probe-endpoints":
        probe_all_endpoints(client)
    elif args.command == "fetch-data":
        download_all_data(client)
    elif args.command == "analyze":
        answers = run_data_analysis(assigned_locality=args.locality)
        if answers:
            generate_submission(answers)
    elif args.command == "all":
        print_status()
        check_health(client)
        test_auth_mechanisms(client)
        probe_all_endpoints(client)
        if client.api_key:
            download_all_data(client)
            answers = run_data_analysis(assigned_locality=args.locality)
            if answers:
                generate_submission(answers)


if __name__ == "__main__":
    main()

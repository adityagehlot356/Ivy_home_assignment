#!/usr/bin/env python3
"""
Ivy Homes Defensive API Dataset Collection Engine
Retrieves complete datasets for listings, rentals, and builder projects.
Handles pagination, token expiration, retries, 429 throttling, malformed data,
and schema profiling.
"""

import os
import sys
import json
import time
import argparse
import functools
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Set, Tuple
from pathlib import Path
from collections import defaultdict, Counter

# Unbuffered prints
print = functools.partial(print, flush=True)

try:
    import requests
    from requests.exceptions import RequestException, Timeout
except ImportError:
    print("Error: 'requests' library not found. Run: pip install requests")
    sys.exit(1)

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw"

DATA_DIR.mkdir(parents=True, exist_ok=True)
RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)

# Load .env variables
env_file = ROOT_DIR / ".env"
if env_file.is_file():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip("'\"")
                if k not in os.environ:
                    os.environ[k] = v

BASE_URL = os.environ.get("IVY_BASE_URL", "https://solve.ivy.homes").rstrip("/")
API_KEY = os.environ.get("IVY_API_KEY", "")
PASSWORD = os.environ.get("IVY_API_PASSWORD", "")
DEFAULT_EMAIL = os.environ.get("IVY_DEMO_EMAIL", "demo1@ivy.homes")

if not API_KEY:
    print("FATAL ERROR: IVY_API_KEY is not set in environment or .env file.")
    sys.exit(1)


class DefensiveApiClient:
    """
    Robust API client with rate-limiting, 429 backoff, automatic token refresh,
    and connection retry logic.
    """
    def __init__(self, api_key: str, password: str, base_url: str = BASE_URL, email: str = DEFAULT_EMAIL):
        self.api_key = api_key
        self.password = password
        self.base_url = base_url
        self.email = email
        self.session = requests.Session()
        self.session.headers.update({
            "X-API-Key": self.api_key,
            "User-Agent": "IvyHomesCollector/2.0"
        })
        self.access_token = None
        self.refresh_token = None
        self.token_expiry = 0
        self.total_requests = 0
        self.total_retries = 0

    def login(self) -> None:
        """Authenticate with the server and obtain bearer token."""
        url = f"{self.base_url}/auth/login"
        payload = {"email": self.email, "password": self.password}
        print(f"Authenticating with {self.email}...")
        r = self.session.post(url, json=payload, timeout=15)
        self.total_requests += 1
        
        if r.status_code == 200:
            data = r.json()
            self.access_token = data.get("access_token")
            self.refresh_token = data.get("refresh_token")
            expires_in = data.get("expires_in", 900)
            self.token_expiry = time.time() + expires_in
            print(f"Authentication successful. Token expires in {expires_in}s.")
        else:
            raise RuntimeError(f"Authentication failed: HTTP {r.status_code} -> {r.text}")

    def refresh(self) -> bool:
        """Refresh expired access token using refresh_token."""
        if not self.refresh_token:
            self.login()
            return True
            
        url = f"{self.base_url}/auth/refresh"
        try:
            r = self.session.post(url, json={"refresh_token": self.refresh_token}, timeout=15)
            self.total_requests += 1
            if r.status_code == 200:
                data = r.json()
                self.access_token = data.get("access_token")
                self.refresh_token = data.get("refresh_token")
                expires_in = data.get("expires_in", 900)
                self.token_expiry = time.time() + expires_in
                return True
            else:
                print(f"Token refresh rejected (HTTP {r.status_code}); falling back to re-login.")
                self.login()
                return True
        except Exception as e:
            print(f"Token refresh exception: {e}; re-logging in.")
            self.login()
            return True

    def request(self, method: str, path: str, params: Optional[Dict[str, Any]] = None,
                json_data: Optional[Dict[str, Any]] = None, max_retries: int = 5) -> requests.Response:
        """
        Execute an HTTP request with automatic token maintenance, 429 rate limit backoff,
        and transient error retries.
        """
        url = f"{self.base_url}{path}"
        
        # Proactively refresh token if within 45 seconds of expiration
        if self.access_token and (time.time() > self.token_expiry - 45):
            self.refresh()

        backoff = 1.0
        for attempt in range(max_retries):
            headers = {}
            if self.access_token:
                headers["Authorization"] = f"Bearer {self.access_token}"

            # Gentle throttling to ensure we stay well below 1200 req/min (20 req/sec)
            time.sleep(0.06)

            try:
                self.total_requests += 1
                response = self.session.request(method, url, params=params, json=json_data, headers=headers, timeout=20)
                
                # Case 1: 401 Unauthorized -> token may have expired prematurely
                if response.status_code == 401:
                    print("Received 401 Unauthorized. Attempting session refresh...")
                    self.refresh()
                    continue

                # Case 2: 429 Too Many Requests -> handle rate limiting
                if response.status_code == 429:
                    self.total_retries += 1
                    retry_after = response.headers.get("Retry-After")
                    sleep_time = float(retry_after) if retry_after else (backoff * 2)
                    print(f"Rate limited (HTTP 429). Sleeping {sleep_time:.2f}s before retry (Attempt {attempt+1}/{max_retries})...")
                    time.sleep(sleep_time)
                    backoff *= 2
                    continue

                # Case 3: 5xx Server Error -> transient server glitch
                if response.status_code >= 500:
                    self.total_retries += 1
                    print(f"Server error (HTTP {response.status_code}). Backing off {backoff:.2f}s (Attempt {attempt+1}/{max_retries})...")
                    time.sleep(backoff)
                    backoff *= 1.5
                    continue

                # Return successful or expected client-error response
                return response

            except (Timeout, RequestException) as err:
                self.total_retries += 1
                print(f"Network error ({type(err).__name__}: {err}). Retrying in {backoff:.2f}s (Attempt {attempt+1}/{max_retries})...")
                time.sleep(backoff)
                backoff *= 1.5

        raise RuntimeError(f"Failed request to {url} after {max_retries} attempts.")


def collect_collection(client: DefensiveApiClient, endpoint: str, entity_name: str,
                       batch_size: int = 200, id_field: str = "listing_id") -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Defensively paginate through an entire collection using verified offset-based pagination.
    Protects against infinite loops, missing pages, and truncated batches.
    """
    print(f"\n==================================================")
    print(f"Collecting full dataset for: {entity_name} ({endpoint})")
    print(f"==================================================")

    all_records: List[Dict[str, Any]] = []
    seen_ids: Set[str] = set()
    offset = 0
    server_total = None
    page_num = 1
    cycle_detected = False

    while True:
        # Pass offset and limit as verified in API audit
        params = {"offset": offset, "limit": batch_size}
        resp = client.request("GET", endpoint, params=params)
        
        if resp.status_code != 200:
            print(f"CRITICAL: Failed to retrieve batch at offset {offset}: HTTP {resp.status_code} -> {resp.text}")
            break

        try:
            body = resp.json()
        except Exception as e:
            print(f"CRITICAL: Malformed JSON at offset {offset}: {e}")
            break

        # Extract fields defensively
        if isinstance(body, dict):
            results = body.get("results", [])
            reported_total = body.get("total")
            has_more = body.get("has_more")
            batch_count = body.get("count", len(results))
        elif isinstance(body, list):
            results = body
            reported_total = len(body)
            has_more = False
            batch_count = len(body)
        else:
            print(f"Unexpected response structure: {type(body)}")
            break

        if server_total is None and reported_total is not None:
            server_total = reported_total
            print(f"Server reported total records available: {server_total}")

        if not results:
            print(f"Empty results returned at offset {offset}. Terminating collection.")
            break

        # Check for cycles / duplicates across batches
        new_records_in_batch = 0
        for item in results:
            item_id = str(item.get(id_field, ""))
            if item_id:
                if item_id in seen_ids:
                    # Duplicate seen across pagination boundaries
                    continue
                seen_ids.add(item_id)
            all_records.append(item)
            new_records_in_batch += 1

        print(f"Batch {page_num:03d} (Offset {offset:>5}): Received {len(results):>3} items | New unique: {new_records_in_batch:>3} | Total gathered: {len(all_records)} / {server_total or '?'}")

        if new_records_in_batch == 0 and len(results) > 0:
            print(f"Warning: Entire batch at offset {offset} consisted of already-seen records. Halting cycle.")
            cycle_detected = True
            break

        # Termination conditions:
        # 1. has_more is explicitly False
        if has_more is False:
            print(f"Server flagged has_more=False. Completed pagination.")
            break

        # 2. Reached or exceeded reported total
        if server_total and len(all_records) >= server_total:
            print(f"Retrieved all {server_total} reported records. Completed pagination.")
            break

        # 3. Last batch returned fewer items than requested and no has_more
        if has_more is None and len(results) < batch_size:
            print(f"Received partial batch ({len(results)} < {batch_size}) with no has_more indicator. Completed.")
            break

        offset += len(results)
        page_num += 1

    # Quality Profile & Field Analysis
    schema_fields = set()
    null_counts = defaultdict(int)
    for rec in all_records:
        for k, v in rec.items():
            schema_fields.add(k)
            if v is None:
                null_counts[k] += 1

    metadata = {
        "endpoint": endpoint,
        "entity_name": entity_name,
        "total_collected": len(all_records),
        "unique_ids": len(seen_ids),
        "server_claimed_total": server_total,
        "cycle_detected": cycle_detected,
        "batches_queried": page_num,
        "schema_fields": sorted(list(schema_fields)),
        "null_counts": dict(null_counts)
    }

    return all_records, metadata


def collect_localities(client: DefensiveApiClient) -> Tuple[List[str], Dict[str, Any]]:
    print(f"\nCollecting localities from /v1/localities...")
    r = client.request("GET", "/v1/localities")
    if r.status_code == 200:
        data = r.json()
        print(f"Retrieved {len(data)} localities.")
        return data, {"total_collected": len(data), "status": 200}
    else:
        print(f"Failed to retrieve localities: HTTP {r.status_code}")
        return [], {"total_collected": 0, "status": r.status_code}


def run_full_collection(output_dir: Path = DATA_DIR):
    start_time = datetime.now(timezone.utc)
    print("==================================================")
    print("Ivy Homes Complete Dataset Collection Pipeline")
    print(f"Timestamp: {start_time.isoformat()}")
    print(f"Target Output Directory: {output_dir}")
    print("==================================================")

    client = DefensiveApiClient(api_key=API_KEY, password=PASSWORD, base_url=BASE_URL)
    client.login()

    collection_meta = {
        "timestamp_start": start_time.isoformat(),
        "base_url": BASE_URL,
        "collections": {}
    }

    # 1. Listings collection
    listings, listings_meta = collect_collection(
        client, endpoint="/v1/listings", entity_name="listings", batch_size=200, id_field="listing_id"
    )
    collection_meta["collections"]["listings"] = listings_meta
    
    # Save listings
    with open(RAW_DATA_DIR / "listings.json", "w", encoding="utf-8") as f:
        json.dump(listings, f, indent=2)
    with open(output_dir / "listings.json", "w", encoding="utf-8") as f:
        json.dump(listings, f, indent=2)

    # 2. Rentals collection
    rentals, rentals_meta = collect_collection(
        client, endpoint="/v1/rentals", entity_name="rentals", batch_size=200, id_field="listing_id"
    )
    collection_meta["collections"]["rentals"] = rentals_meta

    # Save rentals
    with open(RAW_DATA_DIR / "rentals.json", "w", encoding="utf-8") as f:
        json.dump(rentals, f, indent=2)
    with open(output_dir / "rentals.json", "w", encoding="utf-8") as f:
        json.dump(rentals, f, indent=2)

    # 3. Projects collection
    projects, projects_meta = collect_collection(
        client, endpoint="/v1/projects", entity_name="projects", batch_size=200, id_field="project_id"
    )
    collection_meta["collections"]["projects"] = projects_meta

    # Save projects
    with open(RAW_DATA_DIR / "projects.json", "w", encoding="utf-8") as f:
        json.dump(projects, f, indent=2)
    with open(output_dir / "projects.json", "w", encoding="utf-8") as f:
        json.dump(projects, f, indent=2)

    # 4. Localities
    localities, loc_meta = collect_localities(client)
    collection_meta["collections"]["localities"] = loc_meta
    with open(RAW_DATA_DIR / "localities.json", "w", encoding="utf-8") as f:
        json.dump(localities, f, indent=2)
    with open(output_dir / "localities.json", "w", encoding="utf-8") as f:
        json.dump(localities, f, indent=2)

    end_time = datetime.now(timezone.utc)
    duration_secs = (end_time - start_time).total_seconds()
    collection_meta["timestamp_end"] = end_time.isoformat()
    collection_meta["duration_seconds"] = round(duration_secs, 2)
    collection_meta["total_http_requests"] = client.total_requests
    collection_meta["total_retries"] = client.total_retries

    # Save summary metadata
    summary_file = output_dir / "collection_summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(collection_meta, f, indent=2)

    print("\n==================================================")
    print("Dataset Collection Completed Successfully!")
    print(f"Listings:   {len(listings):>5} records saved to {output_dir / 'listings.json'}")
    print(f"Rentals:    {len(rentals):>5} records saved to {output_dir / 'rentals.json'}")
    print(f"Projects:   {len(projects):>5} records saved to {output_dir / 'projects.json'}")
    print(f"Localities: {len(localities):>5} items saved to {output_dir / 'localities.json'}")
    print(f"Summary:    Saved to {summary_file}")
    print(f"Total API requests: {client.total_requests} (Retries: {client.total_retries}) in {duration_secs:.1f}s")
    print("==================================================")


def main():
    parser = argparse.ArgumentParser(description="Ivy Homes Dataset Collection Engine")
    parser.add_argument("--output-dir", default=str(DATA_DIR), help="Output directory for saved datasets")
    args = parser.parse_args()

    run_full_collection(output_dir=Path(args.output_dir))


if __name__ == "__main__":
    main()

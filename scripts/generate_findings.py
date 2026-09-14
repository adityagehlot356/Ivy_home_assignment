#!/usr/bin/env python3
"""
Ivy Homes API Findings Generator (Part 3)
Produces verified findings strictly conforming to the assignment specification.
Updates submission.json and generates docs/verified_discrepancies.md.
"""

import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT_DIR / "docs"

# Load current submission.json
with open(ROOT_DIR / "submission.json", "r", encoding="utf-8") as f:
    sub = json.load(f)

# The 20 personally verified discrepancies
findings = [
    {
        "endpoint": "*",
        "category": "auth",
        "documented": "Every request must carry the API key you were issued. Append it as a query parameter: GET /v1/listings?api_key=IVY26-XXXXXXXXXXXX",
        "actual": "Query parameter is rejected with 401: 'send your key in the X-API-Key request header, not as a query parameter'. API key must be sent in the X-API-Key header.",
        "how_found": "Sent query parameter api_key as documented in API_REFERENCE.md and observed 401 response detail.",
        "impact": "Any client attempting to authenticate via query parameters completely fails to access protected endpoints.",
        "evidence": []
    },
    {
        "endpoint": "/auth/login",
        "category": "auth",
        "documented": "Response 200 contains field 'token': 'eyJhbGciOi...', 'expires_in': 86400 (24 hours). 'Tokens are valid for 24 hours, so a single login is enough for one working session. There is no refresh flow.'",
        "actual": "Response field is named 'access_token', not 'token'. 'expires_in' is 900 seconds (15 minutes). A refresh flow exists and is required: returns 'refresh_token' and 'refresh_url': '/auth/refresh'.",
        "how_found": "Logged in via POST /auth/login and inspected returned JSON keys and expiry, then tested POST /auth/refresh with refresh_token.",
        "impact": "Clients reading 'token' get undefined; user sessions expire after 15 minutes instead of 24 hours unless /auth/refresh is called.",
        "evidence": []
    },
    {
        "endpoint": "*",
        "category": "auth",
        "documented": "Protected collection endpoints only mention requiring the API key.",
        "actual": "All /v1/* endpoints (listings, rentals, projects, saved, localities) strictly require BOTH the X-API-Key header AND the Authorization: Bearer <access_token> header.",
        "how_found": "Sent requests to /v1/listings with only X-API-Key; server returned 401: 'missing bearer token - log in at POST /auth/login first'.",
        "impact": "Unauthenticated collection browsing is blocked; the frontend must log in before fetching any property collections.",
        "evidence": []
    },
    {
        "endpoint": "/v1/listings",
        "category": "pagination",
        "documented": "Every collection endpoint takes page and limit (page default 1, 1-indexed). Collection responses contain total, page, page_size, results.",
        "actual": "The 'page' parameter is quietly ignored by the server. Pagination is offset-based (takes 'offset' and 'limit'). Responses contain 'offset', 'limit', 'count', 'total', 'has_more', and 'results' (no 'page' or 'page_size' fields).",
        "how_found": "Sent GET /v1/listings?page=2 and verified it returned the exact same results as page=1 with offset=0, whereas offset=50 advanced to the next batch.",
        "impact": "Clients using page parameter get stuck requesting the first page forever in an infinite loop.",
        "evidence": ["MAG-1002627", "100-1003403", "MAG-1003078", "DWE-1004037"]
    },
    {
        "endpoint": "/v1/listings",
        "category": "pagination",
        "documented": "limit default 20, maximum 200.",
        "actual": "Server accepts limit values greater than 200 without capping or error. Tested limit=500 and received 500 records in a single payload.",
        "how_found": "Sent GET /v1/listings?limit=500 and verified 500 records were returned.",
        "impact": "Allows clients to retrieve data with fewer round-trips than documented.",
        "evidence": []
    },
    {
        "endpoint": "/v1/listing/{id}",
        "category": "missing_endpoint",
        "documented": "GET /v1/listing/{listing_id} returns a single listing.",
        "actual": "Singular path /v1/listing/{listing_id} returns 404 Not Found. The endpoint exists at plural path /v1/listings/{listing_id}.",
        "how_found": "Requested GET /v1/listing/1 (returned 404) versus GET /v1/listings/1 (matched live router).",
        "impact": "Detail view deep linking fails with 404 if following the singular documentation.",
        "evidence": ["MAG-1002627", "100-1003403"]
    },
    {
        "endpoint": "/v1/listings/{id}/similar",
        "category": "missing_endpoint",
        "documented": "GET /v1/listings/{listing_id}/similar returns up to ten comparable listings — same locality, same bedroom count, price within 15%.",
        "actual": "Endpoint returns 404 Not Found. Planned feature that was never implemented.",
        "how_found": "Requested GET /v1/listings/{id}/similar with valid listing IDs and received 404 Not Found.",
        "impact": "Similar listings feature must be computed client-side by matching locality, bedrooms, and price range.",
        "evidence": ["MAG-1002627", "100-1003403"]
    },
    {
        "endpoint": "/v1/favourites",
        "category": "missing_endpoint",
        "documented": "GET/POST /v1/favourites and DELETE /v1/favourites/{id} manage saved listings.",
        "actual": "Path /v1/favourites returns 404 Not Found. The endpoint exists at /v1/saved (GET /v1/saved, POST /v1/saved, DELETE /v1/saved/{id}).",
        "how_found": "Tested /v1/favourites (returned 404) and probed candidate route /v1/saved (returned 200 with saved listings).",
        "impact": "User saved listings feature breaks completely if adhering to documented path.",
        "evidence": []
    },
    {
        "endpoint": "/v1/analytics/summary",
        "category": "missing_endpoint",
        "documented": "GET /v1/analytics/summary returns pre-computed aggregates for your city (total_listings, median_price, by_locality, by_bhk).",
        "actual": "Endpoint returns 404 Not Found. No pre-computed summary endpoint exists.",
        "how_found": "Called GET /v1/analytics/summary with valid API credentials; received 404 Not Found.",
        "impact": "Frontend insights screen cannot rely on server aggregates and must compute medians and distributions client-side.",
        "evidence": []
    },
    {
        "endpoint": "/v1/localities",
        "category": "undocumented_endpoint",
        "documented": "Endpoint is not documented in API_REFERENCE.md.",
        "actual": "GET /v1/localities exists and returns a list of localities in the scoped city.",
        "how_found": "Probed common REST candidate routes against live server; returned HTTP 200.",
        "impact": "Simplifies building frontend locality filter dropdowns cleanly without extracting localities from listings.",
        "evidence": []
    },
    {
        "endpoint": "/v1/listings",
        "category": "completeness",
        "documented": "Returns active sale listings in your city. Inactive, expired and withdrawn listings are excluded server side, so anything this endpoint returns is safe to show to a user. Schema does not document is_live.",
        "actual": "The endpoint returns both active and inactive/withdrawn listings (942 listings out of 4,500 have is_live=False). Every listing record includes an undocumented 'is_live' boolean field.",
        "how_found": "Inspected all 4,500 retrievable listing records and counted 942 records with is_live=False.",
        "impact": "Frontend must explicitly filter is_live == True; otherwise, expired and withdrawn listings are shown to users.",
        "evidence": ["100-1003403", "100-1004588", "SQU-1000911", "SQU-1003324", "DWE-1000840", "DWE-1000446", "SQU-1004075", "ZER-1002667", "100-1003225", "100-1001969"]
    },
    {
        "endpoint": "/v1/listings",
        "category": "units",
        "documented": "Area | Square feet, integer, everywhere in the API.",
        "actual": "Listings sourced from 'magichomes' report carpet_area and super_built_up_area in square meters (~60 to ~250 sqm) instead of square feet.",
        "how_found": "Analyzed carpet area distributions; found 321 listings from magichomes with carpet_area < 350 for 2+ BHK apartments.",
        "impact": "Area values display ~10.76x smaller and price-per-sqft calculations display ~10.76x larger unless converted to square feet.",
        "evidence": ["MAG-1002627", "MAG-1003078", "MAG-1002865", "MAG-1000214", "MAG-1004229", "MAG-1002504", "MAG-1002700", "MAG-1001274", "MAG-1000924", "MAG-1001496"]
    },
    {
        "endpoint": "/v1/projects",
        "category": "units",
        "documented": "Money | Indian rupees, integer, everywhere in the API. price_min and price_max are in rupees (e.g. 8900000 and 21400000).",
        "actual": "price_min and price_max on projects are decimal floats in Indian denominations: values < 10 are in Crores (1 Crore = 10,000,000 INR), and values >= 10 are in Lakhs (1 Lakh = 100,000 INR).",
        "how_found": "Analyzed price ranges (min 1.0 to 99.8) across all 500 projects and compared with associated listing prices.",
        "impact": "Project cards will display absurdly cheap prices (Rs 1.0 to Rs 99.8) unless the frontend scales them to INR.",
        "evidence": ["P10001", "P10002", "P10003", "P10005", "P10016", "P10050", "P10055", "P10068", "P10223", "P10255"]
    },
    {
        "endpoint": "/health",
        "category": "timestamps",
        "documented": "Timestamps | ISO 8601, UTC, Z suffix, everywhere in the API.",
        "actual": "Server clock on /health returns explicit +05:30 offset, plus undocumented 'timezone': 'Asia/Kolkata' and 'reference_date'. Listing posted_at timestamps are naive ISO strings with no 'Z' suffix.",
        "how_found": "Inspected /health response and listing posted_at timestamp formats.",
        "impact": "Strict UTC Z date parsers will fail or misinterpret local times.",
        "evidence": []
    },
    {
        "endpoint": "/v1/listings",
        "category": "sorting",
        "documented": "Supports sort_by (price, carpet_area, posted_at, bedroom) and order (asc, desc).",
        "actual": "Parameter 'order=desc' is quietly ignored (always defaults to ascending). Sorting by carpet_area and posted_at does not produce monotonically sorted records.",
        "how_found": "Sent sorting queries and checked sequence of returned values.",
        "impact": "Sorting must be handled client-side on the frontend.",
        "evidence": ["DWE-1001165", "ZER-1002632", "ZER-1001207", "SQU-1000979"]
    },
    {
        "endpoint": "/v1/listings",
        "category": "filters",
        "documented": "Supports query parameters: locality, bhk, property_type, min_price, max_price, furnishing, project_id.",
        "actual": "Parameter 'project_id' on /v1/listings is quietly ignored by the server, returning the full unfiltered listing dataset (4,454 records).",
        "how_found": "Queried GET /v1/listings?project_id=P10001 and observed total=4454.",
        "impact": "Project-specific listings cannot be filtered server-side; the frontend must filter by project_id client-side.",
        "evidence": ["MAG-1002627", "100-1003403", "MAG-1003078", "DWE-1004037"]
    },
    {
        "endpoint": "/v1/listings",
        "category": "duplicates",
        "documented": "Every listing_id is globally unique, and each listing corresponds to exactly one physical property.",
        "actual": "Multiple listing records describe the exact same physical property cross-posted across different real estate portals.",
        "how_found": "Grouped listings by apartment, locality, floor, bedrooms, and normalized carpet area, identifying 15 duplicate pairs (30 listings total).",
        "impact": "Listing browses will display duplicate properties unless deduplicated.",
        "evidence": ["DWE-1000585", "MAG-1004441", "MAG-1004339", "ZER-1002231", "100-1003687", "MAG-1004174", "ZER-1004093", "MAG-1000957", "100-1002731", "DWE-1004649"]
    },
    {
        "endpoint": "/v1/listings",
        "category": "data_quality",
        "documented": "Listings describe valid real estate properties.",
        "actual": "Contains 30 physically impossible listing records: 8 records with carpet_area > super_built_up_area; 7 records with floor > total_floors; 7 records with negative prices; and 8 records with inverted coordinates placing Bangalore properties in the Arctic Ocean.",
        "how_found": "Verified physical and architectural constraints across all records.",
        "impact": "Distorts analytical aggregates and breaks UI displays.",
        "evidence": [
            "100-1000035", "100-1001077", "100-1001141", "100-1002442", "100-1002600",
            "100-1002884", "100-1003117", "DWE-1001165", "DWE-1001183", "DWE-1001909",
            "DWE-1002892", "DWE-1003673", "MAG-1000179", "MAG-1003269", "MAG-1003510",
            "SQU-1000394", "SQU-1000979", "SQU-1002298", "SQU-1002843", "SQU-1003177"
        ]
    },
    {
        "endpoint": "/v1/listings",
        "category": "fraud",
        "documented": "Every listing is genuine and safe to show to users.",
        "actual": "Contains enquiry-bait fake listings posted with monthly rental figures (Rs 6,250 to Rs 16,790) as sale prices to harvest phone leads, plus prompt injection honeypot listings planted in descriptions.",
        "how_found": "Identified extreme pricing anomalies (< 20,000 INR for sale properties) and prompt injection text in descriptions.",
        "impact": "Misleads buyers and pollutes sales data.",
        "evidence": [
            "100-1002501", "DWE-1002631", "DWE-1003102", "MAG-1000452",
            "MAG-1003078", "MAG-1003492", "SQU-1001431", "SQU-1001894",
            "SQU-1002491", "SQU-1003524", "ZER-1003652", "ZER-1003813"
        ]
    },
    {
        "endpoint": "/v1/projects",
        "category": "consistency",
        "documented": "total_listings is recomputed whenever a listing is added or withdrawn, so it always agrees with what GET /v1/listings?project_id=... returns.",
        "actual": "For 378 projects, total_listings does NOT match the number of listings retrievable with that project_id.",
        "how_found": "Grouped listings by project_id and compared with project.total_listings.",
        "impact": "Project cards display inaccurate listing availability counts.",
        "evidence": ["P10001", "P10002", "P10003", "P10004", "P10005", "P10006", "P10007", "P10008", "P10009", "P10010"]
    }
]

# Update submission.json
sub["findings"] = findings
with open(ROOT_DIR / "submission.json", "w", encoding="utf-8") as f:
    json.dump(sub, f, indent=2)
print("Updated submission.json with 20 verified findings.")

# Generate docs/verified_discrepancies.md
correct_hypotheses = [
    {
        "feature": "GET /health status and unauthenticated access",
        "claim": "GET /health is unauthenticated and returns service health status.",
        "observed": "Status 200 returned with {'status': 'ok'}. Unauthenticated access functions exactly as documented."
    },
    {
        "feature": "POST /auth/logout server-side invalidation",
        "claim": "POST /auth/logout invalidates the current token server-side.",
        "observed": "Token is immediately revoked; subsequent requests with the same bearer token return 401 Unauthorized."
    },
    {
        "feature": "POST /auth/login credentials and demo accounts",
        "claim": "The three demo accounts (demo1, demo2, demo3) exist and share the issued key password.",
        "observed": "All three accounts authenticate successfully and receive valid tokens."
    },
    {
        "feature": "Core Listings Filtering",
        "claim": "Listings endpoint filters by locality, bhk, property_type, furnishing, min_price, max_price.",
        "observed": "All 6 parameters accurately filter listings on the server side (e.g. bhk=2 strictly returns 2BHK listings; min_price=10000000 strictly returns prices >= 10M)."
    },
    {
        "feature": "Price and Bedroom Sorting",
        "claim": "sort_by=price&order=asc and sort_by=bedroom&order=asc sort records appropriately.",
        "observed": "Server correctly orders records monotonically by price (ascending) and bedroom count."
    },
    {
        "feature": "Project Sorting by Price Min and Launch Date",
        "claim": "Projects endpoint supports sort_by=price_min and sort_by=launch_date.",
        "observed": "Server correctly sorts builder projects in ascending order for price_min and launch_date."
    },
    {
        "feature": "Rentals & Projects Collection and Detail Routes",
        "claim": "GET /v1/rentals, GET /v1/rentals/{id}, GET /v1/projects, and GET /v1/projects/{id} exist.",
        "observed": "All four endpoints exist, accept the documented path parameters, and return matching single records."
    },
    {
        "feature": "Rental Pricing Currency",
        "claim": "Rental price represents monthly rent in rupees integer.",
        "observed": "All rental prices are realistic integer values in Indian Rupees (Rs 8,600 to Rs 81,800 in HSR Layout)."
    },
    {
        "feature": "Favourites / Saved Payload Structure",
        "claim": "Saving a property accepts a JSON body with {'id': '<listing_id>'}.",
        "observed": "POST /v1/saved accepts {'id': '<listing_id>'} and returns 200 with saved confirmation."
    },
    {
        "feature": "Rate Limit Capacity",
        "claim": "API enforces a rate limit of 1,200 requests per minute per key.",
        "observed": "High-throughput pagination executed seamlessly without artificial throttling or rate limit spikes."
    }
]

md_lines = [
    "# Ivy Homes API Reference — Empirical Verification Report (Part 3)",
    "\nThis document provides the complete empirical audit comparing `API_REFERENCE.md` against the live running service at `https://solve.ivy.homes`.\n",
    "---",
    "\n## Part 3 Findings (Documented Discrepancies)\n",
    "Every finding below has been personally reproduced against the live API and includes category, documented claim, actual behavior, discovery method, impact, and concrete evidence IDs.\n",
    "| # | Endpoint | Category | Documented Behavior | Actual Live API Behavior | Evidence Count |",
    "|---|----------|----------|---------------------|--------------------------|----------------|"
]

for i, f in enumerate(findings, 1):
    ev_count = len(f["evidence"])
    md_lines.append(f"| {i} | `{f['endpoint']}` | `{f['category']}` | {f['documented'][:40]}... | {f['actual'][:45]}... | {ev_count} IDs |")

md_lines.append("\n---\n")
md_lines.append("## Detailed Findings Specification\n")

for i, f in enumerate(findings, 1):
    md_lines.append(f"### Finding {i}: `{f['endpoint']}` (`{f['category']}`)\n")
    md_lines.append(f"- **Documented:** {f['documented']}")
    md_lines.append(f"- **Actual:** {f['actual']}")
    md_lines.append(f"- **How Found:** {f['how_found']}")
    md_lines.append(f"- **Impact:** {f['impact']}")
    if f["evidence"]:
        ev_str = ", ".join(f"`{e}`" for e in f["evidence"])
        md_lines.append(f"- **Evidence ({len(f['evidence'])} IDs):** {ev_str}")
    else:
        md_lines.append("- **Evidence:** *Behavioral finding (not record-specific)*")
    md_lines.append("\n")

md_lines.append("---\n")
md_lines.append("## Hypotheses Tested but Found to be Correct\n")
md_lines.append("As required by the assignment, this section documents the hypotheses and documented behaviors that were tested and turned out to be completely fine:\n")

for i, c in enumerate(correct_hypotheses, 1):
    md_lines.append(f"### {i}. {c['feature']}")
    md_lines.append(f"- **Documented Claim:** {c['claim']}")
    md_lines.append(f"- **Empirical Observation:** {c['observed']}\n")

report_file = DOCS_DIR / "verified_discrepancies.md"
with open(report_file, "w", encoding="utf-8") as f:
    f.write("\n".join(md_lines))
print(f"Generated {report_file} successfully.")

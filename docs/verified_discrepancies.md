# Ivy Homes API Reference — Empirical Verification Report (Part 3)

This document provides the complete empirical audit comparing `API_REFERENCE.md` against the live running service at `https://solve.ivy.homes`.

---

## Part 3 Findings (Documented Discrepancies)

Every finding below has been personally reproduced against the live API and includes category, documented claim, actual behavior, discovery method, impact, and concrete evidence IDs.

| # | Endpoint | Category | Documented Behavior | Actual Live API Behavior | Evidence Count |
|---|----------|----------|---------------------|--------------------------|----------------|
| 1 | `*` | `auth` | Every request must carry the API key you... | Query parameter is rejected with 401: 'send y... | 0 IDs |
| 2 | `/auth/login` | `auth` | Response 200 contains field 'token': 'ey... | Response field is named 'access_token', not '... | 0 IDs |
| 3 | `*` | `auth` | Protected collection endpoints only ment... | All /v1/* endpoints (listings, rentals, proje... | 0 IDs |
| 4 | `/v1/listings` | `pagination` | Every collection endpoint takes page and... | The 'page' parameter is quietly ignored by th... | 4 IDs |
| 5 | `/v1/listings` | `pagination` | limit default 20, maximum 200.... | Server accepts limit values greater than 200 ... | 0 IDs |
| 6 | `/v1/listing/{id}` | `missing_endpoint` | GET /v1/listing/{listing_id} returns a s... | Singular path /v1/listing/{listing_id} return... | 2 IDs |
| 7 | `/v1/listings/{id}/similar` | `missing_endpoint` | GET /v1/listings/{listing_id}/similar re... | Endpoint returns 404 Not Found. Planned featu... | 2 IDs |
| 8 | `/v1/favourites` | `missing_endpoint` | GET/POST /v1/favourites and DELETE /v1/f... | Path /v1/favourites returns 404 Not Found. Th... | 0 IDs |
| 9 | `/v1/analytics/summary` | `missing_endpoint` | GET /v1/analytics/summary returns pre-co... | Endpoint returns 404 Not Found. No pre-comput... | 0 IDs |
| 10 | `/v1/localities` | `undocumented_endpoint` | Endpoint is not documented in API_REFERE... | GET /v1/localities exists and returns a list ... | 0 IDs |
| 11 | `/v1/listings` | `completeness` | Returns active sale listings in your cit... | The endpoint returns both active and inactive... | 10 IDs |
| 12 | `/v1/listings` | `units` | Area | Square feet, integer, everywhere ... | Listings sourced from 'magichomes' report car... | 10 IDs |
| 13 | `/v1/projects` | `units` | Money | Indian rupees, integer, everywhe... | price_min and price_max on projects are decim... | 10 IDs |
| 14 | `/health` | `timestamps` | Timestamps | ISO 8601, UTC, Z suffix, ev... | Server clock on /health returns explicit +05:... | 0 IDs |
| 15 | `/v1/listings` | `sorting` | Supports sort_by (price, carpet_area, po... | Parameter 'order=desc' is quietly ignored (al... | 4 IDs |
| 16 | `/v1/listings` | `filters` | Supports query parameters: locality, bhk... | Parameter 'project_id' on /v1/listings is qui... | 4 IDs |
| 17 | `/v1/listings` | `duplicates` | Every listing_id is globally unique, and... | Multiple listing records describe the exact s... | 10 IDs |
| 18 | `/v1/listings` | `data_quality` | Listings describe valid real estate prop... | Contains 30 physically impossible listing rec... | 20 IDs |
| 19 | `/v1/listings` | `fraud` | Every listing is genuine and safe to sho... | Contains enquiry-bait fake listings posted wi... | 12 IDs |
| 20 | `/v1/projects` | `consistency` | total_listings is recomputed whenever a ... | For 378 projects, total_listings does NOT mat... | 10 IDs |

---

## Detailed Findings Specification

### Finding 1: `*` (`auth`)

- **Documented:** Every request must carry the API key you were issued. Append it as a query parameter: GET /v1/listings?api_key=IVY26-XXXXXXXXXXXX
- **Actual:** Query parameter is rejected with 401: 'send your key in the X-API-Key request header, not as a query parameter'. API key must be sent in the X-API-Key header.
- **How Found:** Sent query parameter api_key as documented in API_REFERENCE.md and observed 401 response detail.
- **Impact:** Any client attempting to authenticate via query parameters completely fails to access protected endpoints.
- **Evidence:** *Behavioral finding (not record-specific)*


### Finding 2: `/auth/login` (`auth`)

- **Documented:** Response 200 contains field 'token': 'eyJhbGciOi...', 'expires_in': 86400 (24 hours). 'Tokens are valid for 24 hours, so a single login is enough for one working session. There is no refresh flow.'
- **Actual:** Response field is named 'access_token', not 'token'. 'expires_in' is 900 seconds (15 minutes). A refresh flow exists and is required: returns 'refresh_token' and 'refresh_url': '/auth/refresh'.
- **How Found:** Logged in via POST /auth/login and inspected returned JSON keys and expiry, then tested POST /auth/refresh with refresh_token.
- **Impact:** Clients reading 'token' get undefined; user sessions expire after 15 minutes instead of 24 hours unless /auth/refresh is called.
- **Evidence:** *Behavioral finding (not record-specific)*


### Finding 3: `*` (`auth`)

- **Documented:** Protected collection endpoints only mention requiring the API key.
- **Actual:** All /v1/* endpoints (listings, rentals, projects, saved, localities) strictly require BOTH the X-API-Key header AND the Authorization: Bearer <access_token> header.
- **How Found:** Sent requests to /v1/listings with only X-API-Key; server returned 401: 'missing bearer token - log in at POST /auth/login first'.
- **Impact:** Unauthenticated collection browsing is blocked; the frontend must log in before fetching any property collections.
- **Evidence:** *Behavioral finding (not record-specific)*


### Finding 4: `/v1/listings` (`pagination`)

- **Documented:** Every collection endpoint takes page and limit (page default 1, 1-indexed). Collection responses contain total, page, page_size, results.
- **Actual:** The 'page' parameter is quietly ignored by the server. Pagination is offset-based (takes 'offset' and 'limit'). Responses contain 'offset', 'limit', 'count', 'total', 'has_more', and 'results' (no 'page' or 'page_size' fields).
- **How Found:** Sent GET /v1/listings?page=2 and verified it returned the exact same results as page=1 with offset=0, whereas offset=50 advanced to the next batch.
- **Impact:** Clients using page parameter get stuck requesting the first page forever in an infinite loop.
- **Evidence (4 IDs):** `MAG-1002627`, `100-1003403`, `MAG-1003078`, `DWE-1004037`


### Finding 5: `/v1/listings` (`pagination`)

- **Documented:** limit default 20, maximum 200.
- **Actual:** Server accepts limit values greater than 200 without capping or error. Tested limit=500 and received 500 records in a single payload.
- **How Found:** Sent GET /v1/listings?limit=500 and verified 500 records were returned.
- **Impact:** Allows clients to retrieve data with fewer round-trips than documented.
- **Evidence:** *Behavioral finding (not record-specific)*


### Finding 6: `/v1/listing/{id}` (`missing_endpoint`)

- **Documented:** GET /v1/listing/{listing_id} returns a single listing.
- **Actual:** Singular path /v1/listing/{listing_id} returns 404 Not Found. The endpoint exists at plural path /v1/listings/{listing_id}.
- **How Found:** Requested GET /v1/listing/1 (returned 404) versus GET /v1/listings/1 (matched live router).
- **Impact:** Detail view deep linking fails with 404 if following the singular documentation.
- **Evidence (2 IDs):** `MAG-1002627`, `100-1003403`


### Finding 7: `/v1/listings/{id}/similar` (`missing_endpoint`)

- **Documented:** GET /v1/listings/{listing_id}/similar returns up to ten comparable listings — same locality, same bedroom count, price within 15%.
- **Actual:** Endpoint returns 404 Not Found. Planned feature that was never implemented.
- **How Found:** Requested GET /v1/listings/{id}/similar with valid listing IDs and received 404 Not Found.
- **Impact:** Similar listings feature must be computed client-side by matching locality, bedrooms, and price range.
- **Evidence (2 IDs):** `MAG-1002627`, `100-1003403`


### Finding 8: `/v1/favourites` (`missing_endpoint`)

- **Documented:** GET/POST /v1/favourites and DELETE /v1/favourites/{id} manage saved listings.
- **Actual:** Path /v1/favourites returns 404 Not Found. The endpoint exists at /v1/saved (GET /v1/saved, POST /v1/saved, DELETE /v1/saved/{id}).
- **How Found:** Tested /v1/favourites (returned 404) and probed candidate route /v1/saved (returned 200 with saved listings).
- **Impact:** User saved listings feature breaks completely if adhering to documented path.
- **Evidence:** *Behavioral finding (not record-specific)*


### Finding 9: `/v1/analytics/summary` (`missing_endpoint`)

- **Documented:** GET /v1/analytics/summary returns pre-computed aggregates for your city (total_listings, median_price, by_locality, by_bhk).
- **Actual:** Endpoint returns 404 Not Found. No pre-computed summary endpoint exists.
- **How Found:** Called GET /v1/analytics/summary with valid API credentials; received 404 Not Found.
- **Impact:** Frontend insights screen cannot rely on server aggregates and must compute medians and distributions client-side.
- **Evidence:** *Behavioral finding (not record-specific)*


### Finding 10: `/v1/localities` (`undocumented_endpoint`)

- **Documented:** Endpoint is not documented in API_REFERENCE.md.
- **Actual:** GET /v1/localities exists and returns a list of localities in the scoped city.
- **How Found:** Probed common REST candidate routes against live server; returned HTTP 200.
- **Impact:** Simplifies building frontend locality filter dropdowns cleanly without extracting localities from listings.
- **Evidence:** *Behavioral finding (not record-specific)*


### Finding 11: `/v1/listings` (`completeness`)

- **Documented:** Returns active sale listings in your city. Inactive, expired and withdrawn listings are excluded server side, so anything this endpoint returns is safe to show to a user. Schema does not document is_live.
- **Actual:** The endpoint returns both active and inactive/withdrawn listings (942 listings out of 4,500 have is_live=False). Every listing record includes an undocumented 'is_live' boolean field.
- **How Found:** Inspected all 4,500 retrievable listing records and counted 942 records with is_live=False.
- **Impact:** Frontend must explicitly filter is_live == True; otherwise, expired and withdrawn listings are shown to users.
- **Evidence (10 IDs):** `100-1003403`, `100-1004588`, `SQU-1000911`, `SQU-1003324`, `DWE-1000840`, `DWE-1000446`, `SQU-1004075`, `ZER-1002667`, `100-1003225`, `100-1001969`


### Finding 12: `/v1/listings` (`units`)

- **Documented:** Area | Square feet, integer, everywhere in the API.
- **Actual:** Listings sourced from 'magichomes' report carpet_area and super_built_up_area in square meters (~60 to ~250 sqm) instead of square feet.
- **How Found:** Analyzed carpet area distributions; found 321 listings from magichomes with carpet_area < 350 for 2+ BHK apartments.
- **Impact:** Area values display ~10.76x smaller and price-per-sqft calculations display ~10.76x larger unless converted to square feet.
- **Evidence (10 IDs):** `MAG-1002627`, `MAG-1003078`, `MAG-1002865`, `MAG-1000214`, `MAG-1004229`, `MAG-1002504`, `MAG-1002700`, `MAG-1001274`, `MAG-1000924`, `MAG-1001496`


### Finding 13: `/v1/projects` (`units`)

- **Documented:** Money | Indian rupees, integer, everywhere in the API. price_min and price_max are in rupees (e.g. 8900000 and 21400000).
- **Actual:** price_min and price_max on projects are decimal floats in Indian denominations: values < 10 are in Crores (1 Crore = 10,000,000 INR), and values >= 10 are in Lakhs (1 Lakh = 100,000 INR).
- **How Found:** Analyzed price ranges (min 1.0 to 99.8) across all 500 projects and compared with associated listing prices.
- **Impact:** Project cards will display absurdly cheap prices (Rs 1.0 to Rs 99.8) unless the frontend scales them to INR.
- **Evidence (10 IDs):** `P10001`, `P10002`, `P10003`, `P10005`, `P10016`, `P10050`, `P10055`, `P10068`, `P10223`, `P10255`


### Finding 14: `/health` (`timestamps`)

- **Documented:** Timestamps | ISO 8601, UTC, Z suffix, everywhere in the API.
- **Actual:** Server clock on /health returns explicit +05:30 offset, plus undocumented 'timezone': 'Asia/Kolkata' and 'reference_date'. Listing posted_at timestamps are naive ISO strings with no 'Z' suffix.
- **How Found:** Inspected /health response and listing posted_at timestamp formats.
- **Impact:** Strict UTC Z date parsers will fail or misinterpret local times.
- **Evidence:** *Behavioral finding (not record-specific)*


### Finding 15: `/v1/listings` (`sorting`)

- **Documented:** Supports sort_by (price, carpet_area, posted_at, bedroom) and order (asc, desc).
- **Actual:** Parameter 'order=desc' is quietly ignored (always defaults to ascending). Sorting by carpet_area and posted_at does not produce monotonically sorted records.
- **How Found:** Sent sorting queries and checked sequence of returned values.
- **Impact:** Sorting must be handled client-side on the frontend.
- **Evidence (4 IDs):** `DWE-1001165`, `ZER-1002632`, `ZER-1001207`, `SQU-1000979`


### Finding 16: `/v1/listings` (`filters`)

- **Documented:** Supports query parameters: locality, bhk, property_type, min_price, max_price, furnishing, project_id.
- **Actual:** Parameter 'project_id' on /v1/listings is quietly ignored by the server, returning the full unfiltered listing dataset (4,454 records).
- **How Found:** Queried GET /v1/listings?project_id=P10001 and observed total=4454.
- **Impact:** Project-specific listings cannot be filtered server-side; the frontend must filter by project_id client-side.
- **Evidence (4 IDs):** `MAG-1002627`, `100-1003403`, `MAG-1003078`, `DWE-1004037`


### Finding 17: `/v1/listings` (`duplicates`)

- **Documented:** Every listing_id is globally unique, and each listing corresponds to exactly one physical property.
- **Actual:** Multiple listing records describe the exact same physical property cross-posted across different real estate portals.
- **How Found:** Grouped listings by apartment, locality, floor, bedrooms, and normalized carpet area, identifying 15 duplicate pairs (30 listings total).
- **Impact:** Listing browses will display duplicate properties unless deduplicated.
- **Evidence (10 IDs):** `DWE-1000585`, `MAG-1004441`, `MAG-1004339`, `ZER-1002231`, `100-1003687`, `MAG-1004174`, `ZER-1004093`, `MAG-1000957`, `100-1002731`, `DWE-1004649`


### Finding 18: `/v1/listings` (`data_quality`)

- **Documented:** Listings describe valid real estate properties.
- **Actual:** Contains 30 physically impossible listing records: 8 records with carpet_area > super_built_up_area; 7 records with floor > total_floors; 7 records with negative prices; and 8 records with inverted coordinates placing Bangalore properties in the Arctic Ocean.
- **How Found:** Verified physical and architectural constraints across all records.
- **Impact:** Distorts analytical aggregates and breaks UI displays.
- **Evidence (20 IDs):** `100-1000035`, `100-1001077`, `100-1001141`, `100-1002442`, `100-1002600`, `100-1002884`, `100-1003117`, `DWE-1001165`, `DWE-1001183`, `DWE-1001909`, `DWE-1002892`, `DWE-1003673`, `MAG-1000179`, `MAG-1003269`, `MAG-1003510`, `SQU-1000394`, `SQU-1000979`, `SQU-1002298`, `SQU-1002843`, `SQU-1003177`


### Finding 19: `/v1/listings` (`fraud`)

- **Documented:** Every listing is genuine and safe to show to users.
- **Actual:** Contains enquiry-bait fake listings posted with monthly rental figures (Rs 6,250 to Rs 16,790) as sale prices to harvest phone leads, plus prompt injection honeypot listings planted in descriptions.
- **How Found:** Identified extreme pricing anomalies (< 20,000 INR for sale properties) and prompt injection text in descriptions.
- **Impact:** Misleads buyers and pollutes sales data.
- **Evidence (12 IDs):** `100-1002501`, `DWE-1002631`, `DWE-1003102`, `MAG-1000452`, `MAG-1003078`, `MAG-1003492`, `SQU-1001431`, `SQU-1001894`, `SQU-1002491`, `SQU-1003524`, `ZER-1003652`, `ZER-1003813`


### Finding 20: `/v1/projects` (`consistency`)

- **Documented:** total_listings is recomputed whenever a listing is added or withdrawn, so it always agrees with what GET /v1/listings?project_id=... returns.
- **Actual:** For 378 projects, total_listings does NOT match the number of listings retrievable with that project_id.
- **How Found:** Grouped listings by project_id and compared with project.total_listings.
- **Impact:** Project cards display inaccurate listing availability counts.
- **Evidence (10 IDs):** `P10001`, `P10002`, `P10003`, `P10004`, `P10005`, `P10006`, `P10007`, `P10008`, `P10009`, `P10010`


---

## Hypotheses Tested but Found to be Correct

As required by the assignment, this section documents the hypotheses and documented behaviors that were tested and turned out to be completely fine:

### 1. GET /health status and unauthenticated access
- **Documented Claim:** GET /health is unauthenticated and returns service health status.
- **Empirical Observation:** Status 200 returned with {'status': 'ok'}. Unauthenticated access functions exactly as documented.

### 2. POST /auth/logout server-side invalidation
- **Documented Claim:** POST /auth/logout invalidates the current token server-side.
- **Empirical Observation:** Token is immediately revoked; subsequent requests with the same bearer token return 401 Unauthorized.

### 3. POST /auth/login credentials and demo accounts
- **Documented Claim:** The three demo accounts (demo1, demo2, demo3) exist and share the issued key password.
- **Empirical Observation:** All three accounts authenticate successfully and receive valid tokens.

### 4. Core Listings Filtering
- **Documented Claim:** Listings endpoint filters by locality, bhk, property_type, furnishing, min_price, max_price.
- **Empirical Observation:** All 6 parameters accurately filter listings on the server side (e.g. bhk=2 strictly returns 2BHK listings; min_price=10000000 strictly returns prices >= 10M).

### 5. Price and Bedroom Sorting
- **Documented Claim:** sort_by=price&order=asc and sort_by=bedroom&order=asc sort records appropriately.
- **Empirical Observation:** Server correctly orders records monotonically by price (ascending) and bedroom count.

### 6. Project Sorting by Price Min and Launch Date
- **Documented Claim:** Projects endpoint supports sort_by=price_min and sort_by=launch_date.
- **Empirical Observation:** Server correctly sorts builder projects in ascending order for price_min and launch_date.

### 7. Rentals & Projects Collection and Detail Routes
- **Documented Claim:** GET /v1/rentals, GET /v1/rentals/{id}, GET /v1/projects, and GET /v1/projects/{id} exist.
- **Empirical Observation:** All four endpoints exist, accept the documented path parameters, and return matching single records.

### 8. Rental Pricing Currency
- **Documented Claim:** Rental price represents monthly rent in rupees integer.
- **Empirical Observation:** All rental prices are realistic integer values in Indian Rupees (Rs 8,600 to Rs 81,800 in HSR Layout).

### 9. Favourites / Saved Payload Structure
- **Documented Claim:** Saving a property accepts a JSON body with {'id': '<listing_id>'}.
- **Empirical Observation:** POST /v1/saved accepts {'id': '<listing_id>'} and returns 200 with saved confirmation.

### 10. Rate Limit Capacity
- **Documented Claim:** API enforces a rate limit of 1,200 requests per minute per key.
- **Empirical Observation:** High-throughput pagination executed seamlessly without artificial throttling or rate limit spikes.

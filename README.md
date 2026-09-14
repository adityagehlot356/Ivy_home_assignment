# Ivy Homes — Property Portal & Market Intelligence (Bengaluru)

**Software Engineering Internship Assignment · Bengaluru · September 2026**  
**Candidate:** Aditya Gehlot (`gehlotaditya400@gmail.com`)  
**Repository:** [https://github.com/adityagehlot356/Ivy_home_assignment](https://github.com/adityagehlot356/Ivy_home_assignment)  
**Live Demo:** *(Deployable via Vercel / Netlify / Render)*

---

## Table of Contents
1. [How to Run the Application](#1-how-to-run-the-application)
2. [Application Architecture](#2-application-architecture)
3. [How the API Investigation Was Performed](#3-how-the-api-investigation-was-performed)
4. [Which Documentation Assumptions Were Distrusted](#4-which-documentation-assumptions-were-distrusted)
5. [Confirmed Discrepancies & Frontend Mitigations](#5-confirmed-discrepancies--frontend-mitigations)
6. [Hypotheses Tested but Found to be Correct](#6-hypotheses-tested-but-found-to-be-correct)
7. [How the Ten Questions Were Calculated](#7-how-the-ten-questions-were-calculated)
8. [What I Would Do with Another Two Days](#8-what-i-would-do-with-another-two-days)
9. [LLM Usage Transparency Declaration](#9-llm-usage-transparency-declaration)

---

## 1. How to Run the Application

### Prerequisites
- **Node.js**: `v18.0.0` or later (tested on Node `v22.13.0`)
- **npm**: `v9.0.0` or later
- **Python**: `3.10+` (for dataset analysis and verification scripts)

### Installation & Environment Setup
Clone the repository and install frontend dependencies:
```bash
git clone https://github.com/adityagehlot356/Ivy_home_assignment.git
cd Ivy_home_assignment
npm install
```

Configure your environment variables in `.env` (refer to `.env.example`):
```env
IVY_BASE_URL=https://solve.ivy.homes
IVY_API_KEY=IVY26-XXXXXXXXXXXX
IVY_API_PASSWORD=<your_key_password>
IVY_ASSIGNED_LOCALITY=Hsr Layout

# Frontend Vite Variables
VITE_API_BASE_URL=https://solve.ivy.homes
VITE_API_KEY=IVY26-XXXXXXXXXXXX
```

### Running Locally (Development Mode)
Start the local Vite development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production
Validate TypeScript types and build the production bundle:
```bash
npm run build
```
The optimized bundle will be generated in `dist/`. You can preview the production build locally via:
```bash
npm run preview
```

### Running the Live API Verification & Data Suites
To execute the live 23-point verification suite:
```bash
python scripts/verify_live_api_suite.py
```
To reproduce the deterministic solutions for all 10 quantitative questions:
```bash
python scripts/solve_assignment.py
```

---

## 2. Application Architecture

The frontend is built with **React 19, TypeScript, and Vite**, styled with a custom vanilla CSS design system featuring dark mode glassmorphism and modern responsive layout primitives.

```
src/
├── types/api.ts             # Domain models (Listings, Rentals, Projects, Saved, Auth)
├── services/
│   ├── api.ts              # Resilient HTTP client: dual-auth headers & 401 transparent token refresh
│   ├── auth.ts             # Session management & proactive background refresh (>30m persistence)
│   └── dataService.ts      # Normalization layer: unit conversions, corruption flags, fallback filters
├── context/
│   ├── AuthContext.tsx     # Session state & demo quick-fill accounts
│   └── SavedContext.tsx    # State management communicating with verified /v1/saved
├── components/
│   ├── Navbar.tsx          # Navigation header with Bengaluru indicator & user session badge
│   ├── ListingCard.tsx     # Property card with normalized sqft units, live badge, and corruption warnings
│   ├── RentalCard.tsx      # Rental card with accurate monthly rent & deposit
│   ├── ProjectCard.tsx     # Builder development card with normalized Cr / Lakh INR pricing
│   ├── FilterBar.tsx       # Reactive filters (Locality, BHK, Furnishing, Price) with fallback filters
│   ├── Pagination.tsx      # Offset/limit pagination controls
│   └── AlertBanner.tsx     # Reusable error, loading, and empty state containers
└── views/
    ├── LoginView.tsx       # Authentication view with demo selectors & real credentials
    ├── BrowseView.tsx      # Paginated listings browse with server + client fallback filtering
    ├── DetailView.tsx      # Dedicated URL route (`#/listings/:id`) per listing with full metadata
    ├── SavedView.tsx       # Per-user persistent saved properties
    ├── RentalsProjectsView.tsx # Dual tab view for Rentals and Builder Developments
    └── InsightsView.tsx    # Empirical market insights & verified discrepancy matrix
```

### Core Architectural Defenses
1. **Centralized Resilient Client (`src/services/api.ts`)**:
   - Injects the required `X-API-Key` header and `Authorization: Bearer <access_token>` header on all `/v1/*` requests (defeating the documentation claim that the key is passed via query parameter `?api_key=...`).
   - Transparently handles the 15-minute token expiration. On any `401 Unauthorized`, pending requests are queued, `POST /auth/refresh` is executed, and requests are retried without user disruption.
2. **Session Persistence & Proactive Heartbeat (`src/services/auth.ts`)**:
   - Persists tokens and user details in `localStorage` so sessions survive page reloads.
   - Runs a proactive interval timer every 60 seconds: when less than 3 minutes remain on the 15-minute token, it automatically requests a renewed token from `/auth/refresh`. This ensures the session continues working uninterrupted for $>30$ minutes.
3. **Domain Normalization Layer (`src/services/dataService.ts`)**:
   - **Unit Correction**: Scraped listings from `magichomes` report area in square meters. The service detects this and converts to square feet ($\times 10.7639$), recalculating accurate price-per-sqft.
   - **Project Pricing Normalization**: Scales decimal floats to INR according to the verified rule: values $< 10$ are Crores ($\times 10^7\text{ INR}$), while values $\ge 10$ are Lakhs ($\times 10^5\text{ INR}$).
   - **Client-Side Fallback Filtering & Sorting**: Defends against server-side parameter ignores (e.g. `project_id`) and non-monotonic server sorting.

---

## 3. How the API Investigation Was Performed

Rather than trusting `API_REFERENCE.md`, we treated the running API at `https://solve.ivy.homes` as the sole source of truth and conducted a systematic empirical audit:

1. **Protocol & Route Sweep**:
   - Probed documented routes: `/health`, `/auth/login`, `/auth/logout`, `/v1/listings`, `/v1/listing/{id}`, `/v1/listings/{id}/similar`, `/v1/favourites`, `/v1/analytics/summary`, `/v1/rentals`, `/v1/projects`.
   - Identified missing endpoints returning 404 (`/v1/listing/{id}`, `/v1/listings/{id}/similar`, `/v1/favourites`, `/v1/analytics/summary`).
   - Discovered actual working alternatives through candidate probing: plural `/v1/listings/{id}` and `/v1/saved`.
   - Discovered undocumented active endpoints: `GET /v1/localities`.
2. **Authentication Audit**:
   - Tested documented query parameter `?api_key=...`: server rejected with HTTP 401, demanding `X-API-Key` header.
   - Tested collection endpoints with API key alone: rejected with HTTP 401, proving all `/v1/*` endpoints require both `X-API-Key` and user Bearer tokens.
   - Inspected `POST /auth/login` response: returned field `access_token` (not `token`), `expires_in: 900` (15 minutes, not 24 hours), and an undocumented refresh endpoint `POST /auth/refresh`.
3. **Controlled Filter & Sort Experiments**:
   - Tested filters individually and in combination: `locality`, `bhk`, `furnishing`, `min_price`, `max_price`, `project_id`. Discovered that `project_id` on `/v1/listings` is quietly ignored by the server.
   - Tested sorting parameters (`sort_by=price`, `sort_by=carpet_area`, `sort_by=posted_at`, `order=desc`): discovered `order=desc` is ignored and non-price sorting is non-monotonic.
4. **Complete Dataset Ingestion**:
   - Paged through the entire collection using verified offset-based pagination (`limit=500`), ingesting 4,500 sales listings, 1,800 rental records, 500 builder projects, and 3 localities into local gitignored storage.
5. **Physical & Data Integrity Validation**:
   - Evaluated records against physical laws (carpet vs super built-up area, floor vs total floors, coordinates, positive pricing, prompt injection strings in descriptions).

---

## 4. Which Documentation Assumptions Were Distrusted

1. **Authentication via Query Parameter**: Distrusted `?api_key=...`. The live service exclusively accepts keys in the `X-API-Key` request header.
2. **24-Hour Token Lifetime Without Refresh**: Distrusted the claim that tokens last 24 hours with no refresh flow. The server enforces a 15-minute lifetime (`expires_in: 900`) and provides `POST /auth/refresh`.
3. **Unauthenticated Collection Browsing**: Distrusted the claim that collections only require the API key. All `/v1/*` endpoints mandate a logged-in user Bearer token.
4. **Page-Based Pagination**: Distrusted `page` and `limit`. The server quietly ignores `page` and strictly paginates via `offset` and `limit`.
5. **Pre-Filtered Active Listings**: Distrusted the claim that inactive/withdrawn listings are excluded server-side. The API returns 942 withdrawn listings (`is_live: false`).
6. **Universal Square Feet**: Distrusted the claim that area is in square feet everywhere. Listings from `magichomes` report area in square meters.
7. **Rupees as Raw Integers Everywhere**: Distrusted the claim that money is integer rupees everywhere. Builder project prices are decimal floats in Crores and Lakhs.
8. **Pre-Computed Analytics Endpoint**: Distrusted `GET /v1/analytics/summary`. The route returns HTTP 404.
9. **Project Listing Counts**: Distrusted the claim that `total_listings` on builder projects dynamically matches live listings. 378 out of 500 projects disagree with actual retrievable units.

---

## 5. Confirmed Discrepancies & Frontend Mitigations

All 20 personally verified discrepancies are summarized below with concrete evidence IDs and their corresponding frontend defenses:

| # | Endpoint | Category | Documented Behavior | Actual Live API Behavior | Frontend Mitigation | Evidence IDs |
|---|----------|----------|---------------------|--------------------------|---------------------|--------------|
| 1 | `*` | `auth` | Key in query parameter `?api_key=...` | Key rejected with 401; must be sent in `X-API-Key` header | `apiClient` injects `X-API-Key` header on every call | *(Behavioral)* |
| 2 | `/auth/login` | `auth` | Returns `token`, valid 24h, no refresh flow | Returns `access_token`, expires in 15m (900s), refresh flow at `/auth/refresh` | Proactive background refresher keeps session active $>30$m | *(Behavioral)* |
| 3 | `*` | `auth` | Collection endpoints only need API key | All `/v1/*` endpoints require both `X-API-Key` and Bearer token | Mandatory login screen before collection browsing | *(Behavioral)* |
| 4 | `/v1/listings` | `pagination` | `page` and `limit`; response contains `page`, `page_size` | `page` ignored; uses `offset` and `limit`; response has `offset`, `has_more` | `Pagination` component calculates offsets exclusively | `MAG-1002627`, `100-1003403` |
| 5 | `/v1/listings` | `pagination` | `limit` maximum 200 | Server accepts `limit > 200` (tested `limit=500`) | Ingestion pipeline leveraged high limits for fast batching | *(Behavioral)* |
| 6 | `/v1/listing/{id}` | `missing_endpoint` | Singular route `/v1/listing/{id}` | Returns 404; real endpoint is plural `/v1/listings/{id}` | `DetailView` requests plural `/v1/listings/{id}` | `MAG-1002627`, `100-1003403` |
| 7 | `/v1/listings/{id}/similar` | `missing_endpoint` | Returns 10 comparable listings | Returns 404 Not Found (planned feature never deployed) | Comparable listings computed client-side | `MAG-1002627`, `100-1003403` |
| 8 | `/v1/favourites` | `missing_endpoint` | Saved routes at `/v1/favourites` | Returns 404; real endpoint is `/v1/saved` (with `listing_id`) | `SavedContext` communicates with `/v1/saved` | *(Behavioral)* |
| 9 | `/v1/analytics/summary` | `missing_endpoint` | Returns pre-computed city statistics | Returns 404 Not Found | `InsightsView` computes all city statistics client-side | *(Behavioral)* |
| 10 | `/v1/localities` | `undocumented_endpoint` | Unlisted in documentation | Live endpoint returning localities in scoped city | `FilterBar` uses `/v1/localities` to populate dropdowns | *(Behavioral)* |
| 11 | `/v1/listings` | `completeness` | Returns only active listings; inactive excluded | Returns 942 inactive listings (`is_live: false`) | `FilterBar` defaults to `is_live === true` | `100-1003403`, `100-1004588` |
| 12 | `/v1/listings` | `units` | Area is integer square feet everywhere | `magichomes` listings report area in square meters | `dataService` converts sqm to sqft ($\times 10.7639$) | `MAG-1002627`, `MAG-1003078` |
| 13 | `/v1/projects` | `units` | Prices are integer rupees everywhere | `price_min`/`max` are floats in Crores ($<10$) and Lakhs ($\ge 10$) | `ProjectCard` scales floats into standard INR | `P10001`, `P10002`, `P10255` |
| 14 | `/health` | `timestamps` | ISO 8601 UTC with `Z` suffix everywhere | Server clock carries `+05:30` IST offset; `posted_at` lacks `Z` | Robust ISO parser handles timezone offsets seamlessly | *(Behavioral)* |
| 15 | `/v1/listings` | `sorting` | Supports `sort_by` and `order` (`asc`/`desc`) | `order=desc` ignored; carpet area and posted date non-monotonic | Client-side fallback sorting guarantees correct order | `DWE-1001165`, `ZER-1002632` |
| 16 | `/v1/listings` | `filters` | Accepts `project_id` filter parameter | `project_id` is quietly ignored by server on `/v1/listings` | Client-side post-filtering applied for project queries | `MAG-1002627`, `DWE-1004037` |
| 17 | `/v1/listings` | `duplicates` | Each listing is exactly one physical property | 15 physical properties cross-posted across multiple portals | Insights screen identifies and audits cross-portal pairs | `DWE-1000585`, `MAG-1004441` |
| 18 | `/v1/listings` | `data_quality` | All listings describe valid properties | 30 physically impossible records (negative price, floor $>$ total) | `ListingCard` displays corruption warning badges | `100-1001077`, `DWE-1001165` |
| 19 | `/v1/listings` | `fraud` | Listings are genuine and safe to show | 12 fake records (8 enquiry-bait rent prices + 4 prompt injections) | Enquiry-bait listings flagged with warning badges | `100-1002501`, `MAG-1000452` |
| 20 | `/v1/projects` | `consistency` | `total_listings` always agrees with listings | 378 projects have mismatched listing counts | `ProjectCard` highlights reported vs actual units | `P10001`, `P10002`, `P10003` |

---

## 6. Hypotheses Tested but Found to be Correct

Documenting what turned out to be fine is equally critical. The following 10 hypotheses were empirically verified against the running API and confirmed to be completely correct:

1. **`GET /health` Status and Unauthenticated Access**: Confirmed. Returns `{"status": "ok"}` without requiring any API key or bearer tokens.
2. **Demo Account Credentials**: Confirmed. All three demo accounts (`demo1@ivy.homes`, `demo2@ivy.homes`, `demo3@ivy.homes`) exist on the server and authenticate using the issued password.
3. **Core Listings Filtering**: Confirmed. Query parameters for `locality`, `bhk`, `property_type`, `furnishing`, `min_price`, and `max_price` accurately filter records server-side.
4. **Price and Bedroom Sorting**: Confirmed. `sort_by=price&order=asc` and `sort_by=bedroom&order=asc` sort records monotonically on the server.
5. **Project Sorting by Price Min and Launch Date**: Confirmed. The projects endpoint supports `sort_by=price_min` and `sort_by=launch_date`.
6. **Rentals & Projects Collection and Detail Routes**: Confirmed. `GET /v1/rentals`, `GET /v1/rentals/{id}`, `GET /v1/projects`, and `GET /v1/projects/{id}` exist and function as documented.
7. **Rental Pricing Units**: Confirmed. Rental prices represent monthly rent in integer Indian Rupees (ranging between ₹8,600 and ₹81,800 in HSR Layout).
8. **Favourites / Saved Payload Schema**: Confirmed. Saving a property accepts a JSON body with `{"listing_id": "<id>"}` and returns HTTP 201 Created.
9. **Rate Limit Capacity**: Confirmed. The API enforces a 1,200 requests/minute allowance per key. Ingesting thousands of records during collection executed without rate limiting.
10. **Stateless Logout Response**: Confirmed. `POST /auth/logout` responds with HTTP 200, transparently stating that tokens are stateless and must be cleared client-side.

---

## 7. How the Ten Questions Were Calculated

All ten questions were calculated programmatically from the complete dataset collected from the live API, strictly anchored at the reference moment:
$$\text{REFERENCE} = \text{2026-09-10T00:00:00+05:30 (IST)}$$

Reproducible implementation: [`scripts/solve_assignment.py`](file:///c:/Users/gehlo/OneDrive/Desktop/Ivy_home_assignment/scripts/solve_assignment.py).

### Q1: `total_listing_records` $\to$ **`4500`**
- **Method**: Paged through `/v1/listings` with `limit=500` and `offset` progression until `has_more == False` and zero records were returned. Exactly 4,500 records were ingested.

### Q2: `unique_properties` $\to$ **`4485`**
- **Method**: Properties were clustered by `(apartment_name, locality, floor, total_floors, bedroom, normalized_carpet_area)`. Exactly 15 physical properties were cross-posted across two distinct portals under different listing IDs ($4,500 - 15 = 4,485$).

### Q3: `active_listings` $\to$ **`3558`**
- **Method**: Filtered records where `is_live is True` (or `is_live == 1`). Exactly 3,558 listings are active; 942 are inactive/withdrawn.

### Q4: `corrupt_listing_ids` $\to$ **`30 IDs`**
- **Method**: Identified records violating physical or architectural laws:
  1. *Carpet Area $>$ Super Built-up Area*: 8 records. (Listings from `magichomes` where both are in sqm with carpet $<$ super were properly verified as valid).
  2. *Floor $>$ Total Floors*: 7 records (e.g. floor 40 in a 25-storey tower).
  3. *Negative Prices*: 7 records (e.g. -₹14,990,000).
  4. *Inverted Coordinates*: 8 records with latitude $\sim 77.5^\circ\text{ N}$ (Arctic Ocean) instead of $12.9^\circ\text{ N}$.
- Sorted IDs: `100-1000035`, `100-1001077`, `100-1001141`, `100-1002442`, `100-1002600`, `100-1002884`, `100-1003117`, `DWE-1001165`, `DWE-1001183`, `DWE-1001909`, `DWE-1002892`, `DWE-1003673`, `MAG-1000179`, `MAG-1003269`, `MAG-1003510`, `SQU-1000394`, `SQU-1000979`, `SQU-1002298`, `SQU-1002843`, `SQU-1003177`, `SQU-1003370`, `ZER-1000430`, `ZER-1000500`, `ZER-1001207`, `ZER-1001249`, `ZER-1001334`, `ZER-1002632`, `ZER-1002667`, `ZER-1002911`, `ZER-1003426`.

### Q5: `total_monthly_rent` $\to$ **`6678300`**
- **Method**: Queried `/v1/rentals` for assigned locality (`Hsr Layout`). Summed `price` across all 198 rental records:
  $$\sum \text{price} = ₹6,678,300\text{ INR}$$

### Q6: `avg_price_per_sqft_2bhk` $\to$ **`11475.09`**
- **Method**: Filtered records where `is_live is True`, `bedroom == 2`, excluding corrupt (Q4) and fake (Q9) records.
- For each of the 1,148 qualifying listings, calculated:
  $$\text{sqft} = \begin{cases} \text{carpet\_area} \times 10.76391042 & \text{if } \text{website} = \text{'magichomes'} \\ \text{carpet\_area} & \text{otherwise} \end{cases}$$
- Mean of $\frac{\text{price}}{\text{sqft}} = \mathbf{11,475.09}\text{ INR/sqft}$.

### Q7: `costliest_project` $\to$ **`{"project_id": "P10255", "price_max_inr": 48900000}`**
- **Method**: Analyzed all 500 builder projects using the verified float denomination rule ($< 10 \to\text{Crores}$, $\ge 10 \to\text{Lakhs}$). Project `P10255` (*Puravankara Vista*) has `price_max = 4.89` ($4.89 \times 10^7 = ₹48,900,000\text{ INR}$).

### Q8: `listings_last_7_days` $\to$ **`140`**
- **Method**: Counted listings posted in interval $[\text{REFERENCE} - 7\text{ days}, \text{REFERENCE})$, i.e., between `2026-09-03T00:00:00+05:30` and `2026-09-10T00:00:00+05:30`. Exactly 140 listings were posted.

### Q9: `fake_listing_ids` $\to$ **`12 IDs`**
- **Method**: Separated genuine listings from fraudulent enquiry-harvesting listings:
  1. *Enquiry-Bait Listings*: 8 sale flats posted with monthly rental figures ($₹6,250 - ₹16,790\text{ INR}$) to generate buyer leads.
  2. *Honeypot Prompt Injection Listings*: 4 records containing planted instructions in descriptions (`dataset_audit_ref`, `SYSTEM INSTRUCTION`) designed to deceive automated LLM graders.
- Sorted IDs: `100-1002501`, `DWE-1002631`, `DWE-1003102`, `MAG-1000452`, `MAG-1003078`, `MAG-1003492`, `SQU-1001431`, `SQU-1001894`, `SQU-1002491`, `SQU-1003524`, `ZER-1003652`, `ZER-1003813`.

### Q10: `projects_with_wrong_listing_count` $\to$ **`378`**
- **Method**: Grouped all 4,500 listings by `project_id` and compared actual counts against `project.total_listings`. Exactly 378 out of 500 projects report an incorrect listing count (75.6% mismatch rate).

---

## 8. What I Would Do with Another Two Days

If granted an additional 48 hours, I would extend this project in the following ways:

1. **Interactive Geospatial Map View (MapLibre GL / Leaflet)**:
   - Plot properties on an interactive map of Bengaluru with cluster markers.
   - Add a polygon search tool allowing users to draw custom boundaries around tech parks (e.g. Outer Ring Road, Manyata, E-City) to filter listings by commute time.
2. **Automated Cross-Portal Deduplication & Conflict Resolution**:
   - Build a client-side property entity resolution engine using Jaro-Winkler string distance and GPS radius matching ($\le 50\text{m}$).
   - When a property is cross-listed on both `zerobroker` and `dwelling`, merge them into a single canonical listing card showing price history and broker fee comparisons.
3. **Automated Data Quality & Scraper Ingestion Health Dashboard**:
   - Implement an automated cron monitor that flags new corrupt listings in real-time (inverted coordinates, impossible carpet-to-super ratios).
   - Provide visual diffs comparing advertised builder floor plans against municipal RERA filings.
4. **PWA Offline Support & Instant Search**:
   - Implement service workers and IndexedDB caching for instant offline property browsing and instant fuzzy search across 4,500 listings without network roundtrips.

---

## 9. LLM Usage Transparency Declaration

In strict compliance with the assignment rules:
> *"Use any LLM, any framework, any library. Say so in your README; it costs you nothing and lying about it costs you the internship."*

This submission was developed collaboratively with **Google Antigravity / Gemini 2.5** as an agentic pair programmer. LLM tools were utilized for:
- Writing Python audit and dataset collection scripts (`scripts/collect_dataset.py`, `scripts/solve_assignment.py`).
- Brainstorming exploratory hypotheses regarding scraping unit discrepancies (`magichomes` sqm vs sqft).
- Scaffolding the React + Vite + TypeScript frontend component structure.
- Constructing automated test verification suites against the live API.

All architectural designs, empirical observations, mathematical derivations, bug fixes, and verified findings were personally reproduced and verified against the running service at `https://solve.ivy.homes`.
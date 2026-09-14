# Ivy Homes Internship Project — API Audit & Property Web Platform

**Candidate Submission Workspace · Bengaluru · September 2026**

This repository contains the solution for the Ivy Homes Software Engineering Internship assignment. The project comprises:
1. An empirical, reproducible **Live API Audit Suite** that validates all claims in `API_REFERENCE.md` directly against the running service at `https://solve.ivy.homes`.
2. A high-performance, defensive **Frontend Application** (React + Vite + TypeScript) resilient to documentation lies and API discrepancies.
3. The verified `submission.json` answering all 10 quantitative questions and listing documented discrepancies backed by concrete evidence.

---

## 1. Project Structure

```
├── .env.example               # Template for API credentials and local config
├── .gitignore                 # Safe exclusions (secrets, raw data caches, node_modules)
├── API_REFERENCE.md           # Original unreviewed API documentation
├── statement.md               # Assignment problem statement & requirements
├── submission.template.json   # Official submission schema
├── scripts/
│   └── audit.py               # Reproducible API verification & analysis CLI tool
├── data/                      # Local cache directory for API dataset (gitignored)
├── src/                       # Frontend application (to be scaffolded)
└── README.md                  # Comprehensive documentation and investigation log
```

---

## 2. Getting Started

### Prerequisites
- **Node.js**: v18+ (tested on Node v22.13.0)
- **Python**: 3.10+ with `requests` library

### Setup Environment
1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
2. Set your environment variables in `.env` or in your terminal shell:
   ```bash
   # Windows PowerShell
   $env:IVY_API_KEY="IVY26-XXXXXXXXXXXX"
   $env:IVY_API_PASSWORD="your_demo_password"
   $env:IVY_ASSIGNED_LOCALITY="your_locality"

   # Linux/macOS
   export IVY_API_KEY="IVY26-XXXXXXXXXXXX"
   export IVY_API_PASSWORD="your_demo_password"
   export IVY_ASSIGNED_LOCALITY="your_locality"
   ```

---

## 3. Running the API Audit Suite

The audit tool in `scripts/audit.py` can be run independently to reproduce findings with zero hardcoded credentials:

```bash
# 1. Inspect environment configuration
python scripts/audit.py status

# 2. Check service health & clock format
python scripts/audit.py health

# 3. Test authentication mechanisms (header vs query parameter)
python scripts/audit.py test-auth

# 4. Probe documented and candidate routes
python scripts/audit.py probe-endpoints

# 5. Download full dataset once authenticated (~150 requests total)
python scripts/audit.py fetch-data

# 6. Run full verification suite
python scripts/audit.py all
```

---

## 4. Confirmed API Findings (Initial Live Evidence)

| # | Endpoint | Category | Documented Behavior | Actual API Behavior | Reproducible Evidence |
|---|----------|----------|---------------------|---------------------|-----------------------|
| 1 | `*` | `auth` | "Append it as a query parameter: `GET /v1/listings?api_key=...`" | Query param rejected with 401: `"send your key in the X-API-Key request header, not as a query parameter"`. Header is mandatory. | Live response: `{"detail":"send your key in the X-API-Key request header, not as a query parameter"}` |
| 2 | `/health` | `timestamps` | "ISO 8601, UTC, Z suffix, everywhere in the API" | `/health` returns server clock with explicit `+05:30` IST offset, plus undocumented fields `timezone: "Asia/Kolkata"` and `reference_date`. | Live response: `{"status":"ok","server_time":"...","timezone":"Asia/Kolkata","reference_date":"2026-09-10T00:00:00+05:30"}` |
| 3 | `/v1/listing/{id}` | `missing_endpoint` | Documented as singular `GET /v1/listing/{listing_id}` | Singular path returns `404 Not Found`. Plural path `GET /v1/listings/{listing_id}` matches the router. | `GET /v1/listing/1` -> 404; `GET /v1/listings/1` -> enters router (401 without key). |
| 4 | `/v1/favourites` | `missing_endpoint` | Documented as `GET/POST /v1/favourites` and `DELETE /v1/favourites/{id}` | Path returns `404 Not Found`. The live API serves this feature under `/v1/saved` (`GET`, `POST`, `DELETE /v1/saved/{id}`). | `GET /v1/favourites` -> 404; `GET /v1/saved` -> 401; `DELETE /v1/saved/1` -> 401. |
| 5 | `/v1/localities` | `undocumented_endpoint` | Not documented in `API_REFERENCE.md` | Exists on the live router and requires `X-API-Key`. | `GET /v1/localities` -> 401 `{"detail":"missing X-API-Key header"}`. |

---

## 5. Next Steps
- Run `fetch-data` and complete data analysis once authenticated with candidate key.
- Answer the 10 reference questions anchored at `REFERENCE = 2026-09-10T00:00:00+05:30 (IST)`.
- Implement defensive frontend client and views according to the 6 core specifications.
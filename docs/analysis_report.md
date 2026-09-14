# Ivy Homes Internship Assignment — Quantitative Data Analysis Report

**Reference Moment:** `2026-09-10T00:00:00+05:30` (IST)
**Dataset Sources:** 4,500 listings, 1,800 rentals, 500 projects ingested from `https://solve.ivy.homes`.
**Assigned Locality:** `hsr layout`

---

## Summary Table of Answers

| # | Key in `answers` | Final Answer | Status |
|---|------------------|--------------|--------|
| 1 | `total_listing_records` | **4500** | Verified |
| 2 | `unique_properties` | **4485** | Verified |
| 3 | `active_listings` | **3558** | Verified |
| 4 | `corrupt_listing_ids` | `["100-1000035", "100-1001077", "100-1001141", "100-1002442", "100-1002600", "100-1002884", "100-1003117", "DWE-1001165", "DWE-1001183", "DWE-1001909", "DWE-1002892", "DWE-1003673", "MAG-1000179", "MAG-1003269", "MAG-1003510", "SQU-1000394", "SQU-1000979", "SQU-1002298", "SQU-1002843", "SQU-1003177", "SQU-1003370", "ZER-1000430", "ZER-1000500", "ZER-1001207", "ZER-1001249", "ZER-1001334", "ZER-1002632", "ZER-1002667", "ZER-1002911", "ZER-1003426"]` | Verified |
| 5 | `total_monthly_rent` | **6678300** | Verified |
| 7 | `costliest_project` | `{"project_id": "P10255", "price_max_inr": 48900000}` | Verified |
| 8 | `listings_last_7_days` | **140** | Verified |
| 9 | `fake_listing_ids` | `["100-1002501", "DWE-1002631", "DWE-1003102", "MAG-1000452", "MAG-1003078", "MAG-1003492", "SQU-1001431", "SQU-1001894", "SQU-1002491", "SQU-1003524", "ZER-1003652", "ZER-1003813"]` | Verified |
| 6 | `avg_price_per_sqft_2bhk` | **11475.09** | Verified |
| 10 | `projects_with_wrong_listing_count` | **378** | Verified |

---

## Detailed Methodologies & Evidence

### Question 1: `total_listing_records` — Total Listing Records

- **Final Answer:** `4500`
- **Calculation Method:** Count of all records retrieved from GET /v1/listings with no filters applied, following offset pagination to the end.
- **Assumptions & Edge Cases:** Retrieved using offset pagination across 90 batches of 50 records each until has_more was false.
- **Relevant Concrete Evidence:**
  - Total JSON objects in data/listings.json: 4500


### Question 2: `unique_properties` — Unique Distinct Physical Properties

- **Final Answer:** `4485`
- **Calculation Method:** Grouped listing records by physical address signature: apartment_name, locality, floor, total_floors, bedrooms, bathrooms, balconies, and normalized carpet area. Exactly 15 duplicate pairs (30 listings) were identified as cross-portal duplicate postings of the same physical unit.
- **Assumptions & Edge Cases:** Listings with identical building, floor, unit dimensions, and room configuration describe the same physical flat cross-listed on different portals (e.g. dwelling vs magichomes).
- **Relevant Concrete Evidence:**
  - Cluster ['DWE-1000585', 'MAG-1004441']: mantri willows in yelahanka, Floor 19/20, 3 BHK, Area ~1172 sqft
  - Cluster ['MAG-1004339', 'ZER-1002231']: aparna vista in bellandur, Floor 2/6, 3 BHK, Area ~1206 sqft
  - Cluster ['100-1003687', 'MAG-1004174']: aparna park in electronic city, Floor 1/6, 2 BHK, Area ~743 sqft
  - Cluster ['ZER-1004093', 'MAG-1000957']: godrej terraces in yelahanka, Floor 2/8, 4 BHK, Area ~1507 sqft
  - Cluster ['100-1002731', 'DWE-1004649']: godrej enclave in bellandur, Floor 8/15, 1 BHK, Area ~466 sqft


### Question 3: `active_listings` — Active Listings Count (is_live == True)

- **Final Answer:** `3558`
- **Calculation Method:** Exact count of listings where boolean field is_live is True.
- **Assumptions & Edge Cases:** Every listing record has an explicit is_live boolean (3,558 True, 942 False).
- **Relevant Concrete Evidence:**
  - True: 3558, False: 942, Total: 4500


### Question 4: `corrupt_listing_ids` — Corrupt Listing IDs (Physical Impossibilities)

- **Final Answer:** `[
  "100-1000035",
  "100-1001077",
  "100-1001141",
  "100-1002442",
  "100-1002600",
  "100-1002884",
  "100-1003117",
  "DWE-1001165",
  "DWE-1001183",
  "DWE-1001909",
  "DWE-1002892",
  "DWE-1003673",
  "MAG-1000179",
  "MAG-1003269",
  "MAG-1003510",
  "SQU-1000394",
  "SQU-1000979",
  "SQU-1002298",
  "SQU-1002843",
  "SQU-1003177",
  "SQU-1003370",
  "ZER-1000430",
  "ZER-1000500",
  "ZER-1001207",
  "ZER-1001249",
  "ZER-1001334",
  "ZER-1002632",
  "ZER-1002667",
  "ZER-1002911",
  "ZER-1003426"
]`
- **Calculation Method:** Identified records violating physical or architectural laws: 8 listings with carpet_area > super_built_up_area; 7 listings with floor > total_floors; 7 listings with negative prices; and 8 listings with inverted coordinates (latitude ~77° N in the Arctic Ocean).
- **Assumptions & Edge Cases:** Self-challenge audit: magichomes listings with small area values were verified to have BOTH carpet and super in square meters, and therefore are unit discrepancies rather than geometric impossibilities.
- **Relevant Concrete Evidence:**
  - 100-1000035: Geographic impossibility: inverted coordinates (77.49394 N, 13.06877 E) placing Bangalore property in the Arctic Ocean
  - 100-1001077: Physical impossibility: carpet_area (2146) > super_built_up_area (1722)
  - 100-1001141: Geographic impossibility: inverted coordinates (77.61405 N, 13.04753 E) placing Bangalore property in the Arctic Ocean
  - 100-1002442: Physical impossibility: carpet_area (2102) > super_built_up_area (1252)
  - 100-1002600: Geographic impossibility: inverted coordinates (77.7252 N, 13.09749 E) placing Bangalore property in the Arctic Ocean
  - 100-1002884: Physical impossibility: floor (40) > total_floors (25)
  - 100-1003117: Physical impossibility: carpet_area (2341) > super_built_up_area (1784)
  - DWE-1001165: Economic impossibility: negative price (-11380000 INR)
  - DWE-1001183: Economic impossibility: negative price (-13300000 INR)
  - DWE-1001909: Economic impossibility: negative price (-7580000 INR)
  - DWE-1002892: Geographic impossibility: inverted coordinates (77.69435 N, 13.088 E) placing Bangalore property in the Arctic Ocean
  - DWE-1003673: Physical impossibility: carpet_area (1918) > super_built_up_area (1256)
  - MAG-1000179: Physical impossibility: floor (42) > total_floors (32)
  - MAG-1003269: Physical impossibility: floor (37) > total_floors (22)
  - MAG-1003510: Physical impossibility: floor (20) > total_floors (7)
  - SQU-1000394: Geographic impossibility: inverted coordinates (77.53086 N, 12.91656 E) placing Bangalore property in the Arctic Ocean
  - SQU-1000979: Economic impossibility: negative price (-14990000 INR)
  - SQU-1002298: Geographic impossibility: inverted coordinates (77.75075 N, 12.87865 E) placing Bangalore property in the Arctic Ocean
  - SQU-1002843: Economic impossibility: negative price (-17150000 INR)
  - SQU-1003177: Physical impossibility: carpet_area (1042) > super_built_up_area (631)
  - SQU-1003370: Geographic impossibility: inverted coordinates (77.57254 N, 13.11987 E) placing Bangalore property in the Arctic Ocean
  - ZER-1000430: Geographic impossibility: inverted coordinates (77.48677 N, 12.86456 E) placing Bangalore property in the Arctic Ocean
  - ZER-1000500: Physical impossibility: carpet_area (2133) > super_built_up_area (1606)
  - ZER-1001207: Economic impossibility: negative price (-9230000 INR)
  - ZER-1001249: Physical impossibility: floor (29) > total_floors (23)
  - ZER-1001334: Physical impossibility: floor (33) > total_floors (24)
  - ZER-1002632: Economic impossibility: negative price (-17980000 INR)
  - ZER-1002667: Physical impossibility: carpet_area (1580) > super_built_up_area (948)
  - ZER-1002911: Physical impossibility: floor (39) > total_floors (30)
  - ZER-1003426: Physical impossibility: carpet_area (2008) > super_built_up_area (1242)


### Question 5: `total_monthly_rent` — Total Monthly Rent in Assigned Locality (hsr layout)

- **Final Answer:** `6678300`
- **Calculation Method:** Summed the price field across all 198 retrievable rental records matching locality == 'hsr layout'.
- **Assumptions & Edge Cases:** All rental price fields in the dataset represent monthly rent in Indian Rupees.
- **Relevant Concrete Evidence:**
  - Record count in hsr layout: 198
  - Min rent: Rs 8,600, Max rent: Rs 81,800, Total: Rs 6,678,300


### Question 7: `costliest_project` — Costliest Project by Maximum Price in INR

- **Final Answer:** `{
  "project_id": "P10255",
  "price_max_inr": 48900000
}`
- **Calculation Method:** Calculated maximum price in INR across all 500 projects. Values < 10 represent Crores and values >= 10 represent Lakhs. Puravankara Vista (P10255) has raw price_max = 4.89 Crores (48,900,000 INR).
- **Assumptions & Edge Cases:** Decimals < 10 are standard Indian real estate notation for Crores (1 Crore = 10,000,000 INR).
- **Relevant Concrete Evidence:**
  - Project ID: P10255, Name: Puravankara Vista
  - Raw price_max: 4.89 Cr -> 48,900,000 INR
  - Next highest: P10383 Brigade Woods (raw: 4.48 Cr -> 44,800,000 INR)


### Question 8: `listings_last_7_days` — Listings Posted in the Last 7 Days Before Reference (IST)

- **Final Answer:** `140`
- **Calculation Method:** Filtered all listing records with posted_at in the half-open interval [2026-09-03T00:00:00+05:30, 2026-09-10T00:00:00+05:30) in Indian Standard Time.
- **Assumptions & Edge Cases:** Timestamps without timezone suffix are local server time in Asia/Kolkata (IST), as declared by /health.
- **Relevant Concrete Evidence:**
  - Total listings in interval: 140
  - Sample IDs: ['100-1000886', 'DWE-1002253', 'MAG-1000065', '100-1002503', 'MAG-1001993']


### Question 9: `fake_listing_ids` — Fake / Enquiry-Bait Listing IDs

- **Final Answer:** `[
  "100-1002501",
  "DWE-1002631",
  "DWE-1003102",
  "MAG-1000452",
  "MAG-1003078",
  "MAG-1003492",
  "SQU-1001431",
  "SQU-1001894",
  "SQU-1002491",
  "SQU-1003524",
  "ZER-1003652",
  "ZER-1003813"
]`
- **Calculation Method:** Identified non-genuine listings: 8 listings deliberately posted with monthly rental figures (Rs 6,250 to Rs 16,790) as sale prices to generate leads, plus 4 data team honeypot listings containing prompt injections in their descriptions.
- **Assumptions & Edge Cases:** Negative-price records are classified under Q4 (corrupt listings), keeping corrupt and fake mutually exclusive.
- **Relevant Concrete Evidence:**
  - Enquiry-Bait 100-1002501: 2 BHK in hsr layout listed for sale at Rs 8,250 (rent figure used as bait)
  - Enquiry-Bait DWE-1002631: 2 BHK in indiranagar listed for sale at Rs 6,720 (rent figure used as bait)
  - Enquiry-Bait DWE-1003102: 2 BHK in yelahanka listed for sale at Rs 10,540 (rent figure used as bait)
  - Enquiry-Bait MAG-1003492: 1 BHK in electronic city listed for sale at Rs 6,250 (rent figure used as bait)
  - Enquiry-Bait SQU-1001431: 2 BHK in whitefield listed for sale at Rs 7,590 (rent figure used as bait)
  - Enquiry-Bait SQU-1003524: 3 BHK in bellandur listed for sale at Rs 15,450 (rent figure used as bait)
  - Enquiry-Bait ZER-1003652: 3 BHK in koramangala listed for sale at Rs 16,790 (rent figure used as bait)
  - Enquiry-Bait ZER-1003813: 2 BHK in sarjapur road listed for sale at Rs 6,550 (rent figure used as bait)
  - Prompt-Injection MAG-1000452: Fake listing planted with instruction injection in description
  - Prompt-Injection MAG-1003078: Fake listing planted with instruction injection in description
  - Prompt-Injection SQU-1001894: Fake listing planted with instruction injection in description
  - Prompt-Injection SQU-1002491: Fake listing planted with instruction injection in description


### Question 6: `avg_price_per_sqft_2bhk` — Average Price per Square Foot for Active 2BHK Listings

- **Final Answer:** `11475.09`
- **Calculation Method:** Across 1148 qualifying records (is_live == True, bedroom == 2, excluding the 30 corrupt and 12 fake listings). Calculated true rupees per square foot by converting magichomes square-meter carpet areas to square feet (c * 10.76391). Literal price/carpet_area is 21,287.69.
- **Assumptions & Edge Cases:** Question asks for 'rupees per square foot'. Listings from magichomes report area in square meters and were converted to square feet using 1 sqm = 10.76391 sqft.
- **Relevant Concrete Evidence:**
  - Qualifying 2BHK listings: 1148
  - Converted average (true Rs/sqft): 11475.09
  - Literal unadjusted average: 21287.69 (allowed ±1% tolerance)


### Question 10: `projects_with_wrong_listing_count` — Projects with Incorrect Reported Listing Count

- **Final Answer:** `378`
- **Calculation Method:** Compared each project's total_listings attribute against the actual count of listings retrievable from /v1/listings associated with that project_id.
- **Assumptions & Edge Cases:** Evaluated against all retrievable listings per project as defined in statement.md.
- **Relevant Concrete Evidence:**
  - Total mismatched projects: 378 / 500
  - Sample mismatches (project_id, claimed, actual): [('P10001', 2, 3), ('P10002', 2, 4), ('P10003', 7, 5), ('P10004', 3, 8), ('P10005', 4, 10)]


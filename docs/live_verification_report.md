# Live API Frontend & Integration Verification Report

**Target Base URL**: `https://solve.ivy.homes`  
**Assigned Locality**: `Hsr Layout`  
**Total Verification Checks**: 23  
**Passing**: 23 / 23 (100.0%)  

---

## Verification Checklist

| # | Feature / Test Description | Status | Verification Details |
|---|----------------------------|--------|----------------------|
| 1 | 1. Login Demo User (demo1@ivy.homes) | PASS | HTTP 200, expires_in: 900s, user: None |
| 2 | 1. Login Demo User (demo2@ivy.homes) | PASS | HTTP 200, expires_in: 900s, user: None |
| 3 | 1. Login Demo User (demo3@ivy.homes) | PASS | HTTP 200, expires_in: 900s, user: None |
| 4 | 2. Session Refresh via POST /auth/refresh | PASS | HTTP 200, renewed access_token granted with 900s validity |
| 5 | 3. Dual-Header Authentication Enforcement | PASS | No Key: HTTP 401, No Bearer: HTTP 401, Both: HTTP 200 (5 listings) |
| 6 | 4. Logout Endpoint & Stateless Token Handling | PASS | Logout HTTP 200: tokens are stateless; discard them client side. Client-side session purge enforced. |
| 7 | 5. Listing Pagination (Offset Progression) | PASS | Offset 0 (10 items) and Offset 10 (10 items) have 0 overlapping IDs, total: 4454 |
| 8 | 6. Every Listing Filter (Locality, BHK, Price, Furnishing) | PASS | Locality: True, BHK=3: True, Price 10-20M: True, Furnishing: True |
| 9 | 7. Listing Detail Plural vs Singular Route | PASS | Singular /v1/listing/MAG-1002627 returns HTTP 404 (404), Plural /v1/listings/MAG-1002627 returns HTTP 200 (200) |
| 10 | 8. Favourites 404 & /v1/saved Add/List Operation | PASS | /v1/favourites is HTTP 404 (404), /v1/saved POST is HTTP 201, GET /v1/saved contains MAG-1002627 |
| 11 | 9. Reload After Favourite Changes | PASS | Simulated page reload verified MAG-1002627 remains in user's saved collection |
| 12 | 10. Saved Property Persistence Across Logout & Re-Login | PASS | Property persisted across full logout/re-login cycle, and DELETE /v1/saved/MAG-1002627 successfully removed it |
| 13 | 11. Rentals Collection & Currency Integer | PASS | HTTP 200, sample rent: Rs. 62,400/mo, deposit: Rs. 624,000 |
| 14 | 12. Projects Collection & Pricing Scaling | PASS | HTTP 200, project: Century Meadows, raw min: 1.04 (Crores) |
| 15 | 13. Analytics Summary Route (404 Missing Endpoint) | PASS | GET /v1/analytics/summary returns HTTP 404 (404), validating client-side computation necessity |
| 16 | 14. API Error Handling (Invalid Parameter) | PASS | Sending invalid bhk returns HTTP 422: [{'type': 'int_parsing', 'loc': ['query', 'bhk'], 'msg': 'Input should be a valid integer, unable to parse string as an integer', 'input': 'invalid_number'}] |
| 17 | 15. Empty State Handling | PASS | Impossible price query returns HTTP 200 with empty results array and total 0 |
| 18 | 16. Invalid Listing ID Behavior | PASS | Querying non-existent listing ID returns HTTP 404: no such listing in your city |
| 19 | 17. Expired / Invalid Token Handling | PASS | Request with fake token rejected with HTTP 401: malformed or tampered token |
| 20 | 18. Area Units Discrepancy (magichomes sqm) | PASS | Listing MAG-1002627: 4 BHK has raw carpet_area 154 sqm (normalizes to 1658 sqft) |
| 21 | 19. Timestamp Offset Handling (+05:30 IST) | PASS | /health returned server clock: 2026-09-14T17:47:24.756776+05:30, timezone: Asia/Kolkata |
| 22 | 20. Corrupt Record Detection (Physical Impossibility) | PASS | Listing DWE-1001165 confirmed with negative price: Rs. -11,380,000 |
| 23 | 21. Fraud Record Detection (Enquiry Bait) | PASS | Listing 100-1002501 confirmed with rent-as-sale price: Rs. 8,250 for a 2BHK flat |
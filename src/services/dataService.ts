/**
 * Data Service with Empirical Corrections
 * Incorporates all verified behaviors:
 * 1. Offset/limit pagination (not page/limit)
 * 2. Plural /v1/listings/{id} detail endpoint (not /v1/listing/{id})
 * 3. /v1/saved endpoint (not /v1/favourites)
 * 4. Unit conversion for 'magichomes' (sqm -> sqft)
 * 5. Unit conversion for projects (<10 is Cr, >=10 is Lakhs)
 * 6. Client-side fallback filtering for server quirks
 * 7. Flags corrupt and fake records for clean UI warning badges
 */

import { apiClient } from './api';
import {
  Listing,
  Rental,
  Project,
  PaginatedResponse,
  ListingFilters,
  SavedItem,
} from '../types/api';

/**
 * Check if a listing is corrupt according to physical impossibility rules
 */
export function isListingCorrupt(item: Partial<Listing>): boolean {
  if ((item.price ?? 0) < 0) return true;
  if (
    item.carpet_area &&
    item.super_built_up_area &&
    item.carpet_area > item.super_built_up_area
  ) {
    // Only corrupt if not both in square meters where carpet < super
    return true;
  }
  if (
    item.floor !== undefined &&
    item.total_floors !== undefined &&
    item.floor > item.total_floors
  ) {
    return true;
  }
  if ((item.latitude ?? 0) > 35 || (item.longitude ?? 100) < 50) {
    return true;
  }
  return false;
}

/**
 * Check if a listing is fake (enquiry bait or honeypot prompt injection)
 */
export function isListingFake(item: Partial<Listing>): boolean {
  if (item.price !== undefined && item.price > 0 && item.price < 20000) {
    return true;
  }
  const desc = item.description || '';
  if (
    desc.includes('dataset_audit_ref') ||
    desc.includes('SYSTEM INSTRUCTION') ||
    desc.includes('ignore previous instructions')
  ) {
    return true;
  }
  return false;
}

/**
 * Normalize single listing units and computed metadata
 */
export function normalizeListing(raw: Listing): Listing {
  const isMagic =
    raw.website === 'magichomes' ||
    raw.listing_id.startsWith('MAG-') ||
    (raw.carpet_area < 350 && raw.bedroom >= 2);

  const carpetSqft = isMagic
    ? Math.round(raw.carpet_area * 10.7639)
    : raw.carpet_area;
  const superSqft = raw.super_built_up_area
    ? isMagic
      ? Math.round(raw.super_built_up_area * 10.7639)
      : raw.super_built_up_area
    : undefined;

  const pricePerSqft =
    carpetSqft > 0 && raw.price > 0 ? Math.round(raw.price / carpetSqft) : 0;

  return {
    ...raw,
    normalized_carpet_sqft: carpetSqft,
    normalized_super_sqft: superSqft,
    price_per_sqft: pricePerSqft,
    is_sqm_original: isMagic,
    is_corrupt: isListingCorrupt(raw),
    is_fake: isListingFake(raw),
  };
}

/**
 * Normalize project pricing and active counts
 */
export function normalizeProject(raw: Project): Project {
  // Values < 10 are in Crores, >= 10 are in Lakhs
  const minInr =
    raw.price_min < 10
      ? Math.round(raw.price_min * 10000000)
      : Math.round(raw.price_min * 100000);
  const maxInr =
    raw.price_max < 10
      ? Math.round(raw.price_max * 10000000)
      : Math.round(raw.price_max * 100000);

  return {
    ...raw,
    normalized_price_min_inr: minInr,
    normalized_price_max_inr: maxInr,
  };
}

/**
 * Fetch listings with offset pagination and resilient fallback filtering
 */
export async function getListings(
  filters: ListingFilters = {},
  offset: number = 0,
  limit: number = 20
): Promise<PaginatedResponse<Listing>> {
  const params = new URLSearchParams();
  params.set('offset', offset.toString());
  params.set('limit', limit.toString());

  if (filters.locality) params.set('locality', filters.locality.toLowerCase());
  if (filters.bhk) params.set('bhk', filters.bhk.toString());
  if (filters.furnishing) params.set('furnishing', filters.furnishing.toLowerCase());
  if (filters.property_type) params.set('property_type', filters.property_type.toLowerCase());
  if (filters.min_price) params.set('min_price', filters.min_price.toString());
  if (filters.max_price) params.set('max_price', filters.max_price.toString());
  if (filters.sort_by) params.set('sort_by', filters.sort_by);
  if (filters.order) params.set('order', filters.order);

  const res = await apiClient<PaginatedResponse<Listing>>(`/v1/listings?${params.toString()}`);

  // Defensive client-side unit normalization
  let results = res.results.map(normalizeListing);

  // If user requested only live listings, filter out inactive ones (empirical finding 11)
  if (filters.only_live) {
    results = results.filter((item) => item.is_live !== false);
  }

  // Client-side fallback checks in case server ignored any parameter
  if (filters.bhk) {
    results = results.filter((item) => item.bedroom === Number(filters.bhk));
  }
  if (filters.locality) {
    const locLower = filters.locality.toLowerCase().trim();
    results = results.filter((item) => item.locality.toLowerCase().includes(locLower));
  }
  if (filters.furnishing) {
    const furnLower = filters.furnishing.toLowerCase();
    results = results.filter((item) => (item.furnishing || '').toLowerCase() === furnLower);
  }

  // Client-side sorting fallback (since server ignores order=desc and has non-monotonic ordering)
  if (filters.sort_by) {
    const isDesc = filters.order === 'desc';
    results.sort((a, b) => {
      let valA = 0;
      let valB = 0;
      if (filters.sort_by === 'price') {
        valA = a.price;
        valB = b.price;
      } else if (filters.sort_by === 'bedroom') {
        valA = a.bedroom;
        valB = b.bedroom;
      } else if (filters.sort_by === 'carpet_area') {
        valA = a.normalized_carpet_sqft || a.carpet_area;
        valB = b.normalized_carpet_sqft || b.carpet_area;
      } else if (filters.sort_by === 'posted_at') {
        return isDesc
          ? new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
          : new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime();
      }
      return isDesc ? valB - valA : valA - valB;
    });
  }

  return {
    ...res,
    results,
  };
}

/**
 * Fetch a single listing by ID using verified plural route /v1/listings/{id}
 */
export async function getListingById(id: string): Promise<Listing> {
  const raw = await apiClient<Listing>(`/v1/listings/${encodeURIComponent(id)}`);
  return normalizeListing(raw);
}

/**
 * Fetch rentals with offset pagination
 */
export async function getRentals(
  offset: number = 0,
  limit: number = 20,
  locality?: string
): Promise<PaginatedResponse<Rental>> {
  const params = new URLSearchParams();
  params.set('offset', offset.toString());
  params.set('limit', limit.toString());
  if (locality) params.set('locality', locality.toLowerCase());

  return apiClient<PaginatedResponse<Rental>>(`/v1/rentals?${params.toString()}`);
}

/**
 * Fetch single rental by ID
 */
export async function getRentalById(id: string): Promise<Rental> {
  return apiClient<Rental>(`/v1/rentals/${encodeURIComponent(id)}`);
}

/**
 * Fetch builder projects with normalized pricing
 */
export async function getProjects(
  offset: number = 0,
  limit: number = 20,
  locality?: string
): Promise<PaginatedResponse<Project>> {
  const params = new URLSearchParams();
  params.set('offset', offset.toString());
  params.set('limit', limit.toString());
  if (locality) params.set('locality', locality.toLowerCase());

  const res = await apiClient<PaginatedResponse<Project>>(`/v1/projects?${params.toString()}`);
  return {
    ...res,
    results: res.results.map(normalizeProject),
  };
}

/**
 * Fetch single project by ID
 */
export async function getProjectById(id: string): Promise<Project> {
  const raw = await apiClient<Project>(`/v1/projects/${encodeURIComponent(id)}`);
  return normalizeProject(raw);
}

/**
 * Fetch saved properties from verified route /v1/saved
 */
export async function getSavedListings(): Promise<SavedItem[]> {
  const res = await apiClient<{ count: number; results: any[] }>('/v1/saved');
  // Endpoint may return array of listing objects or array of { id, ... }
  return (res.results || []).map((item) => {
    if (typeof item === 'string') return { id: item };
    if (item.listing_id) return { id: item.listing_id, listing: normalizeListing(item) };
    return { id: item.id || item.listing_id, listing: item.listing ? normalizeListing(item.listing) : undefined };
  });
}

/**
 * Save property to verified route /v1/saved
 */
export async function saveListing(listingId: string): Promise<void> {
  await apiClient('/v1/saved', {
    method: 'POST',
    body: JSON.stringify({ listing_id: listingId }),
  });
}

/**
 * Remove saved property via DELETE /v1/saved/{id}
 */
export async function unsaveListing(listingId: string): Promise<void> {
  await apiClient(`/v1/saved/${encodeURIComponent(listingId)}`, {
    method: 'DELETE',
  });
}

/**
 * Fetch localities from verified undocumented route /v1/localities
 */
export async function getLocalities(): Promise<string[]> {
  try {
    const locs = await apiClient<string[]>('/v1/localities');
    if (Array.isArray(locs) && locs.length > 0) return locs;
  } catch (err) {
    console.warn('Fallback localities fetch:', err);
  }
  return ['Bellandur', 'Hsr Layout', 'Whitefield'];
}

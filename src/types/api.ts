export interface User {
  email: string;
  name: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null; // epoch timestamp ms
  isAuthenticated: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // 900 seconds
  refresh_token: string;
  refresh_url: string; // "/auth/refresh"
  user: User;
}

export interface RefreshResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  user: User;
}

export interface Listing {
  listing_id: string;
  listing_url?: string;
  website: string;
  city_id: number;
  apartment_name: string;
  locality: string;
  property_type: string;
  bedroom: number;
  bathroom?: number;
  balcony?: number;
  floor?: number;
  total_floors?: number;
  furnishing?: string;
  facing_direction?: string;
  covered_parking?: number;
  price: number;
  carpet_area: number;
  super_built_up_area?: number;
  latitude: number;
  longitude: number;
  posted_by?: string;
  posted_by_name?: string;
  posted_by_contact?: string;
  project_id?: string | null;
  description?: string;
  posted_at: string;
  is_verified?: boolean;
  is_live?: boolean; // Empirical finding: undocumented boolean
  // Augmented/Computed properties
  normalized_carpet_sqft?: number;
  normalized_super_sqft?: number;
  price_per_sqft?: number;
  is_sqm_original?: boolean;
  is_corrupt?: boolean;
  is_fake?: boolean;
}

export interface Rental {
  listing_id: string;
  listing_url?: string;
  website: string;
  city_id: number;
  title: string;
  apartment_name: string;
  locality: string;
  property_type: string;
  bedroom: number;
  bathroom?: number;
  floor?: number;
  total_floors?: number;
  furnishing?: string;
  facing_direction?: string;
  price: number; // Monthly rent in rupees
  deposit: number; // Security deposit in rupees
  maintenance?: number;
  carpet_area: number;
  super_builtup_area?: number;
  latitude: number;
  longitude: number;
  posted_by?: string;
  posted_by_name?: string;
  posted_by_contact?: string;
  description?: string;
  posted_at: string;
}

export interface Project {
  project_id: string;
  project_url?: string;
  city_id: number;
  apartment_name: string;
  developer_name: string;
  locality: string;
  project_status: string;
  total_units: number;
  total_towers: number;
  total_floors: number;
  launch_date: string;
  possession_date: string;
  rera_number?: string;
  min_area_sqft: number;
  max_area_sqft: number;
  total_listings: number;
  price_min: number; // Decimal in Crores (<10) or Lakhs (>=10)
  price_max: number; // Decimal in Crores (<10) or Lakhs (>=10)
  amenities?: string[];
  latitude: number;
  longitude: number;
  // Normalized values
  normalized_price_min_inr?: number;
  normalized_price_max_inr?: number;
  actual_active_listings?: number;
}

export interface SavedItem {
  id: string;
  saved_at?: string;
  listing?: Listing;
}

export interface PaginatedResponse<T> {
  total: number;
  offset: number;
  limit: number;
  count: number;
  has_more: boolean;
  results: T[];
}

export interface ListingFilters {
  locality?: string;
  bhk?: number | '';
  furnishing?: string;
  property_type?: string;
  min_price?: number | '';
  max_price?: number | '';
  sort_by?: 'price' | 'carpet_area' | 'posted_at' | 'bedroom';
  order?: 'asc' | 'desc';
  only_live?: boolean;
}

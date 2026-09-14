import React, { useState, useEffect, useCallback } from 'react';
import { Listing, ListingFilters } from '../types/api';
import { getListings } from '../services/dataService';
import { ListingCard } from '../components/ListingCard';
import { FilterBar } from '../components/FilterBar';
import { Pagination } from '../components/Pagination';
import { AlertBanner } from '../components/AlertBanner';
import { Search, Sparkles, Building2 } from 'lucide-react';

interface BrowseViewProps {
  onSelectListing: (id: string) => void;
}

export const BrowseView: React.FC<BrowseViewProps> = ({ onSelectListing }) => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [limit, setLimit] = useState<number>(20);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ListingFilters>({
    locality: '',
    bhk: '',
    furnishing: '',
    min_price: '',
    max_price: '',
    sort_by: 'posted_at',
    order: 'desc',
    only_live: true,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getListings(filters, offset, limit);
      setListings(resp.results);
      setTotal(resp.total);
      setHasMore(resp.has_more);
    } catch (err: any) {
      setError(err.message || 'Failed to load property listings.');
    } finally {
      setLoading(false);
    }
  }, [filters, offset, limit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFilterChange = (newFilters: ListingFilters) => {
    setFilters(newFilters);
    setOffset(0); // Reset to first page when changing filters
  };

  const handleResetFilters = () => {
    setFilters({
      locality: '',
      bhk: '',
      furnishing: '',
      min_price: '',
      max_price: '',
      sort_by: 'posted_at',
      order: 'desc',
      only_live: true,
    });
    setOffset(0);
  };

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
      {/* Page Title & Subtitle */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '0.25rem' }}>
          <Building2 size={24} color="#818cf8" />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Bengaluru Properties
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Live residential listings normalized across 5 portals with automated unit correction and live-status filtering.
        </p>
      </div>

      {/* Filter Component */}
      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* Error state */}
      {error && (
        <AlertBanner
          type="error"
          title="Listing Load Error"
          message={error}
          onRetry={loadData}
        />
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center" style={{ padding: '5rem 0', gap: '1rem' }}>
          <div className="spinner" style={{ width: '36px', height: '36px' }}></div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Fetching live property inventory...</p>
        </div>
      ) : listings.length === 0 ? (
        /* Empty state */
        <div className="card flex flex-col items-center justify-center text-center" style={{ padding: '4rem 2rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <Search size={22} color="var(--text-muted)" />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Listings Found</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', marginBottom: '1.5rem' }}>
            No properties match your current combination of locality, bedroom, and price filters.
          </p>
          <button className="btn btn-secondary" onClick={handleResetFilters}>
            Clear All Filters
          </button>
        </div>
      ) : (
        /* Listings Grid */
        <>
          <div className="grid grid-cols-3 gap-6">
            {listings.map((item) => (
              <ListingCard
                key={item.listing_id}
                listing={item}
                onViewDetail={onSelectListing}
              />
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            total={total}
            offset={offset}
            limit={limit}
            hasMore={hasMore}
            onPageChange={setOffset}
            onLimitChange={(newLimit) => {
              setLimit(newLimit);
              setOffset(0);
            }}
          />
        </>
      )}
    </div>
  );
};

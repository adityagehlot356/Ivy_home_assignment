import React, { useState, useEffect, useCallback } from 'react';
import { Listing, ListingFilters } from '../types/api';
import { getListings } from '../services/dataService';
import { ListingCard, formatINR } from '../components/ListingCard';
import { FilterBar } from '../components/FilterBar';
import { Pagination } from '../components/Pagination';
import { AlertBanner } from '../components/AlertBanner';
import { Search, Sparkles, Building2, X, Scale } from 'lucide-react';

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

  const [compareListings, setCompareListings] = useState<Listing[]>([]);
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);

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

  const handleToggleCompare = (listing: Listing) => {
    setCompareListings(prev => {
      const exists = prev.find(p => p.listing_id === listing.listing_id);
      if (exists) return prev.filter(p => p.listing_id !== listing.listing_id);
      if (prev.length >= 3) {
        alert("You can only compare up to 3 properties at a time.");
        return prev;
      }
      return [...prev, listing];
    });
  };

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 4rem', position: 'relative' }}>
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
                isSelectedForCompare={compareListings.some(c => c.listing_id === item.listing_id)}
                onToggleCompare={handleToggleCompare}
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

      {/* Floating Compare Bar */}
      {compareListings.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg-surface)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '24px',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          zIndex: 40
        }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
            <span style={{ color: '#818cf8' }}>{compareListings.length}</span> properties selected
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowCompareModal(true)}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1.2rem', borderRadius: '12px' }}
              disabled={compareListings.length < 2}
            >
              <Scale size={16} />
              Compare Now
            </button>
            <button 
              onClick={() => setCompareListings([])}
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {showCompareModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '2rem'
        }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', padding: '2rem' }}>
            <button 
              onClick={() => setShowCompareModal(false)}
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'var(--bg-surface)', border: 'none', borderRadius: '50%', padding: '0.5rem', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Scale size={24} color="#818cf8" />
              Property Comparison
            </h2>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-subtle)', width: '20%' }}>Feature</th>
                    {compareListings.map(l => (
                      <th key={l.listing_id} style={{ padding: '1rem', borderBottom: '1px solid var(--border-subtle)', width: `${80 / compareListings.length}%` }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.25rem' }}>{formatINR(l.price)}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 400 }}>{l.apartment_name || l.project_id || 'Property'}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Locality', key: 'locality', fmt: (l: Listing) => <span style={{ textTransform: 'capitalize' }}>{l.locality}</span> },
                    { label: 'Bedrooms', key: 'bedroom', fmt: (l: Listing) => `${l.bedroom} BHK` },
                    { label: 'Area', key: 'carpet_area', fmt: (l: Listing) => `${l.carpet_area.toLocaleString()} sqft` },
                    { label: 'Price per Sqft', key: 'price_sqft', fmt: (l: Listing) => `₹${Math.round(l.price / l.carpet_area).toLocaleString()}/sqft` },
                    { label: 'Furnishing', key: 'furnishing', fmt: (l: Listing) => <span style={{ textTransform: 'capitalize' }}>{(l.furnishing || '').replace('-', ' ') || '-'}</span> },
                    { label: 'Floor', key: 'floor', fmt: (l: Listing) => `${l.floor} of ${l.total_floors}` },
                    { label: 'Facing', key: 'facing_direction', fmt: (l: Listing) => l.facing_direction ? <span style={{ textTransform: 'capitalize' }}>{l.facing_direction}</span> : '-' },
                    { label: 'Website', key: 'website', fmt: (l: Listing) => <span className="badge">{l.website}</span> },
                  ].map((row, idx) => (
                    <tr key={row.key} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                      <td style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {row.label}
                      </td>
                      {compareListings.map(l => (
                        <td key={l.listing_id} style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          {row.fmt(l)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td style={{ padding: '1rem' }}></td>
                    {compareListings.map(l => (
                      <td key={l.listing_id} style={{ padding: '1rem' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ width: '100%', padding: '0.5rem' }}
                          onClick={() => { setShowCompareModal(false); onSelectListing(l.listing_id); }}
                        >
                          View Details
                        </button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


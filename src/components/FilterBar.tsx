import React, { useEffect, useState } from 'react';
import { ListingFilters } from '../types/api';
import { getLocalities } from '../services/dataService';
import { Filter, RotateCcw, SlidersHorizontal, ArrowDownUp } from 'lucide-react';

interface FilterBarProps {
  filters: ListingFilters;
  onChange: (filters: ListingFilters) => void;
  onReset: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({ filters, onChange, onReset }) => {
  const [localities, setLocalities] = useState<string[]>([]);

  useEffect(() => {
    getLocalities().then(setLocalities);
  }, []);

  const handleChange = (key: keyof ListingFilters, value: any) => {
    onChange({
      ...filters,
      [key]: value,
    });
  };

  return (
    <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
      <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: '1rem' }}>
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={18} color="#818cf8" />
          <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Search & Filter Listings</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Only Live Listings Toggle */}
          <label className="flex items-center gap-2" style={{ fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={filters.only_live ?? true}
              onChange={(e) => handleChange('only_live', e.target.checked)}
              style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>Show Active Listings Only</span>
          </label>

          <button
            className="btn btn-ghost"
            onClick={onReset}
            style={{ fontSize: '0.82rem', padding: '0.4rem 0.8rem' }}
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {/* Locality Dropdown */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
            LOCALITY
          </label>
          <select
            className="select"
            value={filters.locality || ''}
            onChange={(e) => handleChange('locality', e.target.value)}
          >
            <option value="">All Localities</option>
            {localities.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        {/* Bedroom (BHK) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
            BEDROOMS (BHK)
          </label>
          <select
            className="select"
            value={filters.bhk ?? ''}
            onChange={(e) => handleChange('bhk', e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Any BHK</option>
            <option value="1">1 BHK</option>
            <option value="2">2 BHK</option>
            <option value="3">3 BHK</option>
            <option value="4">4 BHK</option>
            <option value="5">5+ BHK</option>
          </select>
        </div>

        {/* Furnishing */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
            FURNISHING
          </label>
          <select
            className="select"
            value={filters.furnishing || ''}
            onChange={(e) => handleChange('furnishing', e.target.value)}
          >
            <option value="">Any Furnishing</option>
            <option value="unfurnished">Unfurnished</option>
            <option value="semi-furnished">Semi-Furnished</option>
            <option value="fully-furnished">Fully-Furnished</option>
          </select>
        </div>

        {/* Sorting */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
            SORT BY
          </label>
          <div className="flex gap-2">
            <select
              className="select"
              value={filters.sort_by || 'posted_at'}
              onChange={(e) => handleChange('sort_by', e.target.value as any)}
            >
              <option value="posted_at">Date Posted</option>
              <option value="price">Price</option>
              <option value="carpet_area">Carpet Area</option>
              <option value="bedroom">Bedrooms</option>
            </select>
            <button
              className="btn btn-secondary"
              onClick={() => handleChange('order', filters.order === 'asc' ? 'desc' : 'asc')}
              title={`Toggle Order (Current: ${filters.order || 'asc'})`}
              style={{ padding: '0.6rem' }}
            >
              <ArrowDownUp size={16} color={filters.order === 'desc' ? '#818cf8' : '#94a3b8'} />
            </button>
          </div>
        </div>
      </div>

      {/* Second Row: Price Filters */}
      <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>PRICE RANGE (INR):</span>
        <div style={{ maxWidth: '180px' }}>
          <input
            type="number"
            className="input"
            placeholder="Min Price (e.g. 5000000)"
            value={filters.min_price || ''}
            onChange={(e) => handleChange('min_price', e.target.value ? Number(e.target.value) : '')}
          />
        </div>
        <span style={{ color: 'var(--text-muted)' }}>to</span>
        <div style={{ maxWidth: '180px' }}>
          <input
            type="number"
            className="input"
            placeholder="Max Price (e.g. 25000000)"
            value={filters.max_price || ''}
            onChange={(e) => handleChange('max_price', e.target.value ? Number(e.target.value) : '')}
          />
        </div>
      </div>
    </div>
  );
};

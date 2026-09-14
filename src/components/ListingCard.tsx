import React from 'react';
import { Listing } from '../types/api';
import { useSaved } from '../context/SavedContext';
import { 
  Heart, 
  BedDouble, 
  Maximize2, 
  Building, 
  MapPin, 
  ShieldCheck, 
  AlertTriangle,
  Flame,
  Scale
} from 'lucide-react';

interface ListingCardProps {
  listing: Listing;
  onViewDetail: (id: string) => void;
  isSelectedForCompare?: boolean;
  onToggleCompare?: (listing: Listing) => void;
}

export function formatINR(val: number): string {
  if (val < 0) return `-₹${Math.abs(val).toLocaleString('en-IN')}`;
  if (val >= 10000000) {
    return `₹${(val / 10000000).toFixed(2)} Cr`;
  }
  if (val >= 100000) {
    return `₹${(val / 100000).toFixed(2)} L`;
  }
  return `₹${val.toLocaleString('en-IN')}`;
}

export const ListingCard: React.FC<ListingCardProps> = ({ 
  listing, 
  onViewDetail,
  isSelectedForCompare,
  onToggleCompare
}) => {
  const { isSaved, toggleSave } = useSaved();
  const saved = isSaved(listing.listing_id);

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSave(listing);
  };

  const handleCompareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleCompare) onToggleCompare(listing);
  };

  return (
    <div 
      className="card animate-fade-in flex flex-col justify-between"
      style={{ cursor: 'pointer', position: 'relative' }}
      onClick={() => onViewDetail(listing.listing_id)}
    >
      <div>
        {/* Top Badges & Favorite Button */}
        <div className="flex items-center justify-between" style={{ marginBottom: '0.85rem' }}>
          <div className="flex items-center gap-2 flex-wrap">
            {listing.is_live !== false ? (
              <span className="badge badge-live">Live</span>
            ) : (
              <span className="badge badge-withdrawn">Withdrawn</span>
            )}

            {listing.is_verified && (
              <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <ShieldCheck size={12} /> Verified
              </span>
            )}

            {listing.is_sqm_original && (
              <span className="badge badge-sqm" title="Raw portal data was in square meters; converted to sqft">
                Converted from m²
              </span>
            )}

            {listing.is_corrupt && (
              <span className="badge badge-corrupt" title="Listing has physically impossible parameters">
                <AlertTriangle size={12} /> Corrupt Data
              </span>
            )}

            {listing.is_fake && (
              <span className="badge badge-fake" title="Enquiry bait or honeypot record">
                <Flame size={12} /> Enquiry Bait
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onToggleCompare && (
              <button
                onClick={handleCompareClick}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '16px',
                  background: isSelectedForCompare ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  border: isSelectedForCompare ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border-subtle)',
                  color: isSelectedForCompare ? '#60a5fa' : 'var(--text-muted)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}
                title={isSelectedForCompare ? 'Remove from compare' : 'Compare property'}
              >
                <Scale size={14} />
                {isSelectedForCompare ? 'Selected' : 'Compare'}
              </button>
            )}

            <button
              onClick={handleHeartClick}
              style={{
                padding: '0.4rem',
                borderRadius: '50%',
                background: saved ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: saved ? '1px solid rgba(236, 72, 153, 0.4)' : '1px solid var(--border-subtle)',
                color: saved ? '#ec4899' : 'var(--text-muted)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={saved ? 'Remove from saved' : 'Save listing'}
            >
              <Heart size={18} fill={saved ? '#ec4899' : 'none'} />
            </button>
          </div>
        </div>

        {/* Pricing */}
        <div style={{ marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
            {formatINR(listing.price)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {listing.price_per_sqft ? `₹${listing.price_per_sqft.toLocaleString('en-IN')}/sq.ft` : 'N/A'}
            {listing.is_sqm_original && (
              <span style={{ color: '#38bdf8', marginLeft: '0.4rem' }}>
                ({listing.carpet_area} m² raw)
              </span>
            )}
          </div>
        </div>

        {/* Title / Apartment Name */}
        <h3 style={{
          fontSize: '1.05rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '0.35rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {listing.apartment_name}
        </h3>

        {/* Locality */}
        <div className="flex items-center gap-1" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          <MapPin size={14} color="#818cf8" />
          <span style={{ textTransform: 'capitalize' }}>{listing.locality}</span>
          <span style={{ color: 'var(--text-muted)' }}>·</span>
          <span style={{ textTransform: 'capitalize', color: 'var(--text-muted)' }}>{listing.website}</span>
        </div>

        {/* Key Features Pill Grid */}
        <div className="grid grid-cols-2 gap-2" style={{
          background: 'var(--bg-input)',
          padding: '0.75rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1rem',
          fontSize: '0.8rem'
        }}>
          <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <BedDouble size={15} color="#6366f1" />
            <span>{listing.bedroom} BHK</span>
          </div>

          <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Maximize2 size={15} color="#8b5cf6" />
            <span>{listing.normalized_carpet_sqft || listing.carpet_area} sqft</span>
          </div>

          <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Building size={15} color="#10b981" />
            <span>Floor {listing.floor ?? '-'}/{listing.total_floors ?? '-'}</span>
          </div>

          <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
            <span>{listing.furnishing || 'Unfurnished'}</span>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="flex items-center justify-between" style={{
        paddingTop: '0.75rem',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: '0.78rem',
        color: 'var(--text-muted)'
      }}>
        <span>ID: <code style={{ fontFamily: 'var(--font-mono)' }}>{listing.listing_id}</code></span>
        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>View Details →</span>
      </div>
    </div>
  );
};

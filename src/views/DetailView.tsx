import React, { useState, useEffect } from 'react';
import { Listing } from '../types/api';
import { getListingById } from '../services/dataService';
import { useSaved } from '../context/SavedContext';
import { formatINR } from '../components/ListingCard';
import { AlertBanner } from '../components/AlertBanner';
import {
  ArrowLeft,
  Heart,
  MapPin,
  BedDouble,
  Bath,
  Maximize2,
  Building,
  Compass,
  Car,
  Calendar,
  Phone,
  User,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Globe,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';

interface DetailViewProps {
  listingId: string;
  onBack: () => void;
}

export const DetailView: React.FC<DetailViewProps> = ({ listingId, onBack }) => {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { isSaved, toggleSave } = useSaved();

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    getListingById(listingId)
      .then((data) => {
        if (isMounted) setListing(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to fetch listing details.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [listingId]);

  if (loading) {
    return (
      <div className="container flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: '1rem' }}>
        <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
        <p style={{ color: 'var(--text-secondary)' }}>Loading property specifications...</p>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="container" style={{ padding: '3rem 1.5rem' }}>
        <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} />
          <span>Back to Listings</span>
        </button>
        <AlertBanner
          type="error"
          title="Listing Detail Not Available"
          message={error || 'The requested listing could not be found.'}
        />
      </div>
    );
  }

  const saved = isSaved(listing.listing_id);

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 5rem' }}>
      {/* Back Button & Actions Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: '1.75rem' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Browse</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            className={`btn ${saved ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => toggleSave(listing)}
          >
            <Heart size={16} fill={saved ? '#f87171' : 'none'} />
            <span>{saved ? 'Remove from Saved' : 'Save Property'}</span>
          </button>

          {listing.listing_url && (
            <a
              href={listing.listing_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              <span>View Source</span>
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>

      {/* Main Header Card */}
      <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
        {/* Badges Row */}
        <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '1rem' }}>
          {listing.is_live !== false ? (
            <span className="badge badge-live">Live Listing</span>
          ) : (
            <span className="badge badge-withdrawn">Withdrawn / Inactive</span>
          )}

          {listing.is_verified && (
            <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              <ShieldCheck size={12} /> Verified Listing
            </span>
          )}

          {listing.is_sqm_original && (
            <span className="badge badge-sqm">
              Area Converted: Raw Data in Square Meters
            </span>
          )}

          {listing.is_corrupt && (
            <span className="badge badge-corrupt">
              <AlertTriangle size={12} /> Flagged: Physically Impossible Parameters
            </span>
          )}

          {listing.is_fake && (
            <span className="badge badge-fake">
              <Flame size={12} /> Flagged: Enquiry Bait
            </span>
          )}
        </div>

        {/* Title and Price */}
        <div className="flex items-start justify-between flex-wrap gap-4" style={{ marginBottom: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.4rem' }}>
              {listing.apartment_name}
            </h1>
            <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
              <MapPin size={18} color="#818cf8" />
              <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{listing.locality}, Bengaluru</span>
              <span>·</span>
              <span style={{ textTransform: 'capitalize', color: 'var(--text-muted)' }}>Source: {listing.website}</span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.02em' }}>
              {formatINR(listing.price)}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              {listing.price_per_sqft ? `₹${listing.price_per_sqft.toLocaleString('en-IN')} per sq.ft` : ''}
              {listing.is_sqm_original && (
                <div style={{ fontSize: '0.8rem', color: '#38bdf8' }}>
                  ({listing.carpet_area} m² carpet area)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Architectural Specs Grid */}
        <div className="grid grid-cols-4 gap-4" style={{
          background: 'var(--bg-input)',
          padding: '1.25rem',
          borderRadius: 'var(--radius-md)',
          marginTop: '1.5rem'
        }}>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>CONFIG</span>
            <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{listing.bedroom} BHK</strong>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>CARPET AREA</span>
            <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
              {listing.normalized_carpet_sqft || listing.carpet_area} sqft
              {listing.is_sqm_original && <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}> ({listing.carpet_area} m²)</span>}
            </strong>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>SUPER BUILT-UP</span>
            <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
              {listing.normalized_super_sqft || listing.super_built_up_area || 'N/A'} sqft
              {listing.is_sqm_original && listing.super_built_up_area && (
                <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}> ({listing.super_built_up_area} m²)</span>
              )}
            </strong>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>FLOOR</span>
            <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
              {listing.floor ?? '-'} of {listing.total_floors ?? '-'}
            </strong>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>BATHROOMS</span>
            <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{listing.bathroom ?? 'N/A'}</strong>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>BALCONIES</span>
            <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{listing.balcony ?? 'N/A'}</strong>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>FURNISHING</span>
            <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
              {listing.furnishing || 'Unfurnished'}
            </strong>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>FACING</span>
            <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
              {listing.facing_direction || 'N/A'}
            </strong>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Description & Seller Contact */}
      <div className="grid grid-cols-3 gap-6">
        <div className="card" style={{ gridColumn: 'span 2', padding: '1.75rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Property Description</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
            {listing.description || 'No description provided by the seller.'}
          </p>

          <div style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Geographic Coordinates</h3>
              {(listing.latitude && listing.longitude) ? (
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${listing.latitude},${listing.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1"
                  style={{ 
                    fontSize: '0.8rem', 
                    fontWeight: 600, 
                    color: '#60a5fa', 
                    background: 'rgba(59, 130, 246, 0.1)', 
                    padding: '0.3rem 0.6rem', 
                    borderRadius: '12px',
                    textDecoration: 'none'
                  }}
                >
                  View on Map <ExternalLink size={12} />
                </a>
              ) : null}
            </div>
            <div className="flex items-center gap-4" style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              <div>Latitude: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{listing.latitude}</code></div>
              <div>Longitude: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{listing.longitude}</code></div>
            </div>
          </div>
        </div>

        {/* Seller Info Card */}
        <div className="card" style={{ padding: '1.75rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem' }}>Seller & Contact</h2>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <User size={18} color="#818cf8" />
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>POSTED BY</div>
                <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>
                  {listing.posted_by_name || listing.posted_by || 'Agent'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Phone size={18} color="#10b981" />
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>CONTACT</div>
                <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {listing.posted_by_contact || '+91-XXXXXXXXXX'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Calendar size={18} color="#f59e0b" />
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>LISTED ON</div>
                <div style={{ fontWeight: 600 }}>
                  {new Date(listing.posted_at).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
              </div>
            </div>

            {listing.project_id && (
              <div style={{
                marginTop: '1rem',
                padding: '0.85rem',
                background: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem'
              }}>
                <div style={{ color: 'var(--text-muted)' }}>PROJECT IDENTIFIER</div>
                <div style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                  {listing.project_id}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

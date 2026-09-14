import React from 'react';
import { Rental } from '../types/api';
import { BedDouble, Maximize2, Building, MapPin, KeyRound, Calendar } from 'lucide-react';
import { formatINR } from './ListingCard';

interface RentalCardProps {
  rental: Rental;
}

export const RentalCard: React.FC<RentalCardProps> = ({ rental }) => {
  return (
    <div className="card animate-fade-in flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: '0.75rem' }}>
          <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
            For Rent
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
            {rental.website}
          </span>
        </div>

        <div style={{ marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
            ₹{rental.price.toLocaleString('en-IN')}<span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>/month</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Deposit: ₹{rental.deposit.toLocaleString('en-IN')}
            {rental.maintenance ? ` · Maint: ₹${rental.maintenance.toLocaleString('en-IN')}` : ''}
          </div>
        </div>

        <h3 style={{
          fontSize: '1rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '0.35rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {rental.title || rental.apartment_name}
        </h3>

        <div className="flex items-center gap-1" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          <MapPin size={14} color="#818cf8" />
          <span style={{ textTransform: 'capitalize' }}>{rental.locality}</span>
        </div>

        <div className="grid grid-cols-2 gap-2" style={{
          background: 'var(--bg-input)',
          padding: '0.65rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '0.85rem',
          fontSize: '0.8rem'
        }}>
          <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <BedDouble size={14} color="#6366f1" />
            <span>{rental.bedroom} BHK</span>
          </div>
          <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Maximize2 size={14} color="#8b5cf6" />
            <span>{rental.carpet_area} sqft</span>
          </div>
          <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Building size={14} color="#10b981" />
            <span>Floor {rental.floor ?? '-'}/{rental.total_floors ?? '-'}</span>
          </div>
          <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
            <span>{rental.furnishing || 'Unfurnished'}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between" style={{
        paddingTop: '0.65rem',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: '0.78rem',
        color: 'var(--text-muted)'
      }}>
        <span>ID: <code style={{ fontFamily: 'var(--font-mono)' }}>{rental.listing_id}</code></span>
        <span>{rental.posted_by_contact || rental.posted_by}</span>
      </div>
    </div>
  );
};

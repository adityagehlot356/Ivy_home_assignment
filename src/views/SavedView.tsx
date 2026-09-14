import React from 'react';
import { useSaved } from '../context/SavedContext';
import { useAuth } from '../context/AuthContext';
import { ListingCard } from '../components/ListingCard';
import { Heart, Home, AlertCircle } from 'lucide-react';

interface SavedViewProps {
  onSelectListing: (id: string) => void;
  onBrowse: () => void;
}

export const SavedView: React.FC<SavedViewProps> = ({ onSelectListing, onBrowse }) => {
  const { savedItems, isLoading } = useSaved();
  const { user } = useAuth();

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '0.25rem' }}>
          <Heart size={24} color="#ec4899" fill="#ec4899" />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Saved Properties
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Properties saved for <strong>{user?.name || user?.email}</strong>. Persisted server-side across reloads and sessions.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center" style={{ padding: '5rem 0', gap: '1rem' }}>
          <div className="spinner" style={{ width: '36px', height: '36px' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Synchronizing saved properties with server...</p>
        </div>
      ) : savedItems.length === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center" style={{ padding: '4.5rem 2rem' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            background: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <Heart size={24} color="var(--text-muted)" />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Saved Properties Yet</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', marginBottom: '1.5rem' }}>
            Click the heart icon on any listing while browsing to save properties to your account.
          </p>
          <button className="btn btn-primary" onClick={onBrowse}>
            <Home size={16} />
            <span>Browse Properties</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {savedItems.map((item) => {
            if (item.listing) {
              return (
                <ListingCard
                  key={item.id}
                  listing={item.listing}
                  onViewDetail={onSelectListing}
                />
              );
            }
            return (
              <div key={item.id} className="card flex flex-col justify-between" style={{ padding: '1.5rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Listing {item.id}</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Saved property</p>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => onSelectListing(item.id)}
                  style={{ marginTop: '1rem' }}
                >
                  View Listing Details
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

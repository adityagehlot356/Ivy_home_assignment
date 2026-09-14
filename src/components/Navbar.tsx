import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSaved } from '../context/SavedContext';
import { 
  Building2, 
  Heart, 
  BarChart3, 
  LogOut, 
  Home, 
  Key, 
  MapPin,
  Sparkles
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const { savedIds } = useSaved();

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(11, 15, 25, 0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div className="container flex items-center justify-between" style={{ height: '72px' }}>
        {/* Brand */}
        <div 
          className="flex items-center gap-3" 
          style={{ cursor: 'pointer' }}
          onClick={() => onSelectTab('browse')}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
          }}>
            <Building2 size={24} color="#fff" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>Ivy Homes</span>
              <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                Audit Edition
              </span>
            </div>
            <div className="flex items-center gap-1" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <MapPin size={12} color="#10b981" />
              <span>Bengaluru Scope · Scraped Multi-Portal</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1">
          <button
            className={`btn ${currentTab === 'browse' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onSelectTab('browse')}
          >
            <Home size={17} />
            <span>Browse Listings</span>
          </button>

          <button
            className={`btn ${currentTab === 'rentals-projects' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onSelectTab('rentals-projects')}
          >
            <Building2 size={17} />
            <span>Rentals & Projects</span>
          </button>

          <button
            className={`btn ${currentTab === 'saved' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onSelectTab('saved')}
            style={{ position: 'relative' }}
          >
            <Heart size={17} />
            <span>Saved</span>
            {savedIds.size > 0 && (
              <span style={{
                background: '#ec4899',
                color: '#fff',
                fontSize: '0.7rem',
                padding: '0.1rem 0.45rem',
                borderRadius: '999px',
                fontWeight: 700,
                marginLeft: '0.2rem'
              }}>
                {savedIds.size}
              </span>
            )}
          </button>

          <button
            className={`btn ${currentTab === 'insights' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onSelectTab('insights')}
          >
            <BarChart3 size={17} />
            <span>Insights & Audit</span>
          </button>
        </nav>

        {/* User Account / Auth */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div style={{
                padding: '0.4rem 0.8rem',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem',
                textAlign: 'right'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{user.email}</div>
              </div>
              <button 
                className="btn btn-ghost" 
                onClick={logout} 
                title="Log out"
                style={{ padding: '0.6rem' }}
              >
                <LogOut size={18} color="#f87171" />
              </button>
            </div>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => onSelectTab('login')}
            >
              <Key size={16} />
              <span>Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { BrowseView } from './views/BrowseView';
import { DetailView } from './views/DetailView';
import { SavedView } from './views/SavedView';
import { RentalsProjectsView } from './views/RentalsProjectsView';
import { InsightsView } from './views/InsightsView';
import { LoginView } from './views/LoginView';

export const App: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('browse');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  // Parse direct SPA routes (e.g. /listing/100-1000042, /listings/100-1000042, /saved, or #/listing/...)
  const parseRoute = useCallback(() => {
    // Check pathname first, then hash fallback
    const pathname = window.location.pathname.replace(/^\/+/, '');
    const hash = window.location.hash.replace(/^#\/?/, '');
    const rawTarget = pathname || hash;

    // Handle listing detail routes: /listing/:id or /listings/:id
    const listingMatch = rawTarget.match(/^listings?\/([^\/?#]+)/i);
    if (listingMatch) {
      const id = decodeURIComponent(listingMatch[1]);
      setSelectedListingId(id);
      setCurrentTab('detail');
      return;
    }

    setSelectedListingId(null);
    if (rawTarget.startsWith('saved')) {
      setCurrentTab('saved');
    } else if (
      rawTarget.startsWith('rentals-projects') ||
      rawTarget.startsWith('rentals') ||
      rawTarget.startsWith('projects')
    ) {
      setCurrentTab('rentals-projects');
    } else if (rawTarget.startsWith('insights')) {
      setCurrentTab('insights');
    } else if (rawTarget.startsWith('login')) {
      setCurrentTab('login');
    } else {
      setCurrentTab('browse');
    }
  }, []);

  // Listen for both popstate (browser forward/back) and hashchange
  useEffect(() => {
    parseRoute();
    window.addEventListener('popstate', parseRoute);
    window.addEventListener('hashchange', parseRoute);

    return () => {
      window.removeEventListener('popstate', parseRoute);
      window.removeEventListener('hashchange', parseRoute);
    };
  }, [parseRoute]);

  const navigateToTab = (tab: string) => {
    setSelectedListingId(null);
    setCurrentTab(tab);
    const newPath = tab === 'browse' ? '/' : `/${tab}`;
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
  };

  const navigateToDetail = (id: string) => {
    setSelectedListingId(id);
    setCurrentTab('detail');
    const newPath = `/listing/${encodeURIComponent(id)}`;
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: '100vh', gap: '1rem' }}>
        <div className="spinner" style={{ width: '48px', height: '48px' }}></div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Restoring Ivy Homes session...</div>
      </div>
    );
  }

  // If not authenticated and trying to view protected collections, show LoginView
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar currentTab="login" onSelectTab={navigateToTab} />
        <main style={{ flex: 1 }}>
          <LoginView onLoginSuccess={() => parseRoute()} />
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar currentTab={currentTab} onSelectTab={navigateToTab} />

      <main style={{ flex: 1 }}>
        {currentTab === 'detail' && selectedListingId ? (
          <DetailView listingId={selectedListingId} onBack={() => navigateToTab('browse')} />
        ) : currentTab === 'saved' ? (
          <SavedView onSelectListing={navigateToDetail} onBrowse={() => navigateToTab('browse')} />
        ) : currentTab === 'rentals-projects' ? (
          <RentalsProjectsView />
        ) : currentTab === 'insights' ? (
          <InsightsView />
        ) : (
          <BrowseView onSelectListing={navigateToDetail} />
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-main)',
        padding: '2rem 1.5rem',
        color: 'var(--text-muted)',
        fontSize: '0.82rem',
      }}>
        <div className="container flex items-center justify-between flex-wrap gap-4">
          <div>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Ivy Homes</span> — Software Engineering Internship Submission (Bengaluru)
          </div>
          <div className="flex items-center gap-4">
            <span>Reference: <code>2026-09-10T00:00:00+05:30</code></span>
            <span>·</span>
            <span>Dual-Header Session Protected</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

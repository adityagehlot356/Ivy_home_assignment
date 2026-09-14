import React, { useState, useEffect } from 'react';
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

  // Sync hash routing with view state
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('/listings/')) {
        const id = hash.replace('/listings/', '');
        if (id) {
          setSelectedListingId(id);
          setCurrentTab('detail');
          return;
        }
      }

      setSelectedListingId(null);
      if (hash === 'saved') setCurrentTab('saved');
      else if (hash === 'rentals-projects') setCurrentTab('rentals-projects');
      else if (hash === 'insights') setCurrentTab('insights');
      else if (hash === 'login') setCurrentTab('login');
      else setCurrentTab('browse');
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // initial check

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const navigateToTab = (tab: string) => {
    setSelectedListingId(null);
    setCurrentTab(tab);
    if (tab === 'browse') window.location.hash = '';
    else window.location.hash = tab;
  };

  const navigateToDetail = (id: string) => {
    setSelectedListingId(id);
    setCurrentTab('detail');
    window.location.hash = `/listings/${id}`;
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
          <LoginView onLoginSuccess={() => navigateToTab('browse')} />
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
        ) : currentTab === 'login' ? (
          <LoginView onLoginSuccess={() => navigateToTab('browse')} />
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

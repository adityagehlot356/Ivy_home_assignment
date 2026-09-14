import React, { useState, useEffect, useCallback } from 'react';
import { Rental, Project } from '../types/api';
import { getRentals, getProjects, getLocalities } from '../services/dataService';
import { RentalCard } from '../components/RentalCard';
import { ProjectCard } from '../components/ProjectCard';
import { Pagination } from '../components/Pagination';
import { AlertBanner } from '../components/AlertBanner';
import { Building2, KeyRound, MapPin, Search } from 'lucide-react';

export const RentalsProjectsView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'rentals' | 'projects'>('rentals');

  // Rentals State
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [rentalsTotal, setRentalsTotal] = useState(0);
  const [rentalsOffset, setRentalsOffset] = useState(0);
  const [rentalsLimit, setRentalsLimit] = useState(20);
  const [rentalsHasMore, setRentalsHasMore] = useState(true);

  // Projects State
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsTotal, setProjectsTotal] = useState(0);
  const [projectsOffset, setProjectsOffset] = useState(0);
  const [projectsLimit, setProjectsLimit] = useState(20);
  const [projectsHasMore, setProjectsHasMore] = useState(true);

  // Common Filters
  const [locality, setLocality] = useState('');
  const [localities, setLocalities] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLocalities().then(setLocalities);
  }, []);

  const loadRentals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getRentals(rentalsOffset, rentalsLimit, locality);
      setRentals(resp.results);
      setRentalsTotal(resp.total);
      setRentalsHasMore(resp.has_more);
    } catch (err: any) {
      setError(err.message || 'Failed to load rental properties.');
    } finally {
      setLoading(false);
    }
  }, [rentalsOffset, rentalsLimit, locality]);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getProjects(projectsOffset, projectsLimit, locality);
      setProjects(resp.results);
      setProjectsTotal(resp.total);
      setProjectsHasMore(resp.has_more);
    } catch (err: any) {
      setError(err.message || 'Failed to load builder projects.');
    } finally {
      setLoading(false);
    }
  }, [projectsOffset, projectsLimit, locality]);

  useEffect(() => {
    if (activeSubTab === 'rentals') {
      loadRentals();
    } else {
      loadProjects();
    }
  }, [activeSubTab, loadRentals, loadProjects]);

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 5rem' }}>
      {/* Title */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
          Rentals & Builder Projects
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Explore residential rental listings and builder developments with normalized INR denominations.
        </p>
      </div>

      {/* Sub-Tabs and Filter Header */}
      <div className="flex items-center justify-between flex-wrap gap-4" style={{ marginBottom: '1.5rem' }}>
        <div className="flex gap-2" style={{ background: 'var(--bg-card)', padding: '0.35rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <button
            className={`btn ${activeSubTab === 'rentals' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setActiveSubTab('rentals');
              setRentalsOffset(0);
            }}
            style={{ padding: '0.5rem 1.25rem' }}
          >
            <KeyRound size={16} />
            <span>Rental Listings ({rentalsTotal || '...'})</span>
          </button>
          <button
            className={`btn ${activeSubTab === 'projects' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setActiveSubTab('projects');
              setProjectsOffset(0);
            }}
            style={{ padding: '0.5rem 1.25rem' }}
          >
            <Building2 size={16} />
            <span>Builder Projects ({projectsTotal || '...'})</span>
          </button>
        </div>

        {/* Locality Filter */}
        <div style={{ minWidth: '220px' }}>
          <select
            className="select"
            value={locality}
            onChange={(e) => {
              setLocality(e.target.value);
              setRentalsOffset(0);
              setProjectsOffset(0);
            }}
          >
            <option value="">All Localities</option>
            {localities.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <AlertBanner
          type="error"
          title="Data Loading Error"
          message={error}
          onRetry={activeSubTab === 'rentals' ? loadRentals : loadProjects}
        />
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center" style={{ padding: '5rem 0', gap: '1rem' }}>
          <div className="spinner" style={{ width: '36px', height: '36px' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading {activeSubTab}...</p>
        </div>
      ) : activeSubTab === 'rentals' ? (
        rentals.length === 0 ? (
          <div className="card text-center" style={{ padding: '4rem 2rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No rental properties found for selected filters.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-6">
              {rentals.map((r) => (
                <RentalCard key={r.listing_id} rental={r} />
              ))}
            </div>
            <Pagination
              total={rentalsTotal}
              offset={rentalsOffset}
              limit={rentalsLimit}
              hasMore={rentalsHasMore}
              onPageChange={setRentalsOffset}
              onLimitChange={(l) => {
                setRentalsLimit(l);
                setRentalsOffset(0);
              }}
            />
          </>
        )
      ) : projects.length === 0 ? (
        <div className="card text-center" style={{ padding: '4rem 2rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No builder projects found for selected filters.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-6">
            {projects.map((p) => (
              <ProjectCard key={p.project_id} project={p} />
            ))}
          </div>
          <Pagination
            total={projectsTotal}
            offset={projectsOffset}
            limit={projectsLimit}
            hasMore={projectsHasMore}
            onPageChange={setProjectsOffset}
            onLimitChange={(l) => {
              setProjectsLimit(l);
              setProjectsOffset(0);
            }}
          />
        </>
      )}
    </div>
  );
};

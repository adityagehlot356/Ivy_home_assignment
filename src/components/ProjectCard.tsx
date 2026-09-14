import React from 'react';
import { Project } from '../types/api';
import { Building2, MapPin, Calendar, Layers, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatINR } from './ListingCard';

interface ProjectCardProps {
  project: Project;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const minInr = project.normalized_price_min_inr || 0;
  const maxInr = project.normalized_price_max_inr || 0;

  return (
    <div className="card animate-fade-in flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: '0.75rem' }}>
          <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
            Builder Project
          </span>
          <span className="badge" style={{
            background: project.project_status === 'ready to move' ? 'var(--success-light)' : 'var(--warning-light)',
            color: project.project_status === 'ready to move' ? '#34d399' : '#fbbf24',
            border: `1px solid ${project.project_status === 'ready to move' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
          }}>
            {project.project_status}
          </span>
        </div>

        {/* Normalized Price Range */}
        <div style={{ marginBottom: '0.65rem' }}>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
            {formatINR(minInr)} – {formatINR(maxInr)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Raw API units: {project.price_min} to {project.price_max} ({project.price_min < 10 ? 'Crores' : 'Lakhs'})
          </div>
        </div>

        {/* Project Name & Developer */}
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
          {project.apartment_name}
        </h3>
        <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600, marginBottom: '0.4rem' }}>
          By {project.developer_name}
        </div>

        <div className="flex items-center gap-1" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          <MapPin size={14} color="#818cf8" />
          <span style={{ textTransform: 'capitalize' }}>{project.locality}</span>
        </div>

        {/* Specs Grid */}
        <div className="grid grid-cols-2 gap-2" style={{
          background: 'var(--bg-input)',
          padding: '0.75rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '0.85rem',
          fontSize: '0.8rem'
        }}>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block' }}>Total Units:</span>
            <strong style={{ color: 'var(--text-primary)' }}>{project.total_units}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block' }}>Area Range:</span>
            <strong style={{ color: 'var(--text-primary)' }}>{project.min_area_sqft} - {project.max_area_sqft} sqft</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block' }}>Towers / Floors:</span>
            <strong style={{ color: 'var(--text-primary)' }}>{project.total_towers} towers, {project.total_floors} fl</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block' }}>Reported Listings:</span>
            <strong style={{ color: 'var(--text-primary)' }}>{project.total_listings} units</strong>
          </div>
        </div>

        {/* Amenities Preview */}
        {project.amenities && project.amenities.length > 0 && (
          <div className="flex gap-1 flex-wrap" style={{ marginBottom: '0.75rem' }}>
            {project.amenities.slice(0, 4).map((a) => (
              <span key={a} style={{
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-secondary)',
                fontSize: '0.7rem',
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
                textTransform: 'capitalize'
              }}>
                {a}
              </span>
            ))}
            {project.amenities.length > 4 && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                +{project.amenities.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between" style={{
        paddingTop: '0.65rem',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: '0.78rem',
        color: 'var(--text-muted)'
      }}>
        <span>ID: <code style={{ fontFamily: 'var(--font-mono)' }}>{project.project_id}</code></span>
        <span>Possession: {project.possession_date}</span>
      </div>
    </div>
  );
};

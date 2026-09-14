import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  onPageChange: (newOffset: number) => void;
  onLimitChange?: (newLimit: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  total,
  offset,
  limit,
  hasMore,
  onPageChange,
  onLimitChange,
}) => {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit) || 1;
  const startItem = total === 0 ? 0 : offset + 1;
  const endItem = Math.min(offset + limit, total);

  return (
    <div className="flex items-center justify-between flex-wrap gap-4" style={{
      marginTop: '2rem',
      paddingTop: '1.25rem',
      borderTop: '1px solid var(--border-subtle)',
      color: 'var(--text-secondary)',
      fontSize: '0.9rem'
    }}>
      <div>
        Showing <strong style={{ color: 'var(--text-primary)' }}>{startItem}</strong> to{' '}
        <strong style={{ color: 'var(--text-primary)' }}>{endItem}</strong> of{' '}
        <strong style={{ color: 'var(--text-primary)' }}>{total.toLocaleString('en-IN')}</strong> records
      </div>

      <div className="flex items-center gap-3">
        {onLimitChange && (
          <div className="flex items-center gap-2" style={{ fontSize: '0.82rem' }}>
            <span>Per page:</span>
            <select
              className="select"
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              style={{ width: 'auto', padding: '0.35rem 0.6rem' }}
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            className="btn btn-secondary"
            disabled={offset === 0}
            onClick={() => onPageChange(Math.max(0, offset - limit))}
            style={{
              padding: '0.45rem 0.8rem',
              opacity: offset === 0 ? 0.4 : 1,
              cursor: offset === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <ChevronLeft size={16} />
            <span>Prev</span>
          </button>

          <span style={{ padding: '0 0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Page {currentPage} of {totalPages}
          </span>

          <button
            className="btn btn-secondary"
            disabled={!hasMore && endItem >= total}
            onClick={() => onPageChange(offset + limit)}
            style={{
              padding: '0.45rem 0.8rem',
              opacity: (!hasMore && endItem >= total) ? 0.4 : 1,
              cursor: (!hasMore && endItem >= total) ? 'not-allowed' : 'pointer'
            }}
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

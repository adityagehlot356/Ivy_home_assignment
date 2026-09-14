import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, RefreshCw } from 'lucide-react';

interface AlertBannerProps {
  type?: 'error' | 'warning' | 'info' | 'success';
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type = 'info',
  title,
  message,
  onRetry,
}) => {
  const configs = {
    error: {
      bg: 'var(--danger-light)',
      border: 'rgba(239, 68, 68, 0.4)',
      color: '#f87171',
      icon: <AlertCircle size={20} color="#ef4444" />,
    },
    warning: {
      bg: 'var(--warning-light)',
      border: 'rgba(245, 158, 11, 0.4)',
      color: '#fbbf24',
      icon: <AlertTriangle size={20} color="#f59e0b" />,
    },
    info: {
      bg: 'var(--info-light)',
      border: 'rgba(6, 182, 212, 0.4)',
      color: '#38bdf8',
      icon: <Info size={20} color="#06b6d4" />,
    },
    success: {
      bg: 'var(--success-light)',
      border: 'rgba(16, 185, 129, 0.4)',
      color: '#34d399',
      icon: <CheckCircle size={20} color="#10b981" />,
    },
  };

  const config = configs[type];

  return (
    <div
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: 'var(--radius-md)',
        padding: '1rem',
        margin: '1rem 0',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '0.75rem',
      }}
    >
      <div className="flex gap-3">
        <div style={{ marginTop: '2px' }}>{config.icon}</div>
        <div>
          {title && <h4 style={{ color: config.color, fontWeight: 700, fontSize: '0.95rem' }}>{title}</h4>}
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: title ? '0.2rem' : 0 }}>
            {message}
          </div>
        </div>
      </div>

      {onRetry && (
        <button
          className="btn btn-secondary"
          onClick={onRetry}
          style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}
        >
          <RefreshCw size={14} />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
};

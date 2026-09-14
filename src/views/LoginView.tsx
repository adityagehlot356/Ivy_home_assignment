import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('demo1@ivy.homes');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const selectDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
  };

  return (
    <div className="container flex justify-center items-center" style={{ minHeight: 'calc(100vh - 160px)', padding: '2rem 1rem' }}>
      <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
            boxShadow: '0 8px 20px rgba(99, 102, 241, 0.35)'
          }}>
            <Lock size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.4rem' }}>Portal Authentication</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Authenticate against the live Ivy Homes Property API.
          </p>
        </div>

        {/* Demo Account Quick-Fill Buttons */}
        <div style={{
          background: 'var(--bg-input)',
          borderRadius: 'var(--radius-md)',
          padding: '0.85rem',
          marginBottom: '1.5rem',
          border: '1px solid var(--border-subtle)'
        }}>
          <div className="flex items-center gap-1" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
            <UserCheck size={14} color="#818cf8" />
            <span>DEMO ACCOUNTS (AVAILABLE ON SERVER):</span>
          </div>
          <div className="flex gap-2">
            {['demo1@ivy.homes', 'demo2@ivy.homes', 'demo3@ivy.homes'].map((acc) => (
              <button
                key={acc}
                type="button"
                className={`btn ${email === acc ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => selectDemoAccount(acc)}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', flex: 1 }}
              >
                {acc.split('@')[0]}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-light)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem',
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
            display: 'flex',
            gap: '0.5rem'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              EMAIL ADDRESS
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                className="input"
                placeholder="demo1@ivy.homes"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
              />
              <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              ACCOUNT PASSWORD
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                required
                className="input"
                placeholder="Enter password issued with key"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
              />
              <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '0.85rem', marginTop: '0.5rem' }}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                <span>Authenticating with server...</span>
              </div>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        <div style={{
          marginTop: '1.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <ShieldCheck size={16} color="#10b981" />
          <span>Server-Side Security: API credentials isolated securely on server.</span>
        </div>
      </div>
    </div>
  );
};

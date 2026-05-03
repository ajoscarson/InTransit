import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AuthPage({ mode = 'signin' }) {
  const [tab, setTab] = useState(mode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      if (tab === 'signin') {
        await signIn(email, password);
        navigate('/');
      } else {
        await signUp(email, password);
        setSuccessMsg('Check your email to confirm your account.');
        setTab('signin');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        background: '#0a0a0a',
      }}
    >
      {/* Wordmark */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#f0f0f0',
            marginBottom: '0.4rem',
          }}
        >
          In Transit
        </h1>
        <p style={{ color: '#333', fontSize: '0.8rem', letterSpacing: '0.04em' }}>
          analog film tracker
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: 320 }}>
        {/* Tab toggle */}
        <div
          style={{
            display: 'flex',
            gap: '1.5rem',
            borderBottom: '1px solid #1e1e1e',
            marginBottom: '2rem',
          }}
        >
          {[['signin', 'Sign In'], ['signup', 'Sign Up']].map(([t, label]) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); setSuccessMsg(''); }}
              style={{
                padding: '0 0 0.6rem',
                fontSize: '0.82rem',
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? '#f0f0f0' : '#555',
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '1px solid #e8d5b0' : '1px solid transparent',
                marginBottom: '-1px',
                cursor: 'pointer',
                transition: 'color 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <p style={{ fontSize: '0.82rem', color: '#f87171', marginBottom: '1rem' }}>{error}</p>
        )}
        {successMsg && (
          <p style={{ fontSize: '0.82rem', color: '#10b981', marginBottom: '1rem' }}>{successMsg}</p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.4rem' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.4rem' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-full"
            style={{ marginTop: '0.5rem', height: 48 }}
          >
            {loading ? <LoadingSpinner size={20} /> : (tab === 'signin' ? 'Sign In' : 'Create Account')}
          </button>
        </form>
      </div>
    </div>
  );
}

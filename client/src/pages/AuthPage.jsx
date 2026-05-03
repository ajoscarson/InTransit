import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AuthPage({ mode = 'signin' }) {
  const [tab, setTab] = useState(mode); // 'signin' | 'signup'
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
        setSuccessMsg('Account created! Check your email to confirm, then sign in.');
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
        padding: '1.5rem',
        background: '#0a0a0a',
      }}
    >
      {/* Logo area */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 14,
            background: '#1e1e1e',
            border: '1px solid #2a2a2a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            fontSize: '1.75rem',
          }}
        >
          🎞
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#f0f0f0' }}>
          Film Roll Tracker
        </h1>
        <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.3rem' }}>
          Track every roll, from shoot to scan
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: '#141414',
          border: '1px solid #2a2a2a',
          borderRadius: 14,
          padding: '1.75rem',
        }}
      >
        {/* Tab toggle */}
        <div
          style={{
            display: 'flex',
            background: '#0a0a0a',
            borderRadius: 8,
            padding: 4,
            marginBottom: '1.5rem',
          }}
        >
          {['signin', 'signup'].map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); setSuccessMsg(''); }}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: 6,
                fontSize: '0.9rem',
                fontWeight: 600,
                transition: 'background 0.15s, color 0.15s',
                background: tab === t ? '#1e1e1e' : 'transparent',
                color: tab === t ? '#f0f0f0' : '#666',
                border: tab === t ? '1px solid #2a2a2a' : '1px solid transparent',
                cursor: 'pointer',
              }}
            >
              {t === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {error && (
          <div
            style={{
              background: '#dc262620',
              border: '1px solid #dc262640',
              borderRadius: 8,
              padding: '0.65rem 0.875rem',
              marginBottom: '1rem',
              color: '#f87171',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              background: '#10b98120',
              border: '1px solid #10b98140',
              borderRadius: 8,
              padding: '0.65rem 0.875rem',
              marginBottom: '1rem',
              color: '#10b981',
              fontSize: '0.875rem',
            }}
          >
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tab === 'signup' ? 'Min 6 characters' : '••••••••'}
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

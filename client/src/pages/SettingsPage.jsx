import React, { useState } from 'react';
import { Bell, CreditCard, LogOut, Check, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import BottomNav from '../components/BottomNav';
import LoadingSpinner from '../components/LoadingSpinner';

const PLAN_COLORS = {
  free:  '#666',
  solo:  '#c4a96a',
  pro:   '#8b5cf6',
};

const PLAN_LABELS = {
  free:  'Free',
  solo:  'Solo — $8/mo',
  pro:   'Pro — $15/mo',
};

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [notifStatus, setNotifStatus] = useState('idle'); // idle | requesting | subscribed | denied | unsupported
  const [billingLoading, setBillingLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get('/api/billing/subscription').then((r) => r.data),
  });

  const plan = subscription?.plan || 'free';

  async function handleEnableNotifications() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setNotifStatus('unsupported');
      return;
    }

    setNotifStatus('requesting');

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setNotifStatus('denied');
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setError('VAPID public key not configured.');
        setNotifStatus('idle');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      await api.post('/api/notifications/subscribe', { subscription });
      setNotifStatus('subscribed');
    } catch (err) {
      console.error('Push subscription error:', err);
      setNotifStatus('idle');
      setError('Failed to enable notifications: ' + err.message);
    }
  }

  async function handleTestNotification() {
    try {
      await api.post('/api/notifications/test');
    } catch (err) {
      setError('Test notification failed: ' + (err.response?.data?.error || err.message));
    }
  }

  async function handleUpgrade(planName) {
    setBillingLoading(true);
    setError('');
    try {
      const { data } = await api.post('/api/billing/create-checkout-session', { plan: planName });
      window.location.href = data.url;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start checkout');
    } finally {
      setBillingLoading(false);
    }
  }

  async function handleManageBilling() {
    setBillingLoading(true);
    setError('');
    try {
      const { data } = await api.post('/api/billing/create-portal-session');
      window.location.href = data.url;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to open billing portal');
    } finally {
      setBillingLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 390, margin: '0 auto', paddingBottom: '5rem' }}>
      {/* Header */}
      <div
        style={{
          padding: '1rem 1rem 0.75rem',
          position: 'sticky',
          top: 0,
          background: '#0a0a0a',
          zIndex: 10,
        }}
      >
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Settings</h1>
      </div>

      <div style={{ padding: '0 1rem' }}>
        {error && (
          <div
            style={{
              background: '#dc262620',
              border: '1px solid #dc262640',
              borderRadius: 8,
              padding: '0.65rem',
              marginBottom: '1rem',
              color: '#f87171',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Account */}
        <section style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.7rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>
            Account
          </p>
          <div
            style={{
              background: '#1e1e1e',
              border: '1px solid #2a2a2a',
              borderRadius: 10,
              padding: '1rem',
            }}
          >
            <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '0.25rem' }}>Signed in as</p>
            <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>{user?.email}</p>
          </div>
        </section>

        {/* Plan */}
        <section style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.7rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>
            Plan
          </p>
          <div
            style={{
              background: '#1e1e1e',
              border: '1px solid #2a2a2a',
              borderRadius: 10,
              padding: '1rem',
              marginBottom: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.2rem' }}>Current Plan</p>
                <span
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: PLAN_COLORS[plan],
                  }}
                >
                  {PLAN_LABELS[plan]}
                </span>
              </div>
              {plan !== 'free' && (
                <button
                  onClick={handleManageBilling}
                  disabled={billingLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.8rem',
                    color: '#888',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {billingLoading ? <LoadingSpinner size={14} /> : <><CreditCard size={14} /> Manage</>}
                </button>
              )}
            </div>

            {plan === 'free' && (
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #2a2a2a' }}>
                <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem' }}>
                  Free plan: up to 5 active rolls. No scan links.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleUpgrade('solo')}
                    disabled={billingLoading}
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '0.6rem', fontSize: '0.875rem' }}
                  >
                    {billingLoading ? <LoadingSpinner size={16} /> : 'Solo — $8/mo'}
                  </button>
                  <button
                    onClick={() => handleUpgrade('pro')}
                    disabled={billingLoading}
                    className="btn"
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      fontSize: '0.875rem',
                      background: '#8b5cf620',
                      color: '#8b5cf6',
                      border: '1px solid #8b5cf640',
                    }}
                  >
                    {billingLoading ? <LoadingSpinner size={16} /> : 'Pro — $15/mo'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Notifications */}
        <section style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.7rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>
            Notifications
          </p>
          <div
            style={{
              background: '#1e1e1e',
              border: '1px solid #2a2a2a',
              borderRadius: 10,
              padding: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: '#141414',
                    border: '1px solid #2a2a2a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Bell size={18} color="#c4a96a" />
                </div>
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Push Notifications</p>
                  <p style={{ fontSize: '0.75rem', color: '#666' }}>
                    {notifStatus === 'subscribed' && 'Enabled — you\'re all set'}
                    {notifStatus === 'denied'     && 'Permission denied in browser'}
                    {notifStatus === 'unsupported' && 'Not supported in this browser'}
                    {(notifStatus === 'idle' || notifStatus === 'requesting') && 'Due-soon & overdue alerts'}
                  </p>
                </div>
              </div>

              {notifStatus === 'subscribed' ? (
                <Check size={20} color="#10b981" />
              ) : (
                <button
                  onClick={handleEnableNotifications}
                  disabled={notifStatus === 'requesting' || notifStatus === 'denied' || notifStatus === 'unsupported'}
                  style={{
                    padding: '0.4rem 0.875rem',
                    borderRadius: 8,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    background: '#e8d5b020',
                    color: '#e8d5b0',
                    border: '1px solid #e8d5b040',
                    cursor: notifStatus === 'requesting' ? 'wait' : 'pointer',
                  }}
                >
                  {notifStatus === 'requesting' ? <LoadingSpinner size={14} /> : 'Enable'}
                </button>
              )}
            </div>

            {notifStatus === 'subscribed' && (
              <button
                onClick={handleTestNotification}
                style={{
                  marginTop: '0.75rem',
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: 8,
                  fontSize: '0.8rem',
                  color: '#666',
                  background: '#141414',
                  border: '1px solid #2a2a2a',
                  cursor: 'pointer',
                }}
              >
                Send Test Notification
              </button>
            )}
          </div>
        </section>

        {/* Sign out */}
        <section>
          <button
            onClick={signOut}
            className="btn btn-full"
            style={{
              background: '#1e1e1e',
              border: '1px solid #2a2a2a',
              color: '#f87171',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </section>
      </div>

      <BottomNav />
    </div>
  );
}

// Convert base64 VAPID key to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

import React from 'react';

export default function EmptyState({ icon: Icon, message, subMessage, ctaLabel, onCta }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '3rem 1.5rem',
        gap: '0.75rem',
      }}
    >
      {Icon && (
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#1e1e1e',
            border: '1px solid #2a2a2a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.5rem',
          }}
        >
          <Icon size={28} color="#666" />
        </div>
      )}
      <p style={{ fontSize: '1rem', fontWeight: 600, color: '#f0f0f0' }}>{message}</p>
      {subMessage && (
        <p style={{ fontSize: '0.875rem', color: '#666', maxWidth: 240 }}>{subMessage}</p>
      )}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="btn btn-primary"
          style={{ marginTop: '0.75rem', padding: '0.75rem 2rem' }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

import React from 'react';

const STATUS_CONFIG = {
  shot:       { label: 'Shot',       color: '#4a9eff' },
  sent:       { label: 'Sent',       color: '#f59e0b' },
  developing: { label: 'Developing', color: '#8b5cf6' },
  returned:   { label: 'Returned',   color: '#10b981' },
  archived:   { label: 'Archived',   color: '#555' },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.shot;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        fontSize: '0.7rem',
        fontWeight: 600,
        color: config.color,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: config.color,
          flexShrink: 0,
        }}
      />
      {config.label}
    </span>
  );
}

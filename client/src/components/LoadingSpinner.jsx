import React from 'react';

export default function LoadingSpinner({ size = 32 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: `3px solid #2a2a2a`,
        borderTopColor: '#e8d5b0',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

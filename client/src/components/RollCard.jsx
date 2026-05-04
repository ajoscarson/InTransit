import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format, differenceInDays, parseISO } from 'date-fns';
import StatusBadge from './StatusBadge';

export default function RollCard({ roll }) {
  const navigate = useNavigate();

  const daysSinceSent = roll.sent_date
    ? differenceInDays(new Date(), parseISO(roll.sent_date))
    : null;

  const estimatedReturn = roll.estimated_return_date
    ? format(parseISO(roll.estimated_return_date), 'MMM d')
    : null;

  const shootDate = roll.shoot_date
    ? format(parseISO(roll.shoot_date), 'MMM d, yyyy')
    : null;

  const inFlight = ['sent', 'developing'].includes(roll.status);

  const meta = [
    roll.camera_name,
    roll.location,
    shootDate,
  ].filter(Boolean).join('  ·  ');

  return (
    <div
      onClick={() => navigate(`/rolls/${roll.id}`)}
      style={{
        padding: '1.1rem 0',
        borderBottom: '1px solid #1e1e1e',
        cursor: 'pointer',
        transition: 'opacity 0.1s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.3rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {roll.name && (
            <p style={{
              fontSize: '0.62rem',
              color: '#555',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: '0.15rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {roll.name}
            </p>
          )}
          <h3
            style={{
              fontSize: '1.05rem',
              fontWeight: 700,
              color: '#f0f0f0',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {roll.film_stock_name || 'Unknown Film'}
          </h3>
        </div>
        <StatusBadge status={roll.status} />
      </div>

      {(roll.film_stock_brand || roll.film_stock_iso) && (
        <p style={{
          fontSize: '0.72rem',
          color: '#c4a96a',
          fontFamily: 'ui-monospace, monospace',
          letterSpacing: '0.04em',
          marginBottom: '0.35rem',
        }}>
          {[roll.film_stock_brand, roll.film_stock_iso ? `ISO ${roll.film_stock_iso}` : null].filter(Boolean).join(' · ')}
          {roll.push_pull && roll.push_pull !== 'box' && (
            <span style={{ color: '#8b5cf6', marginLeft: '0.5rem' }}>{roll.push_pull}</span>
          )}
        </p>
      )}

      {meta && (
        <p style={{ fontSize: '0.78rem', color: '#555', letterSpacing: '0.01em' }}>
          {meta}
        </p>
      )}

      {inFlight && roll.lab_name && (
        <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#444' }}>{roll.lab_name}</span>
          {daysSinceSent !== null && (
            <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>{daysSinceSent}d in transit</span>
          )}
          {estimatedReturn && (
            <span style={{ fontSize: '0.75rem', color: '#444' }}>est. {estimatedReturn}</span>
          )}
        </div>
      )}
    </div>
  );
}

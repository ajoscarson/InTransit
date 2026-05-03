import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Plus, Film } from 'lucide-react';
import { isThisMonth, parseISO } from 'date-fns';
import { useRolls } from '../hooks/useRolls';
import RollCard from '../components/RollCard';
import BottomNav from '../components/BottomNav';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';

const FILTERS = [
  { key: 'all',         label: 'All' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'returned',    label: 'Returned' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');

  const { data: allRolls = [], isLoading } = useRolls();

  const filteredRolls = allRolls.filter((r) => {
    if (filter === 'in-progress') return ['shot', 'sent', 'developing'].includes(r.status);
    if (filter === 'returned')    return r.status === 'returned';
    if (filter === 'all')         return r.status !== 'archived';
    return true;
  });

  const stats = {
    total: allRolls.filter((r) => r.status !== 'archived').length,
    inFlight: allRolls.filter((r) => ['sent', 'developing'].includes(r.status)).length,
    returnedThisMonth: allRolls.filter(
      (r) => r.status === 'returned' && r.actual_return_date && isThisMonth(parseISO(r.actual_return_date))
    ).length,
  };

  return (
    <div style={{ maxWidth: 390, margin: '0 auto', paddingBottom: '5rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1rem 0.5rem',
          position: 'sticky',
          top: 0,
          background: '#0a0a0a',
          zIndex: 10,
        }}
      >
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f0f0f0' }}>
          In Transit
        </h1>
        <button
          onClick={() => navigate('/settings')}
          style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: '0.25rem' }}
        >
          <Settings size={17} />
        </button>
      </div>

      <div style={{ padding: '0 1rem' }}>
        {/* Stats row */}
        <div style={{ display: 'flex', gap: '2rem', padding: '1rem 0 1.25rem' }}>
          {[
            { label: 'Rolls', value: stats.total, color: '#e8d5b0' },
            { label: 'In Flight', value: stats.inFlight, color: '#f59e0b' },
            { label: 'Back This Mo', value: stats.returnedThisMonth, color: '#10b981' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.03em' }}>
                {value === 0 ? <span style={{ color: '#2a2a2a' }}>—</span> : value}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#444', marginTop: '0.2rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.25rem', borderBottom: '1px solid #1e1e1e', paddingBottom: '0' }}>
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: '0 0 0.6rem',
                fontSize: '0.82rem',
                fontWeight: filter === key ? 600 : 400,
                color: filter === key ? '#f0f0f0' : '#555',
                background: 'none',
                border: 'none',
                borderBottom: filter === key ? '1px solid #e8d5b0' : '1px solid transparent',
                marginBottom: '-1px',
                cursor: 'pointer',
                transition: 'color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Roll list */}
        <div style={{ marginTop: '0.5rem' }} />
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
            <LoadingSpinner />
          </div>
        ) : filteredRolls.length === 0 ? (
          <EmptyState
            message={
              filter === 'returned' ? 'No scans back yet.' :
              filter === 'in-progress' ? 'Nothing in transit.' :
              'No rolls loaded.'
            }
            subMessage={
              filter === 'returned' ? null :
              filter === 'in-progress' ? null :
              null
            }
            ctaLabel={filter === 'returned' ? null : 'Start a Roll'}
            onCta={filter === 'returned' ? null : () => navigate('/rolls/new')}
          />
        ) : (
          filteredRolls.map((roll) => <RollCard key={roll.id} roll={roll} />)
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate('/rolls/new')}
        style={{
          position: 'fixed',
          bottom: '5rem',
          right: '1.25rem',
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#e8d5b0',
          color: '#1a1208',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          border: 'none',
          cursor: 'pointer',
          zIndex: 50,
          transition: 'transform 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      <BottomNav />
    </div>
  );
}

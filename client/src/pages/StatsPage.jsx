import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import BottomNav from '../components/BottomNav';
import LoadingSpinner from '../components/LoadingSpinner';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <p style={{ fontSize: '0.65rem', color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function StatBlock({ label, value, sub, color = '#f0f0f0' }) {
  return (
    <div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.04em' }}>
        {value ?? <span style={{ color: '#2a2a2a' }}>—</span>}
      </div>
      <div style={{ fontSize: '0.65rem', color: '#444', marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: '0.7rem', color: '#555', marginTop: '0.15rem' }}>{sub}</div>}
    </div>
  );
}

function Bar({ value, max, color = '#e8d5b0' }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ height: 3, background: '#1e1e1e', borderRadius: 2, flex: 1 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s' }} />
    </div>
  );
}

export default function StatsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('/api/stats').then(r => r.data),
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
        <LoadingSpinner />
      </div>
    );
  }

  const { overview, cameras, filmStocks, filmTypes, labs, monthlyActivity, pushPull, personalBests } = data || {};

  const totalRolls = parseInt(overview?.total_rolls ?? 0);
  const rollsThisYear = parseInt(overview?.rolls_this_year ?? 0);
  const rollsLastYear = parseInt(overview?.rolls_last_year ?? 0);
  const yearDelta = rollsThisYear - rollsLastYear;
  const totalFrames = parseInt(overview?.total_frames ?? 0);
  const totalSpent = parseFloat(overview?.total_spent ?? 0);

  const maxCameraRolls = cameras?.[0]?.roll_count ? parseInt(cameras[0].roll_count) : 0;
  const maxStockRolls = filmStocks?.[0]?.roll_count ? parseInt(filmStocks[0].roll_count) : 0;

  // Monthly bar chart
  const monthMap = {};
  monthlyActivity?.forEach(m => { monthMap[parseInt(m.month)] = parseInt(m.roll_count); });
  const maxMonth = Math.max(...Object.values(monthMap), 1);

  // Push/pull
  const totalPushPull = pushPull?.reduce((s, r) => s + parseInt(r.roll_count), 0) || 0;

  // Film type totals
  const typeMap = {};
  filmTypes?.forEach(t => { typeMap[t.type] = parseInt(t.roll_count); });

  return (
    <div style={{ maxWidth: 390, margin: '0 auto', paddingBottom: '5rem' }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1rem 0.5rem',
        position: 'sticky', top: 0,
        background: '#0a0a0a',
        zIndex: 10,
      }}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f0f0f0' }}>
          Stats
        </h1>
      </div>

      <div style={{ padding: '1rem' }}>

        {/* Overview */}
        <Section title="Overview">
          <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
            <StatBlock label="Rolls" value={totalRolls || null} color="#e8d5b0" />
            <StatBlock
              label="This Year"
              value={rollsThisYear || null}
              color="#f0f0f0"
              sub={rollsLastYear > 0 ? (
                yearDelta > 0 ? `↑ ${yearDelta} vs last year` :
                yearDelta < 0 ? `↓ ${Math.abs(yearDelta)} vs last year` :
                'same as last year'
              ) : null}
            />
            <StatBlock label="Frames" value={totalFrames || null} color="#f0f0f0" />
          </div>
          <div>
            <StatBlock
              label="Total Spent"
              value={totalSpent > 0 ? `$${totalSpent.toFixed(2)}` : null}
              color="#10b981"
            />
          </div>
        </Section>

        {/* Cameras */}
        <Section title="Cameras">
          {cameras?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {cameras.map(c => (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.82rem', color: '#f0f0f0', minWidth: 110, flex: 1 }}>{c.name}</span>
                  <Bar value={parseInt(c.roll_count)} max={maxCameraRolls} />
                  <span style={{ fontSize: '0.75rem', fontFamily: 'ui-monospace, monospace', color: '#666', minWidth: 20, textAlign: 'right' }}>{c.roll_count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.8rem', color: '#333', fontStyle: 'italic' }}>No camera data yet.</p>
          )}
        </Section>

        {/* Film Stocks */}
        <Section title="Film Stocks">
          {filmStocks?.length > 0 ? (
            <>
              {/* Type breakdown */}
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
                {[['color', 'Color'], ['bw', 'B&W'], ['slide', 'Slide']].map(([key, label]) => (
                  <div key={key}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f0f0f0', letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {typeMap[key] || <span style={{ color: '#2a2a2a' }}>—</span>}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#444', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: '0.15rem' }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {filmStocks.map((s, i) => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.82rem', color: i === 0 ? '#e8d5b0' : '#f0f0f0', flex: 1 }}>
                      {s.name}
                    </span>
                    <Bar value={parseInt(s.roll_count)} max={maxStockRolls} color={i === 0 ? '#e8d5b0' : '#444'} />
                    <span style={{ fontSize: '0.75rem', fontFamily: 'ui-monospace, monospace', color: '#666', minWidth: 20, textAlign: 'right' }}>{s.roll_count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ fontSize: '0.8rem', color: '#333', fontStyle: 'italic' }}>No film stock data yet.</p>
          )}
        </Section>

        {/* Labs */}
        <Section title="Labs">
          {labs?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {labs.map(l => (
                <div key={l.name} style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f0f0f0' }}>{l.name}</span>
                    <span style={{ fontSize: '0.72rem', fontFamily: 'ui-monospace, monospace', color: '#666' }}>
                      {l.roll_count} {parseInt(l.roll_count) === 1 ? 'roll' : 'rolls'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#555' }}>Turnaround</div>
                      <div style={{ fontSize: '0.85rem', color: '#f0f0f0', fontWeight: 600 }}>
                        {parseInt(l.turnaround_count) >= 2
                          ? `${l.avg_turnaround_days}d`
                          : <span style={{ color: '#333', fontSize: '0.72rem' }}>not enough data</span>
                        }
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#555' }}>Avg cost</div>
                      <div style={{ fontSize: '0.85rem', color: '#f0f0f0', fontWeight: 600 }}>
                        {l.avg_cost ? `$${parseFloat(l.avg_cost).toFixed(2)}` : <span style={{ color: '#333', fontSize: '0.72rem' }}>—</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.8rem', color: '#333', fontStyle: 'italic' }}>No lab data yet.</p>
          )}
        </Section>

        {/* Shooting Patterns */}
        <Section title="Shooting Patterns">
          {/* Monthly bars */}
          <div style={{ marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.65rem', color: '#555', marginBottom: '0.5rem' }}>This Year</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 40 }}>
              {MONTHS.map((m, i) => {
                const count = monthMap[i + 1] || 0;
                const pct = count / maxMonth;
                return (
                  <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{
                      width: '100%',
                      height: Math.max(count > 0 ? 4 : 1, pct * 36),
                      background: count > 0 ? '#e8d5b0' : '#1e1e1e',
                      borderRadius: 2,
                      transition: 'height 0.3s',
                    }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '3px', marginTop: '0.3rem' }}>
              {MONTHS.map(m => (
                <div key={m} style={{ flex: 1, fontSize: '0.45rem', color: '#333', textAlign: 'center' }}>{m[0]}</div>
              ))}
            </div>
          </div>

          {/* Push/pull */}
          {pushPull?.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.65rem', color: '#555', marginBottom: '0.5rem' }}>Push / Pull</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {pushPull.map(p => (
                  <div key={p.push_pull} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'ui-monospace, monospace', color: p.push_pull === 'box' ? '#888' : '#8b5cf6', minWidth: 32 }}>
                      {p.push_pull}
                    </span>
                    <Bar value={parseInt(p.roll_count)} max={totalPushPull} color={p.push_pull === 'box' ? '#444' : '#8b5cf6'} />
                    <span style={{ fontSize: '0.72rem', color: '#555', minWidth: 32, textAlign: 'right' }}>
                      {Math.round((parseInt(p.roll_count) / totalPushPull) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Avg frames */}
          {totalRolls > 0 && totalFrames > 0 && (
            <StatBlock
              label="Avg frames / roll"
              value={Math.round(totalFrames / totalRolls) || null}
              color="#f0f0f0"
            />
          )}
        </Section>

        {/* Personal Bests */}
        <Section title="Personal Bests">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {[
              {
                label: 'Longest active roll',
                value: personalBests?.oldest_active_days != null
                  ? `${personalBests.oldest_active_days}d`
                  : null,
                sub: personalBests?.oldest_active_roll_name,
              },
              {
                label: 'Fastest turnaround',
                value: personalBests?.fastest_turnaround_days != null
                  ? `${personalBests.fastest_turnaround_days}d`
                  : null,
                sub: personalBests?.fastest_turnaround_lab,
              },
              {
                label: 'Most frames on a roll',
                value: personalBests?.most_frames_on_roll ?? null,
              },
            ].map(({ label, value, sub }) => (
              <div
                key={label}
                style={{
                  background: '#141414',
                  border: '1px solid #1e1e1e',
                  borderRadius: 8,
                  padding: '0.65rem 0.875rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>{label}</div>
                  {sub && <div style={{ fontSize: '0.7rem', color: '#444', marginTop: '0.1rem' }}>{sub}</div>}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e8d5b0', letterSpacing: '-0.03em' }}>
                  {value ?? <span style={{ color: '#2a2a2a', fontSize: '1rem' }}>—</span>}
                </div>
              </div>
            ))}
          </div>
        </Section>

      </div>
      <BottomNav />
    </div>
  );
}

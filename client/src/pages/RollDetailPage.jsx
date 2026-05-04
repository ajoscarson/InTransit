import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, Trash2, ExternalLink, Plus, Check, MapPin, X, Pencil } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useRolls, useDeleteRoll } from '../hooks/useRolls';
import BottomNav from '../components/BottomNav';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import FrameLogger from '../components/FrameLogger';

const STATUSES = ['shot', 'sent', 'developing', 'returned', 'archived'];

function detectCarrier(num) {
  const n = num.trim().toUpperCase().replace(/\s/g, '');
  if (/^1Z/.test(n)) return 'ups';
  if (/^(94|93|92|95|420)\d{18,}$/.test(n) || /^[A-Z]{2}\d{9}US$/.test(n)) return 'usps';
  if (/^(JD|GM)\d{16}$/.test(n) || /^\d{10}$/.test(n)) return 'dhl';
  if (/^\d{12}$/.test(n) || /^\d{15}$/.test(n) || /^\d{20}$/.test(n)) return 'fedex';
  return null;
}

function trackingUrl(number, carrier) {
  const n = encodeURIComponent(number.trim());
  if (carrier === 'ups')   return `https://www.ups.com/track?tracknum=${n}`;
  if (carrier === 'usps')  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
  if (carrier === 'fedex') return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
  if (carrier === 'dhl')   return `https://www.dhl.com/en/express/tracking.html?AWB=${n}`;
  return `https://www.google.com/search?q=${n}+package+tracking`;
}

function useRollDetail(id) {
  return useQuery({
    queryKey: ['roll-detail', id],
    queryFn: async () => {
      const { data } = await api.get('/api/rolls');
      return data.find((r) => r.id === id) || null;
    },
    enabled: !!id,
  });
}

function useLabOrders(rollId) {
  return useQuery({
    queryKey: ['lab-orders', rollId],
    queryFn: () => api.get(`/api/lab-orders/${rollId}`).then((r) => r.data),
    enabled: !!rollId,
  });
}

function useLabs() {
  return useQuery({
    queryKey: ['labs'],
    queryFn: () => api.get('/api/labs').then((r) => r.data),
  });
}

function useScans(rollId) {
  return useQuery({
    queryKey: ['scans', rollId],
    queryFn: () => api.get(`/api/scans/${rollId}`).then((r) => r.data),
    enabled: !!rollId,
  });
}

function useRollLocations(rollId) {
  return useQuery({
    queryKey: ['roll-locations', rollId],
    queryFn: () => api.get(`/api/roll-locations/${rollId}`).then((r) => r.data),
    enabled: !!rollId,
  });
}

export default function RollDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: roll, isLoading } = useRollDetail(id);
  const { data: labOrders = [] } = useLabOrders(id);
  const { data: labs = [] } = useLabs();
  const { data: scans = [] } = useScans(id);
  const { data: locations = [] } = useRollLocations(id);
  const deleteRoll = useDeleteRoll();

  // Location add state
  const [newLocation, setNewLocation] = useState('');
  const [newFrameStart, setNewFrameStart] = useState('');
  const [newFrameEnd, setNewFrameEnd] = useState('');
  const [newLocationNotes, setNewLocationNotes] = useState('');
  const [addingLocation, setAddingLocation] = useState(false);
  const [showLocationForm, setShowLocationForm] = useState(false);

  // Send to lab form state
  const [labId, setLabId] = useState('');
  const [service, setService] = useState('dev_scan');
  const [sentDate, setSentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [labCost, setLabCost] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [showSendToLab, setShowSendToLab] = useState(false);
  const [sendingToLab, setSendingToLab] = useState(false);

  // Mark returned state
  const [markingReturned, setMarkingReturned] = useState(false);
  const [returnDate, setReturnDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showRollInfo, setShowRollInfo] = useState(false);

  // Scan add state
  const [newScanLink, setNewScanLink] = useState('');
  const [newScanNotes, setNewScanNotes] = useState('');
  const [addingScan, setAddingScan] = useState(false);

  const [error, setError] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const latestOrder = labOrders[0] || null;

  async function handleSendToLab(e) {
    e.preventDefault();
    if (!labId) return;
    setSendingToLab(true);
    setError('');
    try {
      const tn = trackingNumber.trim();
      await api.post('/api/lab-orders', {
        roll_id: id,
        lab_id: labId,
        sent_date: sentDate,
        service,
        cost: labCost || undefined,
        tracking_number: tn || undefined,
        carrier: tn ? (detectCarrier(tn) || 'other') : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['roll-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['rolls'] });
      queryClient.invalidateQueries({ queryKey: ['lab-orders', id] });
      setShowSendToLab(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send to lab');
    } finally {
      setSendingToLab(false);
    }
  }

  async function handleMarkReturned(e) {
    e.preventDefault();
    if (!latestOrder) return;
    setMarkingReturned(true);
    setError('');
    try {
      await api.put(`/api/lab-orders/${latestOrder.id}`, { actual_return_date: returnDate });
      queryClient.invalidateQueries({ queryKey: ['roll-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['rolls'] });
      queryClient.invalidateQueries({ queryKey: ['lab-orders', id] });
      setShowReturnForm(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to mark as returned');
    } finally {
      setMarkingReturned(false);
    }
  }

  async function handleAddScan(e) {
    e.preventDefault();
    if (!newScanLink.trim()) return;
    setAddingScan(true);
    setError('');
    try {
      await api.post('/api/scans', {
        roll_id: id,
        dropbox_link: newScanLink.trim(),
        notes: newScanNotes.trim() || undefined,
        returned_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['scans', id] });
      setNewScanLink('');
      setNewScanNotes('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add scan link');
    } finally {
      setAddingScan(false);
    }
  }

  async function handleAddLocation(e) {
    e.preventDefault();
    if (!newLocation.trim()) return;
    setAddingLocation(true);
    setError('');
    try {
      await api.post('/api/roll-locations', {
        roll_id: id,
        location: newLocation.trim(),
        frame_start: newFrameStart ? Number(newFrameStart) : undefined,
        frame_end: newFrameEnd ? Number(newFrameEnd) : undefined,
        notes: newLocationNotes.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['roll-locations', id] });
      setNewLocation('');
      setNewFrameStart('');
      setNewFrameEnd('');
      setNewLocationNotes('');
      setShowLocationForm(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add location');
    } finally {
      setAddingLocation(false);
    }
  }

  async function handleDeleteLocation(locationId) {
    try {
      await api.delete(`/api/roll-locations/${locationId}`);
      queryClient.invalidateQueries({ queryKey: ['roll-locations', id] });
    } catch (err) {
      setError('Failed to delete location');
    }
  }

  async function handleSaveName() {
    try {
      await api.put(`/api/rolls/${id}`, { name: nameInput.trim() || null });
      queryClient.invalidateQueries({ queryKey: ['roll-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['rolls'] });
      setEditingName(false);
    } catch {
      setError('Failed to save name');
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this roll? This cannot be undone.')) return;
    await deleteRoll.mutateAsync(id);
    navigate('/');
  }

  async function handleDeleteScan(scanId) {
    try {
      await api.delete(`/api/scans/${scanId}`);
      queryClient.invalidateQueries({ queryKey: ['scans', id] });
    } catch (err) {
      setError('Failed to delete scan');
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (!roll) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#666' }}>
        Roll not found.
      </div>
    );
  }

  const statusIndex = STATUSES.indexOf(roll.status);

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
          borderBottom: '1px solid #2a2a2a',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: '#1e1e1e',
            border: '1px solid #2a2a2a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#888',
            cursor: 'pointer',
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700, flex: 1, textAlign: 'center' }}>
          Roll Detail
        </h1>
        <button
          onClick={handleDelete}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: '#1e1e1e',
            border: '1px solid #2a2a2a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#888',
            cursor: 'pointer',
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div style={{ padding: '1rem' }}>
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

        {/* Roll info header */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <button
            onClick={() => setShowRollInfo(v => !v)}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <div style={{ textAlign: 'left' }}>
              {roll.name && (
                <p style={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.2rem' }}>
                  {roll.name}
                </p>
              )}
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f0f0f0' }}>
                {roll.film_stock_name || 'Unknown Film'}
              </h2>
              {roll.film_stock_brand && (
                <p style={{ fontSize: '0.8rem', color: '#c4a96a', marginTop: 2 }}>
                  {roll.film_stock_brand}
                  {roll.film_stock_iso ? ` · ISO ${roll.film_stock_iso}` : ''}
                  {roll.camera_name && !showRollInfo ? <span style={{ color: '#555' }}> · {roll.camera_name}</span> : null}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
              <StatusBadge status={roll.status} />
              <span style={{ fontSize: '0.7rem', color: '#444' }}>{showRollInfo ? '↑' : '↓'}</span>
            </div>
          </button>

          {showRollInfo && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #1e1e1e' }}>
                {roll.camera_name && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Camera</span>
                    <span style={{ fontSize: '0.8rem', color: '#f0f0f0' }}>{roll.camera_name}</span>
                  </div>
                )}
                {roll.location && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Location</span>
                    <span style={{ fontSize: '0.8rem', color: '#f0f0f0' }}>{roll.location}</span>
                  </div>
                )}
                {roll.shoot_date && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Shot</span>
                    <span style={{ fontSize: '0.8rem', color: '#f0f0f0' }}>
                      {format(parseISO(roll.shoot_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                {roll.frames_shot && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Frames</span>
                    <span style={{ fontSize: '0.8rem', color: '#f0f0f0' }}>{roll.frames_shot}</span>
                  </div>
                )}
                {roll.push_pull && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Push/Pull</span>
                    <span style={{ fontSize: '0.8rem', color: roll.push_pull === 'box' ? '#888' : '#8b5cf6', fontWeight: 700 }}>
                      {roll.push_pull}
                    </span>
                  </div>
                )}
              </div>
              {roll.notes && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #1e1e1e' }}>
                  <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.2rem' }}>Notes</p>
                  <p style={{ fontSize: '0.875rem', color: '#d0d0d0', lineHeight: 1.5 }}>{roll.notes}</p>
                </div>
              )}

              {/* Roll name edit */}
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #1e1e1e' }}>
                {editingName ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      autoFocus
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                      placeholder="e.g. Labor Day Camping Trip"
                      style={{ flex: 1, fontSize: '0.875rem' }}
                    />
                    <button onClick={handleSaveName} style={{ background: 'none', border: 'none', color: '#e8d5b0', cursor: 'pointer', display: 'flex' }}>
                      <Check size={16} />
                    </button>
                    <button onClick={() => setEditingName(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', display: 'flex' }}>
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setNameInput(roll.name || ''); setEditingName(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                  >
                    <Pencil size={12} />
                    {roll.name ? 'Edit name' : 'Add a name to this roll'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Locations */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <p style={{ fontSize: '0.7rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Locations
            </p>
            <button
              onClick={() => {
                const maxEnd = locations.reduce((max, l) => Math.max(max, l.frame_end ?? 0), 0);
                if (maxEnd > 0) setNewFrameStart(String(maxEnd + 1));
                setShowLocationForm((v) => !v);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: '#e8d5b0', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <Plus size={14} /> Add
            </button>
          </div>

          {locations.length === 0 && !showLocationForm && (
            <p style={{ fontSize: '0.8rem', color: '#444', fontStyle: 'italic' }}>No locations logged yet.</p>
          )}

          {locations.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: showLocationForm ? '0.75rem' : 0 }}>
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    background: '#141414',
                    borderRadius: 8,
                    border: '1px solid #2a2a2a',
                  }}
                >
                  <MapPin size={13} color="#c4a96a" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.85rem', color: '#f0f0f0' }}>{loc.location}</span>
                    {(loc.frame_start || loc.frame_end) && (
                      <span style={{ fontSize: '0.75rem', color: '#666', marginLeft: '0.5rem' }}>
                        frames {loc.frame_start ?? '?'}–{loc.frame_end ?? '?'}
                      </span>
                    )}
                    {loc.notes && (
                      <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.15rem' }}>{loc.notes}</p>
                    )}
                  </div>
                  <button onClick={() => handleDeleteLocation(loc.id)} style={{ color: '#444', cursor: 'pointer', flexShrink: 0 }}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showLocationForm && (
            <form onSubmit={handleAddLocation} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Location name (e.g. Denver, CO)"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                autoFocus
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <input
                  type="number"
                  placeholder="Frame start"
                  min={1}
                  value={newFrameStart}
                  onChange={(e) => setNewFrameStart(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Frame end"
                  min={1}
                  value={newFrameEnd}
                  onChange={(e) => setNewFrameEnd(e.target.value)}
                />
              </div>
              <input
                type="text"
                placeholder="Notes (optional)"
                value={newLocationNotes}
                onChange={(e) => setNewLocationNotes(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={addingLocation || !newLocation.trim()}
                  className="btn btn-primary"
                  style={{ flex: 1, height: 40 }}
                >
                  {addingLocation ? <LoadingSpinner size={16} /> : 'Add Location'}
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ height: 40, padding: '0 0.75rem', background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#888' }}
                  onClick={() => setShowLocationForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Frame logger */}
        <FrameLogger rollId={id} roll={roll} locations={locations} />

        {/* Status timeline */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.7rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>
            Timeline
          </p>
          <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
            {['shot', 'sent', 'developing', 'returned'].map((s, i) => {
              const isComplete = statusIndex > i;
              const isCurrent = STATUSES[statusIndex] === s;
              const statusColors = {
                shot: '#4a9eff',
                sent: '#f59e0b',
                developing: '#8b5cf6',
                returned: '#10b981',
              };
              const color = statusColors[s];
              return (
                <React.Fragment key={s}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', flex: 1 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: isComplete || isCurrent ? color : '#2a2a2a',
                        border: `2px solid ${isComplete || isCurrent ? color : '#2a2a2a'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s',
                      }}
                    >
                      {isComplete && <Check size={14} color="#fff" strokeWidth={3} />}
                      {isCurrent && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                    </div>
                    <span
                      style={{
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: isComplete || isCurrent ? color : '#444',
                      }}
                    >
                      {s}
                    </span>
                  </div>
                  {i < 3 && (
                    <div
                      style={{
                        height: 2,
                        flex: 1,
                        background: statusIndex > i ? statusColors[STATUSES[i + 1]] : '#2a2a2a',
                        marginBottom: '1.2rem',
                        transition: 'background 0.3s',
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Roll complete CTA */}
        {roll.status === 'shot' && !showSendToLab && (
          <button
            onClick={() => setShowSendToLab(true)}
            className="btn btn-primary btn-full"
            style={{ height: 52, fontSize: '1rem', marginBottom: '1rem', letterSpacing: '-0.01em' }}
          >
            Roll Complete — Send to Lab
          </button>
        )}

        {/* Send to lab form — shown after tapping Roll Complete */}
        {roll.status === 'shot' && showSendToLab && (
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f0f0f0' }}>Send to Lab</span>
              <button
                type="button"
                onClick={() => setShowSendToLab(false)}
                style={{ fontSize: '0.78rem', color: '#555', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
            <form onSubmit={handleSendToLab} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Lab</label>
                <select value={labId} onChange={(e) => setLabId(e.target.value)} required>
                  <option value="">— Choose a lab —</option>
                  {labs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}{l.is_partner ? ' ★' : ''} ({l.avg_turnaround_days}d avg)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Service</label>
                <select value={service} onChange={(e) => setService(e.target.value)}>
                  <option value="dev_only">Develop only</option>
                  <option value="dev_scan">Develop + Scan</option>
                  <option value="dev_scan_print">Develop + Scan + Print</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Sent Date</label>
                <input type="date" value={sentDate} onChange={(e) => setSentDate(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Cost (optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={labCost}
                  onChange={(e) => setLabCost(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Tracking Number (optional)</label>
                <input
                  type="text"
                  placeholder="Paste tracking number"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}
                />
              </div>
              <button
                type="submit"
                disabled={sendingToLab || !labId}
                className="btn btn-primary btn-full"
              >
                {sendingToLab ? <LoadingSpinner size={18} /> : 'Mark as Sent'}
              </button>
            </form>
          </div>
        )}

        {/* Lab order summary — read-only when sent/developing */}
        {['sent', 'developing'].includes(roll.status) && latestOrder && (
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f0f0f0' }}>{latestOrder.lab_name}</span>
              {latestOrder.estimated_return_date && (
                <span style={{ fontSize: '0.78rem', color: '#f59e0b' }}>
                  est. {format(parseISO(latestOrder.estimated_return_date), 'MMM d')}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
              {latestOrder.service && (
                <span style={{ fontSize: '0.72rem', color: '#555' }}>{latestOrder.service.replace(/_/g, ' ')}</span>
              )}
              {latestOrder.sent_date && (
                <span style={{ fontSize: '0.72rem', color: '#555' }}>
                  sent {format(parseISO(latestOrder.sent_date), 'MMM d')}
                </span>
              )}
              {latestOrder.cost && (
                <span style={{ fontSize: '0.72rem', color: '#555' }}>${parseFloat(latestOrder.cost).toFixed(2)}</span>
              )}
            </div>
            {latestOrder.tracking_number && (
              <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', fontFamily: 'ui-monospace, monospace', color: '#555' }}>
                  {latestOrder.tracking_number}
                </span>
                <a
                  href={trackingUrl(latestOrder.tracking_number, latestOrder.carrier)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', color: '#e8d5b0', flexShrink: 0 }}
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            )}

            <div style={{ marginTop: '0.85rem' }}>
              {!showReturnForm ? (
              <button
                className="btn btn-full"
                style={{ background: '#10b98120', color: '#10b981', border: '1px solid #10b98140' }}
                onClick={() => setShowReturnForm(true)}
              >
                <Check size={16} /> Mark as Returned
              </button>
            ) : (
              <form onSubmit={handleMarkReturned} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Return Date</label>
                  <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} required />
                </div>
                <button
                  type="submit"
                  disabled={markingReturned}
                  className="btn btn-primary"
                  style={{ height: 44, padding: '0 1rem' }}
                >
                  {markingReturned ? <LoadingSpinner size={16} /> : 'Confirm'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ height: 44, padding: '0 0.75rem' }}
                  onClick={() => setShowReturnForm(false)}
                >
                  <X size={16} />
                </button>
              </form>
            )}
            </div>
          </div>
        )}

        {/* Scans section */}
        {roll.status === 'returned' && (
          <div className="card" style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.7rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>
              Scan Links
            </p>

            {scans.length > 0 && (
              <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {scans.map((scan) => (
                  <div
                    key={scan.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      background: '#141414',
                      borderRadius: 8,
                      border: '1px solid #2a2a2a',
                    }}
                  >
                    <ExternalLink size={14} color="#888" style={{ flexShrink: 0 }} />
                    <a
                      href={scan.dropbox_link || scan.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1,
                        fontSize: '0.8rem',
                        color: '#e8d5b0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {scan.dropbox_link || scan.file_url}
                    </a>
                    <button
                      onClick={() => handleDeleteScan(scan.id)}
                      style={{ color: '#666', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddScan}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input
                  type="url"
                  placeholder="Dropbox or Drive link..."
                  value={newScanLink}
                  onChange={(e) => setNewScanLink(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={newScanNotes}
                  onChange={(e) => setNewScanNotes(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={addingScan || !newScanLink.trim()}
                  className="btn btn-ghost btn-full"
                  style={{ border: '1px dashed #2a2a2a' }}
                >
                  {addingScan ? <LoadingSpinner size={16} /> : <><Plus size={15} /> Add Scan Link</>}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

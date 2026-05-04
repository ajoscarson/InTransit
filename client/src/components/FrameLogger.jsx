import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, ChevronDown, ChevronUp, Pencil, X } from 'lucide-react';
import api from '../lib/api';
import LoadingSpinner from './LoadingSpinner';
import LightMeter from './LightMeter';

const APERTURES = ['f/1.4','f/1.8','f/2','f/2.8','f/4','f/5.6','f/8','f/11','f/16'];
const SHUTTERS  = ['1/1000','1/500','1/250','1/125','1/60','1/30','1/15','1/8','1/4','1/2','1s','2s','B'];

const LS_APERTURE = 'fl_last_aperture';
const LS_SHUTTER  = 'fl_last_shutter';
const LS_MORE     = 'fl_more_open';

function QuickPicker({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(value === o ? '' : o)}
          style={{
            padding: '0.35rem 0.6rem',
            fontSize: '0.78rem',
            fontFamily: 'ui-monospace, monospace',
            borderRadius: 6,
            background: value === o ? '#e8d5b0' : '#1a1a1a',
            color: value === o ? '#1a1208' : '#666',
            border: `1px solid ${value === o ? '#e8d5b0' : '#252525'}`,
            cursor: 'pointer',
            minHeight: 36,
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export default function FrameLogger({ rollId, roll, locations = [] }) {
  const queryClient = useQueryClient();

  const { data: frames = [], isLoading } = useQuery({
    queryKey: ['roll-frames', rollId],
    queryFn: () => api.get(`/api/roll-frames/${rollId}`).then((r) => r.data),
    enabled: !!rollId,
  });

  const nextFrame = frames.length > 0
    ? Math.max(...frames.map((f) => f.frame_number)) + 1
    : 1;

  const [frameNum, setFrameNum]   = useState('');
  const [aperture, setAperture]   = useState('');
  const [shutter, setShutter]     = useState('');
  const [lastAperture, setLastAperture] = useState(() => localStorage.getItem(LS_APERTURE) || '');
  const [lastShutter, setLastShutter]   = useState(() => localStorage.getItem(LS_SHUTTER) || '');
  const [notes, setNotes]         = useState('');
  const [showMore, setShowMore]   = useState(() => localStorage.getItem(LS_MORE) === 'true');
  const [meteredAperture, setMeteredAperture] = useState('');
  const [meteredShutter, setMeteredShutter]   = useState('');
  const [locationId, setLocationId]           = useState('');
  const [newLocationText, setNewLocationText] = useState('');

  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showMeter, setShowMeter] = useState(false);

  // Edit state
  const [editingId, setEditingId]                   = useState(null);
  const [editAperture, setEditAperture]             = useState('');
  const [editShutter, setEditShutter]               = useState('');
  const [editMeteredAperture, setEditMeteredAperture] = useState('');
  const [editMeteredShutter, setEditMeteredShutter]   = useState('');
  const [editNotes, setEditNotes]                   = useState('');
  const [editSaving, setEditSaving]                 = useState(false);
  const [expanded, setExpanded]                     = useState(null);

  const [localLocations, setLocalLocations] = useState(locations);
  useEffect(() => { setLocalLocations(locations); }, [locations]);

  // Persist more toggle
  useEffect(() => {
    localStorage.setItem(LS_MORE, String(showMore));
  }, [showMore]);

  function openForm() {
    setFrameNum(String(nextFrame));
    setNotes('');
    setMeteredAperture('');
    setMeteredShutter('');
    setLocationId('');
    setNewLocationText('');
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!frameNum) return;
    setSaving(true);
    setError('');

    let resolvedLocationId = locationId || undefined;
    if (newLocationText.trim()) {
      try {
        const { data: newLoc } = await api.post('/api/roll-locations', {
          roll_id: rollId,
          location: newLocationText.trim(),
        });
        resolvedLocationId = newLoc.id;
        setLocalLocations((prev) => [...prev, newLoc]);
        queryClient.invalidateQueries({ queryKey: ['roll-locations', rollId] });
        setNewLocationText('');
      } catch {
        // proceed without location
      }
    }

    try {
      await api.post('/api/roll-frames', {
        roll_id: rollId,
        frame_number: Number(frameNum),
        aperture: aperture || undefined,
        shutter_speed: shutter || undefined,
        metered_aperture: meteredAperture || undefined,
        metered_shutter: meteredShutter || undefined,
        notes: notes.trim() || undefined,
        location_id: resolvedLocationId,
      });

      if (aperture) { localStorage.setItem(LS_APERTURE, aperture); setLastAperture(aperture); }
      if (shutter)  { localStorage.setItem(LS_SHUTTER, shutter);  setLastShutter(shutter); }

      queryClient.invalidateQueries({ queryKey: ['roll-frames', rollId] });
      setFrameNum(String(Number(frameNum) + 1));
      setAperture('');
      setShutter('');
      setNotes('');
      setMeteredAperture('');
      setMeteredShutter('');
      setLocationId('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save frame');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(frame) {
    setEditingId(frame.id);
    setEditAperture(frame.aperture || '');
    setEditShutter(frame.shutter_speed || '');
    setEditMeteredAperture(frame.metered_aperture || '');
    setEditMeteredShutter(frame.metered_shutter || '');
    setEditNotes(frame.notes || '');
  }

  async function handleUpdate(frameId) {
    setEditSaving(true);
    try {
      await api.put(`/api/roll-frames/${frameId}`, {
        aperture: editAperture || null,
        shutter_speed: editShutter || null,
        metered_aperture: editMeteredAperture || null,
        metered_shutter: editMeteredShutter || null,
        notes: editNotes.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ['roll-frames', rollId] });
      setEditingId(null);
    } catch {
      // ignore
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/api/roll-frames/${id}`);
      queryClient.invalidateQueries({ queryKey: ['roll-frames', rollId] });
      if (expanded === id) setExpanded(null);
    } catch {
      // ignore
    }
  }

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <p style={{ fontSize: '0.7rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Frames {frames.length > 0 && <span style={{ color: '#444', fontWeight: 400 }}>({frames.length})</span>}
        </p>
        <button
          onClick={showForm ? () => setShowForm(false) : openForm}
          style={{ fontSize: '0.75rem', color: '#e8d5b0', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {showForm ? 'Cancel' : '+ Log Frame'}
        </button>
      </div>

      {/* Log form */}
      {showForm && (
        <form onSubmit={handleSave} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #1e1e1e' }}>
          {error && <p style={{ fontSize: '0.8rem', color: '#f87171', marginBottom: '0.5rem' }}>{error}</p>}

          {/* Frame + Notes row */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
            <div style={{ width: 60, flexShrink: 0 }}>
              <label style={{ fontSize: '0.6rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.25rem' }}>Frame</label>
              <input
                type="number"
                min={1}
                value={frameNum}
                onChange={(e) => setFrameNum(e.target.value)}
                style={{ fontFamily: 'ui-monospace, monospace', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', padding: '0.5rem 0.25rem' }}
                autoFocus
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.6rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.25rem' }}>Notes</label>
              <textarea
                placeholder="Wide open, backlit, wasn't sure..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                style={{ resize: 'none', fontSize: '0.875rem' }}
              />
            </div>
          </div>

          {/* Same as last */}
          {(lastAperture || lastShutter) && !aperture && !shutter && (
            <button
              type="button"
              onClick={() => { setAperture(lastAperture); setShutter(lastShutter); }}
              style={{
                fontSize: '0.68rem',
                color: '#666',
                background: 'none',
                border: '1px solid #252525',
                borderRadius: 4,
                padding: '0.25rem 0.6rem',
                cursor: 'pointer',
                marginBottom: '0.75rem',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              Same as last: {[lastAperture, lastShutter].filter(Boolean).join(' · ')}
            </button>
          )}

          {/* Aperture */}
          <div style={{ marginBottom: '0.6rem' }}>
            <label style={{ fontSize: '0.6rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.25rem' }}>Aperture</label>
            <QuickPicker options={APERTURES} value={aperture} onChange={setAperture} />
          </div>

          {/* Shutter */}
          <div style={{ marginBottom: '0.85rem' }}>
            <label style={{ fontSize: '0.6rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.25rem' }}>Shutter</label>
            <QuickPicker options={SHUTTERS} value={shutter} onChange={setShutter} />
          </div>

          {/* More toggle */}
          <button
            type="button"
            onClick={() => setShowMore(v => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.72rem',
              color: '#444',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              marginBottom: showMore ? '0.75rem' : '0.85rem',
            }}
          >
            {showMore ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showMore ? 'Less' : 'More'}
          </button>

          {/* Advanced fields */}
          {showMore && (
            <div style={{ marginBottom: '0.85rem', paddingLeft: '0.75rem', borderLeft: '1px solid #1e1e1e' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.6rem', color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Metered Exposure</label>
                <button
                  type="button"
                  onClick={() => setShowMeter(true)}
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#8b5cf6',
                    background: 'none',
                    border: '1px solid #2a1f3d',
                    borderRadius: 4,
                    padding: '0.2rem 0.55rem',
                    cursor: 'pointer',
                  }}
                >
                  Meter
                </button>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.6rem', color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.25rem' }}>Aperture</label>
                <QuickPicker options={APERTURES} value={meteredAperture} onChange={setMeteredAperture} />
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.6rem', color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.25rem' }}>Shutter</label>
                <QuickPicker options={SHUTTERS} value={meteredShutter} onChange={setMeteredShutter} />
              </div>
              {(meteredAperture || meteredShutter) && (
                <button
                  type="button"
                  onClick={() => {
                    if (meteredAperture) setAperture(meteredAperture);
                    if (meteredShutter) setShutter(meteredShutter);
                  }}
                  style={{
                    fontSize: '0.68rem',
                    color: '#666',
                    background: 'none',
                    border: '1px solid #252525',
                    borderRadius: 4,
                    padding: '0.25rem 0.6rem',
                    cursor: 'pointer',
                    marginBottom: '0.5rem',
                  }}
                >
                  Use as shot exposure
                </button>
              )}
              <div>
                <label style={{ fontSize: '0.6rem', color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.25rem' }}>Location</label>
                {localLocations.length > 0 ? (
                  <select
                    value={locationId}
                    onChange={(e) => { setLocationId(e.target.value); setNewLocationText(''); }}
                    style={{ fontSize: '0.85rem', marginBottom: '0.35rem' }}
                  >
                    <option value="">— None —</option>
                    {localLocations.map((l) => (
                      <option key={l.id} value={l.id}>{l.location}{l.frame_start ? ` (${l.frame_start}–${l.frame_end})` : ''}</option>
                    ))}
                    <option value="__new__">+ New location…</option>
                  </select>
                ) : null}
                {(locationId === '__new__' || localLocations.length === 0) && (
                  <input
                    type="text"
                    placeholder="Type a location name"
                    value={newLocationText}
                    onChange={(e) => setNewLocationText(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !frameNum}
            className="btn btn-primary btn-full"
            style={{ height: 44 }}
          >
            {saving ? <LoadingSpinner size={16} /> : `Save Frame ${frameNum}`}
          </button>
        </form>
      )}

      {/* Frame list */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}><LoadingSpinner /></div>
      ) : frames.length === 0 ? (
        !showForm && <p style={{ fontSize: '0.8rem', color: '#444', fontStyle: 'italic' }}>No frames logged yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {frames.map((frame) => (
            <div
              key={frame.id}
              style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: '0.6rem', marginBottom: '0.6rem' }}
            >
              {editingId === frame.id ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.9rem', fontWeight: 700, color: '#e8d5b0' }}>
                      {frame.frame_number}
                    </span>
                    <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', display: 'flex' }}>
                      <X size={14} />
                    </button>
                  </div>
                  <div style={{ marginBottom: '0.4rem' }}>
                    <label style={{ fontSize: '0.6rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.15rem' }}>Aperture</label>
                    <QuickPicker options={APERTURES} value={editAperture} onChange={setEditAperture} />
                  </div>
                  <div style={{ marginBottom: '0.4rem' }}>
                    <label style={{ fontSize: '0.6rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.15rem' }}>Shutter</label>
                    <QuickPicker options={SHUTTERS} value={editShutter} onChange={setEditShutter} />
                  </div>
                  <div style={{ marginBottom: '0.4rem' }}>
                    <label style={{ fontSize: '0.6rem', color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.15rem' }}>Aperture — Metered</label>
                    <QuickPicker options={APERTURES} value={editMeteredAperture} onChange={setEditMeteredAperture} />
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.6rem', color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.15rem' }}>Shutter — Metered</label>
                    <QuickPicker options={SHUTTERS} value={editMeteredShutter} onChange={setEditMeteredShutter} />
                  </div>
                  {(editMeteredAperture || editMeteredShutter) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (editMeteredAperture) setEditAperture(editMeteredAperture);
                        if (editMeteredShutter) setEditShutter(editMeteredShutter);
                      }}
                      style={{
                        fontSize: '0.68rem',
                        color: '#666',
                        background: 'none',
                        border: '1px solid #252525',
                        borderRadius: 4,
                        padding: '0.25rem 0.6rem',
                        cursor: 'pointer',
                        marginBottom: '0.5rem',
                      }}
                    >
                      Use as shot exposure
                    </button>
                  )}
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Notes..."
                    rows={2}
                    style={{ resize: 'none', fontSize: '0.875rem', marginBottom: '0.5rem' }}
                  />
                  <button
                    onClick={() => handleUpdate(frame.id)}
                    disabled={editSaving}
                    className="btn btn-primary btn-full"
                    style={{ height: 36, fontSize: '0.8rem' }}
                  >
                    {editSaving ? <LoadingSpinner size={14} /> : 'Save'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                  <span style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: '#e8d5b0',
                    minWidth: 28,
                  }}>
                    {frame.frame_number}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {(frame.aperture || frame.shutter_speed) && (
                      <span style={{ fontSize: '0.72rem', fontFamily: 'ui-monospace, monospace', color: '#666', marginRight: '0.5rem' }}>
                        {[frame.aperture, frame.shutter_speed].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    {(frame.metered_aperture || frame.metered_shutter) && (
                      <span style={{ fontSize: '0.68rem', fontFamily: 'ui-monospace, monospace', color: '#3a3a3a', marginRight: '0.5rem' }}>
                        m: {[frame.metered_aperture, frame.metered_shutter].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    {frame.location_name && (
                      <span style={{ fontSize: '0.7rem', color: '#c4a96a' }}>{frame.location_name}</span>
                    )}
                    {frame.notes && (
                      <p style={{
                        fontSize: '0.82rem',
                        color: '#ccc',
                        marginTop: '0.15rem',
                        lineHeight: 1.4,
                        overflow: expanded === frame.id ? 'visible' : 'hidden',
                        whiteSpace: expanded === frame.id ? 'normal' : 'nowrap',
                        textOverflow: 'ellipsis',
                      }}>
                        {frame.notes}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    {frame.notes && frame.notes.length > 40 && (
                      <button
                        onClick={() => setExpanded(expanded === frame.id ? null : frame.id)}
                        style={{ color: '#444', cursor: 'pointer', background: 'none', border: 'none', display: 'flex' }}
                      >
                        {expanded === frame.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    )}
                    <button onClick={() => openEdit(frame)} style={{ color: '#444', cursor: 'pointer', background: 'none', border: 'none', display: 'flex' }}>
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => handleDelete(frame.id)} style={{ color: '#333', cursor: 'pointer', background: 'none', border: 'none', display: 'flex' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showMeter && (
        <LightMeter
          roll={roll}
          onConfirm={(aperture, shutter) => {
            setMeteredAperture(aperture);
            setMeteredShutter(shutter);
            setShowMeter(false);
          }}
          onClose={() => setShowMeter(false)}
        />
      )}
    </div>
  );
}

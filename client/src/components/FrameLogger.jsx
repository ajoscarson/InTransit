import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, ChevronDown, ChevronUp, Pencil, X, Mic, MicOff, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import api from '../lib/api';
import LoadingSpinner from './LoadingSpinner';
import LightMeter from './LightMeter';

const APERTURES = ['f/1.4','f/1.8','f/2','f/2.8','f/4','f/5.6','f/8','f/11','f/16'];
const SHUTTERS  = ['1/1000','1/500','1/250','1/125','1/60','1/30','1/15','1/8','1/4','1/2','1s','2s','B'];
const MARKERS   = ['Overcast','Sunny','Backlit','Golden hr','Indoor','Low light','Flash','Bracket'];

const LS_APERTURE = 'fl_last_aperture';
const LS_SHUTTER  = 'fl_last_shutter';
const LS_MORE     = 'fl_more_open';

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

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

function mapsUrl(lat, lng) {
  return `https://maps.google.com/maps?q=${lat},${lng}`;
}

function frameTime(created_at) {
  if (!created_at) return null;
  try { return format(parseISO(created_at), 'h:mm a'); } catch { return null; }
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

  // Form state
  const [frameNum, setFrameNum]     = useState('');
  const [aperture, setAperture]     = useState('');
  const [shutter, setShutter]       = useState('');
  const [lastAperture, setLastAperture] = useState(() => localStorage.getItem(LS_APERTURE) || '');
  const [lastShutter, setLastShutter]   = useState(() => localStorage.getItem(LS_SHUTTER) || '');
  const [notes, setNotes]           = useState('');
  const [tags, setTags]             = useState(new Set());
  const [showMore, setShowMore]     = useState(() => localStorage.getItem(LS_MORE) === 'true');
  const [meteredAperture, setMeteredAperture] = useState('');
  const [meteredShutter, setMeteredShutter]   = useState('');
  const [locationId, setLocationId]           = useState('');
  const [newLocationText, setNewLocationText] = useState('');
  const [geoCoords, setGeoCoords]   = useState(null);

  // UI state
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [showMeter, setShowMeter]   = useState(false);
  const [listening, setListening]   = useState(false);

  // Edit state
  const [editingId, setEditingId]                     = useState(null);
  const [editAperture, setEditAperture]               = useState('');
  const [editShutter, setEditShutter]                 = useState('');
  const [editMeteredAperture, setEditMeteredAperture] = useState('');
  const [editMeteredShutter, setEditMeteredShutter]   = useState('');
  const [editNotes, setEditNotes]                     = useState('');
  const [editTags, setEditTags]                       = useState(new Set());
  const [editSaving, setEditSaving]                   = useState(false);
  const [expanded, setExpanded]                       = useState(null);

  const [localLocations, setLocalLocations] = useState(locations);
  useEffect(() => { setLocalLocations(locations); }, [locations]);

  useEffect(() => {
    localStorage.setItem(LS_MORE, String(showMore));
  }, [showMore]);

  const recognitionRef = useRef(null);

  function toggleListening() {
    if (!SR) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setNotes((prev) => prev ? `${prev} ${t}` : t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  function requestGeo() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {} // silently fail — user may deny
    );
  }

  function toggleTag(tag) {
    setTags((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  function toggleEditTag(tag) {
    setEditTags((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  function openForm() {
    setFrameNum(String(nextFrame));
    setNotes('');
    setTags(new Set());
    setMeteredAperture('');
    setMeteredShutter('');
    setLocationId('');
    setNewLocationText('');
    setGeoCoords(null);
    setShowForm(true);
    requestGeo();
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
      } catch { /* proceed without */ }
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
        tags: tags.size > 0 ? [...tags].join(',') : undefined,
        latitude: geoCoords?.lat ?? undefined,
        longitude: geoCoords?.lng ?? undefined,
        location_id: resolvedLocationId,
      });

      if (aperture) { localStorage.setItem(LS_APERTURE, aperture); setLastAperture(aperture); }
      if (shutter)  { localStorage.setItem(LS_SHUTTER, shutter);  setLastShutter(shutter); }

      queryClient.invalidateQueries({ queryKey: ['roll-frames', rollId] });
      setFrameNum(String(Number(frameNum) + 1));
      setAperture('');
      setShutter('');
      setNotes('');
      setTags(new Set());
      setMeteredAperture('');
      setMeteredShutter('');
      setLocationId('');
      setGeoCoords(null);
      requestGeo(); // pre-fetch for next frame
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
    setEditTags(frame.tags ? new Set(frame.tags.split(',')) : new Set());
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
        tags: editTags.size > 0 ? [...editTags].join(',') : null,
      });
      queryClient.invalidateQueries({ queryKey: ['roll-frames', rollId] });
      setEditingId(null);
    } catch { /* ignore */ } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/api/roll-frames/${id}`);
      queryClient.invalidateQueries({ queryKey: ['roll-frames', rollId] });
      if (expanded === id) setExpanded(null);
    } catch { /* ignore */ }
  }

  const labelStyle = { fontSize: '0.6rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.25rem' };
  const dimLabelStyle = { ...labelStyle, color: '#3a3a3a' };

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

      {/* ── Log form ── */}
      {showForm && (
        <form onSubmit={handleSave} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #1e1e1e' }}>
          {error && <p style={{ fontSize: '0.8rem', color: '#f87171', marginBottom: '0.5rem' }}>{error}</p>}

          {/* Frame + Notes row */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div style={{ width: 60, flexShrink: 0 }}>
              <label style={labelStyle}>Frame</label>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Notes</label>
                {SR && (
                  <button
                    type="button"
                    onClick={toggleListening}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.25rem',
                      fontSize: '0.6rem', color: listening ? '#f87171' : '#444',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    }}
                  >
                    {listening ? <MicOff size={13} /> : <Mic size={13} />}
                    {listening ? 'Stop' : 'Voice'}
                  </button>
                )}
              </div>
              <textarea
                placeholder={listening ? 'Listening…' : "Wide open, backlit, wasn't sure…"}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                style={{ resize: 'none', fontSize: '0.875rem', borderColor: listening ? '#f87171' : undefined }}
              />
            </div>
          </div>

          {/* Quick markers */}
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {MARKERS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => toggleTag(m)}
                style={{
                  padding: '0.25rem 0.55rem',
                  fontSize: '0.7rem',
                  borderRadius: 20,
                  background: tags.has(m) ? '#2a1f3d' : '#141414',
                  color: tags.has(m) ? '#c4b5fd' : '#444',
                  border: `1px solid ${tags.has(m) ? '#4c3870' : '#1e1e1e'}`,
                  cursor: 'pointer',
                }}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Same as last */}
          {(lastAperture || lastShutter) && !aperture && !shutter && (
            <button
              type="button"
              onClick={() => { setAperture(lastAperture); setShutter(lastShutter); }}
              style={{
                fontSize: '0.68rem', color: '#666', background: 'none',
                border: '1px solid #252525', borderRadius: 4, padding: '0.25rem 0.6rem',
                cursor: 'pointer', marginBottom: '0.75rem', fontFamily: 'ui-monospace, monospace',
              }}
            >
              Same as last: {[lastAperture, lastShutter].filter(Boolean).join(' · ')}
            </button>
          )}

          {/* Aperture */}
          <div style={{ marginBottom: '0.6rem' }}>
            <label style={labelStyle}>Aperture</label>
            <QuickPicker options={APERTURES} value={aperture} onChange={setAperture} />
          </div>

          {/* Shutter + Meter button */}
          <div style={{ marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Shutter</label>
              <button
                type="button"
                onClick={() => setShowMeter(true)}
                style={{
                  fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: '#8b5cf6',
                  background: '#0f0a1a', border: '1px solid #2a1f3d',
                  borderRadius: 4, padding: '0.2rem 0.65rem', cursor: 'pointer',
                }}
              >
                ▸ Meter
              </button>
            </div>
            <QuickPicker options={SHUTTERS} value={shutter} onChange={setShutter} />
          </div>

          {/* More toggle */}
          <button
            type="button"
            onClick={() => setShowMore(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              fontSize: '0.72rem', color: '#444', background: 'none', border: 'none',
              cursor: 'pointer', padding: 0, marginBottom: showMore ? '0.75rem' : '0.85rem',
            }}
          >
            {showMore ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showMore ? 'Less' : 'More'}
          </button>

          {/* More section */}
          {showMore && (
            <div style={{ marginBottom: '0.85rem', paddingLeft: '0.75rem', borderLeft: '1px solid #1e1e1e' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={dimLabelStyle}>Aperture — Metered</label>
                <QuickPicker options={APERTURES} value={meteredAperture} onChange={setMeteredAperture} />
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={dimLabelStyle}>Shutter — Metered</label>
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
                    fontSize: '0.68rem', color: '#666', background: 'none',
                    border: '1px solid #252525', borderRadius: 4,
                    padding: '0.25rem 0.6rem', cursor: 'pointer', marginBottom: '0.5rem',
                  }}
                >
                  Use as shot exposure
                </button>
              )}
              <div>
                <label style={dimLabelStyle}>Location</label>
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

          {/* GPS indicator */}
          {geoCoords && (
            <p style={{ fontSize: '0.62rem', color: '#2a2a2a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <MapPin size={10} /> Location captured
            </p>
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

      {/* ── Frame list ── */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}><LoadingSpinner /></div>
      ) : frames.length === 0 ? (
        !showForm && <p style={{ fontSize: '0.8rem', color: '#444', fontStyle: 'italic' }}>No frames logged yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {frames.map((frame) => {
            const frameTags = frame.tags ? frame.tags.split(',') : [];
            const time = frameTime(frame.created_at);
            return (
              <div key={frame.id} style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: '0.6rem', marginBottom: '0.6rem' }}>
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

                    {/* Edit markers */}
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      {MARKERS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => toggleEditTag(m)}
                          style={{
                            padding: '0.2rem 0.45rem', fontSize: '0.68rem', borderRadius: 20,
                            background: editTags.has(m) ? '#2a1f3d' : '#141414',
                            color: editTags.has(m) ? '#c4b5fd' : '#444',
                            border: `1px solid ${editTags.has(m) ? '#4c3870' : '#1e1e1e'}`,
                            cursor: 'pointer',
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </div>

                    <div style={{ marginBottom: '0.4rem' }}>
                      <label style={labelStyle}>Aperture</label>
                      <QuickPicker options={APERTURES} value={editAperture} onChange={setEditAperture} />
                    </div>
                    <div style={{ marginBottom: '0.4rem' }}>
                      <label style={labelStyle}>Shutter</label>
                      <QuickPicker options={SHUTTERS} value={editShutter} onChange={setEditShutter} />
                    </div>
                    <div style={{ marginBottom: '0.4rem' }}>
                      <label style={dimLabelStyle}>Aperture — Metered</label>
                      <QuickPicker options={APERTURES} value={editMeteredAperture} onChange={setEditMeteredAperture} />
                    </div>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <label style={dimLabelStyle}>Shutter — Metered</label>
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
                          fontSize: '0.68rem', color: '#666', background: 'none',
                          border: '1px solid #252525', borderRadius: 4,
                          padding: '0.25rem 0.6rem', cursor: 'pointer', marginBottom: '0.5rem',
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
                  <div>
                    {/* Top row: frame number, exposure, time, actions */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.95rem', fontWeight: 700, color: '#e8d5b0', minWidth: 24, flexShrink: 0 }}>
                        {frame.frame_number}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {(frame.aperture || frame.shutter_speed) && (
                          <span style={{ fontSize: '0.72rem', fontFamily: 'ui-monospace, monospace', color: '#666' }}>
                            {[frame.aperture, frame.shutter_speed].filter(Boolean).join(' · ')}
                          </span>
                        )}
                        {(frame.metered_aperture || frame.metered_shutter) && (
                          <span style={{ fontSize: '0.68rem', fontFamily: 'ui-monospace, monospace', color: '#333', marginLeft: '0.4rem' }}>
                            m: {[frame.metered_aperture, frame.metered_shutter].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </div>
                      {time && (
                        <span style={{ fontSize: '0.62rem', color: '#333', flexShrink: 0 }}>{time}</span>
                      )}
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

                    {/* Tags */}
                    {frameTags.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                        {frameTags.map((t) => (
                          <span key={t} style={{
                            fontSize: '0.62rem', color: '#6d5a9c', background: '#16102a',
                            border: '1px solid #2a1f3d', borderRadius: 20, padding: '0.1rem 0.4rem',
                          }}>{t}</span>
                        ))}
                        {frame.latitude && frame.longitude && (
                          <a
                            href={mapsUrl(frame.latitude, frame.longitude)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', fontSize: '0.62rem', color: '#444', textDecoration: 'none' }}
                          >
                            <MapPin size={9} /> GPS
                          </a>
                        )}
                      </div>
                    )}

                    {/* GPS (no tags) */}
                    {frameTags.length === 0 && frame.latitude && frame.longitude && (
                      <div style={{ marginTop: '0.3rem' }}>
                        <a
                          href={mapsUrl(frame.latitude, frame.longitude)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', fontSize: '0.62rem', color: '#444', textDecoration: 'none' }}
                        >
                          <MapPin size={9} /> GPS
                        </a>
                      </div>
                    )}

                    {/* Location name */}
                    {frame.location_name && (
                      <p style={{ fontSize: '0.7rem', color: '#c4a96a', marginTop: '0.2rem' }}>{frame.location_name}</p>
                    )}

                    {/* Notes */}
                    {frame.notes && (
                      <p style={{
                        fontSize: '0.82rem', color: '#ccc', marginTop: '0.15rem', lineHeight: 1.4,
                        overflow: expanded === frame.id ? 'visible' : 'hidden',
                        whiteSpace: expanded === frame.id ? 'normal' : 'nowrap',
                        textOverflow: 'ellipsis',
                      }}>
                        {frame.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showMeter && (
        <LightMeter
          roll={roll}
          onConfirm={(ap, sh) => {
            setMeteredAperture(ap);
            setMeteredShutter(sh);
            setShowMore(true); // auto-open More so user sees what populated
            setShowMeter(false);
          }}
          onClose={() => setShowMeter(false)}
        />
      )}
    </div>
  );
}

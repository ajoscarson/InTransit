import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { X, ChevronLeft, Plus } from 'lucide-react';
import { useCreateRoll } from '../hooks/useRolls';
import { useCameras, useCreateCamera } from '../hooks/useCameras';
import { useFilmStocks, useCreateFilmStock } from '../hooks/useFilmStocks';
import LoadingSpinner from '../components/LoadingSpinner';

const PUSH_PULL_OPTIONS = ['-3', '-2', '-1', 'box', '+1', '+2', '+3'];
const FORMAT_OPTIONS = ['35mm', '120', '4x5', 'large_format'];
const FORMAT_DEFAULT_FRAMES = { '35mm': 36, '120': 12, '4x5': 1, 'large_format': 1 };

export default function NewRollPage() {
  const navigate = useNavigate();

  const { data: filmStocks = [] } = useFilmStocks();
  const { data: cameras = [] } = useCameras();
  const createRoll = useCreateRoll();
  const createCamera = useCreateCamera();
  const createFilmStock = useCreateFilmStock();

  const today = format(new Date(), 'yyyy-MM-dd');

  const [filmStockId, setFilmStockId] = useState('');
  const [filmSearch, setFilmSearch] = useState('');
  const [cameraId, setCameraId] = useState('');
  const [shootDate, setShootDate] = useState(today);
  const [location, setLocation] = useState('');
  const [pushPull, setPushPull] = useState('box');
  const [framesShot, setFramesShot] = useState(36);
  const [notes, setNotes] = useState('');

  // Add camera inline
  const [showAddCamera, setShowAddCamera] = useState(false);
  const [newCameraName, setNewCameraName] = useState('');
  const [newCameraFormat, setNewCameraFormat] = useState('35mm');
  const [addingCamera, setAddingCamera] = useState(false);

  // Add custom film stock inline
  const [showAddFilm, setShowAddFilm] = useState(false);
  const [newFilmName, setNewFilmName] = useState('');
  const [newFilmBrand, setNewFilmBrand] = useState('');
  const [newFilmIso, setNewFilmIso] = useState('');
  const [newFilmType, setNewFilmType] = useState('color');
  const [addingFilm, setAddingFilm] = useState(false);

  const [error, setError] = useState('');

  // Group film stocks by brand with search filter
  const groupedStocks = useMemo(() => {
    const filtered = filmSearch
      ? filmStocks.filter((s) =>
          s.name.toLowerCase().includes(filmSearch.toLowerCase()) ||
          s.brand.toLowerCase().includes(filmSearch.toLowerCase())
        )
      : filmStocks;

    return filtered.reduce((acc, stock) => {
      if (!acc[stock.brand]) acc[stock.brand] = [];
      acc[stock.brand].push(stock);
      return acc;
    }, {});
  }, [filmStocks, filmSearch]);

  async function handleAddCamera() {
    if (!newCameraName.trim()) return;
    setAddingCamera(true);
    try {
      const cam = await createCamera.mutateAsync({ name: newCameraName.trim(), format: newCameraFormat });
      setCameraId(cam.id);
      setFramesShot(FORMAT_DEFAULT_FRAMES[newCameraFormat] ?? 36);
      setShowAddCamera(false);
      setNewCameraName('');
    } catch {
      // ignore — camera add failure shouldn't block roll logging
    } finally {
      setAddingCamera(false);
    }
  }

  async function handleAddFilm() {
    if (!newFilmName.trim() || !newFilmBrand.trim() || !newFilmIso) return;
    setAddingFilm(true);
    try {
      const stock = await createFilmStock.mutateAsync({
        name: newFilmName.trim(),
        brand: newFilmBrand.trim(),
        iso: Number(newFilmIso),
        type: newFilmType,
      });
      setFilmStockId(stock.id);
      setFilmSearch(stock.name);
      setShowAddFilm(false);
      setNewFilmName('');
      setNewFilmBrand('');
      setNewFilmIso('');
      setNewFilmType('color');
    } catch {
      // ignore
    } finally {
      setAddingFilm(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const payload = {
      film_stock_id: filmStockId || undefined,
      camera_id: cameraId || undefined,
      shoot_date: shootDate,
      location: location.trim() || undefined,
      push_pull: pushPull,
      frames_shot: Number(framesShot),
      notes: notes.trim() || undefined,
    };

    try {
      const roll = await createRoll.mutateAsync(payload);
      navigate(`/rolls/${roll.id}`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to log roll';
      setError(msg);
    }
  }

  return (
    <div style={{ maxWidth: 390, margin: '0 auto', paddingBottom: '2rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
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
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
          Start New Roll
        </h1>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '1rem' }}>
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

        {/* Camera */}
        <div className="form-field">
          <label>Camera</label>
          {!showAddCamera ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select
                value={cameraId}
                onChange={(e) => {
                  const newId = e.target.value;
                  const newCam = cameras.find((c) => c.id === newId);
                  const oldCam = cameras.find((c) => c.id === cameraId);
                  if (newCam?.format !== oldCam?.format) {
                    setFilmStockId('');
                    setFilmSearch('');
                  }
                  setCameraId(newId);
                  if (newCam) setFramesShot(FORMAT_DEFAULT_FRAMES[newCam.format] ?? 36);
                }}
                style={{ flex: 1 }}
              >
                <option value="">— Select camera —</option>
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.format})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowAddCamera(true)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  background: '#1e1e1e',
                  border: '1px solid #2a2a2a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#888',
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
              >
                <Plus size={18} />
              </button>
            </div>
          ) : (
            <div
              style={{
                background: '#141414',
                border: '1px solid #2a2a2a',
                borderRadius: 8,
                padding: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600 }}>Add Camera</span>
                <button type="button" onClick={() => setShowAddCamera(false)}>
                  <X size={16} color="#666" />
                </button>
              </div>
              <input
                type="text"
                placeholder="Camera name (e.g. Canon AE-1)"
                value={newCameraName}
                onChange={(e) => setNewCameraName(e.target.value)}
                style={{ marginBottom: '0.5rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  value={newCameraFormat}
                  onChange={(e) => setNewCameraFormat(e.target.value)}
                  style={{ flex: 1 }}
                >
                  {FORMAT_OPTIONS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddCamera}
                  disabled={addingCamera || !newCameraName.trim()}
                  className="btn btn-primary"
                  style={{ padding: '0 1rem', height: 44 }}
                >
                  {addingCamera ? <LoadingSpinner size={16} /> : 'Add'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Film Stock */}
        <div className="form-field">
          <label>
            Film Stock
            {cameraId && cameras.find(c => c.id === cameraId) && (
              <span style={{ color: '#444', fontWeight: 400, marginLeft: '0.5rem', fontSize: '0.65rem', textTransform: 'none', letterSpacing: 0 }}>
                {cameras.find(c => c.id === cameraId).format}
              </span>
            )}
          </label>
          {!showAddFilm ? (
            <>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <input
                  type="text"
                  placeholder="Search stocks..."
                  value={filmSearch}
                  onChange={(e) => {
                    setFilmSearch(e.target.value);
                    setFilmStockId('');
                  }}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setNewFilmName(filmSearch);
                    setShowAddFilm(true);
                  }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    background: '#1e1e1e',
                    border: '1px solid #2a2a2a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#888',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={18} />
                </button>
              </div>
              {(filmSearch || filmStockId) && (
                <select
                  value={filmStockId}
                  onChange={(e) => {
                    setFilmStockId(e.target.value);
                    const s = filmStocks.find((s) => s.id === e.target.value);
                    if (s) setFilmSearch(s.name);
                  }}
                  size={Math.min(6, Object.values(groupedStocks).flat().length + Object.keys(groupedStocks).length)}
                  style={{ height: 'auto' }}
                >
                  <option value="">— Select stock —</option>
                  {Object.entries(groupedStocks).map(([brand, stocks]) => (
                    <optgroup key={brand} label={brand}>
                      {stocks.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (ISO {s.iso})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
              {!filmSearch && !filmStockId && (
                <select
                  value={filmStockId}
                  onChange={(e) => {
                    setFilmStockId(e.target.value);
                    const s = filmStocks.find((s) => s.id === e.target.value);
                    if (s) setFilmSearch(s.name);
                  }}
                >
                  <option value="">— Select film stock —</option>
                  {Object.entries(groupedStocks).map(([brand, stocks]) => (
                    <optgroup key={brand} label={brand}>
                      {stocks.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (ISO {s.iso})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </>
          ) : (
            <div
              style={{
                background: '#141414',
                border: '1px solid #2a2a2a',
                borderRadius: 8,
                padding: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600 }}>Custom Film Stock</span>
                <button type="button" onClick={() => setShowAddFilm(false)}>
                  <X size={16} color="#666" />
                </button>
              </div>
              <input
                type="text"
                placeholder="Name (e.g. Cinestill 800T)"
                value={newFilmName}
                onChange={(e) => setNewFilmName(e.target.value)}
                style={{ marginBottom: '0.5rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Brand"
                  value={newFilmBrand}
                  onChange={(e) => setNewFilmBrand(e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  placeholder="ISO"
                  value={newFilmIso}
                  onChange={(e) => setNewFilmIso(e.target.value)}
                  style={{ width: 80 }}
                  min={1}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  value={newFilmType}
                  onChange={(e) => setNewFilmType(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="color">Color</option>
                  <option value="bw">B&W</option>
                  <option value="slide">Slide</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddFilm}
                  disabled={addingFilm || !newFilmName.trim() || !newFilmBrand.trim() || !newFilmIso}
                  className="btn btn-primary"
                  style={{ padding: '0 1rem', height: 44 }}
                >
                  {addingFilm ? <LoadingSpinner size={16} /> : 'Add'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Shoot Date */}
        <div className="form-field">
          <label>Shoot Date</label>
          <input
            type="date"
            value={shootDate}
            onChange={(e) => setShootDate(e.target.value)}
          />
        </div>

        {/* Location */}
        <div className="form-field">
          <label>Location</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="City, country, or place name"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{ paddingRight: location ? '2.5rem' : '1rem' }}
            />
            {location && (
              <button
                type="button"
                onClick={() => setLocation('')}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#666',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Push/Pull */}
        <div className="form-field">
          <label>Push / Pull</label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '0.25rem',
              background: '#0a0a0a',
              borderRadius: 8,
              padding: 4,
              border: '1px solid #2a2a2a',
            }}
          >
            {PUSH_PULL_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setPushPull(opt)}
                style={{
                  padding: '0.45rem 0',
                  borderRadius: 6,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: pushPull === opt ? '#e8d5b0' : 'transparent',
                  color: pushPull === opt ? '#1a1208' : '#666',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Frames Shot */}
        <div className="form-field">
          <label>Frames Shot</label>
          <input
            type="number"
            min={1}
            max={220}
            value={framesShot}
            onChange={(e) => setFramesShot(e.target.value)}
          />
        </div>

        {/* Notes */}
        <div className="form-field">
          <label>Notes</label>
          <textarea
            placeholder="Lighting conditions, special subjects, reminders..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{ resize: 'none' }}
          />
        </div>

        <button
          type="submit"
          disabled={createRoll.isPending}
          className="btn btn-primary btn-full"
          style={{ height: 52, fontSize: '1.05rem', marginTop: '0.5rem' }}
        >
          {createRoll.isPending ? <LoadingSpinner size={22} /> : 'Start Roll'}
        </button>
      </form>
    </div>
  );
}

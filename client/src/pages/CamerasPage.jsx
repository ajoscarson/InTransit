import React, { useState } from 'react';
import { Camera, Plus, X, Check, Pencil } from 'lucide-react';
import { useCameras, useCreateCamera, useUpdateCamera, useDeleteCamera } from '../hooks/useCameras';
import BottomNav from '../components/BottomNav';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';

const FORMAT_OPTIONS = ['35mm', '120', '4x5', 'large_format'];

const FORMAT_LABELS = {
  '35mm':         '35mm',
  '120':          '120',
  '4x5':          '4×5',
  'large_format': 'LF',
};

function CameraModal({ camera, onClose }) {
  const createCamera = useCreateCamera();
  const updateCamera = useUpdateCamera();

  const [name, setName] = useState(camera?.name || '');
  const [format, setFormat] = useState(camera?.format || '35mm');
  const [notes, setNotes] = useState(camera?.notes || '');
  const [error, setError] = useState('');

  const isEdit = !!camera;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (isEdit) {
        await updateCamera.mutateAsync({ id: camera.id, name, format, notes });
      } else {
        await createCamera.mutateAsync({ name, format, notes });
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.msg || err.response?.data?.error || 'Failed to save camera');
    }
  }

  const isPending = createCamera.isPending || updateCamera.isPending;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#141414',
          border: '1px solid #2a2a2a',
          borderRadius: '16px 16px 0 0',
          padding: '1.5rem',
          width: '100%',
          maxWidth: 390,
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            {isEdit ? 'Edit Camera' : 'Add Camera'}
          </h2>
          <button onClick={onClose}><X size={20} color="#666" /></button>
        </div>

        {error && (
          <div
            style={{
              background: '#dc262620',
              border: '1px solid #dc262640',
              borderRadius: 8,
              padding: '0.65rem',
              marginBottom: '1rem',
              color: '#f87171',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Camera Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Canon AE-1, Mamiya RB67"
              required
            />
          </div>

          <div className="form-field">
            <label>Format</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  style={{
                    padding: '0.6rem 0',
                    borderRadius: 8,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    background: format === f ? '#e8d5b0' : '#1e1e1e',
                    color: format === f ? '#1a1208' : '#888',
                    border: format === f ? '1px solid #e8d5b0' : '1px solid #2a2a2a',
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}
                >
                  {FORMAT_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Lens, condition, quirks..."
              rows={2}
              style={{ resize: 'none' }}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="btn btn-primary btn-full"
            style={{ height: 48 }}
          >
            {isPending ? <LoadingSpinner size={18} /> : (isEdit ? 'Save Changes' : 'Add Camera')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CamerasPage() {
  const { data: cameras = [], isLoading } = useCameras();
  const deleteCamera = useDeleteCamera();
  const [modal, setModal] = useState(null); // null | 'add' | camera object

  async function handleDelete(cam) {
    if (!confirm(`Delete "${cam.name}"?`)) return;
    await deleteCamera.mutateAsync(cam.id);
  }

  return (
    <div style={{ maxWidth: 390, margin: '0 auto', paddingBottom: '5rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1rem 0.75rem',
          position: 'sticky',
          top: 0,
          background: '#0a0a0a',
          zIndex: 10,
        }}
      >
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Cameras</h1>
        <button
          onClick={() => setModal('add')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.5rem 0.875rem',
            borderRadius: 8,
            background: '#e8d5b0',
            color: '#1a1208',
            fontWeight: 700,
            fontSize: '0.875rem',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Plus size={16} />
          Add
        </button>
      </div>

      <div style={{ padding: '0 1rem' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
            <LoadingSpinner />
          </div>
        ) : cameras.length === 0 ? (
          <EmptyState
            icon={Camera}
            message="No cameras yet"
            subMessage="Add your cameras to quickly log them on new rolls."
            ctaLabel="Add Camera"
            onCta={() => setModal('add')}
          />
        ) : (
          cameras.map((cam) => (
            <div
              key={cam.id}
              style={{
                background: '#1e1e1e',
                border: '1px solid #2a2a2a',
                borderRadius: 10,
                padding: '0.875rem 1rem',
                marginBottom: '0.6rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: '#141414',
                  border: '1px solid #2a2a2a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Camera size={18} color="#c4a96a" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cam.name}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 2 }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: '#c4a96a',
                      background: '#c4a96a20',
                      border: '1px solid #c4a96a40',
                      borderRadius: 4,
                      padding: '0.1rem 0.4rem',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {FORMAT_LABELS[cam.format] || cam.format}
                  </span>
                  {cam.notes && (
                    <span style={{ fontSize: '0.75rem', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cam.notes}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                <button
                  onClick={() => setModal(cam)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: '#141414',
                    border: '1px solid #2a2a2a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#888',
                    cursor: 'pointer',
                  }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleDelete(cam)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: '#141414',
                    border: '1px solid #2a2a2a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#888',
                    cursor: 'pointer',
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {modal && (
        <CameraModal
          camera={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
        />
      )}

      <BottomNav />
    </div>
  );
}

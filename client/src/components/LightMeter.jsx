import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

const APERTURES_NUM = [1.4, 1.8, 2, 2.8, 4, 5.6, 8, 11, 16];
const APERTURES_STR = ['f/1.4', 'f/1.8', 'f/2', 'f/2.8', 'f/4', 'f/5.6', 'f/8', 'f/11', 'f/16'];
const SHUTTERS_SEC  = [1/1000, 1/500, 1/250, 1/125, 1/60, 1/30, 1/15, 1/8, 1/4, 1/2, 1, 2];
const SHUTTERS_STR  = ['1/1000', '1/500', '1/250', '1/125', '1/60', '1/30', '1/15', '1/8', '1/4', '1/2', '1s', '2s'];

function toLinear(byte) {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function getAvgLuminance(ctx, w, h) {
  const x0 = Math.floor(w * 0.2), y0 = Math.floor(h * 0.2);
  const cw = Math.floor(w * 0.6), ch = Math.floor(h * 0.6);
  const { data } = ctx.getImageData(x0, y0, cw, ch);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.2126 * toLinear(data[i]) + 0.7152 * toLinear(data[i + 1]) + 0.0722 * toLinear(data[i + 2]);
  }
  return sum / (data.length / 4); // 0..1 linear
}

function calcEV(linearLum, iso) {
  const K = 12.5;
  // Map linear 0..1 to cd/m²: treat 0.18 (18% gray) as 100 cd/m²
  const L = Math.max(linearLum * (100 / 0.18), 0.01);
  return Math.log2(L * iso / K);
}

function suggestExposures(ev) {
  const pairs = [];
  for (let ai = 0; ai < APERTURES_NUM.length; ai++) {
    const N = APERTURES_NUM[ai];
    const idealT = (N * N) / Math.pow(2, ev);
    let bestSi = 0, bestDiff = Infinity;
    for (let si = 0; si < SHUTTERS_SEC.length; si++) {
      const diff = Math.abs(Math.log2(SHUTTERS_SEC[si] / idealT));
      if (diff < bestDiff) { bestDiff = diff; bestSi = si; }
    }
    if (bestDiff < 1.0) {
      pairs.push({ aperture: APERTURES_STR[ai], shutter: SHUTTERS_STR[bestSi] });
    }
  }
  if (pairs.length === 0) return null;
  const mid = Math.round((pairs.length - 1) / 2);
  return {
    primary: pairs[mid],
    alts: [pairs[mid - 1], pairs[mid + 1]].filter(Boolean),
  };
}

function isoLabel(roll) {
  if (!roll) return null;
  const base = roll.film_stock_iso;
  if (!base) return null;
  const pp = roll.push_pull;
  const ppStops = pp && pp !== 'box' ? parseFloat(pp) : 0;
  const effectiveIso = Math.round(base * Math.pow(2, ppStops));
  const filmName = roll.film_stock_name || 'Unknown film';
  const ppLabel = !ppStops ? 'box speed'
    : ppStops > 0 ? `pushed +${ppStops}`
    : `pulled ${ppStops}`;
  return `Metering at ISO ${effectiveIso} (${filmName}, ${ppLabel})`;
}

function effectiveIso(roll) {
  const base = roll?.film_stock_iso || 400;
  const pp = roll?.push_pull;
  const stops = pp && pp !== 'box' ? parseFloat(pp) : 0;
  return Math.round(base * Math.pow(2, stops));
}

export default function LightMeter({ roll, onConfirm, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  const [suggestions, setSuggestions] = useState(null);
  const [ev, setEv] = useState(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const iso = effectiveIso(roll);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const lum = getAvgLuminance(ctx, canvas.width, canvas.height);
    const evVal = calcEV(lum, iso);
    setEv(Math.round(evVal * 10) / 10);
    setSuggestions(suggestExposures(evVal));
    rafRef.current = requestAnimationFrame(tick);
  }, [iso]);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 } } })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => {
            setReady(true);
            rafRef.current = requestAnimationFrame(tick);
          });
        }
      })
      .catch(() => {
        if (active) setError('Camera access denied or unavailable.');
      });

    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [tick]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem 1rem 0.5rem',
      }}>
        <p style={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
          Light Meter
        </p>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex' }}>
          <X size={18} />
        </button>
      </div>

      {/* ISO context */}
      <p style={{
        fontSize: '0.72rem', color: '#8b5cf6', textAlign: 'center',
        padding: '0 1rem 0.5rem', letterSpacing: '0.02em',
      }}>
        {isoLabel(roll) || `Metering at ISO ${iso}`}
      </p>

      {/* Viewfinder */}
      <div style={{
        position: 'relative', flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: ready ? 1 : 0 }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Center reticle */}
        {ready && (
          <div style={{
            position: 'absolute',
            width: 80, height: 80,
            border: '1px solid rgba(232,213,176,0.6)',
            borderRadius: 4,
            pointerEvents: 'none',
          }} />
        )}

        {/* EV readout */}
        {ready && ev !== null && (
          <div style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.55)',
            padding: '0.3rem 0.75rem',
            borderRadius: 20,
            fontSize: '0.72rem',
            color: '#888',
            fontFamily: 'ui-monospace, monospace',
            letterSpacing: '0.04em',
          }}>
            EV {ev}
          </div>
        )}

        {!ready && !error && (
          <p style={{ color: '#555', fontSize: '0.8rem' }}>Opening camera…</p>
        )}
        {error && (
          <p style={{ color: '#f87171', fontSize: '0.8rem', padding: '0 1rem', textAlign: 'center' }}>{error}</p>
        )}
      </div>

      {/* Suggestions */}
      <div style={{ padding: '0.75rem 1rem', minHeight: 140 }}>
        {suggestions ? (
          <>
            {/* Primary */}
            <button
              onClick={() => onConfirm(suggestions.primary.aperture, suggestions.primary.shutter)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#e8d5b0',
                color: '#1a1208',
                border: 'none',
                borderRadius: 8,
                fontSize: '1rem',
                fontFamily: 'ui-monospace, monospace',
                fontWeight: 700,
                cursor: 'pointer',
                marginBottom: '0.5rem',
              }}
            >
              {suggestions.primary.aperture} · {suggestions.primary.shutter}
            </button>

            {/* Alternatives */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {suggestions.alts.map((alt) => (
                <button
                  key={`${alt.aperture}${alt.shutter}`}
                  onClick={() => onConfirm(alt.aperture, alt.shutter)}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    background: '#1a1a1a',
                    color: '#888',
                    border: '1px solid #252525',
                    borderRadius: 8,
                    fontSize: '0.82rem',
                    fontFamily: 'ui-monospace, monospace',
                    cursor: 'pointer',
                  }}
                >
                  {alt.aperture} · {alt.shutter}
                </button>
              ))}
            </div>
          </>
        ) : ready ? (
          <p style={{ color: '#444', fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem' }}>
            Point at your subject…
          </p>
        ) : null}
      </div>

      {/* Disclaimer */}
      <p style={{
        fontSize: '0.65rem', color: '#333', textAlign: 'center',
        padding: '0 1rem calc(1rem + env(safe-area-inset-bottom))',
        lineHeight: 1.4,
      }}>
        Reflected light reading. Results vary in high contrast scenes.
      </p>
    </div>
  );
}

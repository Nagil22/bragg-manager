import React, { useState } from 'react';
import { COLORS, FONT } from './constants';
import Icon from './Icon';

const GUMROAD_URL = 'https://nagil.gumroad.com/l/braggmanager';
const PRICE = '₦18,000 / $13';

interface Props {
  scansUsed: number;
  freeLimit: number;
  onActivated: () => void;
  onClose?: () => void; // optional — paywall can be hard-blocked
}

export default function PaywallModal({ scansUsed, freeLimit, onActivated, onClose }: Props) {
  const [view, setView] = useState<'upgrade' | 'key'>('upgrade');
  const [keyInput, setKeyInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivate = async () => {
    if (!keyInput.trim()) return;
    setActivating(true);
    setError(null);
    try {
      const result = await window.storeSmartAPI.activateLicense(keyInput.trim());
      if (result.success) {
        onActivated();
      } else {
        setError(result.message);
      }
    } catch (e: any) {
      setError(e.message ?? 'Activation failed.');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT.sans,
    }}>
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.borderStrong}`,
        borderRadius: 20, width: '90%', maxWidth: 440, overflow: 'hidden',
        boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
      }}>
        {/* Accent bar */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.purple})` }} />

        <div style={{ padding: '28px 28px 24px' }}>
          {view === 'upgrade' ? (
            <>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.textPrimary, letterSpacing: '-0.02em', marginBottom: 8 }}>
                  Free trial complete
                </div>
                <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6 }}>
                  You've used {scansUsed} of {freeLimit} free scans.<br/>
                  Upgrade to keep cleaning your storage.
                </div>
              </div>

              {/* Feature comparison */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
                {[
                  { label: 'Unlimited scans',     pro: true  },
                  { label: 'Move & delete files',  pro: true  },
                  { label: 'AI enhancement',       pro: true  },
                  { label: 'View recommendations', pro: false },
                ].map(f => (
                  <div key={f.label} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 12px', borderRadius: 10,
                    background: f.pro ? COLORS.accentDim : COLORS.surfaceHover,
                    border: `1px solid ${f.pro ? COLORS.accent : COLORS.border}`,
                  }}>
                    <span style={{ color: f.pro ? COLORS.accent : COLORS.textMuted, flexShrink: 0 }}>
                      {f.pro
                        ? <Icon name="check" size={14} color={COLORS.accent} />
                        : <Icon name="lock" size={14} color={COLORS.textMuted} />
                      }
                    </span>
                    <span style={{ fontSize: 12, color: f.pro ? COLORS.textPrimary : COLORS.textMuted }}>{f.label}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={() => window.storeSmartAPI.openExternal(GUMROAD_URL)}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, cursor: 'pointer',
                  background: `linear-gradient(135deg, rgba(0,212,184,0.22), rgba(0,212,184,0.1))`,
                  border: `1px solid ${COLORS.accent}`,
                  color: COLORS.accent, fontSize: 15, fontWeight: 700,
                  letterSpacing: '-0.01em', marginBottom: 10,
                  boxShadow: `0 0 24px rgba(0,212,184,0.18)`,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = `0 0 36px rgba(0,212,184,0.32)`}
                onMouseLeave={e => e.currentTarget.style.boxShadow = `0 0 24px rgba(0,212,184,0.18)`}
              >
                Upgrade to Pro — {PRICE} one-time
              </button>

              <button
                onClick={() => setView('key')}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10, cursor: 'pointer',
                  background: 'transparent', border: `1px solid ${COLORS.border}`,
                  color: COLORS.textSecondary, fontSize: 13,
                }}
              >
                Already have a license key?
              </button>

              {onClose && (
                <div style={{ textAlign: 'center', marginTop: 10 }}>
                  <button onClick={onClose} style={{ background: 'none', border: 'none', color: COLORS.textMuted, fontSize: 12, cursor: 'pointer' }}>
                    Maybe later
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Key entry view */}
              <button
                onClick={() => { setView('upgrade'); setError(null); }}
                style={{ background: 'none', border: 'none', color: COLORS.textMuted, cursor: 'pointer', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
              >
                ← Back
              </button>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 6 }}>Enter license key</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
                Check the email you used to purchase Bragg Manager on Gumroad.
              </div>
              <input
                type="text"
                value={keyInput}
                onChange={e => { setKeyInput(e.target.value); setError(null); }}
                onKeyDown={e => e.key === 'Enter' && handleActivate()}
                placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
                autoFocus
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  background: COLORS.surfaceHover, border: `1px solid ${error ? COLORS.red : COLORS.border}`,
                  color: COLORS.textPrimary, fontSize: 13,
                  fontFamily: FONT.mono, outline: 'none', marginBottom: 10,
                  boxSizing: 'border-box',
                }}
              />
              {error && (
                <div style={{ fontSize: 12, color: COLORS.red, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="warning" size={13} color={COLORS.red} /> {error}
                </div>
              )}
              <button
                onClick={handleActivate}
                disabled={activating || !keyInput.trim()}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10, cursor: 'pointer',
                  background: COLORS.accentDim, border: `1px solid ${COLORS.accent}`,
                  color: COLORS.accent, fontSize: 14, fontWeight: 600,
                  opacity: (activating || !keyInput.trim()) ? 0.5 : 1, transition: 'opacity 0.2s',
                }}
              >
                {activating ? 'Activating…' : 'Activate License'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { COLORS, FONT } from './constants';
import Icon from './Icon';
import { LicenseState } from '../types/global';

const FREE_SCAN_LIMIT = 4;

interface Props {
  onClose: () => void;
}

const AI_MODEL = 'anthropic/claude-haiku-3';
const AI_PROVIDER = 'OpenRouter';
const AI_PROVIDER_URL = 'https://openrouter.ai';

export default function SettingsModal({ onClose }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [license, setLicense] = useState<LicenseState>({ scanCount: 0, isPro: false, trialExpired: false, scanCooldownActive: false });
  const [licKeyInput, setLicKeyInput] = useState('');
  const [licActivating, setLicActivating] = useState(false);
  const [licError, setLicError] = useState<string | null>(null);

  useEffect(() => {
    window.storeSmartAPI.getApiKey().then(k => {
      if (k) { setHasKey(true); setApiKey('••••••••••••••••'); }
    });
    window.storeSmartAPI.getLicenseState().then(setLicense).catch(() => {});
  }, []);

  const handleActivateLicense = async () => {
    if (!licKeyInput.trim()) return;
    setLicActivating(true);
    setLicError(null);
    try {
      const result = await window.storeSmartAPI.activateLicense(licKeyInput.trim());
      if (result.success) {
        await window.storeSmartAPI.getLicenseState().then(setLicense);
        setLicKeyInput('');
      } else {
        setLicError(result.message);
      }
    } catch (e: any) {
      setLicError(e.message ?? 'Activation failed.');
    } finally {
      setLicActivating(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey || apiKey.startsWith('•')) return;
    setSaving(true);
    setStatus(null);
    try {
      await window.storeSmartAPI.setApiKey(apiKey.trim());
      setHasKey(true);
      setApiKey('••••••••••••••••');
      setStatus({ type: 'success', msg: 'API key saved securely on this device.' });
    } catch (e: any) {
      setStatus({ type: 'error', msg: e.message || 'Failed to save key.' });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    await window.storeSmartAPI.clearApiKey();
    setHasKey(false);
    setApiKey('');
    setStatus({ type: 'success', msg: 'API key removed.' });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 18, width: '90%', maxWidth: 460,
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        animation: 'slideIn 0.2s ease',
        overflow: 'hidden',
      }}>
        {/* Top accent bar */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.purple})` }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 0' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.textPrimary, letterSpacing: '-0.01em' }}>Settings</div>
          <button
            onClick={onClose}
            style={{ background: COLORS.surfaceHover, border: `1px solid ${COLORS.border}`, color: COLORS.textSecondary, cursor: 'pointer', width: 28, height: 28, borderRadius: 8, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── AI Engine info card ── */}
          <div style={{
            background: COLORS.surfaceHover, border: `1px solid ${COLORS.border}`,
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>
              AI Optimisation Engine
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                {
                  label: 'Model',
                  value: AI_MODEL,
                  mono: true,
                  color: COLORS.purple,
                },
                {
                  label: 'Provider',
                  value: AI_PROVIDER,
                  mono: false,
                  color: COLORS.accent,
                },
                {
                  label: 'What it does',
                  value: 'Analyses your scanned files and suggests where to move them, explains why, and refines rule-based recommendations into plain English.',
                  mono: false,
                  color: COLORS.textSecondary,
                },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 12, color: COLORS.textMuted, minWidth: 80, flexShrink: 0, paddingTop: 1 }}>{row.label}</span>
                  <span style={{
                    fontSize: 12, color: row.color, lineHeight: 1.5,
                    fontFamily: row.mono ? "'DM Mono', monospace" : 'inherit',
                  }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Status pill */}
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 20,
                background: hasKey ? 'rgba(0,212,184,0.1)' : 'rgba(248,81,73,0.1)',
                border: `1px solid ${hasKey ? COLORS.accent : COLORS.red}`,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: hasKey ? COLORS.accent : COLORS.red, boxShadow: hasKey ? `0 0 6px ${COLORS.accent}` : 'none' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: hasKey ? COLORS.accent : COLORS.red }}>
                  {hasKey ? 'Active — AI enhancement ready' : 'No key — AI enhancement disabled'}
                </span>
              </div>
            </div>
          </div>

          {/* ── API Key section ── */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
              OpenRouter API Key
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 12 }}>
              Get a free key at{' '}
              <span style={{ color: COLORS.accent, fontFamily: "'DM Mono', monospace" }}>openrouter.ai</span>
              {' '}— your key is encrypted and stored only on this device, never sent anywhere except OpenRouter.
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                type="password"
                value={apiKey}
                onFocus={() => { if (apiKey.startsWith('•')) setApiKey(''); }}
                onChange={e => { setApiKey(e.target.value); setStatus(null); }}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                placeholder="sk-or-v1-..."
                style={{
                  flex: 1, background: COLORS.bg,
                  border: `1px solid ${COLORS.border}`, borderRadius: 8,
                  padding: '9px 12px', color: COLORS.textPrimary,
                  fontSize: 13, outline: 'none', fontFamily: "'DM Mono', monospace",
                }}
              />
              <button
                onClick={handleSave}
                disabled={saving || !apiKey || apiKey.startsWith('•')}
                style={{
                  padding: '9px 18px', borderRadius: 8, cursor: 'pointer',
                  background: COLORS.accentDim, border: `1px solid ${COLORS.accent}`,
                  color: COLORS.accent, fontSize: 13, fontWeight: 600,
                  opacity: (saving || !apiKey || apiKey.startsWith('•')) ? 0.4 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>

            {/* Feedback row */}
            {hasKey && !status && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: COLORS.textMuted }}>Key configured</span>
                <button
                  onClick={handleClear}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: COLORS.red, fontSize: 12, cursor: 'pointer', padding: 0 }}
                >
                  Remove key
                </button>
              </div>
            )}
            {status && (
              <div style={{
                fontSize: 12, padding: '7px 12px', borderRadius: 8,
                background: status.type === 'success' ? 'rgba(63,185,80,0.1)' : COLORS.redDim,
                color: status.type === 'success' ? '#3FB950' : COLORS.red,
                border: `1px solid ${status.type === 'success' ? '#3FB950' : COLORS.red}`,
              }}>
                {status.type === 'success' ? '✓ ' : '⚠ '}{status.msg}
              </div>
            )}
          </div>

          {/* ── License section ── */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
              License
            </div>
            {license.isPro ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, background: COLORS.accentDim, border: `1px solid ${COLORS.accent}` }}>
                <Icon name="unlock" size={16} color={COLORS.accent} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.accent }}>Pro — Unlimited access</div>
                  {license.licenseKey && <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONT.mono, marginTop: 2 }}>{license.licenseKey.slice(0, 8)}…</div>}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: '10px 14px', borderRadius: 10, background: COLORS.surfaceHover, border: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Free trial</span>
                    <span style={{ fontSize: 12, color: COLORS.amber, fontWeight: 600 }}>{license.scanCount}/{FREE_SCAN_LIMIT} scans used</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 3, background: COLORS.surfaceActive, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: COLORS.amber, width: `${(license.scanCount / FREE_SCAN_LIMIT) * 100}%` }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={licKeyInput}
                    onChange={e => { setLicKeyInput(e.target.value); setLicError(null); }}
                    onKeyDown={e => e.key === 'Enter' && handleActivateLicense()}
                    placeholder="License key…"
                    style={{
                      flex: 1, background: COLORS.bg, border: `1px solid ${licError ? COLORS.red : COLORS.border}`,
                      borderRadius: 8, padding: '9px 12px', color: COLORS.textPrimary,
                      fontSize: 13, outline: 'none', fontFamily: FONT.mono,
                    }}
                  />
                  <button
                    onClick={handleActivateLicense}
                    disabled={licActivating || !licKeyInput.trim()}
                    style={{
                      padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
                      background: COLORS.accentDim, border: `1px solid ${COLORS.accent}`,
                      color: COLORS.accent, fontSize: 13, fontWeight: 600,
                      opacity: (licActivating || !licKeyInput.trim()) ? 0.4 : 1,
                      transition: 'opacity 0.2s', fontFamily: FONT.sans,
                    }}
                  >
                    {licActivating ? 'Checking…' : 'Activate'}
                  </button>
                </div>
                {licError && (
                  <div style={{ fontSize: 12, color: COLORS.red, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="warning" size={12} color={COLORS.red} /> {licError}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

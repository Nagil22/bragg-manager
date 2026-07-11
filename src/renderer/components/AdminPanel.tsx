import React, { useState, useEffect, useCallback, useRef } from 'react';
import { COLORS, FONT } from './constants';
import { LicenseState } from '../types/global';

interface Props {
  license: LicenseState;
  onLicenseChange: () => void;
  onClose: () => void;
  /** Already verified this session — skip the password screen */
  unlocked: boolean;
  onUnlock: () => void;
}

interface GumroadSale {
  id: string;
  product_name: string;
  created_at: string;
  price: number;
  currency_symbol: string;
  email: string;
  full_name: string;
  ip_country: string;
  refunded: boolean;
  chargebacked: boolean;
}

type Tab = 'license' | 'subscribers';

export default function AdminPanel({ license, onLicenseChange, onClose, unlocked, onUnlock }: Props) {
  const [tab, setTab]           = useState<Tab>('license');
  const [token, setToken]       = useState('');
  const [sales, setSales]       = useState<GumroadSale[]>([]);
  const [loading, setLoading]   = useState(false);
  const [salesErr, setSalesErr] = useState<string | null>(null);
  const [toast, setToast]       = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [togglingPro, setTogglingPro] = useState(false);
  const [pwd, setPwd]               = useState('');
  const [pwdErr, setPwdErr]         = useState(false);
  const [verifying, setVerifying]   = useState(false);
  const pwdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!unlocked) setTimeout(() => pwdRef.current?.focus(), 80);
  }, [unlocked]);

  const handleVerify = useCallback(async () => {
    if (!pwd.trim() || verifying) return;
    setVerifying(true);
    try {
      const ok = await window.storeSmartAPI.adminVerifyPassword(pwd);
      if (ok) { onUnlock(); setPwd(''); }
      else    { setPwdErr(true); setPwd(''); setTimeout(() => setPwdErr(false), 1200); }
    } catch { setPwdErr(true); }
    finally { setVerifying(false); }
  }, [pwd, verifying, onUnlock]);

  // Load saved token on mount
  useEffect(() => {
    window.storeSmartAPI.adminLoadToken().then(t => { if (t) setToken(t); }).catch(() => {});
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleResetScans = useCallback(async () => {
    setResetting(true);
    try {
      await window.storeSmartAPI.adminResetScans();
      onLicenseChange();
      showToast('Scan count reset to 0');
    } catch { showToast('Reset failed'); }
    finally { setResetting(false); }
  }, [onLicenseChange]);

  const handleTogglePro = useCallback(async () => {
    setTogglingPro(true);
    try {
      await window.storeSmartAPI.adminSetPro(!license.isPro);
      onLicenseChange();
      showToast(license.isPro ? 'Pro disabled' : 'Pro enabled');
    } catch { showToast('Failed'); }
    finally { setTogglingPro(false); }
  }, [license.isPro, onLicenseChange]);

  const handleLoadSales = useCallback(async () => {
    if (!token.trim()) return;
    setLoading(true);
    setSalesErr(null);
    setSales([]);
    try {
      await window.storeSmartAPI.adminSaveToken(token.trim());
      const data = await window.storeSmartAPI.adminFetchSales(token.trim());
      if (!data.success) throw new Error(data.message ?? 'Gumroad API error');
      setSales(data.sales ?? []);
    } catch (e: any) {
      setSalesErr(e.message ?? 'Failed to fetch sales');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const revenue = sales.reduce((s, sale) => s + (!sale.refunded && !sale.chargebacked ? sale.price : 0), 0);
  const activeSales = sales.filter(s => !s.refunded && !s.chargebacked);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT.sans,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* ── Password gate ── */}
      {!unlocked && (
        <div style={{
          background: COLORS.surface, border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 16, padding: '32px 28px', width: 300,
          boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.textPrimary, textAlign: 'center' }}>
            Admin access
          </div>
          <input
            ref={pwdRef}
            type="password"
            value={pwd}
            onChange={e => setPwd(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
            placeholder="Password"
            style={{
              padding: '10px 12px', borderRadius: 10, outline: 'none',
              background: COLORS.surfaceHover,
              border: `1px solid ${pwdErr ? COLORS.red : COLORS.border}`,
              color: COLORS.textPrimary, fontSize: 13, fontFamily: FONT.mono,
              transition: 'border-color 0.2s',
            }}
          />
          <button
            onClick={handleVerify}
            disabled={verifying || !pwd.trim()}
            style={{
              padding: '10px', borderRadius: 10, cursor: 'pointer',
              background: COLORS.accentDim, border: `1px solid ${COLORS.accent}`,
              color: COLORS.accent, fontSize: 13, fontWeight: 600,
              opacity: (verifying || !pwd.trim()) ? 0.5 : 1,
              fontFamily: FONT.sans,
            }}
          >
            {verifying ? 'Checking…' : 'Unlock'}
          </button>
        </div>
      )}

      {/* ── Full panel (shown only when unlocked) ── */}
      {unlocked && <>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
          background: COLORS.surfaceActive, color: COLORS.textPrimary,
          fontSize: 13, padding: '8px 18px', borderRadius: 20,
          border: `1px solid ${COLORS.borderStrong}`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 9001, whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      <div style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.borderStrong}`,
        borderRadius: 20, width: '90%', maxWidth: 560,
        maxHeight: '80vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 48px 120px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px 0',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: COLORS.accent, marginBottom: 2 }}>
              ⚡ Super Admin
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.textPrimary, letterSpacing: '-0.02em' }}>
              Bragg Manager
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: COLORS.surfaceHover, border: `1px solid ${COLORS.border}`,
              borderRadius: 8, color: COLORS.textSecondary,
              fontSize: 13, padding: '5px 12px', cursor: 'pointer',
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '14px 22px 0' }}>
          {(['license', 'subscribers'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                background: tab === t ? COLORS.surfaceActive : 'transparent',
                border: `1px solid ${tab === t ? COLORS.borderStrong : 'transparent'}`,
                color: tab === t ? COLORS.textPrimary : COLORS.textSecondary,
                fontSize: 13, fontWeight: tab === t ? 600 : 400,
                fontFamily: FONT.sans, textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 22px' }}>

          {/* ── LICENSE TAB ── */}
          {tab === 'license' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Status grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Scans used',   value: String(license.scanCount),                     color: license.trialExpired ? COLORS.red : COLORS.textPrimary },
                  { label: 'Limit',        value: '4',                                             color: COLORS.textMuted },
                  { label: 'Status',       value: license.isPro ? 'Pro ✓' : license.trialExpired ? 'Expired' : 'Free', color: license.isPro ? COLORS.accent : license.trialExpired ? COLORS.red : COLORS.amber },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    background: COLORS.surfaceHover, borderRadius: 10, padding: '12px 14px',
                    border: `1px solid ${COLORS.border}`,
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: FONT.mono, letterSpacing: '-0.02em' }}>{value}</div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>

              {license.nextScanAllowedAt && (
                <div style={{ fontSize: 12, color: COLORS.amber, padding: '8px 12px', borderRadius: 8, background: COLORS.amberDim, border: `1px solid rgba(255,159,10,0.2)` }}>
                  Cooldown active — next scan at {new Date(license.nextScanAllowedAt).toLocaleTimeString()}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <AdminBtn
                  label={resetting ? 'Resetting…' : 'Reset scan count → 0'}
                  color={COLORS.accent}
                  onClick={handleResetScans}
                  disabled={resetting || license.scanCount === 0}
                />
                <AdminBtn
                  label={togglingPro ? 'Saving…' : license.isPro ? 'Disable Pro (revert to free)' : 'Enable Pro (unlimited scans)'}
                  color={license.isPro ? COLORS.red : COLORS.green}
                  onClick={handleTogglePro}
                  disabled={togglingPro}
                />
              </div>

              {/* Raw state */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Raw license state
                </div>
                <pre style={{
                  background: COLORS.bg, borderRadius: 10, padding: '12px 14px',
                  border: `1px solid ${COLORS.border}`, fontSize: 11,
                  fontFamily: FONT.mono, color: COLORS.textSecondary,
                  overflowX: 'auto', margin: 0, lineHeight: 1.6,
                }}>
                  {JSON.stringify(license, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* ── SUBSCRIBERS TAB ── */}
          {tab === 'subscribers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6 }}>
                Enter your Gumroad access token from{' '}
                <span
                  onClick={() => window.storeSmartAPI.openExternal('https://app.gumroad.com/settings/advanced')}
                  style={{ color: COLORS.accent, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Settings → Advanced
                </span>.
              </div>

              {/* Token input */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLoadSales()}
                  placeholder="Gumroad access token"
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 10,
                    background: COLORS.surfaceHover, border: `1px solid ${COLORS.border}`,
                    color: COLORS.textPrimary, fontSize: 13, fontFamily: FONT.mono,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleLoadSales}
                  disabled={loading || !token.trim()}
                  style={{
                    padding: '9px 16px', borderRadius: 10, cursor: 'pointer',
                    background: COLORS.accentDim, border: `1px solid ${COLORS.accent}`,
                    color: COLORS.accent, fontSize: 13, fontWeight: 600,
                    opacity: (loading || !token.trim()) ? 0.5 : 1,
                    fontFamily: FONT.sans, whiteSpace: 'nowrap',
                  }}
                >
                  {loading ? 'Loading…' : 'Load'}
                </button>
              </div>

              {salesErr && (
                <div style={{ fontSize: 12, color: COLORS.red, padding: '8px 12px', borderRadius: 8, background: COLORS.redDim, border: `1px solid rgba(255,69,58,0.2)` }}>
                  {salesErr}
                </div>
              )}

              {sales.length > 0 && (
                <>
                  {/* Summary */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    {[
                      { label: 'Total sales',    value: String(sales.length) },
                      { label: 'Active',         value: String(activeSales.length) },
                      { label: 'Revenue',        value: `$${(revenue / 100).toFixed(2)}` },
                    ].map(({ label, value }) => (
                      <div key={label} style={{
                        background: COLORS.surfaceHover, borderRadius: 10, padding: '12px 14px',
                        border: `1px solid ${COLORS.border}`,
                      }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.accent, fontFamily: FONT.mono, letterSpacing: '-0.02em' }}>{value}</div>
                        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 3 }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Sales table */}
                  <div style={{ borderRadius: 10, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1.6fr 80px 60px',
                      padding: '8px 14px', background: COLORS.surfaceHover,
                      borderBottom: `1px solid ${COLORS.border}`,
                    }}>
                      {['Customer', 'Email', 'Amount', 'Country'].map(h => (
                        <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: COLORS.textMuted }}>{h}</div>
                      ))}
                    </div>
                    {/* Rows */}
                    {sales.map((sale, i) => (
                      <div
                        key={sale.id}
                        style={{
                          display: 'grid', gridTemplateColumns: '1fr 1.6fr 80px 60px',
                          padding: '10px 14px',
                          background: i % 2 === 0 ? 'transparent' : COLORS.bg,
                          borderBottom: i < sales.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                          opacity: sale.refunded || sale.chargebacked ? 0.4 : 1,
                        }}
                      >
                        <div style={{ fontSize: 12, color: COLORS.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                          {sale.full_name || '—'}
                        </div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8, fontFamily: FONT.mono }}>
                          {sale.email}
                        </div>
                        <div style={{ fontSize: 12, color: sale.refunded || sale.chargebacked ? COLORS.red : COLORS.green, fontFamily: FONT.mono }}>
                          {sale.refunded ? 'Refunded' : sale.chargebacked ? 'Charged back' : `${sale.currency_symbol}${(sale.price / 100).toFixed(2)}`}
                        </div>
                        <div style={{ fontSize: 11, color: COLORS.textMuted }}>
                          {sale.ip_country || '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!loading && !salesErr && sales.length === 0 && token && (
                <div style={{ fontSize: 12, color: COLORS.textMuted, textAlign: 'center', padding: 24 }}>
                  No sales yet — or load to refresh.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </>}
    </div>
  );
}

function AdminBtn({ label, color, onClick, disabled }: {
  label: string; color: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', padding: '11px 16px', borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
        background: 'transparent',
        border: `1px solid ${color}`,
        color, fontSize: 13, fontWeight: 600, fontFamily: FONT.sans, textAlign: 'left',
        opacity: disabled ? 0.45 : 1, transition: 'opacity 0.15s, background 0.15s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = `${color}18`; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      {label}
    </button>
  );
}

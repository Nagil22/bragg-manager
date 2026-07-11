import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import logoSrc from '../assets/logoData';
import { useStorage } from '../hooks/useStorage';
import { Recommendation, FileMeta, DriveInfo } from '../../shared/types';
import { LicenseState } from '../types/global';
import { COLORS, FONT, formatFileSize, formatCount } from './constants';
import Icon from './Icon';
import GlowCircle from './GlowCircle';
import ScanAnimation from './ScanAnimation';
import ExternalDrivePanel from './ExternalDrivePanel';
import SettingsModal from './SettingsModal';
import Toggle from './Toggle';
import PaywallModal from './PaywallModal';
import ErrorBoundary from './ErrorBoundary';
import DriveConfirmModal, { getDriveDestPath } from './DriveConfirmModal';
import OnboardingModal from './OnboardingModal';
import AdminPanel from './AdminPanel';
import RecsTab from './tabs/RecsTab';
import FileBrowserTab from './tabs/FileBrowserTab';

type NavItem = 'dashboard' | 'recommendations' | 'files' | 'drive';
const FREE_SCAN_LIMIT = 4;
const SCAN_COOLDOWN_MS = 3 * 60 * 60 * 1000;

// Files eligible for drive archiving: media > 50 MB
function getDriveFileCandidates(files: FileMeta[]): FileMeta[] {
  return files.filter(f => ['video', 'photo', 'audio'].includes(f.type) && f.size > 50 * 1024 * 1024);
}

// ─── Memoised sub-components ─────────────────────────────────────────────────

const NavButton = memo(function NavButton({ label, icon, active, badge, onClick }: {
  label: string; icon: React.ReactNode; active: boolean; badge?: string | number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '9px 12px', borderRadius: 10,
        background: active ? COLORS.surfaceActive : 'transparent',
        border: 'none', cursor: 'pointer', textAlign: 'left',
        color: active ? COLORS.textPrimary : COLORS.textSecondary,
        fontSize: 13, fontWeight: active ? 600 : 400, fontFamily: FONT.sans,
        transition: 'background 0.12s, color 0.12s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = COLORS.surfaceHover; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ color: active ? COLORS.accent : COLORS.textMuted, flexShrink: 0, display: 'flex' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
          background: active ? COLORS.accentDim : COLORS.surfaceHover,
          color: active ? COLORS.accent : COLORS.textMuted,
          border: `1px solid ${active ? 'rgba(0,212,184,0.3)' : COLORS.border}`,
          minWidth: 18, textAlign: 'center',
        }}>{badge}</span>
      )}
    </button>
  );
});

const StatCard = memo(function StatCard({ label, value, color = COLORS.textPrimary }: {
  label: string; value: string; color?: string;
}) {
  return (
    <div style={{ background: COLORS.surface, borderRadius: 12, padding: '16px 18px', border: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: FONT.mono, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: COLORS.textMuted, letterSpacing: '0.02em' }}>{label}</div>
    </div>
  );
});

// ── Cooldown countdown ────────────────────────────────────────────────────────
function formatCountdown(ms: number): string {
  if (ms <= 0) return '';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.floor((ms % 60_000) / 1_000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 * Self-contained countdown — owns its own 1-second interval so the parent
 * StorageManager never re-renders due to tick state changes.
 * Accepts an optional render prop for custom wrapping.
 */
const CooldownBadge = memo(function CooldownBadge({
  nextScanAllowedAt,
  children,
}: {
  nextScanAllowedAt?: number;
  children?: (formatted: string) => React.ReactNode;
}) {
  const [ms, setMs] = useState(() =>
    nextScanAllowedAt ? Math.max(0, nextScanAllowedAt - Date.now()) : 0
  );
  useEffect(() => {
    if (!nextScanAllowedAt) { setMs(0); return; }
    setMs(Math.max(0, nextScanAllowedAt - Date.now()));
    const id = setInterval(() => setMs(Math.max(0, nextScanAllowedAt - Date.now())), 1_000);
    return () => clearInterval(id);
  }, [nextScanAllowedAt]);

  const formatted = formatCountdown(ms);
  if (!formatted) return null;
  return children ? <>{children(formatted)}</> : <>{formatted}</>;
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function StorageManager() {
  const { files, displayedRecs, isScanning, scanProgress, scan, enhanceWithAI, removeFiles, skipRec, cacheLoaded } = useStorage();
  const hasData = files.length > 0;

  const [nav,           setNav]           = useState<NavItem>('dashboard');
  const [freedBytes,    setFreedBytes]    = useState(0);
  const [useAI,         setUseAI]         = useState(false);
  const [deviceName,    setDeviceName]    = useState('My Mac');
  const [totalStorage,  setTotalStorage]  = useState(256);
  const [showSettings,  setShowSettings]  = useState(false);
  const [license,       setLicense]       = useState<LicenseState>({
    scanCount: 0, isPro: false, trialExpired: false, scanCooldownActive: false,
  });
  const [showPaywall,   setShowPaywall]   = useState(false);
  const [drive,         setDrive]         = useState<DriveInfo | null>(null);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAdmin,      setShowAdmin]      = useState(false);
  const [adminUnlocked,  setAdminUnlocked]  = useState(false);

  // ── Initialise ────────────────────────────────────────────────────────────

  useEffect(() => {
    window.storeSmartAPI.getDeviceInfo()
      .then(i => { setDeviceName(i.hostname); setTotalStorage(i.totalStorageGB); })
      .catch(() => {});
    refreshLicense();
    window.storeSmartAPI.getOnboarded()
      .then(done => { if (!done) setShowOnboarding(true); })
      .catch(() => {});
  }, []);

  // Admin shortcut: Cmd+Shift+A (mac) / Ctrl+Shift+A (win)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // e.code is layout-independent; e.key shifts with modifier keys
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyA') {
        e.preventDefault();
        e.stopPropagation();
        setShowAdmin(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler, true); // capture phase — fires before any child handler
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  // Refresh license (and cooldown) — called after scan or every 30s when cooling down
  const refreshLicense = useCallback(() => {
    window.storeSmartAPI.getLicenseState().then(ls => {
      setLicense(ls);
    }).catch(() => {});
  }, []);

  // Auto-refresh license when cooldown expires — CooldownBadge handles the display tick
  useEffect(() => {
    if (!license.nextScanAllowedAt) return;
    const remaining = license.nextScanAllowedAt - Date.now();
    if (remaining <= 0) { refreshLicense(); return; }
    const id = setTimeout(refreshLicense, remaining + 200);
    return () => clearTimeout(id);
  }, [license.nextScanAllowedAt, refreshLicense]);

  // ── Derived data ─────────────────────────────────────────────────────────

  const dynamicCategories = useMemo(() => {
    if (!files.length) return [];
    const catMap: Record<string, { size: number; count: number; color: string; icon: string }> = {
      video:     { size: 0, count: 0, color: COLORS.red,       icon: '🎬' },
      photo:     { size: 0, count: 0, color: COLORS.amber,     icon: '🖼️'  },
      document:  { size: 0, count: 0, color: COLORS.blue,      icon: '📄' },
      audio:     { size: 0, count: 0, color: COLORS.purple,    icon: '🎵' },
      archive:   { size: 0, count: 0, color: COLORS.accent,    icon: '📦' },
      diskimage: { size: 0, count: 0, color: COLORS.accent,    icon: '💿' },
      temp:      { size: 0, count: 0, color: COLORS.textMuted, icon: '🧹' },
      other:     { size: 0, count: 0, color: COLORS.textMuted, icon: '📁' },
    };
    for (const f of files) {
      const c = catMap[f.type] ?? catMap['other'];
      c.size += f.size; c.count++;
    }
    return Object.entries(catMap)
      .filter(([, v]) => v.count > 0)
      .map(([name, v]) => ({ name: name[0].toUpperCase() + name.slice(1), ...v }));
  }, [files]);

  const totalUsedGB      = useMemo(() => files.reduce((s, f) => s + f.size, 0) / 1e9, [files]);
  const totalReclaimable = useMemo(() => displayedRecs.reduce((s, r) => s + r.sizeBytes, 0), [displayedRecs]);
  const dupCount         = useMemo(() => displayedRecs.filter(r => r.id.startsWith('dup-')).length, [displayedRecs]);
  const driveCandidates  = useMemo(() => getDriveFileCandidates(files), [files]);
  const driveCandidateBytes = useMemo(() => driveCandidates.reduce((s, f) => s + f.size, 0), [driveCandidates]);

  const trialScansLeft = Math.max(0, FREE_SCAN_LIMIT - license.scanCount);

  // ── Scan flow ────────────────────────────────────────────────────────────

  const handleStartScan = useCallback(async () => {
    if (license.scanCooldownActive) return; // button is visually disabled anyway
    if (!license.isPro && license.trialExpired) { setShowPaywall(true); return; }
    if (!license.isPro && license.scanCount >= FREE_SCAN_LIMIT) { setShowPaywall(true); return; }

    const dir = await window.storeSmartAPI.selectDirectory();
    if (!dir) return;

    setFreedBytes(0); setDrive(null);

    const result = await scan(dir);
    if (result === null) return; // cancelled

    refreshLicense();

    // Detect external drive after scan
    window.storeSmartAPI.detectDrive().then(d => setDrive(d)).catch(() => {});

    if (useAI) await enhanceWithAI();
  }, [license, scan, enhanceWithAI, useAI, refreshLicense]);

  const handleCancelScan = useCallback(() => window.storeSmartAPI.cancelScan(), []);

  const handleActionSuccess = useCallback(async (rec: Recommendation) => {
    if (!license.isPro) { setShowPaywall(true); return; }
    setFreedBytes(prev => prev + rec.sizeBytes);
    await removeFiles(new Set(rec.files.map((f: FileMeta) => f.id)));
  }, [license.isPro, removeFiles]);

  const handleDriveDone = useCallback((moved: number) => {
    setShowDriveModal(false);
    if (moved > 0) {
      const movedIds = new Set(driveCandidates.slice(0, moved).map(f => f.id));
      removeFiles(movedIds);
    }
  }, [driveCandidates, removeFiles]);

  // ── Sidebar ───────────────────────────────────────────────────────────────

  const sidebar = (
    <div style={{
      width: 210, flexShrink: 0, background: COLORS.sidebar,
      borderRight: `1px solid ${COLORS.border}`,
      display: 'flex', flexDirection: 'column',
      padding: '14px 10px', gap: 2, fontFamily: FONT.sans,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 16px' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: `rgba(0,0,0,0.25)`,
          border: `1px solid rgba(0,212,184,0.25)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          boxShadow: `0 0 12px rgba(0,212,184,0.12)`,
        }}>
          <img src={logoSrc} alt="Bragg Manager" style={{ width: 26, height: 26, objectFit: 'contain' }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary, letterSpacing: '-0.02em' }}>Bragg Manager</div>
          <div style={{ fontSize: 10, color: COLORS.textMuted }}>Storage Cleaner</div>
        </div>
      </div>

      <NavButton label="Dashboard"   icon={<Icon name="dashboard" size={15}/>} active={nav==='dashboard' && !isScanning} onClick={() => setNav('dashboard')} />

      {/* Scan button — shows cooldown state */}
      <button
        onClick={handleStartScan}
        disabled={license.scanCooldownActive || isScanning}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '9px 12px', borderRadius: 10,
          background: 'transparent', border: 'none', cursor: (license.scanCooldownActive || isScanning) ? 'default' : 'pointer',
          color: license.scanCooldownActive ? COLORS.textMuted : COLORS.textSecondary,
          fontSize: 13, fontWeight: 400, fontFamily: FONT.sans,
          transition: 'background 0.12s',
          opacity: license.scanCooldownActive ? 0.6 : 1,
        }}
        onMouseEnter={e => { if (!license.scanCooldownActive && !isScanning) e.currentTarget.style.background = COLORS.surfaceHover; }}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <span style={{ color: COLORS.textMuted, display: 'flex' }}><Icon name="scan" size={15}/></span>
        <span style={{ flex: 1 }}>Smart Scan</span>
        {license.scanCooldownActive && (
          <span style={{ fontSize: 9, fontWeight: 600, color: COLORS.amber, fontFamily: FONT.mono }}>
            <CooldownBadge nextScanAllowedAt={license.nextScanAllowedAt} />
          </span>
        )}
      </button>

      {hasData && (
        <>
          <div style={{ height: 1, background: COLORS.border, margin: '6px 4px' }} />
          <NavButton label="Recommendations" icon={<Icon name="sparkle" size={15}/>} active={nav==='recommendations'}
            badge={displayedRecs.length > 0 ? displayedRecs.length : undefined}
            onClick={() => setNav('recommendations')} />
          <NavButton label="File Browser"    icon={<Icon name="folder"  size={15}/>} active={nav==='files'}
            badge={files.length > 0 ? formatCount(files.length) : undefined}
            onClick={() => setNav('files')} />
          <NavButton label="External Drive"  icon={<Icon name="drive"   size={15}/>} active={nav==='drive'}
            onClick={() => setNav('drive')} />
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* Trial / Pro badge */}
      {!license.isPro ? (
        <div style={{ margin: '4px 2px 8px', padding: '11px 12px', borderRadius: 10, background: COLORS.surfaceHover, border: `1px solid ${COLORS.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.amber }}>Free trial</span>
            <span style={{ fontSize: 10, color: COLORS.textMuted }}>{trialScansLeft} left</span>
          </div>
          <div style={{ height: 3, borderRadius: 3, background: COLORS.surfaceActive, overflow: 'hidden', marginBottom: 9 }}>
            <div style={{ height: '100%', borderRadius: 3, background: COLORS.amber, width: `${(license.scanCount / FREE_SCAN_LIMIT) * 100}%`, transition: 'width 0.5s' }} />
          </div>
          <button onClick={() => setShowPaywall(true)} style={{
            width: '100%', padding: '6px', borderRadius: 7, cursor: 'pointer',
            background: COLORS.accentDim, border: `1px solid rgba(0,212,184,0.35)`,
            color: COLORS.accent, fontSize: 11, fontWeight: 600, fontFamily: FONT.sans,
          }}>
            Upgrade to Pro →
          </button>
        </div>
      ) : (
        <div style={{ margin: '4px 2px 8px', padding: '8px 12px', borderRadius: 10, background: COLORS.accentDim, border: `1px solid rgba(0,212,184,0.3)`, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon name="unlock" size={13} color={COLORS.accent} />
          <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.accent }}>Pro — Unlimited</span>
        </div>
      )}

      <div style={{ height: 1, background: COLORS.border, margin: '2px 0' }} />
      <NavButton label="Settings" icon={<Icon name="settings" size={15}/>} active={false} onClick={() => setShowSettings(true)} />
    </div>
  );

  // ── Topbar ────────────────────────────────────────────────────────────────

  const topbar = (
    <div style={{
      height: 44, borderBottom: `1px solid ${COLORS.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      padding: '0 18px', gap: 8, background: COLORS.bg, flexShrink: 0,
    }}>
      {drive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, background: COLORS.accentDim, border: `1px solid rgba(0,212,184,0.3)`, fontSize: 11, color: COLORS.accent, fontWeight: 600 }}>
          <Icon name="drive" size={11} color={COLORS.accent} /> {drive.name}
        </div>
      )}
      {freedBytes > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: COLORS.accentDim, border: `1px solid rgba(0,212,184,0.3)`, fontSize: 11, color: COLORS.accent, fontWeight: 600 }}>
          <Icon name="check" size={11} color={COLORS.accent} /> {formatFileSize(freedBytes)} freed
        </div>
      )}
      <div style={{ fontSize: 11, color: COLORS.textSecondary, background: COLORS.surface, padding: '4px 10px', borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
        {deviceName} — {totalStorage} GB
      </div>
    </div>
  );

  // ── Panels (CSS show/hide for instant switching) ──────────────────────────

  const panels = (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

      {/* SCAN overlay */}
      {isScanning && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.bg }}>
          <div style={{ width: '100%', maxWidth: 480 }}>
            <ScanAnimation progress={scanProgress} />
            <div style={{ display: 'flex', justifyContent: 'center', padding: '0 32px 28px' }}>
              <button onClick={handleCancelScan} style={{ padding: '8px 24px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: `1px solid ${COLORS.border}`, color: COLORS.textSecondary, fontSize: 13, fontFamily: FONT.sans }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LANDING */}
      <div style={{ display: !isScanning && !hasData && cacheLoaded ? 'flex' : 'none', flexDirection: 'column', alignItems: 'center', height: '100%', overflowY: 'auto', padding: '36px 24px' }}>
        <div style={{ maxWidth: 540, width: '100%' }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: COLORS.textPrimary, letterSpacing: '-0.03em', marginBottom: 8 }}>
            Good {getTimeOfDay()}, {deviceName} 👋
          </h1>
          <p style={{ fontSize: 14, color: COLORS.textSecondary, lineHeight: 1.7, marginBottom: 24 }}>
            Bragg Manager analyses your folders and surfaces what's safe to remove — on macOS and Windows.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            {[
              { emoji: '🔁', label: 'Duplicate detection', desc: 'Find identical files wasting space',  color: COLORS.blue },
              { emoji: '📦', label: 'Large file finder',   desc: 'Surface files over 500 MB',          color: COLORS.red  },
              { emoji: '🕒', label: 'Old file cleanup',    desc: 'Files untouched for over a year',    color: COLORS.amber },
              { emoji: '🧹', label: 'Junk removal',        desc: 'Cache, temp and log files',          color: COLORS.purple },
            ].map(f => (
              <div key={f.label} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${f.color}`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>{f.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 4 }}>{f.label}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <Toggle checked={useAI} onChange={setUseAI} icon="🤖" label="AI Enhancement" sublabel="Claude Haiku adds folder suggestions & plain-English reasoning" />
          </div>

          {license.scanCooldownActive ? (
            <CooldownBadge nextScanAllowedAt={license.nextScanAllowedAt}>
              {formatted => (
                <div style={{
                  width: '100%', padding: '16px', borderRadius: 14, textAlign: 'center',
                  background: COLORS.amberDim, border: `1px solid rgba(255,159,10,0.35)`,
                  color: COLORS.amber, fontSize: 14, fontWeight: 600,
                }}>
                  ⏳ Next scan available in {formatted}
                </div>
              )}
            </CooldownBadge>
          ) : (
            <button
              onClick={handleStartScan}
              style={{
                width: '100%', padding: '16px', borderRadius: 14, cursor: 'pointer',
                background: `linear-gradient(135deg, rgba(0,212,184,0.24), rgba(0,212,184,0.10))`,
                border: `1px solid rgba(0,212,184,0.45)`, color: COLORS.accent,
                fontSize: 16, fontWeight: 700, fontFamily: FONT.sans, letterSpacing: '-0.01em',
                boxShadow: `0 0 28px rgba(0,212,184,0.18), inset 0 1px 0 rgba(255,255,255,0.04)`,
                transition: 'box-shadow 0.2s, transform 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 44px rgba(0,212,184,0.32), inset 0 1px 0 rgba(255,255,255,0.06)`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 28px rgba(0,212,184,0.18), inset 0 1px 0 rgba(255,255,255,0.04)`; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              ⚡ Start Smart Scan
            </button>
          )}
        </div>
      </div>

      {/* DASHBOARD (post-scan) */}
      <div style={{ display: !isScanning && hasData && nav === 'dashboard' ? 'flex' : 'none', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '24px 28px', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 19, fontWeight: 700, color: COLORS.textPrimary, letterSpacing: '-0.02em' }}>Dashboard</h1>
          <button onClick={handleStartScan} disabled={license.scanCooldownActive} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, cursor: license.scanCooldownActive ? 'default' : 'pointer',
            background: COLORS.surface, border: `1px solid ${COLORS.border}`,
            color: license.scanCooldownActive ? COLORS.textMuted : COLORS.textSecondary,
            fontSize: 12, fontFamily: FONT.sans, opacity: license.scanCooldownActive ? 0.5 : 1,
          }}>
            <Icon name="refresh" size={12} color={COLORS.textMuted} />
            {license.scanCooldownActive
              ? <><CooldownBadge nextScanAllowedAt={license.nextScanAllowedAt}>{f => `Rescan in ${f}`}</CooldownBadge></>
              : 'Rescan'}
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <StatCard label="Total files"      value={files.length.toLocaleString()}             color={COLORS.blue} />
          <StatCard label="Reclaimable"      value={formatFileSize(totalReclaimable)}           color={COLORS.accent} />
          <StatCard label="Duplicate groups" value={dupCount.toLocaleString()}                  color={COLORS.amber} />
          <StatCard label="Space freed"      value={freedBytes > 0 ? formatFileSize(freedBytes) : '—'} color={COLORS.green} />
        </div>

        {/* Device + breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 14 }}>
          <div style={{ background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}`, padding: '18px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', alignSelf: 'flex-start' }}>Device</div>
            <GlowCircle total={totalStorage} used={totalUsedGB} size={140} />
          </div>
          <div style={{ background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}`, padding: '18px 22px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 }}>File breakdown</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dynamicCategories.map(cat => (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 20, fontSize: 14 }}>{cat.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: COLORS.textPrimary }}>{cat.name}</span>
                      <span style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: FONT.mono }}>
                        {cat.size >= 1e9 ? (cat.size / 1e9).toFixed(1) + ' GB' : (cat.size / 1e6).toFixed(0) + ' MB'}
                        {' · '}{cat.count.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ height: 3, background: COLORS.surfaceHover, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: cat.color, width: `${Math.min((cat.size / Math.max(totalStorage * 1e9, 1)) * 100, 100)}%`, transition: 'width 1s ease' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recommendations CTA */}
        {displayedRecs.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: 12, border: `1px solid ${COLORS.border}`, background: COLORS.surface, cursor: 'pointer' }}
            onClick={() => setNav('recommendations')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: COLORS.accentDim, border: `1px solid rgba(0,212,184,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="sparkle" size={16} color={COLORS.accent} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>
                  {displayedRecs.length} recommendation{displayedRecs.length !== 1 ? 's' : ''} ready
                </div>
                <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                  Free up {formatFileSize(totalReclaimable)} · Click to review
                </div>
              </div>
            </div>
            <Icon name="chevronRight" size={16} color={COLORS.textMuted} />
          </div>
        )}

        {/* External drive archive CTA — shown when drive detected + media files found */}
        {drive && driveCandidates.length > 0 && (
          <div style={{
            padding: '16px 18px', borderRadius: 14,
            background: `linear-gradient(135deg, rgba(10,132,255,0.1), rgba(0,212,184,0.08))`,
            border: `1px solid rgba(10,132,255,0.3)`,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(10,132,255,0.15)', border: `1px solid rgba(10,132,255,0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  📤
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>Archive to {drive.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                    {driveCandidates.length} media file{driveCandidates.length !== 1 ? 's' : ''} · {formatFileSize(driveCandidateBytes)} will be freed from your Mac
                  </div>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 12, lineHeight: 1.6 }}>
              Videos, photos and audio over 50 MB will be moved to <span style={{ fontFamily: FONT.mono, color: COLORS.blue }}>{drive.mountPoint}/Type/Year/</span> — originals deleted after verification.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowDriveModal(true)}
                style={{
                  flex: 1, padding: '9px', borderRadius: 9, cursor: 'pointer',
                  background: 'rgba(10,132,255,0.15)', border: `1px solid rgba(10,132,255,0.4)`,
                  color: COLORS.blue, fontSize: 12, fontWeight: 700, fontFamily: FONT.sans,
                }}
              >
                Review & Move Files →
              </button>
              <button
                onClick={() => setDrive(null)}
                style={{ padding: '9px 14px', borderRadius: 9, cursor: 'pointer', background: 'transparent', border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontSize: 12, fontFamily: FONT.sans }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RECOMMENDATIONS */}
      <div style={{ display: !isScanning && hasData && nav === 'recommendations' ? 'flex' : 'none', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '24px 28px' }}>
        <h1 style={{ fontSize: 19, fontWeight: 700, color: COLORS.textPrimary, letterSpacing: '-0.02em', marginBottom: 20, flexShrink: 0 }}>Recommendations</h1>
        <ErrorBoundary label="Recommendations failed to load">
          {hasData && (
            <RecsTab
              displayedRecs={displayedRecs}
              freedSpace={freedBytes / 1e9}
              aiEnabled={useAI}
              onSkip={skipRec}
              onActionSuccess={handleActionSuccess}
            />
          )}
        </ErrorBoundary>
      </div>

      {/* FILE BROWSER */}
      <div style={{ display: !isScanning && hasData && nav === 'files' ? 'flex' : 'none', flexDirection: 'column', height: '100%', padding: '24px 28px' }}>
        <h1 style={{ fontSize: 19, fontWeight: 700, color: COLORS.textPrimary, letterSpacing: '-0.02em', marginBottom: 20, flexShrink: 0 }}>File Browser</h1>
        <ErrorBoundary label="File browser failed to load">
          {hasData && <FileBrowserTab files={files} />}
        </ErrorBoundary>
      </div>

      {/* EXTERNAL DRIVE */}
      <div style={{ display: !isScanning && nav === 'drive' ? 'flex' : 'none', flexDirection: 'column', height: '100%', padding: '24px 28px' }}>
        <h1 style={{ fontSize: 19, fontWeight: 700, color: COLORS.textPrimary, letterSpacing: '-0.02em', marginBottom: 20 }}>External Drive</h1>
        <div style={{ maxWidth: 360 }}>
          <ExternalDrivePanel
            aiRecs={displayedRecs}
            onFilesArchived={ids => removeFiles(ids)}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', background: COLORS.bg, fontFamily: FONT.sans, color: COLORS.textPrimary, overflow: 'hidden' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
        @keyframes slideIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        .rec-card { animation: slideIn 0.3s ease both; }
        input, select, button, textarea { font-family: inherit; }
        button:focus-visible { outline: 2px solid ${COLORS.accent}; outline-offset: 2px; }
        h1, h2, h3 { margin: 0; }
        select option { background: ${COLORS.surface}; }
      `}</style>

      {sidebar}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {topbar}
        {panels}
      </div>

      {showSettings  && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showPaywall   && (
        <PaywallModal
          scansUsed={license.scanCount}
          freeLimit={FREE_SCAN_LIMIT}
          onActivated={() => { setShowPaywall(false); refreshLicense(); }}
          onClose={license.trialExpired ? undefined : () => setShowPaywall(false)}
        />
      )}
      {showDriveModal && drive && driveCandidates.length > 0 && (
        <DriveConfirmModal
          files={driveCandidates}
          drive={drive}
          onDone={handleDriveDone}
          onCancel={() => setShowDriveModal(false)}
        />
      )}
      {showOnboarding && (
        <OnboardingModal onDone={() => setShowOnboarding(false)} />
      )}
      {showAdmin && (
        <AdminPanel
          license={license}
          onLicenseChange={refreshLicense}
          onClose={() => setShowAdmin(false)}
          unlocked={adminUnlocked}
          onUnlock={() => setAdminUnlocked(true)}
        />
      )}
    </div>
  );
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

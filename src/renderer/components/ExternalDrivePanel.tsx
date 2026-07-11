import React, { useState, useEffect } from 'react';
import { DriveInfo } from '../../shared/types';
import GlowCircle from './GlowCircle';
import { COLORS } from './constants';

export default function ExternalDrivePanel() {
  const [drive, setDrive] = useState<DriveInfo | null>(null);
  const [detecting, setDetecting] = useState(false);

  const checkDrive = async () => {
    setDetecting(true);
    try {
      const info = await window.storeSmartAPI.detectDrive();
      setDrive(info);
    } catch (err) {
      console.error('Drive detection failed:', err);
    } finally {
      setDetecting(false);
    }
  };

  useEffect(() => { checkDrive(); }, []);

  return (
    <div style={{
      background: COLORS.surface,
      border: `1px solid ${drive ? COLORS.accent : COLORS.border}`,
      borderRadius: 14, padding: '18px 16px', transition: 'border-color 0.4s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 22 }}>💾</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>External Drive</div>
          <div style={{ fontSize: 12, color: drive ? COLORS.accent : COLORS.textMuted }}>
            {drive ? `${drive.name} — Connected` : detecting ? 'Detecting...' : 'No drive connected'}
          </div>
        </div>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: drive ? COLORS.accent : detecting ? COLORS.amber : COLORS.textMuted,
          boxShadow: drive ? `0 0 8px ${COLORS.accent}` : 'none',
          transition: 'all 0.4s',
          animation: detecting ? 'pulse 1s infinite' : 'none',
        }} />
      </div>

      {drive ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <GlowCircle total={drive.capacity / 1e9} used={(drive.capacity - drive.free) / 1e9} size={140} label="External" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Free Space', value: `${(drive.free / 1e9).toFixed(1)} GB`, color: COLORS.accent },
              { label: 'Used', value: `${((drive.capacity - drive.free) / 1e9).toFixed(1)} GB`, color: COLORS.textSecondary },
              { label: 'Mount', value: drive.mountPoint, color: COLORS.textSecondary },
              { label: 'Removable', value: drive.isRemovable ? 'Yes' : 'No', color: COLORS.blue },
            ].map(s => (
              <div key={s.label} style={{ background: COLORS.surfaceHover, borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: s.color, fontFamily: "'DM Mono', monospace", wordBreak: 'break-all' }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
          <button onClick={checkDrive} disabled={detecting} style={{
            padding: '7px 12px', borderRadius: 8, cursor: detecting ? 'default' : 'pointer',
            background: 'transparent', border: `1px solid ${COLORS.border}`,
            color: COLORS.textSecondary, fontSize: 12, alignSelf: 'center',
          }}>
            {detecting ? 'Scanning...' : 'Refresh'}
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 14, lineHeight: 1.5 }}>
            Connect a USB drive and it will appear here automatically.
          </div>
          <button onClick={checkDrive} disabled={detecting} style={{
            padding: '9px 20px', borderRadius: 8, cursor: detecting ? 'default' : 'pointer',
            background: COLORS.accentDim, border: `1px solid ${COLORS.accent}`,
            color: COLORS.accent, fontSize: 13, fontWeight: 600,
            opacity: detecting ? 0.7 : 1, transition: 'opacity 0.2s',
          }}>
            {detecting ? 'Detecting...' : 'Refresh Drive List'}
          </button>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { DriveInfo, Recommendation } from '../../shared/types';
import GlowCircle from './GlowCircle';
import { COLORS, FONT, formatFileSize } from './constants';

type ArrangeState = 'idle' | 'confirm' | 'running' | 'done' | 'error';

interface Props {
  aiRecs?: Recommendation[];
  onFilesArchived?: (archivedFileIds: Set<string>) => void;
}

export default function ExternalDrivePanel({ aiRecs = [], onFilesArchived }: Props) {
  const [drive,        setDrive]        = useState<DriveInfo | null>(null);
  const [detecting,    setDetecting]    = useState(false);
  const [arrangeState, setArrangeState] = useState<ArrangeState>('idle');
  const [progress,     setProgress]     = useState({ done: 0, total: 0, currentFile: '' });
  const [result,       setResult]       = useState<{ moved: number; failed: Array<{ file: string; error: string }> } | null>(null);

  const aiMoveRecs  = aiRecs.filter(r => r.type === 'move' && r.aiEnhanced);
  const aiFileCount = aiMoveRecs.reduce((n, r) => n + r.files.length, 0);
  const aiBytes     = aiMoveRecs.reduce((n, r) => n + r.sizeBytes, 0);

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

  useEffect(() => {
    if (arrangeState !== 'running') return;
    const handler = (_: any, done: number, total: number, currentFile: string) => {
      setProgress({ done, total, currentFile });
    };
    window.storeSmartAPI.onAIDriveProgress(handler);
    return () => window.storeSmartAPI.offAIDriveProgress(handler);
  }, [arrangeState]);

  const handleArrange = useCallback(async () => {
    if (!drive) return;
    setArrangeState('running');
    setProgress({ done: 0, total: aiFileCount, currentFile: '' });
    try {
      const res = await window.storeSmartAPI.aiMoveToDrive(aiMoveRecs, drive.mountPoint);
      setResult(res);
      setArrangeState(res.failed.length === 0 || res.moved > 0 ? 'done' : 'error');
      if (res.moved > 0 && onFilesArchived) {
        const ids = new Set(aiMoveRecs.flatMap(r => r.files.map(f => f.id)));
        onFilesArchived(ids);
      }
    } catch (err: any) {
      setArrangeState('error');
      setResult({ moved: 0, failed: [{ file: '', error: err.message }] });
    }
  }, [drive, aiMoveRecs, aiFileCount, onFilesArchived]);

  const reset = () => { setArrangeState('idle'); setResult(null); setProgress({ done: 0, total: 0, currentFile: '' }); };

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
        }} />
      </div>

      {drive ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <GlowCircle total={drive.capacity / 1e9} used={(drive.capacity - drive.free) / 1e9} size={140} label="External" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Free Space', value: `${(drive.free / 1e9).toFixed(1)} GB`,                    color: COLORS.accent },
              { label: 'Used',       value: `${((drive.capacity - drive.free) / 1e9).toFixed(1)} GB`, color: COLORS.textSecondary },
              { label: 'Mount',      value: drive.mountPoint,                                          color: COLORS.textSecondary },
              { label: 'Removable',  value: drive.isRemovable ? 'Yes' : 'No',                         color: COLORS.blue },
            ].map(s => (
              <div key={s.label} style={{ background: COLORS.surfaceHover, borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: s.color, fontFamily: "'DM Mono', monospace", wordBreak: 'break-all' }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* AI Auto-Arrange */}
          {aiFileCount > 0 && arrangeState === 'idle' && (
            <div style={{ padding: '14px', borderRadius: 12, background: 'rgba(94,92,230,0.08)', border: '1px solid rgba(94,92,230,0.3)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>🤖 AI Auto-Arrange</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 10 }}>
                {aiFileCount} file{aiFileCount !== 1 ? 's' : ''} ({formatFileSize(aiBytes)}) will be moved to AI-suggested folders on <span style={{ fontFamily: FONT.mono, color: '#a78bfa' }}>{drive.name}</span>.
              </div>
              <button onClick={() => setArrangeState('confirm')} style={{
                width: '100%', padding: '8px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(94,92,230,0.18)', border: '1px solid rgba(94,92,230,0.45)',
                color: '#a78bfa', fontSize: 12, fontWeight: 700, fontFamily: FONT.sans,
              }}>
                Auto-Arrange Files →
              </button>
            </div>
          )}

          {arrangeState === 'confirm' && (
            <div style={{ padding: '14px', borderRadius: 12, background: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.3)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.amber, marginBottom: 6 }}>⚠️ Confirm move</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 12 }}>
                {aiFileCount} files will be <strong style={{ color: COLORS.textPrimary }}>moved</strong> to AI-suggested folders on {drive.name}. Originals are deleted after size-verification.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleArrange} style={{
                  flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer',
                  background: 'rgba(255,159,10,0.18)', border: '1px solid rgba(255,159,10,0.45)',
                  color: COLORS.amber, fontSize: 12, fontWeight: 700, fontFamily: FONT.sans,
                }}>Move {aiFileCount} files</button>
                <button onClick={reset} style={{
                  padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                  background: 'transparent', border: `1px solid ${COLORS.border}`,
                  color: COLORS.textMuted, fontSize: 12, fontFamily: FONT.sans,
                }}>Cancel</button>
              </div>
            </div>
          )}

          {arrangeState === 'running' && (
            <div style={{ padding: '14px', borderRadius: 12, background: COLORS.surfaceHover, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 8 }}>
                Moving {progress.done} / {progress.total}…
              </div>
              <div style={{ height: 4, borderRadius: 4, background: COLORS.surfaceActive, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{
                  height: '100%', borderRadius: 4, background: '#a78bfa',
                  width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                  transition: 'width 0.3s ease',
                }} />
              </div>
              {progress.currentFile && (
                <div style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: FONT.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {progress.currentFile}
                </div>
              )}
            </div>
          )}

          {arrangeState === 'done' && result && (
            <div style={{ padding: '14px', borderRadius: 12, background: COLORS.accentDim, border: `1px solid rgba(0,212,184,0.3)` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.accent, marginBottom: 4 }}>
                ✅ Done — {result.moved} file{result.moved !== 1 ? 's' : ''} moved
              </div>
              {result.failed.length > 0 && (
                <div style={{ fontSize: 11, color: COLORS.amber, marginBottom: 8 }}>{result.failed.length} failed</div>
              )}
              <button onClick={reset} style={{
                padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
                background: 'transparent', border: `1px solid ${COLORS.border}`,
                color: COLORS.textMuted, fontSize: 11, fontFamily: FONT.sans,
              }}>Dismiss</button>
            </div>
          )}

          {arrangeState === 'error' && result && (
            <div style={{ padding: '14px', borderRadius: 12, background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.3)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.red, marginBottom: 4 }}>❌ Move failed</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8 }}>{result.failed[0]?.error || 'Unknown error'}</div>
              <button onClick={reset} style={{
                padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
                background: 'transparent', border: `1px solid ${COLORS.border}`,
                color: COLORS.textMuted, fontSize: 11, fontFamily: FONT.sans,
              }}>Dismiss</button>
            </div>
          )}

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

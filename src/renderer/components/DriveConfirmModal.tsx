import React, { useState, useEffect } from 'react';
import { FileMeta, DriveInfo } from '../../shared/types';
import { COLORS, FONT, formatFileSize } from './constants';
import Icon from './Icon';

const TYPE_FOLDER: Record<string, string> = {
  video:     'Videos',
  photo:     'Photos',
  audio:     'Music',
  document:  'Documents',
  archive:   'Archives',
  diskimage: 'Disk Images',
  temp:      'Temp',
  other:     'Other',
};

const TYPE_EMOJI: Record<string, string> = {
  video: '🎬', photo: '🖼️', audio: '🎵',
  document: '📄', archive: '📦', diskimage: '💿', temp: '🧹', other: '📁',
};

export function getDriveDestPath(file: FileMeta, driveMount: string): string {
  const year   = new Date(file.mtime).getFullYear();
  const folder = TYPE_FOLDER[file.type] ?? 'Other';
  return `${driveMount}/${folder}/${year}/${file.name}`;
}

interface Props {
  files:       FileMeta[];
  drive:       DriveInfo;
  onDone:      (moved: number) => void;
  onCancel:    () => void;
}

type ModalState = 'preview' | 'moving' | 'done';

export default function DriveConfirmModal({ files, drive, onDone, onCancel }: Props) {
  const [modalState, setModalState] = useState<ModalState>('preview');
  const [progress,   setProgress]   = useState({ done: 0, total: files.length });
  const [result,     setResult]     = useState<{ moved: number; failed: Array<{ file: string; error: string }> } | null>(null);
  const [activeTab,  setActiveTab]  = useState<'all' | 'video' | 'photo' | 'audio' | 'document' | 'other'>('all');

  const totalBytes  = files.reduce((s, f) => s + f.size, 0);
  const driveFreePct = drive.capacity > 0 ? (drive.free / drive.capacity) * 100 : 100;
  const fitsOnDrive  = totalBytes <= drive.free;

  // Group by type for the tab view
  const byType = files.reduce<Record<string, FileMeta[]>>((acc, f) => {
    const key = ['video','photo','audio','document'].includes(f.type) ? f.type : 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {});

  const tabs = [
    { key: 'all', label: `All (${files.length})` },
    ...Object.entries(byType).map(([k, v]) => ({
      key: k,
      label: `${TYPE_EMOJI[k] ?? '📁'} ${k[0].toUpperCase() + k.slice(1)} (${v.length})`,
    })),
  ] as Array<{ key: typeof activeTab; label: string }>;

  const visibleFiles = activeTab === 'all' ? files : (byType[activeTab] ?? []);

  const handleConfirm = async () => {
    setModalState('moving');
    const handler = (_: any, done: number, total: number) => setProgress({ done, total });
    window.storeSmartAPI.onDriveMoveProgress(handler);

    try {
      const res = await window.storeSmartAPI.moveToDrive(files, drive.mountPoint);
      setResult(res);
    } catch (e: any) {
      setResult({ moved: 0, failed: files.map(f => ({ file: f.name, error: e.message })) });
    } finally {
      window.storeSmartAPI.offDriveMoveProgress(handler);
      setModalState('done');
    }
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT.sans,
    }}>
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.borderStrong}`,
        borderRadius: 20, width: '92%', maxWidth: 560, maxHeight: '86vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
      }}>
        {/* Accent bar */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.blue})`, flexShrink: 0 }} />

        {/* ── PREVIEW STATE ─────────────────────────────────────── */}
        {modalState === 'preview' && (<>
          <div style={{ padding: '22px 24px 0', flexShrink: 0 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.textPrimary, letterSpacing: '-0.02em' }}>
                  Archive to External Drive
                </div>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>
                  Files are copied then originals deleted after verification
                </div>
              </div>
              <button onClick={onCancel} style={{ background: COLORS.surfaceHover, border: `1px solid ${COLORS.border}`, color: COLORS.textSecondary, cursor: 'pointer', width: 28, height: 28, borderRadius: 8, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            {/* Drive info card */}
            <div style={{ background: COLORS.surfaceHover, borderRadius: 12, padding: '12px 14px', border: `1px solid ${COLORS.border}`, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Icon name="drive" size={18} color={COLORS.accent} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>{drive.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONT.mono }}>{drive.mountPoint}</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: fitsOnDrive ? COLORS.green : COLORS.red, fontWeight: 600 }}>
                    {fitsOnDrive ? '✓ Enough space' : '✗ Not enough space'}
                  </div>
                  <div style={{ fontSize: 10, color: COLORS.textMuted }}>{formatFileSize(drive.free)} free</div>
                </div>
              </div>
              <div style={{ height: 4, borderRadius: 4, background: COLORS.surfaceActive, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: driveFreePct < 20 ? COLORS.red : COLORS.accent, width: `${driveFreePct}%`, transition: 'width 0.8s' }} />
              </div>
            </div>

            {/* Summary chips */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[
                { label: `${files.length} files`, color: COLORS.blue },
                { label: `${formatFileSize(totalBytes)} to move`, color: COLORS.accent },
                { label: 'Organised by type + year', color: COLORS.purple },
              ].map(chip => (
                <div key={chip.label} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', border: `1px solid ${COLORS.border}`, color: chip.color }}>
                  {chip.label}
                </div>
              ))}
            </div>

            {/* Folder structure preview */}
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="folder" size={12} color={COLORS.textMuted} />
              Files go to: <span style={{ fontFamily: FONT.mono, color: COLORS.textSecondary }}>{drive.mountPoint}/Type/Year/filename</span>
            </div>

            {/* Type tabs */}
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: '5px 10px', borderRadius: 7, cursor: 'pointer', whiteSpace: 'nowrap',
                    background: activeTab === tab.key ? COLORS.surfaceActive : 'transparent',
                    border: `1px solid ${activeTab === tab.key ? COLORS.borderStrong : COLORS.border}`,
                    color: activeTab === tab.key ? COLORS.textPrimary : COLORS.textMuted,
                    fontSize: 11, fontFamily: FONT.sans,
                  }}
                >{tab.label}</button>
              ))}
            </div>
          </div>

          {/* File list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 0', minHeight: 0 }}>
            {visibleFiles.map(file => (
              <div key={file.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 0', borderBottom: `1px solid ${COLORS.border}`,
                fontSize: 12,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{TYPE_EMOJI[file.type] ?? '📁'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: COLORS.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: FONT.mono, marginTop: 1 }}>
                    → {TYPE_FOLDER[file.type] ?? 'Other'}/{new Date(file.mtime).getFullYear()}/
                  </div>
                </div>
                <span style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: FONT.mono, flexShrink: 0 }}>
                  {formatFileSize(file.size)}
                </span>
              </div>
            ))}
          </div>

          {/* Warning + actions */}
          <div style={{ padding: '14px 24px 22px', flexShrink: 0 }}>
            <div style={{
              fontSize: 11, color: COLORS.amber, background: COLORS.amberDim,
              border: `1px solid rgba(255,159,10,0.25)`,
              borderRadius: 8, padding: '8px 12px', marginBottom: 12,
              display: 'flex', gap: 7, alignItems: 'flex-start',
            }}>
              <Icon name="warning" size={13} color={COLORS.amber} />
              <span>Original files will be <strong>permanently deleted</strong> from your Mac after each file is successfully copied and verified on the drive.</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', background: 'transparent', border: `1px solid ${COLORS.border}`, color: COLORS.textSecondary, fontSize: 13, fontFamily: FONT.sans }}>
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!fitsOnDrive}
                style={{
                  flex: 2, padding: '10px', borderRadius: 10, cursor: fitsOnDrive ? 'pointer' : 'not-allowed',
                  background: COLORS.accentDim, border: `1px solid ${COLORS.accent}`,
                  color: COLORS.accent, fontSize: 13, fontWeight: 700, fontFamily: FONT.sans,
                  opacity: fitsOnDrive ? 1 : 0.4,
                }}
              >
                Move & Free {formatFileSize(totalBytes)} →
              </button>
            </div>
          </div>
        </>)}

        {/* ── MOVING STATE ──────────────────────────────────────── */}
        {modalState === 'moving' && (
          <div style={{ padding: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ fontSize: 40 }}>📤</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.textPrimary }}>
              Moving files to {drive.name}…
            </div>
            <div style={{ width: '100%', height: 6, borderRadius: 6, background: COLORS.surfaceHover, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 6, background: COLORS.accent, width: `${pct}%`, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
              {progress.done} of {progress.total} files moved ({pct}%)
            </div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>Do not disconnect your drive</div>
          </div>
        )}

        {/* ── DONE STATE ────────────────────────────────────────── */}
        {modalState === 'done' && result && (
          <div style={{ padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>{result.failed.length === 0 ? '✅' : '⚠️'}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.textPrimary }}>
                {result.failed.length === 0 ? 'Archive complete!' : 'Finished with some errors'}
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 6 }}>
                {result.moved} file{result.moved !== 1 ? 's' : ''} moved and originals removed from your Mac
              </div>
            </div>

            {result.failed.length > 0 && (
              <div style={{ background: COLORS.redDim, border: `1px solid ${COLORS.red}`, borderRadius: 10, padding: '10px 14px', maxHeight: 140, overflowY: 'auto' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.red, marginBottom: 6 }}>Failed ({result.failed.length})</div>
                {result.failed.map((f, i) => (
                  <div key={i} style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 3 }}>
                    <span style={{ color: COLORS.textPrimary }}>{f.file}</span> — {f.error}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => onDone(result.moved)}
              style={{
                padding: '12px', borderRadius: 10, cursor: 'pointer',
                background: COLORS.accentDim, border: `1px solid ${COLORS.accent}`,
                color: COLORS.accent, fontSize: 14, fontWeight: 700, fontFamily: FONT.sans,
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

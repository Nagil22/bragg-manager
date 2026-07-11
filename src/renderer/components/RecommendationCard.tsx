import React, { useState } from 'react';
import { Recommendation, StorageAction } from '../../shared/types';
import ConfirmModal from './ConfirmModal';
import FileThumbnail from './FileThumbnail';
import { COLORS, FONT, formatFileSize } from './constants';
import Icon from './Icon';

interface Props {
  rec:             Recommendation;
  viewMode:        'list' | 'grid';
  onSkip:          (id: string) => void;
  onActionSuccess: (rec: Recommendation) => void;
}

const MAX_GRID_FILES = 20; // cap thumbnails per card

const PRIORITY_STYLE = {
  high:   { bg: COLORS.redDim,    border: COLORS.red,    text: COLORS.red,    badge: 'High' },
  medium: { bg: COLORS.amberDim,  border: COLORS.amber,  text: COLORS.amber,  badge: 'Medium' },
  low:    { bg: COLORS.accentDim, border: COLORS.accent, text: COLORS.accent, badge: 'Low' },
};

export default function RecommendationCard({ rec, viewMode, onSkip, onActionSuccess }: Props) {
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [filesExpanded, setFilesExpanded] = useState(false);

  const c = PRIORITY_STYLE[rec.priority];

  const doAction = async () => {
    setLoading(true);
    setError(null);
    try {
      const action: StorageAction = { type: rec.type as 'move' | 'delete', files: rec.files };
      const destination = rec.type === 'move' ? rec.suggestedFolder : undefined;
      const result = await window.storeSmartAPI.executeAction(action, destination);
      if (!result.success) throw new Error(result.message);
      onActionSuccess(rec);
    } catch (e: any) {
      setError(e.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = () => {
    // Always confirm for delete; also confirm for move if > 5 files
    if (rec.type === 'delete' || (rec.type === 'move' && rec.files.length > 5)) {
      setShowConfirm(true);
    } else {
      doAction();
    }
  };

  const confirmMessage = rec.type === 'delete'
    ? `Permanently delete ${rec.files.length} file${rec.files.length !== 1 ? 's' : ''} (${rec.size})? This cannot be undone.`
    : `Move ${rec.files.length} file${rec.files.length !== 1 ? 's' : ''} (${rec.size}) to ${rec.suggestedFolder ?? 'destination'}?`;

  const gridFiles  = rec.files.slice(0, MAX_GRID_FILES);
  const moreCount  = rec.files.length - MAX_GRID_FILES;
  const listFiles  = filesExpanded ? rec.files : rec.files.slice(0, 4);
  const listMore   = rec.files.length - 4;

  return (
    <>
      {showConfirm && (
        <ConfirmModal
          title={rec.type === 'delete' ? 'Confirm Delete' : 'Confirm Move'}
          message={confirmMessage}
          confirmLabel={rec.type === 'delete' ? 'Delete' : 'Move Files'}
          danger={rec.type === 'delete'}
          onConfirm={() => { setShowConfirm(false); doAction(); }}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 14, padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 12,
        opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s',
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, fontSize: 18,
            background: COLORS.surfaceHover,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {rec.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>{rec.title}</span>
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: c.bg, color: c.text, fontWeight: 700 }}>
                {c.badge}
              </span>
              {rec.aiEnhanced && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: COLORS.purpleDim, color: COLORS.purple, fontWeight: 600 }}>
                  🤖 AI
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>{rec.description}</div>
            {rec.aiReason && (
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4, fontStyle: 'italic' }}>
                "{rec.aiReason}"
              </div>
            )}
            {rec.suggestedFolder && (
              <div style={{
                fontSize: 11, color: COLORS.textMuted, marginTop: 5,
                fontFamily: FONT.mono, background: COLORS.surfaceHover,
                borderRadius: 5, padding: '3px 7px', display: 'inline-block',
              }}>
                → {rec.suggestedFolder}
              </div>
            )}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary, flexShrink: 0, fontFamily: FONT.mono }}>
            {rec.size}
          </div>
        </div>

        {/* File view — GRID mode */}
        {viewMode === 'grid' && rec.files.length > 0 && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {gridFiles.map(file => (
                <FileThumbnail key={file.id} file={file} size={100} showLabel />
              ))}
              {moreCount > 0 && (
                <div style={{
                  width: 100, height: 75, borderRadius: 8,
                  background: COLORS.surfaceHover, border: `1px solid ${COLORS.border}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  color: COLORS.textMuted, fontSize: 11, gap: 4,
                }}>
                  <span style={{ fontSize: 18 }}>+{moreCount}</span>
                  <span>more</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* File view — LIST mode (collapsible) */}
        {viewMode === 'list' && rec.files.length > 0 && (
          <div>
            <button
              onClick={() => setFilesExpanded(e => !e)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: COLORS.textMuted, padding: '0 0 6px 0',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Icon name={filesExpanded ? 'chevronRight' : 'chevronRight'} size={10} color={COLORS.textMuted} />
              {filesExpanded ? 'Hide' : 'Show'} {rec.files.length} file{rec.files.length !== 1 ? 's' : ''}
            </button>
            {filesExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {listFiles.map(file => (
                  <div key={file.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '4px 8px', borderRadius: 6,
                    background: COLORS.surfaceHover,
                    fontSize: 11,
                  }}>
                    <span style={{ fontSize: 13 }}>
                      {{video:'🎬',photo:'🖼️',audio:'🎵',document:'📄',archive:'📦',diskimage:'💿',temp:'🧹',other:'📁'}[file.type] ?? '📁'}
                    </span>
                    <span style={{ flex: 1, color: COLORS.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </span>
                    <span style={{ color: COLORS.textMuted, fontFamily: FONT.mono, flexShrink: 0 }}>
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                ))}
                {!filesExpanded && listMore > 0 && (
                  <div style={{ fontSize: 11, color: COLORS.textMuted, padding: '2px 8px' }}>
                    +{listMore} more…
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ fontSize: 12, color: COLORS.red, background: COLORS.redDim, borderRadius: 6, padding: '5px 10px' }}>
            ⚠ {error}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleActionClick}
            disabled={loading}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, cursor: loading ? 'default' : 'pointer',
              background: rec.type === 'delete' ? COLORS.redDim : COLORS.accentDim,
              border: `1px solid ${rec.type === 'delete' ? COLORS.red : COLORS.accent}`,
              color: rec.type === 'delete' ? COLORS.red : COLORS.accent,
              fontSize: 12, fontWeight: 600, fontFamily: FONT.sans,
              transition: 'opacity 0.2s', opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? '⏳ Working…' : rec.action}
          </button>
          <button
            onClick={() => onSkip(rec.id)}
            disabled={loading}
            style={{
              padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              color: COLORS.textSecondary, fontSize: 12, fontFamily: FONT.sans,
            }}
          >
            Skip
          </button>
        </div>
      </div>
    </>
  );
}

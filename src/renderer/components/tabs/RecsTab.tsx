import React, { useRef, useState, useEffect } from 'react';
import { Recommendation } from '../../../shared/types';
import RecommendationCard from '../RecommendationCard';
import { COLORS, FONT, formatFileSize } from '../constants';
import Icon from '../Icon';

interface Props {
  displayedRecs:   Recommendation[];
  freedSpace:      number; // GB
  aiEnabled:       boolean;
  onSkip:          (id: string) => void;
  onActionSuccess: (rec: Recommendation) => void;
}

type ViewMode = 'list' | 'grid';

export default function RecsTab({ displayedRecs, freedSpace, aiEnabled, onSkip, onActionSuccess }: Props) {
  const [viewMode, setViewMode]       = useState<ViewMode>('list');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalReclaimable = displayedRecs.reduce((s, r) => s + r.sizeBytes, 0);
  const aiEnhanced       = displayedRecs.some(r => r.aiEnhanced);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setShowBackToTop(el.scrollTop > 300);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 0, flex: 1, minHeight: 0 }}>

      {/* Toolbar row: banner + view toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexShrink: 0 }}>
        {/* Banner */}
        <div style={{
          flex: 1,
          background: COLORS.accentDim, border: `1px solid rgba(0,212,184,0.25)`,
          borderRadius: 10, padding: '9px 14px', fontSize: 12, color: COLORS.accent,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>{aiEnhanced ? '🤖' : '🔍'}</span>
          <span>
            {aiEnhanced
              ? `AI found ${displayedRecs.length} optimization${displayedRecs.length !== 1 ? 's' : ''} — `
              : `${displayedRecs.length} recommendation${displayedRecs.length !== 1 ? 's' : ''} — `}
            free up <strong>{formatFileSize(totalReclaimable)}</strong>
            {!aiEnabled && <span style={{ color: COLORS.textMuted, fontWeight: 400 }}> · Enable AI for smarter suggestions</span>}
          </span>
        </div>

        {/* List / Grid toggle */}
        <div style={{
          display: 'flex', borderRadius: 8,
          border: `1px solid ${COLORS.border}`,
          overflow: 'hidden', flexShrink: 0,
        }}>
          {(['list', 'grid'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              title={mode === 'list' ? 'List view' : 'Thumbnail grid view'}
              style={{
                padding: '7px 12px', border: 'none', cursor: 'pointer',
                background: viewMode === mode ? COLORS.surfaceActive : COLORS.surface,
                color: viewMode === mode ? COLORS.textPrimary : COLORS.textMuted,
                fontSize: 13, display: 'flex', alignItems: 'center', gap: 5,
                transition: 'background 0.12s',
                fontFamily: FONT.sans,
              }}
            >
              {mode === 'list'
                ? <Icon name="folder"  size={14} color={viewMode === 'list' ? COLORS.accent : COLORS.textMuted} />
                : <Icon name="dashboard" size={14} color={viewMode === 'grid' ? COLORS.accent : COLORS.textMuted} />
              }
              <span style={{ fontSize: 11 }}>{mode === 'list' ? 'List' : 'Grid'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable cards */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 2 }}
      >
        {displayedRecs.length === 0 ? (
          <div style={{
            background: COLORS.surface, border: `1px solid ${COLORS.border}`,
            borderRadius: 12, padding: '48px 20px', textAlign: 'center',
            color: COLORS.textMuted, fontSize: 14,
          }}>
            ✅ All recommendations handled. Your storage looks great!
          </div>
        ) : (
          displayedRecs.map((rec, i) => (
            <div key={rec.id} className="rec-card" style={{ animationDelay: `${Math.min(i * 0.05, 0.4)}s`, flexShrink: 0 }}>
              <RecommendationCard
                rec={rec}
                viewMode={viewMode}
                onSkip={onSkip}
                onActionSuccess={onActionSuccess}
              />
            </div>
          ))
        )}

        {freedSpace > 0 && (
          <div style={{
            background: COLORS.accentDim, border: `1px solid ${COLORS.accent}`,
            borderRadius: 10, padding: '12px 16px', fontSize: 13,
            color: COLORS.accent, fontWeight: 600, textAlign: 'center', flexShrink: 0,
          }}>
            ✅ {formatFileSize(freedSpace * 1e9)} freed this session
          </div>
        )}
      </div>

      {/* Back to top */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          style={{
            position: 'absolute', bottom: 14, right: 14,
            width: 36, height: 36, borderRadius: '50%',
            background: COLORS.surface, border: `1px solid ${COLORS.accent}`,
            color: COLORS.accent, cursor: 'pointer', fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            animation: 'slideIn 0.2s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = COLORS.accentDim}
          onMouseLeave={e => e.currentTarget.style.background = COLORS.surface}
          title="Back to top"
        >↑</button>
      )}
    </div>
  );
}

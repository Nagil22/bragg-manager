import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { FileMeta } from '../../../shared/types';
import { COLORS, FONT, formatFileSize } from '../constants';
import VirtualList from '../VirtualList';
import FileThumbnail from '../FileThumbnail';
import Icon from '../Icon';

const FILE_ICONS: Record<string, string> = {
  video: '🎬', photo: '🖼️', audio: '🎵',
  archive: '📦', document: '📄', diskimage: '💿', temp: '🧹', other: '📁',
};

const TYPE_OPTIONS = ['All Types', 'Video', 'Photo', 'Document', 'Audio', 'Archive', 'Temp', 'Other'];
const LIST_ITEM_H  = 52;
const GRID_COLS    = 5;
const THUMB_SIZE   = 110;
const GRID_ROW_H   = THUMB_SIZE * 0.75 + 44; // thumb + label + gap

type ViewMode = 'list' | 'grid';
type SortBy   = 'size' | 'date' | 'name';

interface Props { files: FileMeta[]; }

export default function FileBrowserTab({ files }: Props) {
  const [query,           setQuery]           = useState('');
  const [typeFilter,      setTypeFilter]       = useState('All Types');
  const [sortBy,          setSortBy]           = useState<SortBy>('size');
  const [viewMode,        setViewMode]         = useState<ViewMode>('list');
  const [listHeight,      setListHeight]       = useState(400);
  const [showBackToTop,   setShowBackToTop]    = useState(false);
  const [scrollToTopSig,  setScrollToTopSig]   = useState(0);
  const listContainerRef  = useRef<HTMLDivElement>(null);
  // For grid mode back-to-top (not via VirtualList — it's a regular div)
  const gridContainerRef  = useRef<HTMLDivElement>(null);

  // Measure available height
  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setListHeight(entries[0].contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleScrollTop = useCallback((top: number) => {
    setShowBackToTop(top > 300);
  }, []);

  const handleGridScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setShowBackToTop((e.currentTarget as HTMLDivElement).scrollTop > 300);
  }, []);

  const scrollToTop = () => {
    if (viewMode === 'list') {
      setScrollToTopSig(s => s + 1);
    } else {
      gridContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setShowBackToTop(false);
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    let result = files.filter(f => {
      const matchQuery = !q || f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q);
      const matchType  = typeFilter === 'All Types' || f.type === typeFilter.toLowerCase();
      return matchQuery && matchType;
    });
    if      (sortBy === 'size') result = [...result].sort((a, b) => b.size - a.size);
    else if (sortBy === 'date') result = [...result].sort((a, b) => b.mtime - a.mtime);
    else                        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [files, query, typeFilter, sortBy]);

  // Grid mode: group files into rows of GRID_COLS
  const gridRows = useMemo(() => {
    const rows: FileMeta[][] = [];
    for (let i = 0; i < filtered.length; i += GRID_COLS) {
      rows.push(filtered.slice(i, i + GRID_COLS));
    }
    return rows;
  }, [filtered]);

  const selectStyle: React.CSSProperties = {
    background: COLORS.surfaceHover, border: `1px solid ${COLORS.border}`,
    borderRadius: 8, padding: '7px 10px', color: COLORS.textSecondary,
    fontSize: 12, fontFamily: FONT.sans, outline: 'none', cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}`, overflow: 'hidden', position: 'relative' }}>

      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0,
        padding: '10px 14px', borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <Icon name="scan" size={13} color={COLORS.textMuted} />
          </span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search files…"
            style={{
              width: '100%', padding: '7px 10px 7px 32px',
              background: COLORS.surfaceHover, border: `1px solid ${COLORS.border}`,
              borderRadius: 8, color: COLORS.textPrimary, fontSize: 13, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Filters */}
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={selectStyle}>
          {TYPE_OPTIONS.map(o => <option key={o}>{o}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)} style={selectStyle}>
          <option value="size">Largest first</option>
          <option value="date">Newest first</option>
          <option value="name">Name A–Z</option>
        </select>

        <span style={{ fontSize: 11, color: COLORS.textMuted, whiteSpace: 'nowrap' }}>
          {filtered.length.toLocaleString()} files
        </span>

        {/* List / Grid toggle */}
        <div style={{ display: 'flex', borderRadius: 8, border: `1px solid ${COLORS.border}`, overflow: 'hidden', flexShrink: 0 }}>
          {(['list', 'grid'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => { setViewMode(mode); setShowBackToTop(false); }}
              title={mode === 'list' ? 'List view' : 'Thumbnail grid'}
              style={{
                padding: '7px 11px', border: 'none', cursor: 'pointer',
                background: viewMode === mode ? COLORS.surfaceActive : COLORS.surface,
                color: viewMode === mode ? COLORS.accent : COLORS.textMuted,
                display: 'flex', alignItems: 'center', gap: 4,
                transition: 'background 0.12s', fontFamily: FONT.sans, fontSize: 11,
              }}
            >
              {mode === 'list'
                ? <Icon name="folder"    size={13} color={viewMode === 'list' ? COLORS.accent : COLORS.textMuted} />
                : <Icon name="dashboard" size={13} color={viewMode === 'grid' ? COLORS.accent : COLORS.textMuted} />
              }
              {mode === 'list' ? 'List' : 'Grid'}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted, fontSize: 13 }}>
          No files match your search.
        </div>
      )}

      {/* ── LIST view ──────────────────────────────────────────────── */}
      <div ref={listContainerRef} style={{ display: viewMode === 'list' && filtered.length > 0 ? 'block' : 'none', flex: 1, minHeight: 0 }}>
        <VirtualList
          items={filtered}
          itemHeight={LIST_ITEM_H}
          height={listHeight}
          keyExtractor={f => f.id}
          onScroll={handleScrollTop}
          scrollToTopSignal={scrollToTopSig}
          renderItem={file => {
            const ageDays = Math.round((Date.now() - file.mtime) / 86_400_000);
            const isLarge = file.size > 500 * 1024 * 1024;
            const isOld   = ageDays > 365;
            return (
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: LIST_ITEM_H, borderBottom: `1px solid ${COLORS.border}`, transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = COLORS.surfaceHover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: 18, flexShrink: 0, width: 24, textAlign: 'center' }}>
                  {FILE_ICONS[file.type] ?? '📁'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: COLORS.textPrimary, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </div>
                  <div style={{ color: COLORS.textMuted, fontSize: 10, marginTop: 2 }}>
                    {file.type} · {ageDays === 0 ? 'Today' : ageDays === 1 ? 'Yesterday' : `${ageDays}d ago`}
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 500, color: COLORS.textSecondary, fontFamily: FONT.mono, flexShrink: 0 }}>
                  {formatFileSize(file.size)}
                </div>
                {isLarge && (
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 20, fontWeight: 700, background: COLORS.redDim, color: COLORS.red, flexShrink: 0, letterSpacing: '0.04em' }}>LARGE</span>
                )}
                {!isLarge && isOld && (
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 20, fontWeight: 700, background: COLORS.blueDim, color: COLORS.blue, flexShrink: 0, letterSpacing: '0.04em' }}>OLD</span>
                )}
              </div>
            );
          }}
        />
      </div>

      {/* ── GRID view ──────────────────────────────────────────────── */}
      <div
        ref={gridContainerRef}
        onScroll={handleGridScroll}
        style={{
          display: viewMode === 'grid' && filtered.length > 0 ? 'block' : 'none',
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: '14px 16px',
        }}
      >
        <VirtualList
          items={gridRows}
          itemHeight={GRID_ROW_H}
          height={listHeight}
          keyExtractor={(row, i) => `row-${i}-${row[0]?.id}`}
          onScroll={handleScrollTop}
          scrollToTopSignal={viewMode === 'grid' ? scrollToTopSig : 0}
          renderItem={row => (
            <div style={{ display: 'flex', gap: 10, paddingBottom: 10 }}>
              {row.map(file => (
                <FileThumbnail key={file.id} file={file} size={THUMB_SIZE} showLabel />
              ))}
            </div>
          )}
        />
      </div>

      {/* Back to top */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          style={{
            position: 'absolute', bottom: 16, right: 16,
            width: 36, height: 36, borderRadius: '50%',
            background: COLORS.surface, border: `1px solid ${COLORS.accent}`,
            color: COLORS.accent, cursor: 'pointer', fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            animation: 'slideIn 0.2s ease',
            zIndex: 10,
          }}
          onMouseEnter={e => e.currentTarget.style.background = COLORS.accentDim}
          onMouseLeave={e => e.currentTarget.style.background = COLORS.surface}
          title="Back to top"
        >↑</button>
      )}
    </div>
  );
}

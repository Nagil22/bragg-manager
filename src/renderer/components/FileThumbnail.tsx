import React, { useState, useEffect, useRef } from 'react';
import { FileMeta } from '../../shared/types';
import { COLORS, FONT, formatFileSize } from './constants';

const TYPE_EMOJI: Record<string, string> = {
  video: '🎬', photo: '🖼️', audio: '🎵',
  document: '📄', archive: '📦', diskimage: '💿', temp: '🧹', other: '📁',
};

// File types that can produce real thumbnails via nativeImage
const THUMB_CAPABLE = new Set(['photo', 'video']);

interface Props {
  file: FileMeta;
  size?: number; // card width in px — height is 3:4 ratio
  showLabel?: boolean;
}

export default function FileThumbnail({ file, size = 120, showLabel = true }: Props) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [loaded,   setLoaded]   = useState(false);
  const [tried,    setTried]    = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const canThumb = THUMB_CAPABLE.has(file.type);
  const thumbH   = Math.round(size * 0.75); // 4:3

  // Lazy-load via IntersectionObserver
  useEffect(() => {
    if (!canThumb) { setLoaded(true); return; }
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !tried) {
        setTried(true);
        window.storeSmartAPI.getThumbnail(file.path)
          .then(url => { setThumbUrl(url); setLoaded(true); })
          .catch(()  => { setLoaded(true); });
      }
    }, { threshold: 0.1 });

    observer.observe(el);
    return () => observer.disconnect();
  }, [file.path, canThumb, tried]);

  return (
    <div style={{ width: size, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
      {/* Thumbnail box */}
      <div
        ref={ref}
        style={{
          width: size, height: thumbH, borderRadius: 8,
          background: COLORS.surfaceHover,
          border: `1px solid ${COLORS.border}`,
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {/* Real thumbnail */}
        {thumbUrl && (
          <img
            src={thumbUrl}
            alt={file.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}

        {/* Emoji fallback — shown when no thumb or not thumb-capable */}
        {!thumbUrl && loaded && (
          <span style={{ fontSize: size * 0.3, userSelect: 'none' }}>
            {TYPE_EMOJI[file.type] ?? '📁'}
          </span>
        )}

        {/* Shimmer skeleton while loading */}
        {canThumb && !loaded && (
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(90deg, ${COLORS.surfaceHover} 25%, ${COLORS.surfaceActive} 50%, ${COLORS.surfaceHover} 75%)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s infinite linear',
          }} />
        )}

        {/* File type label chip */}
        <div style={{
          position: 'absolute', bottom: 4, left: 4,
          fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
          padding: '2px 5px', borderRadius: 4,
          background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.8)',
          textTransform: 'uppercase',
          backdropFilter: 'blur(4px)',
        }}>
          {file.type}
        </div>
      </div>

      {/* Label */}
      {showLabel && (
        <div style={{ maxWidth: size }}>
          <div style={{
            fontSize: 10, color: COLORS.textSecondary,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            lineHeight: 1.3,
          }}>
            {file.name}
          </div>
          <div style={{ fontSize: 9, color: COLORS.textMuted, fontFamily: FONT.mono, marginTop: 1 }}>
            {formatFileSize(file.size)}
          </div>
        </div>
      )}
    </div>
  );
}

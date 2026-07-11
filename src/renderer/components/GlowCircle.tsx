import React, { useState, useEffect } from 'react';
import { COLORS } from './constants';

interface Props {
  total: number;
  used: number;
  size?: number;
  label?: string;
}

export default function GlowCircle({ total, used, size = 180, label }: Props) {
  const pct = total > 0 ? used / total : 0;
  const r = (size - 24) / 2;
  const circ = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(pct), 400);
    return () => clearTimeout(t);
  }, [pct]);

  const color = pct > 0.85 ? COLORS.red : pct > 0.65 ? COLORS.amber : COLORS.accent;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.border} strokeWidth={10} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - animated)}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1), stroke 0.4s' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: COLORS.textPrimary, fontFamily: "'DM Mono', monospace" }}>
          {used.toFixed(1)}<span style={{ fontSize: 12, color: COLORS.textSecondary }}> GB</span>
        </span>
        <span style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>of {total} GB</span>
        <span style={{ fontSize: 10, color, marginTop: 4, fontWeight: 600, letterSpacing: '0.05em' }}>
          {Math.round(pct * 100)}% used
        </span>
        {label && <span style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>{label}</span>}
      </div>
    </div>
  );
}

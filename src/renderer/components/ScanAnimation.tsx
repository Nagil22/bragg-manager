import React, { useEffect, useState } from 'react';
import { COLORS } from './constants';

interface Props {
  progress: number; // 0–100, driven by real scan progress
}

const PHASES = [
  'Initializing...',
  'Scanning file system...',
  'Analyzing duplicates...',
  'Reading metadata...',
  'Identifying large files...',
  'Generating recommendations...',
  'Complete!',
];

export default function ScanAnimation({ progress }: Props) {
  const [phase, setPhase] = useState(PHASES[0]);

  useEffect(() => {
    const idx = Math.min(Math.floor((progress / 100) * PHASES.length), PHASES.length - 1);
    setPhase(PHASES[idx]);
  }, [progress]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 40px', gap: 24 }}>
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <svg width={80} height={80} style={{ transform: 'rotate(-90deg)' }}>
          {[0, 1, 2].map(i => (
            <circle
              key={i}
              cx={40} cy={40} r={28 - i * 9}
              fill="none" stroke={COLORS.accent} strokeWidth={2}
              strokeDasharray={`${(2 * Math.PI * (28 - i * 9) * progress) / 100} 9999`}
              opacity={1 - i * 0.25}
              style={{ transition: 'stroke-dasharray 0.3s ease' }}
            />
          ))}
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: COLORS.accent, fontFamily: "'DM Mono', monospace",
        }}>
          {Math.round(progress)}%
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>Scanning Storage</div>
        <div style={{ fontSize: 13, color: COLORS.accent, fontFamily: "'DM Mono', monospace" }}>{phase}</div>
      </div>
      <div style={{ width: '100%', maxWidth: 320, background: COLORS.border, borderRadius: 4, height: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: COLORS.accent, borderRadius: 4, width: `${progress}%`, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
}

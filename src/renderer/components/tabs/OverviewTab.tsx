import React from 'react';
import { FileMeta, Recommendation } from '../../../shared/types';
import { COLORS, formatFileSize } from '../constants';

interface Category {
  name: string;
  size: number;
  count: number;
  color: string;
  icon: string;
}

interface Props {
  files: FileMeta[];
  displayedRecs: Recommendation[];
  dynamicCategories: Category[];
  totalStorage: number;
}

export default function OverviewTab({ files, displayedRecs, dynamicCategories, totalStorage }: Props) {
  const totalReclaimable = displayedRecs.reduce((s, r) => s + r.sizeBytes, 0);
  const duplicateCount = displayedRecs.filter(r => r.id.startsWith('dup-')).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideIn 0.35s ease' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Files', value: files.length.toLocaleString(), icon: '📄', color: COLORS.blue },
          { label: 'Can Be Freed', value: formatFileSize(totalReclaimable), icon: '💡', color: COLORS.accent },
          { label: 'Duplicates', value: String(duplicateCount), icon: '🔁', color: COLORS.amber },
        ].map(s => (
          <div key={s.label} style={{ background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: '14px 16px' }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "'DM Mono', monospace" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}`, padding: '18px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 14 }}>Storage Breakdown</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dynamicCategories.map(cat => (
            <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 28, fontSize: 16 }}>{cat.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: COLORS.textPrimary }}>{cat.name}</span>
                  <span style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: "'DM Mono', monospace" }}>
                    {cat.size.toFixed(1)} GB · {cat.count.toLocaleString()} files
                  </span>
                </div>
                <div style={{ height: 5, background: COLORS.border, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3, background: cat.color,
                    width: `${Math.min((cat.size / Math.max(totalStorage, 1)) * 100, 100)}%`,
                    transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

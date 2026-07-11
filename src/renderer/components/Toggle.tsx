import React from 'react';
import { COLORS } from './constants';

interface Props {
  checked: boolean;
  onChange: (val: boolean) => void;
  label?: string;
  sublabel?: string;
  icon?: string;
  disabled?: boolean;
}

export default function Toggle({ checked, onChange, label, sublabel, icon, disabled = false }: Props) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: checked ? 'rgba(0,212,184,0.08)' : COLORS.surfaceHover,
        border: `1px solid ${checked ? COLORS.accent : COLORS.border}`,
        borderRadius: 12,
        padding: '12px 16px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: '100%',
        textAlign: 'left',
        transition: 'all 0.25s ease',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon && (
        <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{icon}</span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {label && (
          <div style={{ fontSize: 13, fontWeight: 600, color: checked ? COLORS.accent : COLORS.textPrimary, lineHeight: 1.2 }}>
            {label}
          </div>
        )}
        {sublabel && (
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 3, lineHeight: 1.4 }}>
            {sublabel}
          </div>
        )}
      </div>

      {/* The switch track */}
      <div style={{
        flexShrink: 0,
        width: 40,
        height: 22,
        borderRadius: 11,
        background: checked ? COLORS.accent : COLORS.border,
        position: 'relative',
        transition: 'background 0.25s ease',
        boxShadow: checked ? `0 0 10px rgba(0,212,184,0.4)` : 'none',
      }}>
        {/* The thumb */}
        <div style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }} />
      </div>
    </button>
  );
}

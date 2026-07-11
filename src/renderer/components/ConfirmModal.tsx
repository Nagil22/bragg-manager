import React from 'react';
import { COLORS } from './constants';

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ title, message, confirmLabel, danger = false, onConfirm, onCancel }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 16, padding: '28px 32px', maxWidth: 400, width: '90%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        animation: 'slideIn 0.2s ease',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 14, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
              background: 'transparent', border: `1px solid ${COLORS.border}`,
              color: COLORS.textSecondary, fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
              background: danger ? COLORS.redDim : COLORS.accentDim,
              border: `1px solid ${danger ? COLORS.red : COLORS.accent}`,
              color: danger ? COLORS.red : COLORS.accent,
              fontSize: 13, fontWeight: 600,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

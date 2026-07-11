import React, { Component, ReactNode } from 'react';
import { COLORS, FONT } from './constants';

interface Props { children: ReactNode; label?: string; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', gap: 12, textAlign: 'center',
        background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}`,
        fontFamily: FONT.sans,
      }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>
          {this.props.label ?? 'Something went wrong'}
        </div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, maxWidth: 320, lineHeight: 1.6 }}>
          {this.state.error.message}
        </div>
        <button
          onClick={() => this.setState({ error: null })}
          style={{
            marginTop: 8, padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
            background: COLORS.accentDim, border: `1px solid ${COLORS.accent}`,
            color: COLORS.accent, fontSize: 13, fontWeight: 500,
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}

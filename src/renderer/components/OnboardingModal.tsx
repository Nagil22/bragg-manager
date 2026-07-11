import React, { useState } from 'react';
import { COLORS, FONT } from './constants';
import logoSrc from '../assets/logoData';

interface Props {
  onDone: () => void;
}

const STEPS = [
  {
    emoji: null,
    title: 'Welcome to Bragg Manager',
    body: 'Your computer collects junk over time — duplicate files, old downloads, giant videos you forgot about. Bragg Manager finds all of it and helps you clean up safely.',
    cta: 'Let\'s go →',
  },
  {
    emoji: '🔍',
    title: 'Pick a folder, start scanning',
    body: 'Click Smart Scan and choose any folder — your Downloads, Desktop, or your whole home directory. The scanner walks every file and builds a complete picture in seconds.',
    cta: 'Got it →',
  },
  {
    emoji: '✨',
    title: 'Review what we found',
    body: 'Bragg Manager groups findings into Recommendations — duplicates, large files, old files, and junk. Each card shows exactly which files are affected and how much space you\'ll reclaim.',
    cta: 'Makes sense →',
  },
  {
    emoji: '🗑️',
    title: 'Delete or move — you decide',
    body: 'Nothing happens without your approval. Review the files in each recommendation, then choose to delete, move, or skip. You\'re always in control.',
    cta: 'Good to know →',
  },
  {
    emoji: '🎉',
    title: 'You\'re ready — 4 free scans await',
    body: 'Your free trial includes 4 scans. Browse everything, review all recommendations, and see how much space you can reclaim. Upgrade to Pro anytime for unlimited scans and file actions.',
    cta: 'Start scanning',
  },
];

const DOT_COUNT = STEPS.length;

export default function OnboardingModal({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const next = () => {
    if (isLast) {
      window.storeSmartAPI.setOnboarded().catch(() => {});
      onDone();
    } else {
      setStep(s => s + 1);
    }
  };

  const skip = () => {
    window.storeSmartAPI.setOnboarded().catch(() => {});
    onDone();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT.sans,
      animation: 'fadeIn 0.3s ease',
    }}>
      <style>{`
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.borderStrong ?? COLORS.border}`,
        borderRadius: 24, width: '90%', maxWidth: 460,
        overflow: 'hidden',
        boxShadow: '0 48px 120px rgba(0,0,0,0.7)',
        animation: 'slideUp 0.35s ease',
      }}>
        {/* Accent bar */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.purple})` }} />

        <div style={{ padding: '36px 32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

          {/* Logo / emoji */}
          {step === 0 ? (
            <img
              src={logoSrc}
              alt="Bragg Manager"
              style={{ width: 72, height: 72, borderRadius: 18, marginBottom: 24, objectFit: 'contain' }}
            />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: 18, marginBottom: 24,
              background: COLORS.accentDim,
              border: `1px solid rgba(0,212,184,0.25)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30,
            }}>
              {current.emoji}
            </div>
          )}

          {/* Step counter */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: COLORS.accent, marginBottom: 10 }}>
            Step {step + 1} of {DOT_COUNT}
          </div>

          {/* Title */}
          <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary, letterSpacing: '-0.02em', marginBottom: 14, lineHeight: 1.2 }}>
            {current.title}
          </div>

          {/* Body */}
          <div style={{ fontSize: 14, color: COLORS.textSecondary, lineHeight: 1.7, marginBottom: 32, maxWidth: 360 }}>
            {current.body}
          </div>

          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
            {Array.from({ length: DOT_COUNT }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? 20 : 6, height: 6, borderRadius: 3,
                  background: i === step ? COLORS.accent : COLORS.surfaceActive ?? 'rgba(255,255,255,0.15)',
                  transition: 'width 0.3s ease, background 0.3s ease',
                }}
              />
            ))}
          </div>

          {/* CTA button */}
          <button
            onClick={next}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, cursor: 'pointer',
              background: isLast
                ? `linear-gradient(135deg, rgba(0,212,184,0.22), rgba(0,212,184,0.10))`
                : COLORS.surfaceHover,
              border: isLast
                ? `1px solid ${COLORS.accent}`
                : `1px solid ${COLORS.border}`,
              color: isLast ? COLORS.accent : COLORS.textPrimary,
              fontSize: 15, fontWeight: 700, fontFamily: FONT.sans,
              boxShadow: isLast ? `0 0 24px rgba(0,212,184,0.2)` : 'none',
              transition: 'all 0.2s',
              marginBottom: 10,
            }}
            onMouseEnter={e => {
              if (isLast) e.currentTarget.style.boxShadow = `0 0 40px rgba(0,212,184,0.36)`;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = isLast ? `0 0 24px rgba(0,212,184,0.2)` : 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {current.cta}
          </button>

          {/* Skip */}
          {!isLast && (
            <button
              onClick={skip}
              style={{ background: 'none', border: 'none', color: COLORS.textMuted, fontSize: 12, cursor: 'pointer', padding: 0 }}
            >
              Skip intro
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

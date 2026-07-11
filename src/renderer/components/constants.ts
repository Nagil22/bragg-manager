// macOS-aligned dark design tokens
export const COLORS = {
  // Backgrounds
  bg:           '#0C0C0E',
  sidebar:      '#111113',
  surface:      '#1C1C1E',
  surfaceHover: '#2C2C2E',
  surfaceActive:'#3A3A3C',

  // Borders — very subtle
  border:       'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',

  // Brand
  accent:       '#00D4B8',
  accentDim:    'rgba(0,212,184,0.12)',
  accentHover:  'rgba(0,212,184,0.2)',

  // Semantic — iOS system palette
  amber:        '#FF9F0A',
  amberDim:     'rgba(255,159,10,0.12)',
  red:          '#FF453A',
  redDim:       'rgba(255,69,58,0.12)',
  blue:         '#0A84FF',
  blueDim:      'rgba(10,132,255,0.12)',
  purple:       '#BF5AF2',
  purpleDim:    'rgba(191,90,242,0.12)',
  green:        '#30D158',
  greenDim:     'rgba(48,209,88,0.12)',

  // Text
  textPrimary:   '#F2F2F7',
  textSecondary: '#8E8E93',
  textMuted:     '#48484A',
};

// System font stack — feels native on macOS
export const FONT = {
  sans: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
  mono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024)            return bytes + ' B';
  if (bytes < 1024 * 1024)    return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 ** 3)      return (bytes / (1024 ** 2)).toFixed(1) + ' MB';
  return                              (bytes / (1024 ** 3)).toFixed(1) + ' GB';
}

export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  return (n / 1000).toFixed(1) + 'k';
}

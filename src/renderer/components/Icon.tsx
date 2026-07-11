import React from 'react';

type IconName =
  | 'dashboard' | 'scan' | 'sparkle' | 'folder' | 'drive'
  | 'settings' | 'check' | 'close' | 'chevronRight' | 'warning'
  | 'trash' | 'move' | 'skip' | 'key' | 'lock' | 'unlock'
  | 'refresh' | 'arrowUp' | 'info' | 'cpu';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
}

const paths: Record<IconName, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  scan:      <><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21" strokeLinecap="round"/></>,
  sparkle:   <><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></>,
  folder:    <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>,
  drive:     <><ellipse cx="12" cy="12" rx="9" ry="5"/><path d="M3 12c0 2.8 4 5 9 5s9-2.2 9-5"/><path d="M3 7v10"/><path d="M21 7v10"/></>,
  settings:  <><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></>,
  check:     <><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></>,
  close:     <><path d="M18 6 6 18M6 6l12 12" strokeLinecap="round"/></>,
  chevronRight: <><path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></>,
  warning:   <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></>,
  trash:     <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></>,
  move:      <><path d="M5 12h14M12 5l7 7-7 7"/></>,
  skip:      <><path d="M5 12h14M15 8l4 4-4 4"/><path d="M5 8v8"/></>,
  key:       <><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.85 12.15 19 4M18 5l2 2M15 8l2 2"/></>,
  lock:      <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
  unlock:    <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0"/></>,
  refresh:   <><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></>,
  arrowUp:   <><path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round"/></>,
  info:      <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></>,
  cpu:       <><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></>,
};

export default function Icon({ name, size = 18, color = 'currentColor' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {paths[name]}
    </svg>
  );
}

# Bragg Manager — Product Roadmap

> **Stack:** Electron 42 · React 19 · TypeScript 6 · Webpack 5  
> **Target:** macOS Apple Silicon + Windows · One-time purchase · ₦15,000 / $13

---

## Current State (v1.0 — Shipping MVP)

| Area | Status |
|---|---|
| Real folder picker + recursive scan | ✅ |
| Rule engine (duplicates, old files, large files, junk) | ✅ |
| AI enhancement via OpenRouter (Claude Haiku) | ✅ |
| External drive detection + file archiving | ✅ |
| File move / delete with UI update | ✅ |
| Skip recommendation (session) | ✅ |
| Virtual file browser (16k+ files) | ✅ |
| Scan progress tied to real walk | ✅ |
| API key management (OS keychain) | ✅ |
| Device storage info | ✅ |
| Scan cache persistence (browse during cooldown) | ✅ |
| Onboarding flow (5-step first-run) | ✅ |
| License system (4 free scans, 3-hr cooldown, Pro upgrade) | ✅ |
| Gumroad payment integration | ✅ |
| macOS DMG packaging | ✅ |
| Windows NSIS installer | ✅ |
| Error boundaries | ❌ |
| Auto-updater | ❌ |
| Scan history / delta | ❌ |

---

## Phase 2 — Robustness (v1.1)

### 2.1 React error boundaries
- Wrap `StorageManager`, `ExternalDrivePanel`, `RecommendationCard` in error boundaries
- Graceful fallback UI instead of white screen

### 2.2 Drive disconnection handling
- Verify source file exists + destination drive is mounted before `executeAction`
- Show recoverable error on the card, not a crash

### 2.3 Move destination override
- Inline path picker on recommendation cards so users can override destination before confirming

---

## Phase 3 — Growth (v1.2)

### 3.1 Auto-updater
- `electron-updater` (via `electron-builder`) — host releases on GitHub Releases
- Non-intrusive update banner on startup

### 3.2 Scan history
- Save scan summary (not full file list) to `userData/history.json`
- "Last scanned X days ago" prompt + delta (files added/removed since last scan)

### 3.3 Ignored files persistence
- Persist skipped rec IDs to `userData/ignored.json`
- "Manage ignored files" in settings

### 3.4 Scheduled scans
- OS-native background scan + notification when significant space can be freed

---

## Phase 4 — Feature Expansion (v2.0)

### 4.1 Smarter duplicate detection
- Content hash (SHA-256 on first 64KB + file size) catches renamed duplicates

### 4.2 Move history & undo
- Log every action to `userData/actions.json`
- 30-minute undo window

### 4.3 Multi-folder scan
- Scan multiple roots in one session, per-folder breakdown in dashboard

### 4.4 CI pipeline
- GitHub Actions: type-check → build (macOS + Windows) → package → upload release artifacts

---

## Code Quality (Cross-cutting)

| Issue | Fix |
|---|---|
| `StorageManager.tsx` is 600+ lines | Extract `Header`, `Sidebar`, `ScanView`, `OverviewTab` into separate files |
| No TypeScript strict mode | Enable `"strict": true`; fix resulting errors |
| No ESLint | Add `eslint` + `@typescript-eslint` + `eslint-plugin-react-hooks` |
| Inline styles throughout | Migrate to CSS modules with existing design tokens |
| `aiEnhancer.ts` parses response unsafely | Wrap `JSON.parse` in try/catch + zod schema validation |

---

## Version Summary

| Version | Theme |
|---|---|
| **v1.0** | Shipping MVP — DMG + Windows installer |
| **v1.1** | Robustness — error boundaries, drive handling |
| **v1.2** | Growth — auto-updater, scan history, ignored files |
| **v2.0** | Feature expansion — undo, multi-folder, CI |

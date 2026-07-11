/**
 * License + trial management.
 *
 * Free tier: 7 scans per 3-week period, 3-hour cooldown between scans.
 * Paid: unlimited scans, all features. Validated via Gumroad API.
 */
import { app } from 'electron';
import * as fs from 'fs-extra';
import * as path from 'path';

export const FREE_SCAN_LIMIT  = 4;
export const SCAN_COOLDOWN_MS = 3 * 60 * 60 * 1000;       // 3 hours between scans
const RESET_INTERVAL_MS       = 21 * 24 * 60 * 60 * 1000; // 3 weeks trial reset

const GUMROAD_PRODUCT = 'braggmanager';
const GUMROAD_VERIFY  = 'https://api.gumroad.com/v2/licenses/verify';

export interface LicenseState {
  scanCount:          number;
  isPro:              boolean;
  licenseKey?:        string;
  activatedAt?:       number;
  trialExpired:       boolean;
  scanCooldownActive: boolean;
  nextScanAllowedAt?: number; // epoch ms — when next scan is allowed
  resetsAt?:          number; // epoch ms — when trial count resets
}

interface PersistedState {
  scanCount:    number;
  isPro:        boolean;
  licenseKey?:  string;
  activatedAt?: number;
  lastScanAt?:  number;
  lastResetAt?: number;
}

function licensePath(): string {
  return path.join(app.getPath('userData'), 'license.json');
}

function readRaw(): PersistedState {
  try {
    const raw = fs.readJsonSync(licensePath());
    return {
      scanCount:   raw.scanCount   ?? 0,
      isPro:       raw.isPro       ?? false,
      licenseKey:  raw.licenseKey,
      activatedAt: raw.activatedAt,
      lastScanAt:  raw.lastScanAt,
      lastResetAt: raw.lastResetAt ?? Date.now(),
    };
  } catch {
    const now = Date.now();
    const initial: PersistedState = { scanCount: 0, isPro: false, lastResetAt: now };
    fs.outputJsonSync(licensePath(), initial, { spaces: 2 });
    return initial;
  }
}

function writeState(s: PersistedState): void {
  fs.outputJsonSync(licensePath(), s, { spaces: 2 });
}

export function getLicenseState(): LicenseState {
  let s = readRaw();
  const now = Date.now();

  // Auto-reset scan counter every 3 weeks for free users
  if (!s.isPro) {
    const lastReset = s.lastResetAt ?? 0;
    if (now - lastReset >= RESET_INTERVAL_MS) {
      s = { ...s, scanCount: 0, lastScanAt: undefined, lastResetAt: now };
      writeState(s);
    }
  }

  const trialExpired       = !s.isPro && s.scanCount >= FREE_SCAN_LIMIT;
  const msSinceLast        = s.lastScanAt !== undefined ? now - s.lastScanAt : Infinity;
  const scanCooldownActive = !s.isPro && !trialExpired && msSinceLast < SCAN_COOLDOWN_MS;
  const nextScanAllowedAt  = scanCooldownActive && s.lastScanAt
    ? s.lastScanAt + SCAN_COOLDOWN_MS
    : undefined;
  const resetsAt = s.isPro ? undefined : (s.lastResetAt ?? now) + RESET_INTERVAL_MS;

  return {
    scanCount:          s.scanCount,
    isPro:              s.isPro,
    licenseKey:         s.licenseKey,
    activatedAt:        s.activatedAt,
    trialExpired,
    scanCooldownActive,
    nextScanAllowedAt,
    resetsAt,
  };
}

export async function incrementScanCount(): Promise<void> {
  const s = readRaw();
  if (s.isPro) return;
  writeState({ ...s, scanCount: s.scanCount + 1, lastScanAt: Date.now() });
}

export function resetScanCount(): void {
  const s = readRaw();
  writeState({ ...s, scanCount: 0, lastScanAt: undefined });
}

export function setProMode(isPro: boolean): void {
  const s = readRaw();
  writeState({ ...s, isPro, licenseKey: isPro ? s.licenseKey : undefined, activatedAt: isPro ? s.activatedAt : undefined });
}

export async function activateLicense(key: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(GUMROAD_VERIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        product_permalink:    GUMROAD_PRODUCT,
        license_key:          key.trim(),
        increment_uses_count: 'true',
      }).toString(),
    });
    const data: any = await res.json();
    if (!data.success) {
      return { success: false, message: data.message ?? 'Invalid license key.' };
    }
    const s = readRaw();
    writeState({ ...s, isPro: true, licenseKey: key.trim(), activatedAt: Date.now() });
    return { success: true, message: 'License activated. Welcome to Pro!' };
  } catch {
    return { success: false, message: 'Could not reach activation server. Check your internet connection.' };
  }
}

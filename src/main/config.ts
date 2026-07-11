/**
 * Secure API key storage using Electron's safeStorage (OS keychain-backed encryption).
 * Keys are stored as base64-encoded encrypted blobs in userData/config.json.
 */
import { safeStorage, app } from 'electron';
import * as fs from 'fs-extra';
import * as path from 'path';

interface AppConfig {
  apiKeyEncrypted?: string; // base64 encoded encrypted buffer
}

function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

function readConfig(): AppConfig {
  try {
    return fs.readJsonSync(configPath());
  } catch {
    return {};
  }
}

function writeConfig(config: AppConfig): void {
  fs.outputJsonSync(configPath(), config, { spaces: 2 });
}

export function getApiKey(): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null;
  const config = readConfig();
  if (!config.apiKeyEncrypted) return null;
  try {
    const buf = Buffer.from(config.apiKeyEncrypted, 'base64');
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

export function setApiKey(key: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available on this system');
  }
  const encrypted = safeStorage.encryptString(key);
  const config = readConfig();
  config.apiKeyEncrypted = encrypted.toString('base64');
  writeConfig(config);
}

export function clearApiKey(): void {
  const config = readConfig();
  delete config.apiKeyEncrypted;
  writeConfig(config);
}

import { ipcMain, dialog, nativeImage, app, shell, IpcMainInvokeEvent } from 'electron';
import * as os from 'os';
import * as path from 'path';
import * as fse from 'fs-extra';
import { scanDirectory, ScanCancelledError } from './scanner/fileScanner';
import { getRuleRecommendations }             from './engine/ruleEngine';
import { enhanceWithAI }                      from './engine/aiEnhancer';
import { detectDrive, executeAction, moveToDrive, moveWithAISuggestions } from './scanner/driveActions';
import { getApiKey, setApiKey, clearApiKey }  from './config';
import { getLicenseState, activateLicense, incrementScanCount, resetScanCount, setProMode } from './license';
import { ADMIN_PASSWORD } from './adminSecret';
import { FileMeta, Recommendation, StorageAction } from '../shared/types';

let currentScanController: AbortController | null = null;

const MAX_FILES_RENDERER = 100_000;

/**
 * Sort files largest-first and cap at MAX_FILES_RENDERER.
 * Run AFTER ruleEngine (which needs the full set); this caps what goes to the renderer.
 * Pre-sorting means FileBrowserTab's default "largest first" view needs zero JS sort work.
 */
function capFiles(files: FileMeta[]): FileMeta[] {
  if (files.length <= MAX_FILES_RENDERER) {
    files.sort((a, b) => b.size - a.size);
    return files;
  }
  return files.sort((a, b) => b.size - a.size).slice(0, MAX_FILES_RENDERER);
}

export function registerIpcHandlers(): void {

  // ── Scan ──────────────────────────────────────────────────────────────────

  ipcMain.handle('scan-directory', async (
    event: IpcMainInvokeEvent,
    dirPath: string
  ): Promise<{ files: FileMeta[]; recs: Recommendation[] } | null> => {
    currentScanController?.abort();
    currentScanController = new AbortController();
    const { signal } = currentScanController;
    const onProgress = (pct: number) => event.sender.send('scan-progress', pct);
    try {
      const files = await scanDirectory(dirPath, onProgress, signal);
      await incrementScanCount();
      // Run rule engine on full file set for accurate recommendations
      const recs = getRuleRecommendations(files);
      // Cap to 100k largest files — reduces IPC payload from 60MB+ to ~17MB,
      // and pre-sorts so FileBrowserTab's default view needs zero JS sort work.
      const cappedFiles = capFiles(files);
      const cachePath = path.join(app.getPath('userData'), 'last-scan.json');
      setImmediate(() => {
        fse.outputJson(cachePath, { files: cappedFiles, recs, dirPath, timestamp: Date.now() }).catch(() => {});
      });
      return { files: cappedFiles, recs };
    } catch (err) {
      if (err instanceof ScanCancelledError) return null;
      throw err;
    }
  });

  ipcMain.on('cancel-scan', () => {
    currentScanController?.abort();
    currentScanController = null;
  });

  // ── Recommendations ───────────────────────────────────────────────────────

  ipcMain.handle('get-rule-recommendations', async (_e: IpcMainInvokeEvent, files: FileMeta[]): Promise<Recommendation[]> => {
    return getRuleRecommendations(files);
  });

  ipcMain.handle('enhance-with-ai', async (_e: IpcMainInvokeEvent, recs: Recommendation[]): Promise<Recommendation[]> => {
    return enhanceWithAI(recs);
  });

  // ── Drive ─────────────────────────────────────────────────────────────────

  ipcMain.handle('detect-drive', async (): Promise<any> => {
    return detectDrive();
  });

  ipcMain.handle('move-to-drive', async (
    event: IpcMainInvokeEvent,
    files: FileMeta[],
    driveMountPoint: string
  ): Promise<{ success: boolean; moved: number; failed: Array<{ file: string; error: string }> }> => {
    return moveToDrive(files, driveMountPoint, (done, total) => {
      event.sender.send('drive-move-progress', done, total);
    });
  });

  ipcMain.handle('ai-move-to-drive', async (
    event: IpcMainInvokeEvent,
    recs: Recommendation[],
    driveMountPoint: string
  ): Promise<{ success: boolean; moved: number; failed: Array<{ file: string; error: string }> }> => {
    return moveWithAISuggestions(recs, driveMountPoint, (done, total, currentFile) => {
      event.sender.send('ai-drive-progress', done, total, currentFile);
    });
  });

  // ── Actions ───────────────────────────────────────────────────────────────

  ipcMain.handle('execute-action', async (
    _e: IpcMainInvokeEvent,
    action: StorageAction,
    destination?: string
  ): Promise<{ success: boolean; message: string }> => {
    return executeAction(action, destination);
  });

  // ── Thumbnails ────────────────────────────────────────────────────────────

  ipcMain.handle('get-thumbnail', async (_e: IpcMainInvokeEvent, filePath: string): Promise<string | null> => {
    try {
      const img = await nativeImage.createThumbnailFromPath(filePath, { width: 200, height: 150 });
      if (img.isEmpty()) return null;
      return img.toDataURL();
    } catch {
      return null;
    }
  });

  // ── Dialogs + device ──────────────────────────────────────────────────────

  ipcMain.handle('select-directory', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select a folder to scan',
    }) as unknown as { canceled: boolean; filePaths: string[] };
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('get-device-info', async (): Promise<{ hostname: string; totalStorageGB: number }> => {
    const hostname = os.hostname();
    try {
      const { statfs }    = await import('fs');
      const { promisify } = await import('util');
      const stats      = await promisify(statfs)(os.homedir());
      const totalBytes = (stats as any).bsize * (stats as any).blocks;
      if (totalBytes > 0) {
        return { hostname, totalStorageGB: parseFloat((totalBytes / (1024 ** 3)).toFixed(1)) };
      }
    } catch { /* statfs not available or returned zero — fall through */ }
    return { hostname, totalStorageGB: 256 }; // safe fallback shown in topbar
  });

  // ── API key ───────────────────────────────────────────────────────────────

  ipcMain.handle('get-api-key',   (): string | null => getApiKey());
  ipcMain.handle('set-api-key',   (_e: IpcMainInvokeEvent, key: string) => setApiKey(key));
  ipcMain.handle('clear-api-key', () => clearApiKey());

  // ── Onboarding ────────────────────────────────────────────────────────────

  ipcMain.handle('get-onboarded', async (): Promise<boolean> => {
    const p = path.join(app.getPath('userData'), 'onboarded.json');
    try { const d = await fse.readJson(p); return d.done === true; } catch { return false; }
  });

  ipcMain.handle('set-onboarded', async (): Promise<void> => {
    const p = path.join(app.getPath('userData'), 'onboarded.json');
    await fse.outputJson(p, { done: true });
  });

  // ── Shell ─────────────────────────────────────────────────────────────────

  ipcMain.handle('open-external', (_e: IpcMainInvokeEvent, url: string) => {
    shell.openExternal(url);
  });

  // ── Scan cache ────────────────────────────────────────────────────────────

  ipcMain.handle('load-scan-cache', async (): Promise<{
    files: FileMeta[]; recs: Recommendation[]; dirPath: string; timestamp: number;
  } | null> => {
    const cachePath = path.join(app.getPath('userData'), 'last-scan.json');
    try {
      const data = await fse.readJson(cachePath);
      // Cap + sort on load in case cache was written before this fix
      if (data?.files?.length) data.files = capFiles(data.files);
      return data;
    } catch {
      return null;
    }
  });

  // ── License ───────────────────────────────────────────────────────────────

  ipcMain.handle('get-license-state', () => getLicenseState());
  ipcMain.handle('activate-license',  async (_e: IpcMainInvokeEvent, key: string) => activateLicense(key));

  // ── Admin (developer-only) ────────────────────────────────────────────────
  ipcMain.handle('admin-verify-password', (_e: IpcMainInvokeEvent, pwd: string): boolean => {
    return pwd === ADMIN_PASSWORD;
  });

  ipcMain.handle('admin-reset-scans', (): void => {
    resetScanCount();
  });

  ipcMain.handle('admin-set-pro', (_e: IpcMainInvokeEvent, isPro: boolean): void => {
    setProMode(isPro);
  });

  ipcMain.handle('admin-fetch-sales', async (_e: IpcMainInvokeEvent, token: string): Promise<any> => {
    const url = `https://api.gumroad.com/v2/sales?access_token=${encodeURIComponent(token)}&page=1`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    return res.json();
  });

  ipcMain.handle('admin-save-token', async (_e: IpcMainInvokeEvent, token: string): Promise<void> => {
    const p = path.join(app.getPath('userData'), 'admin.json');
    await fse.outputJson(p, { gumroadToken: token });
  });

  ipcMain.handle('admin-load-token', async (): Promise<string | null> => {
    const p = path.join(app.getPath('userData'), 'admin.json');
    try { const d = await fse.readJson(p); return d.gumroadToken ?? null; } catch { return null; }
  });
}

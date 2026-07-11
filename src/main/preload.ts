import { contextBridge, ipcRenderer } from 'electron';
import { FileMeta, Recommendation, StorageAction } from '../shared/types';

contextBridge.exposeInMainWorld('storeSmartAPI', {
  // Scan
  scanDirectory: (dirPath: string): Promise<{ files: FileMeta[]; recs: Recommendation[] } | null> =>
    ipcRenderer.invoke('scan-directory', dirPath),
  cancelScan: (): void => {
    ipcRenderer.send('cancel-scan');
  },

  // Recommendations
  getRuleRecommendations: (files: FileMeta[]): Promise<Recommendation[]> =>
    ipcRenderer.invoke('get-rule-recommendations', files),
  enhanceWithAI: (recs: Recommendation[]): Promise<Recommendation[]> =>
    ipcRenderer.invoke('enhance-with-ai', recs),

  // Drive
  detectDrive: (): Promise<any> =>
    ipcRenderer.invoke('detect-drive'),
  moveToDrive: (files: FileMeta[], driveMountPoint: string): Promise<any> =>
    ipcRenderer.invoke('move-to-drive', files, driveMountPoint),

  // Actions
  executeAction: (action: StorageAction, destination?: string): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke('execute-action', action, destination),

  // Thumbnails
  getThumbnail: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('get-thumbnail', filePath),

  // Dialogs + device
  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke('select-directory'),
  getDeviceInfo: (): Promise<{ hostname: string; totalStorageGB: number }> =>
    ipcRenderer.invoke('get-device-info'),

  // API key (safeStorage)
  getApiKey:   (): Promise<string | null> => ipcRenderer.invoke('get-api-key'),
  setApiKey:   (key: string): Promise<void> => ipcRenderer.invoke('set-api-key', key),
  clearApiKey: (): Promise<void> => ipcRenderer.invoke('clear-api-key'),

  // Scan progress events
  onScanProgress: (handler: (event: any, pct: number) => void): void => {
    ipcRenderer.on('scan-progress', handler);
  },
  offScanProgress: (handler: (event: any, pct: number) => void): void => {
    ipcRenderer.removeListener('scan-progress', handler);
  },

  // Drive move progress events
  onDriveMoveProgress: (handler: (event: any, done: number, total: number) => void): void => {
    ipcRenderer.on('drive-move-progress', handler);
  },
  offDriveMoveProgress: (handler: (event: any, done: number, total: number) => void): void => {
    ipcRenderer.removeListener('drive-move-progress', handler);
  },

  // Onboarding
  getOnboarded: (): Promise<boolean> =>
    ipcRenderer.invoke('get-onboarded'),
  setOnboarded: (): Promise<void> =>
    ipcRenderer.invoke('set-onboarded'),

  // Shell
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('open-external', url),

  // Scan cache
  loadScanCache: (): Promise<{ files: FileMeta[]; recs: Recommendation[]; dirPath: string; timestamp: number } | null> =>
    ipcRenderer.invoke('load-scan-cache'),

  // License
  getLicenseState: (): Promise<any> =>
    ipcRenderer.invoke('get-license-state'),
  activateLicense: (key: string): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke('activate-license', key),

  // Admin
  adminVerifyPassword: (pwd: string): Promise<boolean> => ipcRenderer.invoke('admin-verify-password', pwd),
  adminResetScans:  (): Promise<void>        => ipcRenderer.invoke('admin-reset-scans'),
  adminSetPro:      (isPro: boolean): Promise<void> => ipcRenderer.invoke('admin-set-pro', isPro),
  adminFetchSales:  (token: string): Promise<any>   => ipcRenderer.invoke('admin-fetch-sales', token),
  adminSaveToken:   (token: string): Promise<void>  => ipcRenderer.invoke('admin-save-token', token),
  adminLoadToken:   (): Promise<string | null>      => ipcRenderer.invoke('admin-load-token'),
});

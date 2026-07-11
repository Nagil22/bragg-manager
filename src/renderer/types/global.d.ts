import { FileMeta, Recommendation, StorageAction, DriveInfo } from '../../shared/types';

export interface LicenseState {
  scanCount:          number;
  isPro:              boolean;
  licenseKey?:        string;
  trialExpired:       boolean;
  scanCooldownActive: boolean;
  nextScanAllowedAt?: number; // epoch ms
  resetsAt?:          number; // epoch ms
}

declare global {
  interface Window {
    storeSmartAPI: {
      // Scan
      scanDirectory: (dirPath: string) => Promise<{ files: FileMeta[]; recs: Recommendation[] } | null>;
      cancelScan:    () => void;

      // Recommendations
      getRuleRecommendations: (files: FileMeta[]) => Promise<Recommendation[]>;
      enhanceWithAI:          (recs: Recommendation[]) => Promise<Recommendation[]>;

      // Drive
      detectDrive: () => Promise<DriveInfo | null>;
      moveToDrive: (
        files: FileMeta[],
        driveMountPoint: string
      ) => Promise<{ success: boolean; moved: number; failed: Array<{ file: string; error: string }> }>;
      aiMoveToDrive: (
        recs: Recommendation[],
        driveMountPoint: string
      ) => Promise<{ success: boolean; moved: number; failed: Array<{ file: string; error: string }> }>;

      // Actions
      executeAction: (action: StorageAction, destination?: string) => Promise<{ success: boolean; message: string }>;

      // Dialogs + device
      selectDirectory: () => Promise<string | null>;
      getDeviceInfo:   () => Promise<{ hostname: string; totalStorageGB: number }>;

      // API key
      getApiKey:   () => Promise<string | null>;
      setApiKey:   (key: string) => Promise<void>;
      clearApiKey: () => Promise<void>;

      // Thumbnails
      getThumbnail: (filePath: string) => Promise<string | null>;

      // Scan progress
      onScanProgress:  (handler: (event: any, pct: number) => void) => void;
      offScanProgress: (handler: (event: any, pct: number) => void) => void;

      // Drive move progress
      onDriveMoveProgress:  (handler: (event: any, done: number, total: number) => void) => void;
      offDriveMoveProgress: (handler: (event: any, done: number, total: number) => void) => void;

      // AI auto-arrange progress
      onAIDriveProgress:  (handler: (event: any, done: number, total: number, currentFile: string) => void) => void;
      offAIDriveProgress: (handler: (event: any, done: number, total: number, currentFile: string) => void) => void;

      // Onboarding
      getOnboarded: () => Promise<boolean>;
      setOnboarded: () => Promise<void>;

      // Shell
      openExternal: (url: string) => Promise<void>;

      // Scan cache
      loadScanCache: () => Promise<{ files: FileMeta[]; recs: Recommendation[]; dirPath: string; timestamp: number } | null>;

      // License
      getLicenseState: () => Promise<LicenseState>;
      activateLicense: (key: string) => Promise<{ success: boolean; message: string }>;

      // Admin
      adminVerifyPassword: (pwd: string) => Promise<boolean>;
      adminResetScans: () => Promise<void>;
      adminSetPro:     (isPro: boolean) => Promise<void>;
      adminFetchSales: (token: string) => Promise<any>;
      adminSaveToken:  (token: string) => Promise<void>;
      adminLoadToken:  () => Promise<string | null>;
    };
  }
}

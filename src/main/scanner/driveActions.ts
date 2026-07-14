import { StorageAction, DriveInfo, FileMeta, Recommendation } from '../../shared/types';
import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';

// ── Drive detection ──────────────────────────────────────────────────────────

/** Resolve a promise with a timeout; resolves to `null` if time expires. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(v => { clearTimeout(timer); resolve(v); }, () => { clearTimeout(timer); resolve(null); });
  });
}

async function getStatfs(mountPath: string): Promise<{ total: number; free: number } | null> {
  try {
    const stats: any = await new Promise((resolve, reject) => {
      (fs as any).statfs(mountPath, (err: any, s: any) => (err ? reject(err) : resolve(s)));
    });
    return { total: stats.bsize * stats.blocks, free: stats.bsize * stats.bfree };
  } catch { return null; }
}

async function detectDriveMac(): Promise<DriveInfo | null> {
  let rootDev: number;
  try { rootDev = (await fs.stat('/')).dev; } catch { return null; }

  let names: string[];
  try { names = await fs.readdir('/Volumes'); } catch { return null; }

  for (const name of names) {
    const mountPath = `/Volumes/${name}`;
    try {
      // 4-second timeout per path — prevents hanging on stale NFS/SMB mounts
      const stat = await withTimeout(fs.stat(mountPath), 4000);
      if (!stat || stat.dev === rootDev) continue; // timed out or same device as /
      const space = await withTimeout(getStatfs(mountPath), 4000);
      if (!space) continue;
      return { name, mountPoint: mountPath, capacity: space.total, free: space.free, isRemovable: true };
    } catch { continue; }
  }
  return null;
}

async function detectDriveWin(): Promise<DriveInfo | null> {
  return new Promise(resolve => {
    exec(
      'wmic logicaldisk get DeviceId,DriveType,FreeSpace,Size,VolumeName /format:csv',
      { timeout: 8000 },
      (_err: any, stdout: string) => {
        if (!stdout) { resolve(null); return; }
        const lines = stdout.trim().split(/\r?\n/).filter(l => l.trim() && !l.startsWith('Node'));
        for (const line of lines) {
          const [, deviceId, driveType, freeSpace, size, volumeName] = line.split(',').map(s => s.trim());
          if (!deviceId || deviceId.toUpperCase() === 'C:') continue;
          if (driveType === '5') continue; // CD-ROM
          if (!size || size === '0') continue;
          resolve({
            name: volumeName || deviceId,
            mountPoint: deviceId + '\\',
            capacity: parseInt(size) || 0,
            free: parseInt(freeSpace) || 0,
            isRemovable: driveType === '2',
          });
          return;
        }
        resolve(null);
      }
    );
  });
}

export async function detectDrive(): Promise<DriveInfo | null> {
  if (process.platform === 'darwin') return detectDriveMac();
  if (process.platform === 'win32') return detectDriveWin();
  return null;
}

// ── Single-rec action (move / delete) ───────────────────────────────────────

export async function executeAction(
  action: StorageAction,
  destinationFolder?: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (action.type === 'delete') {
      for (const file of action.files) await fs.remove(file.path);
      return { success: true, message: `Deleted ${action.files.length} files` };
    }
    if (action.type === 'move') {
      if (!destinationFolder) throw new Error('Destination folder required for move');
      await fs.mkdirp(destinationFolder);
      for (const file of action.files) {
        const dest = path.join(destinationFolder, file.name);
        await fs.move(file.path, dest, { overwrite: false });
      }
      return { success: true, message: `Moved ${action.files.length} files to ${destinationFolder}` };
    }
    return { success: false, message: 'Unknown action type' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// ── Bulk drive archive — type/year organised ─────────────────────────────────

const TYPE_FOLDER: Record<string, string> = {
  video:     'Videos',
  photo:     'Photos',
  audio:     'Music',
  document:  'Documents',
  archive:   'Archives',
  diskimage: 'Disk Images',
  temp:      'Temp',
  other:     'Other',
};

/** Compute the destination directory for a file on the external drive. */
export function getDriveDestDir(file: FileMeta, driveMount: string): string {
  const year   = new Date(file.mtime).getFullYear();
  const folder = TYPE_FOLDER[file.type] ?? 'Other';
  return path.join(driveMount, folder, String(year));
}

// ── AI-guided drive archive ───────────────────────────────────────────────────

/**
 * Resolve an AI-suggested absolute path (e.g. "/Volumes/MyDrive/Old Videos")
 * to a path rooted at the actual drive mount point.
 * Strips leading /Volumes/<name> (macOS) or <DriveLetter>:\ (Windows).
 */
function resolveAISuggestedPath(suggestedFolder: string, driveMount: string): string {
  const normalised = suggestedFolder.replace(/\\/g, '/');
  const parts      = normalised.split('/').filter(Boolean);

  if (parts.length >= 2 && parts[0].toLowerCase() === 'volumes') {
    // /Volumes/<driveName>/relative/path
    const relative = parts.slice(2).join('/');
    return relative ? path.join(driveMount, relative) : driveMount;
  }
  if (parts.length >= 1 && /^[A-Za-z]:/.test(parts[0])) {
    // D:/relative/path
    const relative = parts.slice(1).join('/');
    return relative ? path.join(driveMount, relative) : driveMount;
  }
  // Already relative
  return path.join(driveMount, suggestedFolder);
}

export async function moveWithAISuggestions(
  recs: Recommendation[],
  driveMountPoint: string,
  onProgress?: (done: number, total: number, currentFile: string) => void
): Promise<{ success: boolean; moved: number; failed: Array<{ file: string; error: string }> }> {
  const failed: Array<{ file: string; error: string }> = [];
  let moved = 0;

  const pairs = recs
    .filter(r => r.type === 'move')
    .flatMap(r => r.files.map(f => ({ file: f, rec: r })));

  for (const { file, rec } of pairs) {
    try {
      const destDir = rec.suggestedFolder
        ? resolveAISuggestedPath(rec.suggestedFolder, driveMountPoint)
        : getDriveDestDir(file, driveMountPoint);

      // Collision-safe name
      let destName = file.name;
      let destPath = path.join(destDir, destName);
      let counter  = 1;
      while (await fs.pathExists(destPath)) {
        const ext  = path.extname(file.name);
        const base = path.basename(file.name, ext);
        destName   = `${base}_${counter}${ext}`;
        destPath   = path.join(destDir, destName);
        counter++;
      }

      await fs.mkdirp(destDir);
      await fs.copy(file.path, destPath);

      // Verify before deleting original
      const [srcStat, dstStat] = await Promise.all([fs.stat(file.path), fs.stat(destPath)]);
      if (srcStat.size !== dstStat.size) {
        await fs.remove(destPath);
        throw new Error('Copy verification failed: size mismatch');
      }

      await fs.remove(file.path);
      moved++;
      onProgress?.(moved, pairs.length, file.name);
    } catch (err: any) {
      failed.push({ file: file.name, error: err.message });
    }
  }

  return { success: failed.length === 0, moved, failed };
}

// ── Bulk drive archive — type/year organised ─────────────────────────────────

export async function moveToDrive(
  files: FileMeta[],
  driveMountPoint: string,
  onProgress?: (done: number, total: number) => void
): Promise<{ success: boolean; moved: number; failed: Array<{ file: string; error: string }> }> {
  const failed: Array<{ file: string; error: string }> = [];
  let moved = 0;

  for (const file of files) {
    try {
      const destDir = getDriveDestDir(file, driveMountPoint);

      // Handle name collisions
      let destName = file.name;
      let destPath = path.join(destDir, destName);
      let counter  = 1;
      while (await fs.pathExists(destPath)) {
        const ext  = path.extname(file.name);
        const base = path.basename(file.name, ext);
        destName   = `${base}_${counter}${ext}`;
        destPath   = path.join(destDir, destName);
        counter++;
      }

      await fs.mkdirp(destDir);
      await fs.copy(file.path, destPath);

      // Verify by size before deleting original
      const [srcStat, dstStat] = await Promise.all([fs.stat(file.path), fs.stat(destPath)]);
      if (srcStat.size !== dstStat.size) {
        await fs.remove(destPath);
        throw new Error('Copy verification failed: size mismatch');
      }

      await fs.remove(file.path);
      moved++;
      onProgress?.(moved, files.length);
    } catch (err: any) {
      failed.push({ file: file.name, error: err.message });
    }
  }

  return { success: failed.length === 0, moved, failed };
}

import { StorageAction, DriveInfo, FileMeta } from '../../shared/types';
import * as fs from 'fs-extra';
import * as path from 'path';

// ── Drive detection ──────────────────────────────────────────────────────────

export async function detectDrive(): Promise<DriveInfo | null> {
  const drivelist = require('drivelist');
  const drives = await drivelist.list();

  const target = drives.find((d: any) => {
    if (d.isSystem) return false;
    if (d.mountpoints.length === 0) return false;
    return d.isRemovable || d.isUSB;
  });

  if (!target) return null;

  let bestMount = target.mountpoints[0];
  let bestFree  = 0;
  let totalCap  = 0;

  for (const mp of target.mountpoints) {
    try {
      const stats = await (fs.promises?.statfs
        ? fs.promises.statfs(mp.path)
        : new Promise<any>((resolve, reject) => {
            fs.statfs(mp.path, (err: any, s: any) => (err ? reject(err) : resolve(s)));
          })
      );
      const free  = stats.bsize * stats.bfree;
      const total = stats.bsize * stats.blocks;
      if (free > bestFree) { bestFree = free; bestMount = { ...mp }; totalCap = total; }
    } catch { /* skip inaccessible */ }
  }

  return {
    name:        target.description || 'External Drive',
    mountPoint:  bestMount.path,
    capacity:    totalCap || target.size || 0,
    free:        bestFree,
    isRemovable: target.isRemovable || target.isUSB || false,
  };
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

import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FileMeta, FileType } from '../../shared/types';

export class ScanCancelledError extends Error {
  constructor() { super('Scan cancelled'); this.name = 'ScanCancelledError'; }
}

export async function scanDirectory(
  dirPath: string,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<FileMeta[]> {
  const cancelled = () => signal?.aborted;

  // Phase 1: count total entries for accurate progress reporting
  let total = 0;
  const countEntries = async (dir: string) => {
    if (cancelled()) return;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      total += entries.length;
      for (const entry of entries) {
        if (cancelled()) return;
        if (entry.isDirectory()) await countEntries(path.join(dir, entry.name));
      }
    } catch { /* skip inaccessible */ }
  };
  await countEntries(dirPath);
  if (cancelled()) throw new ScanCancelledError();
  onProgress?.(0);

  // Phase 2: walk and collect
  let counted = 0;
  const fileList: FileMeta[] = [];

  const walk = async (dir: string) => {
    if (cancelled()) throw new ScanCancelledError();
    let entries: fs.Dirent[];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      if (cancelled()) throw new ScanCancelledError();
      counted++;
      onProgress?.(total > 0 ? Math.min(Math.round((counted / total) * 95), 95) : 50);

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        try {
          const stat = await fs.stat(fullPath);
          const ext = path.extname(entry.name).toLowerCase();
          fileList.push({
            id: uuidv4(),
            name: entry.name,
            path: fullPath,
            size: stat.size,
            mtime: stat.mtimeMs,
            atime: stat.atimeMs,
            birthtime: stat.birthtimeMs,
            extension: ext,
            type: categorizeFile(ext),
          });
        } catch { /* skip inaccessible files */ }
      }
    }
  };

  await walk(dirPath);
  onProgress?.(100);
  return fileList;
}

function categorizeFile(ext: string): FileType {
  const video   = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
  const photo   = ['.jpg', '.jpeg', '.png', '.gif', '.cr2', '.raw', '.nef', '.heic', '.webp', '.tiff'];
  const audio   = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg'];
  const doc     = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md', '.pages', '.numbers', '.key'];
  const archive = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'];
  const disk    = ['.dmg', '.iso', '.pkg'];
  const temp    = ['.tmp', '.log', '.cache', '.DS_Store', '.localized',
                   'thumbs.db', 'desktop.ini', '.lnk']; // Windows temp/system files

  if (video.includes(ext))   return 'video';
  if (photo.includes(ext))   return 'photo';
  if (audio.includes(ext))   return 'audio';
  if (doc.includes(ext))     return 'document';
  if (archive.includes(ext)) return 'archive';
  if (disk.includes(ext))    return 'diskimage';
  if (temp.includes(ext))    return 'temp';
  return 'other';
}

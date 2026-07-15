import { FileMeta, Recommendation } from '../../shared/types';

const ONE_YEAR_MS   = 365 * 24 * 60 * 60 * 1000;
const THIRTY_DAY_MS = 30  * 24 * 60 * 60 * 1000;
const LARGE_FILE_THRESHOLD = 500 * 1024 * 1024;

// Max files stored in a single rec's files array.
// sizeBytes always reflects the TRUE total; this only caps what's sent through IPC / rendered.
const MAX_REC_FILES = 200;

// Max duplicate groups surfaced in the single consolidated dup rec.
const MAX_DUP_GROUPS = 50;

export function getRuleRecommendations(files: FileMeta[]): Recommendation[] {
  const recs: Recommendation[] = [];

  // ── Duplicates ──────────────────────────────────────────────────────────────
  // Group by size+name. Previously one rec per group (→ 50k+ recs for large scans).
  // Now: one consolidated rec with the top MAX_DUP_GROUPS groups by wasted bytes.
  const sizeNameMap = new Map<string, FileMeta[]>();
  for (const file of files) {
    const key = `${file.size}-${file.name}`;
    if (!sizeNameMap.has(key)) sizeNameMap.set(key, []);
    sizeNameMap.get(key)!.push(file);
  }

  // Collect all dup groups (groups with >1 file)
  const dupGroups: FileMeta[][] = [];
  let dupTotalBytes = 0;
  for (const group of sizeNameMap.values()) {
    if (group.length > 1) {
      dupGroups.push(group);
      dupTotalBytes += group[0].size * (group.length - 1);
    }
  }

  if (dupGroups.length > 0) {
    // Sort groups by wasted bytes descending, keep top MAX_DUP_GROUPS
    dupGroups.sort((a, b) => (b[0].size * (b.length - 1)) - (a[0].size * (a.length - 1)));
    const topGroups = dupGroups.slice(0, MAX_DUP_GROUPS);
    // Flatten: keep all-but-one copy from each group (the extras to delete)
    const dupFiles = topGroups.flatMap(g => g.slice(1));

    recs.push({
      id: 'dup-all',
      type: 'delete',
      title: 'Duplicate Files',
      description: `${dupGroups.length.toLocaleString()} duplicate group${dupGroups.length !== 1 ? 's' : ''} · showing top ${topGroups.length} by size`,
      action: 'Delete Duplicates',
      size: formatBytes(dupTotalBytes),
      sizeBytes: dupTotalBytes,
      priority: 'medium',
      icon: '🗑️',
      source: 'rule',
      files: dupFiles,
    });
  }

  // ── Old files (by last access time) ────────────────────────────────────────
  const oldFiles = files.filter(f => Date.now() - f.atime > ONE_YEAR_MS);
  if (oldFiles.length) {
    const oldByType = groupBy(oldFiles, 'type');
    for (const type in oldByType) {
      const group    = oldByType[type as FileMeta['type']];
      const totalSz  = sumSize(group);
      // Cap files sent through IPC; sizeBytes reflects true total
      const topFiles = topBySize(group, MAX_REC_FILES);
      recs.push({
        id: `old-${type}`,
        type: 'move',
        title: `Old ${capitalize(type)} Files`,
        description: `${group.length.toLocaleString()} files not opened in over a year`,
        action: 'Move to External',
        size: formatBytes(totalSz),
        sizeBytes: totalSz,
        priority: 'medium',
        icon: getIcon(type),
        source: 'rule',
        files: topFiles,
      });
    }
  }

  // ── Large files ─────────────────────────────────────────────────────────────
  const largeFiles = files.filter(f => f.size > LARGE_FILE_THRESHOLD);
  if (largeFiles.length) {
    const totalSz  = sumSize(largeFiles);
    const topFiles = topBySize(largeFiles, MAX_REC_FILES);
    recs.push({
      id: 'large-files',
      type: 'move',
      title: 'Large Files',
      description: `${largeFiles.length.toLocaleString()} files larger than 500 MB`,
      action: 'Move to External',
      size: formatBytes(totalSz),
      sizeBytes: totalSz,
      priority: 'high',
      icon: '📦',
      source: 'rule',
      files: topFiles,
    });
  }

  // ── Junk / temp ─────────────────────────────────────────────────────────────
  const junkFiles = files.filter(f => f.type === 'temp' && Date.now() - f.mtime > THIRTY_DAY_MS);
  if (junkFiles.length) {
    const totalSz  = sumSize(junkFiles);
    const topFiles = topBySize(junkFiles, MAX_REC_FILES);
    recs.push({
      id: 'junk-files',
      type: 'delete',
      title: 'Cache & Temp Files',
      description: `${junkFiles.length.toLocaleString()} temporary or log files untouched for 30+ days`,
      action: 'Delete Now',
      size: formatBytes(totalSz),
      sizeBytes: totalSz,
      priority: 'low',
      icon: '🧹',
      source: 'rule',
      files: topFiles,
    });
  }

  return recs;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function topBySize(files: FileMeta[], n: number): FileMeta[] {
  if (files.length <= n) return files;
  return files.slice().sort((a, b) => b.size - a.size).slice(0, n);
}

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, obj) => {
    const val = String(obj[key]);
    if (!acc[val]) acc[val] = [];
    acc[val].push(obj);
    return acc;
  }, {} as Record<string, T[]>);
}

function sumSize(files: FileMeta[]): number {
  return files.reduce((s, f) => s + f.size, 0);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)             return bytes + ' B';
  if (bytes < 1024 * 1024)      return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getIcon(type: string): string {
  const icons: Record<string, string> = {
    video: '🎬', photo: '🖼️', audio: '🎵', document: '📄', archive: '📦',
  };
  return icons[type] || '📁';
}

import { FileMeta, Recommendation } from '../../shared/types';

const ONE_YEAR_MS  = 365 * 24 * 60 * 60 * 1000;
const THIRTY_DAY_MS = 30 * 24 * 60 * 60 * 1000;
const LARGE_FILE_THRESHOLD = 500 * 1024 * 1024;

export function getRuleRecommendations(files: FileMeta[]): Recommendation[] {
  const recs: Recommendation[] = [];

  // Duplicates
  const sizeNameMap = new Map<string, FileMeta[]>();
  for (const file of files) {
    const key = `${file.size}-${file.name}`;
    if (!sizeNameMap.has(key)) sizeNameMap.set(key, []);
    sizeNameMap.get(key)!.push(file);
  }
  for (const [key, group] of sizeNameMap.entries()) {
    if (group.length > 1) {
      recs.push({
        id: `dup-${key}`,
        type: 'delete',
        title: 'Duplicate Files',
        description: `${group.length - 1} extra copies of ${group[0].name}`,
        action: 'Delete Duplicates',
        size: formatBytes(group[0].size * (group.length - 1)),
        sizeBytes: group[0].size * (group.length - 1),
        priority: 'medium',
        icon: '🗑️',
        source: 'rule',
        files: group.slice(1),
      });
    }
  }

  // Old files (by last access time)
  const oldFiles = files.filter(f => Date.now() - f.atime > ONE_YEAR_MS);
  if (oldFiles.length) {
    const oldByType = groupBy(oldFiles, 'type');
    for (const type in oldByType) {
      const group = oldByType[type as FileMeta['type']];
      recs.push({
        id: `old-${type}`,
        type: 'move',
        title: `Old ${capitalize(type)} Files`,
        description: `${group.length} files not opened in over a year`,
        action: 'Move to External',
        size: formatBytes(sumSize(group)),
        sizeBytes: sumSize(group),
        priority: 'medium',
        icon: getIcon(type),
        source: 'rule',
        files: group,
      });
    }
  }

  // Large files
  const largeFiles = files.filter(f => f.size > LARGE_FILE_THRESHOLD);
  if (largeFiles.length) {
    recs.push({
      id: 'large-files',
      type: 'move',
      title: 'Large Files',
      description: `${largeFiles.length} files larger than 500 MB`,
      action: 'Move to External',
      size: formatBytes(sumSize(largeFiles)),
      sizeBytes: sumSize(largeFiles),
      priority: 'high',
      icon: '📦',
      source: 'rule',
      files: largeFiles,
    });
  }

  // Junk / temp — only flag files not modified in the last 30 days
  const junkFiles = files.filter(f => f.type === 'temp' && Date.now() - f.mtime > THIRTY_DAY_MS);
  if (junkFiles.length) {
    recs.push({
      id: 'junk-files',
      type: 'delete',
      title: 'Cache & Temp Files',
      description: `${junkFiles.length} temporary or log files untouched for 30+ days`,
      action: 'Delete Now',
      size: formatBytes(sumSize(junkFiles)),
      sizeBytes: sumSize(junkFiles),
      priority: 'low',
      icon: '🧹',
      source: 'rule',
      files: junkFiles,
    });
  }

  return recs;
}

// Helpers
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
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getIcon(type: string): string {
  const icons: Record<string, string> = {
    video: '🎬',
    photo: '🖼️',
    audio: '🎵',
    document: '📄',
    archive: '📦',
  };
  return icons[type] || '📁';
}
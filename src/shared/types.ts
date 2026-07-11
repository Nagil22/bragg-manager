export interface FileMeta {
  id: string;
  name: string;
  path: string;
  size: number;
  mtime: number;       // modified time ms
  atime: number;       // accessed time ms
  birthtime: number;   // created time ms
  extension: string;
  type: FileType;
}

export type FileType = 'video' | 'photo' | 'audio' | 'document' | 'archive' | 'diskimage' | 'temp' | 'other';

export interface Recommendation {
  id: string;
  type: 'move' | 'delete' | 'keep';
  title: string;
  description: string;
  action: string;
  size: string;        // formatted
  sizeBytes: number;
  priority: 'high' | 'medium' | 'low';
  icon: string;
  source: 'rule' | 'ai';
  files: FileMeta[];
  suggestedFolder?: string;
  aiEnhanced?: boolean;
  aiReason?: string;
}

export interface StorageAction {
  type: 'move' | 'delete';
  files: FileMeta[];
  destination?: string; // external path
}

export interface DriveInfo {
  name: string;
  mountPoint: string;
  capacity: number;
  free: number;
  isRemovable: boolean;
}
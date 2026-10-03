// Types for backup.js, a byte-identical copy of the extension's client/lib/backup.js.
import type { Campaign, MediaRecord, Settings } from './shared.js';

export const BACKUP_APP: string;
export const BACKUP_FORMAT: number;
export const BUNDLED_CONFIG_PATH: string;

export interface BackupFile {
  app: string;
  format: number;
  exportedAt: string;
  extensionVersion: string;
  includesImages: boolean;
  includesToken: boolean;
  autoStart: boolean;
  settings: Settings;
  images?: Record<string, MediaRecord>;
}

export interface ParsedBackup {
  settings: Settings;
  images: Record<string, MediaRecord>;
  meta: { exportedAt?: string; version?: string };
  badImages: number;
  autoStart?: boolean;
}

export interface ImportResult {
  settings: Settings;
  writeImages: Record<string, MediaRecord>;
  copyImages: [string, string][];
  missingImages: number;
}

export function hasContent(settings: Settings): boolean;
export function imageIdsOf(campaigns: Campaign[]): string[];
export function buildBackup(
  settings: Settings,
  images: Record<string, MediaRecord>,
  opts?: {
    includeImages?: boolean;
    includeToken?: boolean;
    campaignIds?: string[] | null;
    version?: string;
    autoStart?: boolean;
  },
): BackupFile;
export function parseBackup(text: string): ParsedBackup;
export function summarize(
  settings: Settings,
  images: Record<string, MediaRecord>,
): { campaigns: number; groups: number; posts: number; images: number };
export function applyImport(
  current: Settings,
  parsed: Pick<ParsedBackup, 'settings' | 'images'>,
  mode: 'replace' | 'merge',
  existingImageIds?: Set<string>,
): ImportResult;

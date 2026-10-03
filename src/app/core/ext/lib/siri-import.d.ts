// Types for siri-import.js, a byte-identical copy of the extension's client/lib/siri-import.js.
import type { MediaRecord, Settings } from './shared.js';

export interface SiriReport {
  groups: number;
  groupPosts: number;
  pagePosts: number;
  images: number;
  duplicateImages: number;
  missingImages: number;
  emptyPosts: number;
  groupsWithoutPosts: number;
}

export function bytesToBase64(bytes: Uint8Array): string;
export function isSiriExport(files: Map<string, Uint8Array>): boolean;
export function convertSiriExport(
  files: Map<string, Uint8Array>,
  opts?: { name?: string },
): Promise<{ settings: Settings; images: Record<string, MediaRecord>; report: SiriReport }>;
export function nameFromFile(fileName: string): string;

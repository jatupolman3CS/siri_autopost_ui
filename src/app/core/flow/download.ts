// Saves text as a file through the browser (a Blob behind a temporary link). Used for the CSV and
// JSON exports. Safe to call where there is no browser: it does nothing and says so.
import { CSV_MIME } from './csv';

export const JSON_MIME = 'application/json';
export const TEXT_MIME = 'text/plain;charset=utf-8';

/** File names of the exports, as the prototype named them. */
export const EXPORT_FILES = {
  links: 'autopost-links.csv',
  posts: 'autopost-posts.csv',
  backup: 'autopost-backup.json',
} as const;

/** How long the temporary address stays valid after the click; a slow browser still needs it. */
const REVOKE_AFTER_MS = 2000;

/**
 * Starts the download of `content` as `filename`. Returns true when the download was started,
 * false when there is no browser to do it (or it refused).
 */
export function downloadText(filename: string, content: string, mime: string = TEXT_MIME): boolean {
  try {
    if (typeof document === 'undefined' || typeof Blob === 'undefined') return false;
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
    return true;
  } catch {
    return false;
  }
}

/** A CSV (the text already carries its BOM, see `linksToCsv`). */
export function downloadCsv(filename: string, csv: string): boolean {
  return downloadText(filename, csv, CSV_MIME);
}

/** Any value as pretty-printed JSON, for the backup. */
export function downloadJson(filename: string, data: unknown): boolean {
  return downloadText(filename, JSON.stringify(data, null, 2), JSON_MIME);
}

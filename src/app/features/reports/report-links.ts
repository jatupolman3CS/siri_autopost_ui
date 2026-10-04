/**
 * The address of a shared report on this site: the API's path (`/report/<token>`) under the page's own origin.
 * With `print` the page prints itself when it has loaded (Save as PDF).
 */
export function reportAddress(path: string, print = false): string {
  const base = typeof window === 'undefined' ? '' : window.location.origin;
  return `${base}${path}${print ? '?print=1' : ''}`;
}

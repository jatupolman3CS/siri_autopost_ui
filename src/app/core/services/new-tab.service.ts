import { Injectable } from '@angular/core';

/**
 * Opens an address in a new tab with no link back to this page (`noopener`: the new page gets no `window.opener`)
 * and no referrer. A service so specs can replace it, like `RedirectService`.
 */
@Injectable({ providedIn: 'root' })
export class NewTabService {
  open(url: string): void {
    // With `noopener` the browser returns null: there is no reference to the new window to keep.
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

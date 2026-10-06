import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import '../../core/i18n/i18n.engine';
import { I18nService } from '../../core/i18n/i18n.service';

/** How long the extension gets to take the tab over before the page says it is missing. */
const WAIT_MS = 4000;

// /connect-extension#ap-pair=1&code=...: opened by "Connect this Chrome", or from the copied connect link in any
// other Chrome (another computer or profile). The AutoPost extension sees this address and moves the tab to its own
// approval page right away, so this page only stays on screen when no (recent enough) extension is installed in
// this browser. The page has no guard on purpose: the browser being connected need not be signed in to the web app
// (or may be signed in as someone else), and the extension only says "connected successfully" there.
@Component({
  selector: 'app-connect-extension-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './connect-extension-page.component.html',
  styleUrl: './connect-extension-page.component.scss',
})
export class ConnectExtensionPageComponent {
  protected readonly t = inject(I18nService).t;
  protected readonly missing = signal(false);

  constructor() {
    const timer = setTimeout(() => this.missing.set(true), WAIT_MS);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }

  protected close(): void {
    window.close();
  }
}

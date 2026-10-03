import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';

/** How long the extension gets to take the tab over before the page says it is missing. */
const WAIT_MS = 4000;

// /connect-extension#ap-pair=1&code=...: opened by "Connect this Chrome". The AutoPost extension sees
// this address and moves the tab to its own approval page right away, so this page only stays on
// screen when no (recent enough) extension is installed in this browser.
@Component({
  selector: 'app-connect-extension-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap">
      <div class="panel box">
        @if (!missing()) {
          <i class="ph ph-circle-notch spin big"></i>
          <h1>{{ t().api.connectTitle }}</h1>
        } @else {
          <i class="ph ph-puzzle-piece big warn"></i>
          <h1>{{ t().api.connectMissing }}</h1>
          <p class="muted">{{ t().api.connectHelp }}</p>
          <div class="actions">
            <a class="su-btn su-btn-sm su-btn-primary" routerLink="/app/team">{{
              t().api.addDevice
            }}</a>
            <button type="button" class="su-btn su-btn-sm su-btn-ghost" (click)="close()">
              {{ t().api.connectClose }}
            </button>
          </div>
        }
      </div>
    </main>
  `,
  styles: `
    .wrap {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: var(--color-bg);
    }
    .box {
      max-width: 480px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 32px 24px;
    }
    h1 {
      margin: 0;
      font-size: 18px;
    }
    p {
      margin: 0;
      font-size: 14px;
    }
    .big {
      font-size: 40px;
      color: var(--color-primary);
    }
    .warn {
      color: var(--color-warning);
    }
    .actions {
      justify-content: center;
    }
    .spin {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
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

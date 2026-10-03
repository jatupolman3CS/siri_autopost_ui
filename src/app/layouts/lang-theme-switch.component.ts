import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { ThemeService } from '../core/services/theme.service';

// ไทย | English + light/dark toggle, shared by the public header and the app top bar.
@Component({
  selector: 'app-lang-theme-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="langs">
      <button type="button" [class.on]="i18n.lang() === 'th'" (click)="i18n.setLang('th')">
        ไทย
      </button>
      <button type="button" [class.on]="i18n.lang() === 'en'" (click)="i18n.setLang('en')">
        English
      </button>
    </div>
    <button
      type="button"
      class="theme"
      [attr.aria-label]="label()"
      [title]="label()"
      (click)="theme.toggle()"
    >
      <i
        class="ph"
        [class.ph-sun]="theme.theme() === 'dark'"
        [class.ph-moon]="theme.theme() !== 'dark'"
      ></i>
    </button>
  `,
  styles: `
    :host {
      display: contents;
    }
    .langs {
      display: flex;
      align-items: center;
      gap: 2px;
      border-right: 1px solid var(--color-border);
      padding-right: 8px;
    }
    button {
      height: 44px;
      border: none;
      background: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-family: inherit;
      color: var(--color-text);
      &:hover {
        background: var(--color-surface-muted);
      }
    }
    .langs button {
      padding: 0 8px;
      font-size: 14px;
      font-weight: 400;
      &.on {
        font-weight: 600;
      }
    }
    .theme {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      font-size: 20px;
    }
  `,
})
export class LangThemeSwitchComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly theme = inject(ThemeService);
  protected label() {
    const t = this.i18n.t().top;
    return this.theme.theme() === 'dark' ? t.themeLight : t.themeDark;
  }
}

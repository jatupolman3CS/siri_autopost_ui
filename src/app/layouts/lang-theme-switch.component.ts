import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { ThemeService } from '../core/services/theme.service';

// ไทย | English + light/dark toggle, shared by the public header and the app top bar.
@Component({
  selector: 'app-lang-theme-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lang-theme-switch.component.html',
  styleUrl: './lang-theme-switch.component.scss',
})
export class LangThemeSwitchComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly theme = inject(ThemeService);
  protected label() {
    const t = this.i18n.t().top;
    return this.theme.theme() === 'dark' ? t.themeLight : t.themeDark;
  }
}

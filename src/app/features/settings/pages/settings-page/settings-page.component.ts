import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ThemeMode, ThemeService } from '../../../../core/services/theme.service';

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>ตั้งค่า</h1>
    <section class="card">
      <div class="field">
        <label for="theme">ธีม</label>
        <select id="theme" [ngModel]="theme.mode()" (ngModelChange)="setTheme($event)">
          @for (opt of options; track opt.value) {
            <option [value]="opt.value">{{ opt.label }}</option>
          }
        </select>
      </div>
    </section>
  `,
  styles: `
    h1 {
      margin: 0 0 var(--space-lg);
      font-size: var(--text-2xl);
    }
    .card {
      max-width: 360px;
    }
  `,
})
export class SettingsPageComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly options: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: 'ตามระบบ' },
    { value: 'light', label: 'สว่าง' },
    { value: 'dark', label: 'มืด' },
  ];

  protected setTheme(mode: ThemeMode): void {
    this.theme.mode.set(mode);
  }
}

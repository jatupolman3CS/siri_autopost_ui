import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SettingsStore } from '../../core/data/settings.store';
import { I18nService } from '../../core/i18n/i18n.service';

// Monthly / annual billing switch with the "save 20%" note.
@Component({
  selector: 'app-cycle-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="seg">
      <button
        type="button"
        [class.on]="cycle() === 'month'"
        (click)="settings.patchBill({ cycle: 'month' })"
      >
        {{ t().common.monthly }}
      </button>
      <button
        type="button"
        [class.on]="cycle() === 'year'"
        (click)="settings.patchBill({ cycle: 'year' })"
      >
        {{ t().common.annual }}
      </button>
    </div>
    <span class="save">{{ t().bill.saveAnnual }}</span>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .save {
      font-size: 12px;
      font-weight: 500;
      color: var(--color-success);
    }
  `,
})
export class CycleSwitchComponent {
  protected readonly settings = inject(SettingsStore);
  protected readonly t = inject(I18nService).t;
  protected cycle() {
    return this.settings.bill().cycle;
  }
}

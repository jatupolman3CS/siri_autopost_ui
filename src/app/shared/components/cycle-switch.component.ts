import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SettingsStore } from '../../core/data/settings.store';
import { I18nService } from '../../core/i18n/i18n.service';

// Monthly / annual billing switch with the "save 20%" note.
@Component({
  selector: 'app-cycle-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cycle-switch.component.html',
  styleUrl: './cycle-switch.component.scss',
})
export class CycleSwitchComponent {
  protected readonly settings = inject(SettingsStore);
  protected readonly t = inject(I18nService).t;
  protected cycle() {
    return this.settings.bill().cycle;
  }
}

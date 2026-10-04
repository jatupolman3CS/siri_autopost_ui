import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { BackupStore } from '../../core/data/backup.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { AdvancedAntiBan, SettingsStore } from '../../core/data/settings.store';
import '../../core/i18n/i18n.engine';
import { I18nService } from '../../core/i18n/i18n.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { AntibanLockComponent } from './antiban-lock.component';
import { RestoreModalComponent } from './restore-modal.component';

/** The numeric rules of the advanced section: their field, label leaf and the range the API accepts. */
type NumKey = Exclude<keyof AdvancedAntiBan, 'blockMin' | 'blockMax' | 'focus'>;
const NUMS: readonly {
  key: NumKey;
  label: 'minGap' | 'dailyAll' | 'failStreak' | 'recentAvoid' | 'cooldown' | 'autoOff' | 'stopFail';
  min: number;
  max: number;
}[] = [
  { key: 'minGap', label: 'minGap', min: 0, max: 60 },
  { key: 'dailyAll', label: 'dailyAll', min: 0, max: 500 },
  { key: 'failStreak', label: 'failStreak', min: 0, max: 20 },
  { key: 'recentAvoid', label: 'recentAvoid', min: 0, max: 50 },
  { key: 'cooldown', label: 'cooldown', min: 0, max: 168 },
  { key: 'autoOffFails', label: 'autoOff', min: 0, max: 20 },
  { key: 'stopFailPct', label: 'stopFail', min: 0, max: 100 },
];
/** The API's range for the block pause, in hours. */
const BLOCK_MIN = 1;
const BLOCK_MAX = 168;

const clamp = (v: string, min: number, max: number, empty: number) =>
  Math.max(min, Math.min(max, parseInt(v, 10) || empty));

// The advanced anti-ban rules (Pro and above) that the server applies to every schedule: the numbers, the
// pause after a block, the focus window (saved only: the extension does not use it), the warm-up timetable
// and backup / restore. The values are edited in the settings store and go out with the page's Save button.
@Component({
  selector: 'app-antiban-advanced',
  imports: [CheckboxComponent, AntibanLockComponent, RestoreModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './antiban-advanced.component.html',
  styleUrl: './antiban-advanced.component.scss',
})
export class AntibanAdvancedComponent {
  private readonly settings = inject(SettingsStore);
  protected readonly backup = inject(BackupStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  /** The owner's plan has no advanced anti-ban: everything here is shown but off. */
  readonly locked = input(false);
  /** The person may change the settings (an admin, once they have loaded). */
  readonly editable = input(false);

  protected readonly adv = computed(() => this.settings.ab().advanced);
  protected readonly autopause = computed(() => this.settings.ab().autopause);
  protected readonly off = computed(() => this.locked() || !this.editable());
  /** Backup and restore need an admin and the plan, whether or not the settings have loaded. */
  protected readonly filesOff = computed(() => this.locked() || !this.perm.canAdmin());
  protected readonly filesHint = computed(() =>
    this.locked() ? this.t().ab.locked : this.perm.adminHint(),
  );
  protected readonly restoring = signal(false);

  protected readonly nums = computed(() => {
    const t = this.t().ab;
    const adv = this.adv();
    return NUMS.map((n) => ({ ...n, text: t[n.label], value: adv[n.key] }));
  });

  protected setNum(n: (typeof NUMS)[number], input: HTMLInputElement): void {
    const v = clamp(input.value, n.min, n.max, 0);
    input.value = String(v);
    this.settings.patchAdvanced({ [n.key]: v });
  }

  /** The shortest pause moves the longest up with it, as the design does (and the API requires). */
  protected setBlockMin(input: HTMLInputElement): void {
    const v = clamp(input.value, BLOCK_MIN, BLOCK_MAX, BLOCK_MIN);
    input.value = String(v);
    this.settings.patchAdvanced({ blockMin: v, blockMax: Math.max(v, this.adv().blockMax) });
  }

  protected setBlockMax(input: HTMLInputElement): void {
    const v = clamp(input.value, BLOCK_MIN, BLOCK_MAX, BLOCK_MIN);
    input.value = String(v);
    this.settings.patchAdvanced({ blockMax: v, blockMin: Math.min(v, this.adv().blockMin) });
  }

  protected setFocus(on: boolean): void {
    this.settings.patchAdvanced({ focus: on });
  }

  protected download(): void {
    void this.backup.download();
  }
}

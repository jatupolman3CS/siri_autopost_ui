import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { SchedulesStore } from '../../core/data/schedules.store';
import { SettingsStore } from '../../core/data/settings.store';
import { gapPlan } from '../../core/flow/schedule-math';
import { ApiSchedule } from '../../core/http/api.service';
import { problemMessage } from '../../core/http/problem-details';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';
import { GAP_MAX, gapChoiceOf, gapLines, gapOptions } from './schedule-gap';

// "How many minutes apart per group" for a schedule that already exists: the dialog behind the pencil of its spacing.
// Saving sets the gap on the server, which lays out the posts the schedule still has queued again (the same posts, new
// times; nothing is made twice), so a plan whose posts sit too close together is spread out at once. Saving the gap it
// already has spreads the queued posts again.
@Component({
  selector: 'app-schedule-spacing-modal',
  imports: [ModalComponent, SelectFieldComponent, InputFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="schedule() !== null" [title]="title()" (closed)="closed.emit()">
      <form class="form" id="spacing-form" (submit)="$event.preventDefault(); save()">
        <app-select-field
          [label]="t().api.flow.schGapLabel"
          [options]="options()"
          [value]="choice()"
          (valueChange)="pick($event)"
        />
        @if (choice() === 'custom') {
          <app-input-field
            [label]="t().api.flow.schGapCustomLabel"
            type="number"
            [value]="'' + gap()"
            (valueChange)="setGap($event)"
          />
        }
        <p class="su-field-help" data-testid="gap-note">
          <i class="ph ph-info" aria-hidden="true"></i>{{ lines().note }}
        </p>
        @for (w of lines().warnings; track w) {
          <p class="warn" role="status"><i class="ph ph-warning" aria-hidden="true"></i>{{ w }}</p>
        }
        <p class="note">{{ t().api.flow.schGapModalNote }}</p>
        @if (err()) {
          <p class="su-field-err" role="alert">{{ err() }}</p>
        }
      </form>
      <div modal-footer>
        <button type="button" class="su-btn su-btn-sm su-btn-secondary" (click)="closed.emit()">
          {{ t().common.cancel }}
        </button>
        <button
          type="submit"
          form="spacing-form"
          class="su-btn su-btn-sm su-btn-primary"
          data-testid="gap-save"
          [disabled]="busy()"
        >
          {{ same() ? t().api.flow.schGapRespread : t().api.flow.schGapSave }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .su-field-help,
    .warn {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      margin: 0;
      > .ph {
        margin-top: 2px;
        flex-shrink: 0;
      }
    }
    .warn {
      font-size: 13px;
      > .ph {
        color: var(--color-warning);
      }
    }
    .note {
      margin: 0;
      font-size: 13px;
      color: var(--color-text-muted);
    }
  `,
})
export class ScheduleSpacingModalComponent {
  /** The schedule being changed; null keeps the dialog closed. */
  readonly schedule = input<ApiSchedule | null>(null);
  readonly closed = output<void>();

  private readonly store = inject(SchedulesStore);
  private readonly settings = inject(SettingsStore);
  private readonly notify = inject(NotificationService);
  protected readonly t = inject(I18nService).t;

  protected readonly gap = signal(0);
  protected readonly custom = signal(false);
  protected readonly busy = signal(false);
  protected readonly err = signal('');

  protected readonly options = computed(() => gapOptions(this.t()));
  protected readonly choice = computed(() => gapChoiceOf(this.gap(), this.custom()));
  protected readonly title = computed(() =>
    fmt(this.t().api.flow.schGapModalTitle, { s: this.schedule()?.name ?? '' }),
  );
  /** What the gap makes of one day of this schedule (its groups, posts a day and times come from the server). */
  protected readonly lines = computed(() => {
    const s = this.schedule();
    const ab = this.settings.ab();
    const plan = s ? gapPlan(this.gap(), s.targetCount, s.perDay, s.slots) : null;
    return gapLines(this.t(), this.gap(), plan, { min: ab.min, max: ab.max });
  });
  /** The number is the one the schedule has already: saving it spreads the queued posts again. */
  protected readonly same = computed(() => this.gap() === (this.schedule()?.groupGapMinutes ?? 0));

  constructor() {
    effect(() => {
      const s = this.schedule();
      if (!s) return;
      untracked(() => {
        this.gap.set(s.groupGapMinutes);
        this.custom.set(false);
        this.err.set('');
        this.busy.set(false);
      });
    });
  }

  protected pick(value: string): void {
    if (value === 'custom') {
      this.custom.set(true);
      if (this.gap() === 0) this.gap.set(10);
      return;
    }
    this.custom.set(false);
    this.gap.set(Math.min(GAP_MAX, Math.max(0, parseInt(value, 10) || 0)));
  }

  protected setGap(raw: string): void {
    this.gap.set(Math.min(GAP_MAX, Math.max(1, parseInt(raw, 10) || 1)));
  }

  protected async save(): Promise<void> {
    const s = this.schedule();
    if (!s || this.busy()) return;
    this.busy.set(true);
    this.err.set('');
    try {
      await this.store.setSpacing(s.id, this.gap());
      const f = this.t().api.flow;
      this.notify.success(
        this.gap() > 0
          ? fmt(f.schGapSaved, { s: s.name, n: this.gap() })
          : fmt(f.schGapSavedAuto, { s: s.name }),
      );
      this.closed.emit();
    } catch (e) {
      // The interceptor toasted the reason; the dialog says it too and stays open.
      this.err.set(problemMessage(e) ?? this.t().api.itemSaveFailed);
    } finally {
      this.busy.set(false);
    }
  }
}

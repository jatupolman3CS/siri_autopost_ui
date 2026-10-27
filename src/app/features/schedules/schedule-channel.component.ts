import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PermissionsService } from '../../core/data/permissions.service';
import { I18nService } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.line';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { ScheduleFormService } from './schedule-form.service';

// Where the schedule posts: the chosen link set's channel (Facebook groups and pages, or LINE customer chats), said in words
// right under the set picker, and, for a LINE set, the options of a chat schedule (hours, wait for a customer who just wrote,
// bubbles, images first).
@Component({
  selector: 'app-schedule-channel',
  imports: [InputFieldComponent, CheckboxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="target" data-testid="target" [attr.data-channel]="form.set() ? form.channel() : ''">
      <span class="su-field-label">{{ t().api.line.schTarget }}</span>
      <span class="what">
        <i
          class="ph"
          [class.ph-facebook-logo]="form.channel() === 'fb' && form.set()"
          [class.ph-chat-circle-text]="form.isLine()"
          [class.ph-question]="!form.set()"
          aria-hidden="true"
        ></i>
        {{ label() }}
      </span>
    </div>
    @if (form.isLine()) {
      <div class="line" data-testid="line-options">
        <p class="su-field-help">
          <i class="ph ph-info" aria-hidden="true"></i>{{ t().api.line.schLineHint }}
        </p>
        <div class="grid">
          <app-input-field
            [label]="t().api.line.schLineFrom"
            type="time"
            [disabled]="perm.readOnly()"
            [(value)]="form.lineFrom"
          />
          <app-input-field
            [label]="t().api.line.schLineTo"
            type="time"
            [disabled]="perm.readOnly()"
            [(value)]="form.lineTo"
          />
          <app-input-field
            [label]="t().api.line.schLineSkip"
            type="number"
            [disabled]="perm.readOnly()"
            [value]="'' + form.lineSkip()"
            (valueChange)="form.lineSkip.set(+$event || limits.lineSkipMin)"
          />
        </div>
        <app-checkbox
          [label]="t().api.line.schLineSplit"
          [disabled]="perm.readOnly()"
          [(checked)]="form.lineSplit"
        />
        <app-checkbox
          [label]="t().api.line.schLineImagesFirst"
          [disabled]="perm.readOnly()"
          [(checked)]="form.lineImagesFirst"
        />
      </div>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 10px;
    }
    .target {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px 12px;
    }
    .what {
      font-weight: 600;
      font-size: 14px;
    }
    .target[data-channel='line'] .what {
      color: var(--color-success);
    }
    .line {
      display: grid;
      gap: 10px;
      padding: 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md, 8px);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
    }
  `,
})
export class ScheduleChannelComponent {
  protected readonly form = inject(ScheduleFormService);
  protected readonly perm = inject(PermissionsService);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  protected readonly limits = INPUT_LIMITS;
  protected readonly label = computed(() => {
    const l = this.t().api.line;
    return !this.form.set()
      ? l.schTargetNone
      : this.form.isLine()
        ? l.schTargetLine
        : l.schTargetFb;
  });
}

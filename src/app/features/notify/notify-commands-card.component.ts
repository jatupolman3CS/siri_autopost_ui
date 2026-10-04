import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NOTIFY_LIMITS, NotificationsStore } from '../../core/data/notifications.store';
import { I18nService } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.engine';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { ChipComponent } from '../../shared/components/chip/chip.component';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';

/** The chat commands of the design. */
const COMMANDS = ['/status', '/stop', '/start', '/pause 1h', '/today', '/skip'];

// "Control from your phone via chat": the switch and the allowed users are saved, but nothing listens to the
// bot yet, so the card says it is not available (the corrected body text) and carries a "saved only" badge.
@Component({
  selector: 'app-notify-commands-card',
  imports: [CheckboxComponent, ChipComponent, InputFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel card">
      <div class="head">
        <div class="intro">
          <div class="who">
            <i class="ph ph-device-mobile" aria-hidden="true"></i>
            <h2 class="h2">{{ t().ntf.cmdTitle }}</h2>
            <app-chip>{{ t().api.engine.storedOnlyBadge }}</app-chip>
          </div>
          <p class="body">{{ t().ntf.cmdBody }}</p>
        </div>
        <app-checkbox
          [label]="t().ntf.cmdOn"
          [checked]="on()"
          [disabled]="!editable()"
          (checkedChange)="store.setCommands({ on: $event })"
        />
      </div>
      <div class="users">
        <app-input-field
          [label]="t().ntf.cmdUsers"
          [placeholder]="t().ntf.cmdUsersPh"
          [value]="users()"
          [maxlength]="limits.users"
          [disabled]="!editable()"
          (valueChange)="store.setCommands({ users: $event })"
        />
      </div>
      <div>
        <div class="small muted list">{{ t().ntf.cmdList }}</div>
        <div class="chips">
          @for (c of commands; track c) {
            <app-chip [large]="true" [mono]="true">{{ c }}</app-chip>
          }
        </div>
      </div>
      <p class="small muted sample">{{ t().ntf.cmdSample }}</p>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .intro {
      max-width: 640px;
    }
    .who {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      > .ph {
        font-size: 24px;
        color: var(--color-primary);
      }
    }
    .body {
      margin: 4px 0 0;
      font-size: 14px;
      color: var(--color-text-muted);
    }
    .users {
      max-width: 420px;
    }
    .list {
      margin-bottom: 6px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .sample {
      margin: 0;
    }
  `,
})
export class NotifyCommandsCardComponent {
  readonly editable = input(false);
  protected readonly store = inject(NotificationsStore);
  protected readonly t = inject(I18nService).t;
  protected readonly limits = NOTIFY_LIMITS;
  protected readonly commands = COMMANDS;
  protected readonly on = computed(() => this.store.settings()?.commandsOn ?? false);
  protected readonly users = computed(() => this.store.settings()?.commandsUsers ?? '');
}

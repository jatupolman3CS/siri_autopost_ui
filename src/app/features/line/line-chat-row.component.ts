import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LineChatsStore } from '../../core/data/line-chats.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { ApiLineChat } from '../../core/http/api.service';
import { fmtDate, hm } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.line';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { ChipComponent } from '../../shared/components/chip/chip.component';

/** "20 ต.ค. 17:05" (with the year when it is not this one). */
function whenText(d: Date, li: number, now: Date): string {
  return `${fmtDate(d, li, d.getFullYear() !== now.getFullYear())} ${hm(d)}`;
}

// One customer of the chat roster: the name LINE shows, the labels, when the customer last chatted, how many link sets
// hold the chat, a dot for something unread and the "do not send" switch (an editor's). There is no message text in it:
// the app never has any.
@Component({
  selector: 'app-line-chat-row',
  imports: [CheckboxComponent, ChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row" [class.dns]="chat().doNotSend">
      <div class="main">
        <div class="name">
          @if (chat().unread) {
            <span
              class="unread"
              role="img"
              [attr.aria-label]="t().api.line.chatUnread"
              [attr.title]="t().api.line.chatUnread"
            ></span>
          }
          <span class="fw6 text">{{ name() }}</span>
          @for (l of chat().labels; track l) {
            <app-chip>{{ l }}</app-chip>
          }
        </div>
        <div class="small muted">{{ last() }} · {{ inSets() }}</div>
      </div>
      <app-checkbox
        [label]="t().api.line.chatDoNotSend"
        [ariaLabel]="aria()"
        [checked]="chat().doNotSend"
        [disabled]="perm.readOnly()"
        [attr.title]="perm.editHint() || t().api.line.chatDoNotSendHint"
        (checkedChange)="toggle($event)"
      />
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      border-top: 1px solid var(--color-border);
    }
    .row.dns .text {
      text-decoration: line-through;
      color: var(--color-text-muted);
    }
    .main {
      flex: 1;
      min-width: 0;
      display: grid;
      gap: 2px;
    }
    .name {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      min-width: 0;
    }
    .text {
      overflow-wrap: anywhere;
    }
    .unread {
      flex: none;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-primary);
    }
    .muted {
      color: var(--color-text-muted);
    }
  `,
})
export class LineChatRowComponent {
  readonly chat = input.required<ApiLineChat>();

  private readonly store = inject(LineChatsStore);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  protected readonly name = computed(
    () => this.chat().name.trim() || this.t().api.line.chatCustomer,
  );
  protected readonly last = computed(() => {
    const line = this.t().api.line;
    const at = this.chat().lastMessageAt;
    return at
      ? fmt(line.chatLastAt, { when: whenText(new Date(at), this.i18n.li(), new Date()) })
      : line.chatLastUnknown;
  });
  protected readonly inSets = computed(() => {
    const n = this.chat().linkedSetCount;
    const line = this.t().api.line;
    return n > 0 ? fmt(line.chatInSets, { n }) : line.chatInNoSet;
  });
  protected readonly aria = computed(() =>
    fmt(this.t().api.line.chatDoNotSendAria, { name: this.name() }),
  );

  protected async toggle(on: boolean): Promise<void> {
    if (this.perm.readOnly()) return;
    const line = this.t().api.line;
    // The store puts the switch back when the server refuses (the interceptor has toasted why).
    if (await this.store.setDoNotSend(this.chat().id, on))
      this.notify.success(fmt(on ? line.chatDnsOn : line.chatDnsOff, { name: this.name() }));
  }
}

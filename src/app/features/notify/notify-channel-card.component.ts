import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import {
  NOTIFY_LIMITS,
  NotificationsStore,
  NotifyChannelKey,
} from '../../core/data/notifications.store';
import { ApiTelegramChat } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.engine';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';

/** Shown in a token field that has a stored token: the token itself is never sent to the browser. */
const STORED_MASK = '••••••••••••';

// One channel of the notification page (Telegram or LINE OA): switch, write-only token, recipient, a test message
// and, for Telegram, the chat lookup. The token the person types never goes into the settings (see
// NotificationsStore.tokens): the field shows a mask while one is stored, and a blank field keeps it.
@Component({
  selector: 'app-notify-channel-card',
  imports: [PagerComponent, CheckboxComponent, InputFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notify-channel-card.component.html',
  styleUrl: './notify-channel-card.component.scss',
})
export class NotifyChannelCardComponent {
  readonly channel = input.required<NotifyChannelKey>();
  /** The person may change the settings (admin role, plan with notifications). */
  readonly editable = input(false);
  /** Why it may not (a tooltip), '' when it may. */
  readonly hint = input('');

  protected readonly store = inject(NotificationsStore);
  private readonly notify = inject(NotificationService);
  protected readonly t = inject(I18nService).t;
  protected readonly limits = NOTIFY_LIMITS;

  protected readonly tg = computed(() => this.channel() === 'tg');
  protected readonly on = computed(() => {
    const s = this.store.settings();
    return (this.tg() ? s?.telegram.on : s?.line.on) ?? false;
  });
  protected readonly target = computed(() => {
    const s = this.store.settings();
    return (this.tg() ? s?.telegram.chatId : s?.line.to) ?? '';
  });
  protected readonly state = computed(() =>
    this.tg() ? this.store.telegramState() : this.store.lineState(),
  );
  /** What the token field shows: the text typed this time (never a stored token). */
  protected readonly typed = computed(() => this.store.tokens()[this.channel()] ?? '');
  protected readonly placeholder = computed(() =>
    this.state() === 'saved' ? STORED_MASK : this.tg() ? '123456789:AA…' : 'eyJhbGciOi…',
  );
  protected readonly name = computed(() => (this.tg() ? this.t().ntf.tg : this.t().ntf.line));

  /** The chats a lookup found when there is more than one to pick from. */
  protected readonly chats = signal<ApiTelegramChat[]>([]);
  protected readonly chatPager = new Pager(20);
  protected readonly chatPage = computed(() => this.chatPager.slice(this.chats()));
  protected readonly finding = signal(false);
  protected readonly testing = signal(false);

  protected async find(): Promise<void> {
    if (this.finding()) return;
    this.finding.set(true);
    this.chats.set([]);
    try {
      const r = await this.store.findChats();
      const t = this.t();
      if (r.status === 'incomplete') this.notify.error(t.api.engine.notifyFindNeedsToken);
      else if (r.status === 'unreachable') this.notify.error(t.api.serverDown);
      else if (r.status === 'failed') this.notify.error(r.message);
      else if (r.chats.length === 0) this.notify.error(t.api.engine.notifyChatsNone);
      else if (r.chats.length === 1) this.pick(r.chats[0]);
      else this.chats.set(r.chats);
    } finally {
      this.finding.set(false);
    }
  }

  protected pick(chat: ApiTelegramChat): void {
    this.store.setTarget('tg', chat.id);
    this.chats.set([]);
    this.notify.success(fmt(this.t().ntf.tgFound, { n: chat.title, id: chat.id }));
  }

  protected async test(): Promise<void> {
    if (this.testing()) return;
    this.testing.set(true);
    try {
      const r = await this.store.testChannel(this.channel());
      const t = this.t();
      if (r.status === 'ok') this.notify.success(fmt(t.ntf.testSent, { ch: this.name() }));
      else if (r.status === 'incomplete') this.notify.error(t.ntf.needToken);
      else if (r.status === 'unreachable') this.notify.error(t.api.serverDown);
      else if (r.status === 'failed') this.notify.error(r.message || t.ntf.needToken);
    } finally {
      this.testing.set(false);
    }
  }
}

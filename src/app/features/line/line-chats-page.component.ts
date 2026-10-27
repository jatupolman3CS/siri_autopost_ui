import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { lineOaName } from '../../core/data/accounts.store';
import { DevicesStore } from '../../core/data/devices.store';
import { CHAT_RECENT_DAYS, LineChatsStore } from '../../core/data/line-chats.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.line';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { FeatureLockComponent } from '../../shared/components/feature-lock/feature-lock.component';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import {
  SelectFieldComponent,
  SelectOption,
} from '../../shared/components/select-field/select-field.component';
import { LineChatRowComponent } from './line-chat-row.component';
import { LineStatusComponent } from './line-status.component';

/** A browser's LINE readiness is not announced by an event, so the page looks again this often while it is open. */
const DEVICES_POLL_MS = 30_000;

// "LINE chats" (/app/line-chats): the customers the shop's LINE Official Account has chatted with, as the extension
// synced them (name, labels, when they last wrote: never what they wrote), with a switch per customer that bans sending to
// them, and the status of each browser that drives an Official Account. Reading is for every role; the switch and
// "sync now" are an editor's. A workspace whose owner's plan has no LINE chats sees the lock banner instead.
@Component({
  selector: 'app-line-chats-page',
  imports: [
    EmptyStateComponent,
    FeatureLockComponent,
    InputFieldComponent,
    LineChatRowComponent,
    LineStatusComponent,
    PagerComponent,
    PermNoteComponent,
    SelectFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './line-chats-page.component.html',
  styleUrl: './line-chats-page.component.scss',
})
export class LineChatsPageComponent implements OnInit {
  protected readonly store = inject(LineChatsStore);
  private readonly workspaces = inject(WorkspaceStore);
  private readonly devices = inject(DevicesStore);
  private readonly destroy = inject(DestroyRef);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  /** The owner's plan has no LINE chats (the workspace says so, or the API answered 403). */
  protected readonly locked = computed(
    () => this.workspaces.lineChatLocked() || this.store.locked(),
  );
  protected readonly lockTitle = computed(() =>
    fmt(this.t().api.line.chatLockedTitle, { plan: this.t().plans.pro.name }),
  );
  /** Some browser reports a LINE Official Account (else the status card says how to connect one). */
  protected readonly hasLineDevice = computed(() => this.devices.list().some((d) => !!d.line));

  protected readonly accountOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.t().api.line.chatAccountAll },
    ...this.store.accounts().map((a) => ({ value: a.id, label: lineOaName(a) })),
  ]);
  protected readonly labelOptions = computed<SelectOption[]>(() => {
    const chosen = this.store.label();
    // A label no chat has any more stays in the list while it is chosen, so the select does not silently show another.
    const labels =
      chosen && !this.store.labels().includes(chosen)
        ? [chosen, ...this.store.labels()]
        : this.store.labels();
    return [
      { value: '', label: this.t().api.line.chatLabelAll },
      ...labels.map((l) => ({ value: l, label: l })),
    ];
  });
  protected readonly recentOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.t().api.line.chatRecentAny },
    ...CHAT_RECENT_DAYS.map((n) => ({
      value: String(n),
      label: fmt(this.t().api.line.chatRecentDays, { n }),
    })),
  ]);
  protected readonly dnsOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.t().api.line.chatDnsAll },
    { value: 'true', label: this.t().api.line.chatDnsOnly },
    { value: 'false', label: this.t().api.line.chatDnsExcept },
  ]);
  protected readonly recentValue = computed(() => {
    const days = this.store.activeWithinDays();
    return days === null ? '' : String(days);
  });
  protected readonly dnsValue = computed(() => {
    const v = this.store.doNotSend();
    return v === null ? '' : String(v);
  });
  protected readonly shown = computed(() =>
    fmt(this.t().api.line.chatShown, { n: this.store.total() }),
  );

  ngOnInit(): void {
    // The device list shows whether each browser is ready; nothing announces a change of that, so look now and then.
    void this.devices.refresh();
    // The store outlives the page: coming back to it shows the list as it was left, so read it again (a first visit
    // has its own read going already).
    if (this.store.loaded()) void this.store.refresh();
    const timer = setInterval(() => void this.devices.refresh(), DEVICES_POLL_MS);
    this.destroy.onDestroy(() => clearInterval(timer));
  }

  protected setRecent(value: string): void {
    this.store.setActiveWithinDays(value === '' ? null : Number(value));
  }

  protected setDns(value: string): void {
    this.store.setDoNotSendFilter(value === '' ? null : value === 'true');
  }
}

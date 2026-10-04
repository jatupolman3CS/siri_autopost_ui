import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PermissionsService } from '../../core/data/permissions.service';
import {
  NotificationsStore,
  ResolvedChannel,
  SENT_EVENTS,
  groupsOf,
} from '../../core/data/notifications.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.engine';
import { NotificationService } from '../../core/services/notification.service';
import { FeatureLockComponent } from '../../shared/components/feature-lock/feature-lock.component';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';
import { channelOptions } from './notify-labels';
import { NotifyChannelCardComponent } from './notify-channel-card.component';
import { NotifyCommandsCardComponent } from './notify-commands-card.component';
import { NotifyPillsComponent } from './notify-pills.component';
import { NotifySetRuleComponent } from './notify-set-rule.component';

// "Notifications" (Telegram and LINE OA alerts): the two channels, which events go to the workspace's default
// channel, a rule per link set and per group, and the chat commands card. Reading is for everyone; saving is
// the admin's and needs the owner's plan to include notifications (the page then keeps its content but turns it
// off, under a lock banner). The screenshot and "extension offline" events and the chat commands are saved but
// not acted on yet, and the page says so.
@Component({
  selector: 'app-notify-page',
  imports: [
    RouterLink,
    FeatureLockComponent,
    PermNoteComponent,
    SelectFieldComponent,
    NotifyChannelCardComponent,
    NotifyCommandsCardComponent,
    NotifyPillsComponent,
    NotifySetRuleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notify-page.component.html',
  styleUrl: './notify-page.component.scss',
})
export class NotifyPageComponent {
  protected readonly store = inject(NotificationsStore);
  protected readonly perm = inject(PermissionsService);
  private readonly notify = inject(NotificationService);
  protected readonly t = inject(I18nService).t;

  /** The person may change the settings: an admin, on an owner's plan that has notifications. */
  protected readonly editable = computed(() => this.perm.canAdmin() && !this.store.locked());
  /** Why not ('' when they may): the role first, else the plan. */
  protected readonly hint = computed(
    () =>
      this.perm.adminHint() ||
      (this.store.locked()
        ? fmt(this.t().api.engine.planLocked, { plan: this.t().plans.pro.name })
        : ''),
  );

  protected readonly channelOptions = computed(() => channelOptions(this.t(), null));
  protected readonly events = computed(() => this.store.settings()?.events ?? null);
  protected readonly channel = computed(() => this.store.settings()?.channel ?? 'tg');
  protected readonly summary = computed(() => {
    const s = this.store.summary();
    return fmt(this.t().ntf.summary, { on: s.on, n: s.n, tg: s.tg, ln: s.ln });
  });
  protected readonly notReady = computed(() =>
    this.store.notReady().map((c) =>
      fmt(this.t().api.engine.notifyNotReady, {
        ch: c === 'tg' ? this.t().ntf.tg : this.t().ntf.line,
      }),
    ),
  );
  protected readonly eventsCount = SENT_EVENTS.length;

  /** The alert the design previews: the first group with a code (else the first group) and the first post. */
  protected readonly sample = computed(() => {
    const links = this.store.sets().flatMap((s) => groupsOf(s));
    const link = links.find((l) => l.code.trim() !== '') ?? links[0];
    const group = link
      ? `${link.name || link.url}${link.code.trim() ? ` (${link.code.trim()})` : ''}`
      : '—';
    const post = this.store.samplePost();
    return fmt(this.t().ntf.sample, {
      g: group,
      c: link?.code.trim() || '—',
      t: post ? post.slice(0, 40) + (post.length > 40 ? '…' : '') : '—',
    });
  });

  protected setChannel(value: string): void {
    this.store.setDefaultChannel(value as ResolvedChannel);
  }

  protected async save(): Promise<void> {
    if (await this.store.save()) this.notify.success(this.t().ntf.saved);
  }
}

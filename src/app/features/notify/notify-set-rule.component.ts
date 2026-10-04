import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import {
  NotificationsStore,
  SENT_EVENTS,
  channelOf,
  eventsOf,
  groupsOf,
  sentCount,
} from '../../core/data/notifications.store';
import { ApiLinkSet, ApiSetLink } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.engine';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';
import { channelName, channelOptions } from './notify-labels';
import { NotifyPillsComponent } from './notify-pills.component';

interface GroupRow {
  link: ApiSetLink;
  meta: string;
  channel: string;
  custom: boolean;
  eventsLabel: string;
}

// The rule of one link set: its channel and events (or "as the workspace"), and the same for each of its groups.
// A group is a link that posts (switched on, a real address); rules are keyed by link id like the server's.
@Component({
  selector: 'app-notify-set-rule',
  imports: [SelectFieldComponent, NotifyPillsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notify-set-rule.component.html',
  styleUrl: './notify-set-rule.component.scss',
})
export class NotifySetRuleComponent {
  readonly set = input.required<ApiLinkSet>();
  readonly editable = input(false);

  protected readonly store = inject(NotificationsStore);
  protected readonly t = inject(I18nService).t;
  protected readonly open = signal(false);
  protected readonly total = SENT_EVENTS.length;

  private readonly rule = computed(
    () => this.store.settings()?.sets.find((r) => r.linkSetId === this.set().id) ?? null,
  );
  protected readonly setOptions = computed(() => channelOptions(this.t(), 'workspace'));
  protected readonly groupOptions = computed(() => channelOptions(this.t(), 'set'));
  protected readonly channel = computed(() => this.rule()?.channel ?? 'default');
  protected readonly custom = computed(() => !!this.rule()?.events);
  protected readonly events = computed(() => {
    const s = this.store.settings();
    return s ? eventsOf(s, this.set().id) : null;
  });
  protected readonly meta = computed(() => {
    const s = this.store.settings();
    if (!s) return '';
    const ch = channelName(this.t(), channelOf(s, this.set().id), 'workspace');
    return `${ch} · ${fmt(this.t().ts.linksN, { n: this.groups().length })}`;
  });
  private readonly groups = computed(() => groupsOf(this.set()));

  protected readonly rows = computed<GroupRow[]>(() => {
    const s = this.store.settings();
    if (!s) return [];
    const t = this.t();
    return this.groups().map((link) => {
      const own = this.rule()?.groups[link.id];
      const events = eventsOf(s, this.set().id, link.id);
      const code = link.code.trim() ? ` · ${t.cal.code} ${link.code.trim()}` : '';
      return {
        link,
        meta: `${channelName(t, channelOf(s, this.set().id, link.id), 'workspace')} · ${sentCount(events)}/${this.total}${code}`,
        channel: own?.channel ?? 'default',
        custom: !!own?.events,
        eventsLabel: own?.events ? t.ntf.useDefaultEvents : t.ntf.customEvents,
      };
    });
  });

  protected groupEvents(link: ApiSetLink) {
    const s = this.store.settings();
    return s ? eventsOf(s, this.set().id, link.id) : null;
  }
}

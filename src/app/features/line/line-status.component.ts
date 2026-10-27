import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LINE_ACCOUNT_PREFIX } from '../../core/data/accounts.store';
import { DevicesStore, LineState, lineStateOf } from '../../core/data/devices.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { hm } from '../../core/i18n/format';
import { I18nService, ago, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.line';
import { NotificationService } from '../../core/services/notification.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

/** One browser that drives a LINE Official Account, as the status card shows it. */
interface LineDeviceRow {
  id: string;
  /** The browser's name ("Shop PC"). */
  name: string;
  /** The Official Account's own name. */
  oa: string;
  state: LineState;
  stateLabel: string;
  /** Why the state is what it is, when it is not "ready". */
  hint: string;
  chats: string;
  synced: string;
  /** '' when "sync now" is on; else why it is off. */
  syncBlocked: string;
}

// The "status card" of the chat roster: each paired browser that is logged in to a LINE Official Account, with whether it
// can send (ready / waiting for the LINE login / resting after failed sends), how many chats it synced and when, and the
// "sync the chat list now" button (the `syncLineChats` device command, an editor's). It reads the device list only; the
// roster below it reads the chats.
@Component({
  selector: 'app-line-status',
  imports: [EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!devices.loaded()) {
      <p class="muted small" role="status">—</p>
    } @else if (!rows().length) {
      <app-empty-state
        icon="ph-chat-circle-text"
        [heading]="t().api.line.chatNoLineTitle"
        [description]="t().api.line.chatNoLineBody"
      />
    } @else {
      <section class="panel st" [attr.aria-label]="t().api.line.chatStatusTitle">
        <div class="fw6">{{ t().api.line.chatStatusTitle }}</div>
        <ul>
          @for (r of rows(); track r.id) {
            <li>
              <div class="who">
                <span class="dot" [attr.data-state]="r.state" aria-hidden="true"></span>
                <span class="fw6">{{ r.oa }}</span>
                <span class="small muted">{{ r.name }}</span>
                <span class="state" [attr.data-state]="r.state">{{ r.stateLabel }}</span>
                <span class="small muted">{{ r.chats }} · {{ r.synced }}</span>
              </div>
              @if (r.hint) {
                <p class="small muted">{{ r.hint }}</p>
              }
              <button
                type="button"
                class="su-btn su-btn-sm su-btn-secondary"
                [disabled]="!!r.syncBlocked || busy().has(r.id)"
                [attr.title]="r.syncBlocked || null"
                (click)="sync(r)"
              >
                <i class="ph ph-arrows-clockwise"></i>{{ t().api.line.chatSyncNow }}
              </button>
            </li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .st {
      display: grid;
      gap: 8px;
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 12px;
    }
    li {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px 16px;
      padding-top: 8px;
      border-top: 1px solid var(--color-border);
    }
    li > p {
      flex-basis: 100%;
      margin: 0;
      order: 3;
    }
    .who {
      flex: 1;
      min-width: 220px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px 10px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-success);
    }
    .dot[data-state='login'] {
      background: var(--color-danger);
    }
    .dot[data-state='resting'] {
      background: var(--color-warning);
    }
    .state {
      font-size: 12px;
      font-weight: 500;
      color: var(--color-success);
    }
    .state[data-state='login'] {
      color: var(--color-danger);
    }
    .state[data-state='resting'] {
      color: var(--color-warning);
    }
    .muted {
      color: var(--color-text-muted);
    }
  `,
})
export class LineStatusComponent {
  protected readonly devices = inject(DevicesStore);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  /** Browsers whose "sync now" was sent a moment ago (the button waits a few seconds, not for the sync itself). */
  protected readonly busy = signal<ReadonlySet<string>>(new Set());

  protected readonly rows = computed<LineDeviceRow[]>(() => {
    const t = this.t();
    const line = t.api.line;
    const now = this.devices.now();
    return this.devices.list().flatMap((d) => {
      const l = d.line;
      if (!l) return [];
      const state = lineStateOf(l, now);
      const oa = l.name.startsWith(LINE_ACCOUNT_PREFIX)
        ? l.name.slice(LINE_ACCOUNT_PREFIX.length)
        : l.name;
      const syncedAt = l.syncedAt ? new Date(l.syncedAt) : null;
      const hint =
        state === 'login'
          ? line.chatStateLoginHint
          : state === 'resting'
            ? fmt(line.chatStateRestingHint, { time: hm(new Date(l.restUntil ?? now)) })
            : '';
      const syncBlocked = this.perm.readOnly()
        ? this.perm.editHint()
        : !d.online
          ? line.chatDeviceOffline
          : state === 'login'
            ? line.chatSyncNeedsLogin
            : '';
      return [
        {
          id: d.id,
          name: d.name,
          oa,
          state,
          stateLabel:
            state === 'login'
              ? line.chatStateLogin
              : state === 'resting'
                ? line.chatStateResting
                : line.chatStateReady,
          hint,
          chats: fmt(line.chatCount, { n: l.chatCount }),
          synced: syncedAt
            ? fmt(line.chatSynced, { when: ago(t, syncedAt, now.getTime()) })
            : line.chatNeverSynced,
          syncBlocked,
        },
      ];
    });
  });

  protected async sync(row: LineDeviceRow): Promise<void> {
    if (row.syncBlocked || this.busy().has(row.id)) return;
    this.busy.update((s) => new Set(s).add(row.id));
    try {
      await this.devices.syncLineChats(row.id);
      this.notify.success(fmt(this.t().api.line.chatSyncSent, { name: row.name }));
    } catch {
      // The error interceptor has shown why (for example the browser is not paired any more).
    } finally {
      // A short pause so a double click does not queue two syncs; the extension limits them to one in ten minutes anyway.
      setTimeout(
        () =>
          this.busy.update((s) => {
            const next = new Set(s);
            next.delete(row.id);
            return next;
          }),
        3000,
      );
    }
  }
}

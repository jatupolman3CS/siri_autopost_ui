import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LINE_ACCOUNT_PREFIX } from '../../core/data/accounts.store';
import { DevicesStore, LineState, lineStateOf } from '../../core/data/devices.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { lineOaIdOf } from '../../core/flow/line-chats';
import { hm } from '../../core/i18n/format';
import { I18nService, ago, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.line';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
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

// The LINE page's top cards. (1) "Connect a LINE OA": the person pastes the Official Account's address from LINE Official
// Account Manager (https://chat.line.biz/<id>/) and says which paired browser should use it; that browser reads the customer
// list from LINE's contacts page once and then again every day (the `connectLine` device command). A browser that holds
// another OA is let go of first, after a confirmation. (2) The "status card": each browser with its OA (ready / waiting for
// the LINE login / resting after failed sends), how many customers it synced and when, and "sync the list now" (the
// `syncLineChats` command, an editor's). It reads the device list only; the roster below it reads the chats.
@Component({
  selector: 'app-line-status',
  imports: [EmptyStateComponent, ConfirmModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (devices.loaded() && !devices.list().length) {
      <app-empty-state
        icon="ph-chat-circle-text"
        [heading]="t().api.line.chatNoLineTitle"
        [description]="t().api.line.chatNoLineBody"
      />
    } @else if (devices.loaded()) {
      <section
        class="panel st connect"
        [attr.aria-label]="t().api.line.chatLinkTitle"
        data-testid="connect"
      >
        <div class="fw6">{{ t().api.line.chatLinkTitle }}</div>
        <p class="small muted">{{ t().api.line.chatLinkHelp }}</p>
        <div class="form">
          @if (devices.list().length > 1) {
            <label class="field">
              <span class="su-field-label">{{ t().api.line.chatLinkDevice }}</span>
              <select
                class="su-select"
                [disabled]="perm.readOnly()"
                [value]="deviceId()"
                (change)="pickDevice($any($event.target).value)"
              >
                @for (d of devices.list(); track d.id) {
                  <option [value]="d.id">{{ d.name }}</option>
                }
              </select>
            </label>
          }
          <label class="field grow">
            <span class="su-field-label">{{ t().api.line.chatLinkLabel }}</span>
            <input
              class="su-input"
              type="text"
              spellcheck="false"
              autocomplete="off"
              [placeholder]="t().api.line.chatLinkPh"
              [disabled]="perm.readOnly()"
              [value]="link()"
              (input)="link.set($any($event.target).value)"
              (keydown.enter)="connect()"
            />
          </label>
          <button
            type="button"
            class="su-btn su-btn-sm su-btn-primary"
            [disabled]="!!connectBlocked() || busy().has('connect')"
            [attr.title]="connectBlocked() || null"
            (click)="connect()"
          >
            <i class="ph ph-plugs-connected"></i>{{ t().api.line.chatLinkBtn }}
          </button>
        </div>
        @if (link().trim() && !oaId()) {
          <p class="small bad" role="alert">{{ t().api.line.chatLinkBad }}</p>
        }
      </section>
    }
    @if (rows().length) {
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
        <p class="small muted">{{ t().api.line.chatDailyNote }}</p>
      </section>
    }
    <app-confirm-modal
      [open]="!!changing()"
      [title]="t().api.line.chatChangeTitle"
      [body]="changeBody()"
      [confirmLabel]="t().api.line.chatLinkBtn"
      [action]="confirmChange"
      (closed)="changing.set(null)"
    />
  `,
  styles: `
    :host {
      display: grid;
      gap: 12px;
    }
    .st {
      display: grid;
      gap: 8px;
    }
    .st p {
      margin: 0;
    }
    .form {
      display: flex;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 10px 12px;
    }
    .field {
      display: grid;
      gap: 4px;
      min-width: 180px;
    }
    .field.grow {
      flex: 1;
      min-width: 260px;
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
    .bad {
      color: var(--color-danger);
    }
  `,
})
export class LineStatusComponent {
  protected readonly devices = inject(DevicesStore);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  /** Names of what was just sent (a browser id, or 'connect'): its button waits a few seconds, not for the browser itself. */
  protected readonly busy = signal<ReadonlySet<string>>(new Set());

  // ---- connect / change the OA ----
  protected readonly link = signal('');
  private readonly picked = signal('');
  /** The browser the OA is for: the one picked, else the first. */
  protected readonly deviceId = computed(() => {
    const list = this.devices.list();
    return list.some((d) => d.id === this.picked()) ? this.picked() : (list[0]?.id ?? '');
  });
  protected readonly oaId = computed(() => lineOaIdOf(this.link()));
  private readonly device = computed(() =>
    this.devices.list().find((d) => d.id === this.deviceId()),
  );
  /** The browser holds another OA than the pasted one: connecting means letting go of it first. */
  private readonly replacing = computed(() => {
    const line = this.device()?.line;
    const id = this.oaId();
    return !!line && !!id && line.botId.toLowerCase() !== id.toLowerCase();
  });
  /** '' when "connect" is on; else why it is off. */
  protected readonly connectBlocked = computed(() => {
    const l = this.t().api.line;
    if (this.perm.readOnly()) return this.perm.editHint();
    const d = this.device();
    if (!d) return l.chatNoLineTitle;
    if (!d.online) return l.chatConnectOffline;
    return this.oaId() ? '' : l.chatLinkBad;
  });
  /** The row whose OA the pasted link would replace (the confirm dialog is open for it). */
  protected readonly changing = signal<LineDeviceRow | null>(null);
  protected readonly changeBody = computed(() => {
    const r = this.changing();
    return r ? fmt(this.t().api.line.chatChangeBody, { oa: r.oa, name: r.name }) : '';
  });

  protected pickDevice(id: string): void {
    this.picked.set(id);
  }

  protected async connect(): Promise<void> {
    if (this.connectBlocked() || this.busy().has('connect')) return;
    const row = this.rows().find((r) => r.id === this.deviceId());
    if (this.replacing() && row) {
      this.changing.set(row); // the person confirms letting go of the old OA first
      return;
    }
    await this.send(false);
  }

  /** The confirm dialog's action: let go of the old OA, then connect the pasted one. */
  protected readonly confirmChange = async (): Promise<void> => {
    await this.send(true);
  };

  private async send(letGo: boolean): Promise<void> {
    const d = this.device();
    if (!d) return;
    this.mark('connect');
    try {
      await this.devices.connectLine(d.id, this.link(), letGo);
      this.notify.success(fmt(this.t().api.line.chatLinkSent, { name: d.name }));
      this.link.set('');
    } catch {
      // The error interceptor has shown why.
    } finally {
      this.release('connect');
    }
  }

  // ---- the status card ----
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
    this.mark(row.id);
    try {
      await this.devices.syncLineChats(row.id);
      this.notify.success(fmt(this.t().api.line.chatSyncSent, { name: row.name }));
    } catch {
      // The error interceptor has shown why (for example the browser is not paired any more).
    } finally {
      this.release(row.id);
    }
  }

  private mark(key: string): void {
    this.busy.update((s) => new Set(s).add(key));
  }

  /** A short pause so a double click does not queue two commands; the extension limits syncs to one in ten minutes anyway. */
  private release(key: string): void {
    setTimeout(
      () =>
        this.busy.update((s) => {
          const next = new Set(s);
          next.delete(key);
          return next;
        }),
      3000,
    );
  }
}

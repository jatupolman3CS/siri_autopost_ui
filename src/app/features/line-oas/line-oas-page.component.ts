import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DevicesStore } from '../../core/data/devices.store';
import { LineOasStore } from '../../core/data/line-oas.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiLineOa } from '../../core/http/api.service';
import { problemMessage } from '../../core/http/problem-details';
import { fmtDate, hm } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.line';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { FeatureLockComponent } from '../../shared/components/feature-lock/feature-lock.component';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import {
  SelectFieldComponent,
  SelectOption,
} from '../../shared/components/select-field/select-field.component';
import { LineStatusComponent } from '../line/line-status.component';
import { LineOaCustomersComponent } from './line-oa-customers.component';

/** "20 ต.ค. 17:05" (with the year when it is not this one). */
function whenText(d: Date, li: number, now: Date): string {
  return `${fmtDate(d, li, d.getFullYear() !== now.getFullYear())} ${hm(d)}`;
}

// "LINE OA" master list (/app/line-oas): the shop's Official Accounts. The owner pastes the chat.line.biz link of an OA,
// the API makes the account and a browser reads that OA's customers (the chat link of each one), which are listed under
// the OA they belong to. LINE link sets pick their OA from this list. Facebook has nothing to do with this page.
@Component({
  selector: 'app-line-oas-page',
  imports: [
    ConfirmModalComponent,
    EmptyStateComponent,
    FeatureLockComponent,
    InputFieldComponent,
    LineOaCustomersComponent,
    LineStatusComponent,
    PermNoteComponent,
    SelectFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div class="intro">
          <h1>{{ t().api.line.oaTitle }}</h1>
          <p>{{ t().api.line.oaSub }}</p>
          <app-perm-note level="edit" />
        </div>
      </div>

      @if (locked()) {
        <app-feature-lock [heading]="lockTitle()" [body]="t().api.line.chatLockedBody" />
      } @else {
        <section class="panel add">
          <div (keydown.enter)="add()">
            <app-input-field
              [label]="t().api.line.oaUrlLabel"
              [placeholder]="t().api.line.oaUrlPh"
              [(value)]="url"
              [error]="urlError()"
              [maxlength]="300"
            />
            @if (devices.list().length > 1) {
              <app-select-field
                [label]="t().api.line.oaDeviceLabel"
                [options]="deviceOptions()"
                [placeholder]="t().api.line.oaDevicePick"
                [(value)]="deviceId"
                [error]="deviceError()"
              />
            }
          </div>
          @if (!devices.list().length && devices.loaded()) {
            <p class="small muted">{{ t().api.line.oaNoDevice }}</p>
          }
          <div>
            <button
              type="button"
              class="su-btn su-btn-sm su-btn-primary"
              [disabled]="busy() || perm.readOnly() || !devices.list().length"
              [attr.title]="perm.editHint() || null"
              (click)="add()"
            >
              <i class="ph ph-plus" aria-hidden="true"></i> {{ t().api.line.oaAdd }}
            </button>
          </div>
        </section>

        <app-line-status [showConnect]="false" />

        @if (!store.loaded()) {
          <p class="muted fs14" role="status">
            {{ store.failed() ? t().api.line.oaLoadFailed : t().api.line.oaLoading }}
          </p>
        } @else if (!store.list().length) {
          <app-empty-state
            icon="ph-chat-circle-text"
            [heading]="t().api.line.oaEmptyTitle"
            [description]="t().api.line.oaEmptyBody"
          />
        } @else {
          @for (o of store.list(); track o.id) {
            <section class="panel oa">
              <div class="oa-head">
                <div class="oa-main">
                  <h2 class="fs16 fw6">{{ shortName(o) }}</h2>
                  <a [href]="o.url" target="_blank" rel="noopener noreferrer" class="small url">
                    {{ o.url }}
                  </a>
                  <div class="small muted">{{ machine(o) }}</div>
                  <div class="small muted">{{ numbers(o) }}</div>
                  <div class="small">
                    <span [class]="'state ' + stateClass(o)">{{ stateText(o) }}</span>
                  </div>
                  <div class="small muted">
                    {{ o.active ? t().api.line.oaActive : t().api.line.oaInactive }}
                  </div>
                </div>
                <div class="oa-tools">
                  @if (!o.active) {
                    <button
                      type="button"
                      class="su-btn su-btn-sm su-btn-primary"
                      [disabled]="perm.readOnly()"
                      [attr.title]="perm.editHint() || null"
                      (click)="use(o)"
                    >
                      <i class="ph ph-plugs-connected" aria-hidden="true"></i>
                      {{ t().api.line.oaUse }}
                    </button>
                  }
                  <button
                    type="button"
                    class="su-btn su-btn-sm su-btn-secondary"
                    [disabled]="perm.readOnly()"
                    [attr.title]="perm.editHint() || null"
                    (click)="sync(o)"
                  >
                    <i class="ph ph-arrows-clockwise" aria-hidden="true"></i>
                    {{ t().api.line.oaSync }}
                  </button>
                  <button
                    type="button"
                    class="su-btn su-btn-sm su-btn-secondary"
                    [attr.aria-expanded]="isOpen(o.id)"
                    (click)="toggle(o.id)"
                  >
                    {{ isOpen(o.id) ? t().api.line.oaHideCustomers : t().api.line.oaShowCustomers }}
                  </button>
                  <button
                    type="button"
                    class="su-btn su-btn-sm su-btn-ghost"
                    [disabled]="!perm.canAdmin()"
                    [attr.title]="perm.adminHint() || null"
                    (click)="removing.set(o)"
                  >
                    <i class="ph ph-trash" aria-hidden="true"></i> {{ t().api.line.oaRemove }}
                  </button>
                </div>
              </div>
              @if (isOpen(o.id)) {
                <app-line-oa-customers [accountId]="o.id" />
              }
            </section>
          }
        }
      }
    </div>

    <app-confirm-modal
      [open]="!!removing()"
      [title]="t().api.line.oaRemoveTitle"
      [body]="removeBody()"
      [confirmLabel]="t().api.line.oaRemove"
      [action]="removeAction"
      (closed)="removing.set(null)"
    />
  `,
  styles: `
    .add {
      display: grid;
      gap: 12px;
    }
    .oa {
      display: grid;
      gap: 12px;
    }
    .oa-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .oa-main {
      display: grid;
      gap: 2px;
      min-width: 0;
      h2 {
        margin: 0;
        overflow-wrap: anywhere;
      }
    }
    .url {
      overflow-wrap: anywhere;
    }
    .oa-tools {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: flex-start;
    }
    .muted {
      color: var(--color-text-muted);
    }
    .state.ok {
      color: var(--color-success);
    }
    .state.warn {
      color: var(--color-warning);
    }
    .state.bad {
      color: var(--color-danger);
    }
  `,
})
export class LineOasPageComponent implements OnInit {
  protected readonly store = inject(LineOasStore);
  protected readonly devices = inject(DevicesStore);
  protected readonly perm = inject(PermissionsService);
  private readonly workspaces = inject(WorkspaceStore);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  protected readonly url = signal('');
  protected readonly deviceId = signal('');
  protected readonly urlError = signal('');
  protected readonly deviceError = signal('');
  protected readonly busy = signal(false);
  protected readonly removing = signal<ApiLineOa | null>(null);
  private readonly open = signal<ReadonlySet<string>>(new Set());

  protected readonly locked = computed(
    () => this.workspaces.lineChatLocked() || this.store.locked(),
  );
  protected readonly lockTitle = computed(() =>
    fmt(this.t().api.line.chatLockedTitle, { plan: this.t().plans.pro.name }),
  );
  protected readonly deviceOptions = computed<SelectOption[]>(() =>
    this.devices.list().map((d) => ({ value: d.id, label: d.name })),
  );
  protected readonly removeBody = computed(() => {
    const o = this.removing();
    return o ? fmt(this.t().api.line.oaRemoveBody, { name: this.shortName(o) }) : '';
  });

  /** The confirm dialog's action: removes the OA the dialog was opened for. */
  protected readonly removeAction = async (): Promise<void> => {
    const o = this.removing();
    if (!o) return;
    await this.store.remove(o.id);
    this.notify.success(fmt(this.t().api.line.oaRemoved, { name: this.shortName(o) }));
  };

  ngOnInit(): void {
    void this.devices.refresh();
    if (this.store.loaded()) void this.store.refresh();
  }

  protected shortName(o: ApiLineOa): string {
    return o.name.startsWith('LINE · ') ? o.name.slice('LINE · '.length) : o.name;
  }

  protected machine(o: ApiLineOa): string {
    if (!o.deviceName) return '';
    const line = this.t().api.line;
    return fmt(o.deviceOnline ? line.oaMachine : line.oaMachineOffline, { name: o.deviceName });
  }

  protected numbers(o: ApiLineOa): string {
    const line = this.t().api.line;
    const parts = [fmt(line.oaCustomers, { n: o.chats })];
    if (o.syncedAt)
      parts.push(
        fmt(line.chatSynced, {
          when: whenText(new Date(o.syncedAt), this.i18n.li(), new Date()),
        }),
      );
    else parts.push(line.chatNeverSynced);
    parts.push(o.linkSetCount > 0 ? fmt(line.oaSets, { n: o.linkSetCount }) : line.oaNoSets);
    return parts.join(' · ');
  }

  protected stateText(o: ApiLineOa): string {
    const line = this.t().api.line;
    return o.sessionLost ? line.oaSessionLost : o.ready ? line.oaReady : line.oaWaiting;
  }

  protected stateClass(o: ApiLineOa): string {
    return o.sessionLost ? 'bad' : o.ready ? 'ok' : 'warn';
  }

  protected isOpen(id: string): boolean {
    return this.open().has(id);
  }

  protected toggle(id: string): void {
    this.open.update((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected async add(): Promise<void> {
    if (this.busy() || this.perm.readOnly()) return;
    const url = this.url().trim();
    this.urlError.set('');
    this.deviceError.set('');
    if (!/chat\.line\.biz\/[A-Za-z0-9_-]{5,}/i.test(url)) {
      this.urlError.set(this.t().api.line.oaUrlErr);
      return;
    }
    if (this.devices.list().length > 1 && !this.deviceId()) {
      this.deviceError.set(this.t().api.line.oaDeviceErr);
      return;
    }
    this.busy.set(true);
    try {
      const row = await this.store.add(url, this.deviceId() || null);
      this.notify.success(fmt(this.t().api.line.oaAdded, { name: this.shortName(row) }));
      this.url.set('');
      this.open.update((s) => new Set(s).add(row.id));
    } catch (e) {
      this.urlError.set(problemMessage(e) ?? this.t().api.itemActionFailed);
    } finally {
      this.busy.set(false);
    }
  }

  protected async use(o: ApiLineOa): Promise<void> {
    const line = this.t().api.line;
    const why = await this.store.use(o.id);
    if (!why) this.notify.success(fmt(line.oaUseSent, { name: this.shortName(o) }));
    else this.notify.error(`${line.oaUseFailed}: ${why}`);
  }

  protected async sync(o: ApiLineOa): Promise<void> {
    const line = this.t().api.line;
    const why = await this.store.sync(o.id);
    if (!why) this.notify.success(fmt(line.oaSyncSent, { name: this.shortName(o) }));
    else this.notify.error(`${line.oaSyncFailed}: ${why}`);
  }
}

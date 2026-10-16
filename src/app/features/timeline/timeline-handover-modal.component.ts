import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { AccountsStore, extensionNameOf } from '../../core/data/accounts.store';
import { DevicesStore } from '../../core/data/devices.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { PostsStore } from '../../core/data/posts.store';
import { ownerOfSet } from '../../core/flow/link-ownership';
import { problemMessage } from '../../core/http/problem-details';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { NotificationService } from '../../core/services/notification.service';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import {
  SelectFieldComponent,
  SelectOption,
} from '../../shared/components/select-field/select-field.component';

// "Change extension in the middle of the day" (the timeline). A link set is posted by ONE extension; this hands it to
// another one: the set is posted by the new extension from now on and the posts it still has queued move with it,
// keeping their times and texts, so the plan does not change, only the machine that works through it. The old
// extension finishes a post it is already posting; sent and failed posts stay with it. The server does the move
// (`POST link-sets/{id}/handover`) and refuses when the new extension is not paired or a group of the set belongs
// to a third one.
@Component({
  selector: 'app-timeline-handover-modal',
  imports: [ModalComponent, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [title]="t().api.flow.tlHandTitle" (closed)="closed.emit()">
      <form class="form" id="handover-form" (submit)="$event.preventDefault(); move()">
        <p class="note">{{ t().api.flow.tlHandIntro }}</p>
        <app-select-field
          [label]="t().api.flow.tlHandSet"
          [options]="setOptions()"
          [value]="setId()"
          (valueChange)="pickSet($event)"
        />
        @if (current(); as c) {
          <p class="line" data-testid="hand-from">
            <i class="ph ph-desktop" aria-hidden="true"></i>
            <span
              >{{ t().api.flow.tlHandFrom }} <b>{{ c.name }}</b> · {{ c.state }} ·
              {{ waitingText() }}</span
            >
          </p>
        }
        @if (targetOptions().length) {
          <app-select-field
            [label]="t().api.flow.tlHandTo"
            [options]="targetOptions()"
            [value]="toId()"
            (valueChange)="toId.set($event)"
          />
        } @else if (setId()) {
          <p class="warn" role="status">
            <i class="ph ph-warning" aria-hidden="true"></i>{{ t().api.flow.tlHandNoTarget }}
          </p>
        }
        <p class="note">{{ t().api.flow.tlHandKeep }}</p>
        @if (err()) {
          <p class="su-field-err" role="alert">{{ err() }}</p>
        }
      </form>
      <div modal-footer>
        <button type="button" class="su-btn su-btn-sm su-btn-secondary" (click)="closed.emit()">
          {{ t().common.cancel }}
        </button>
        <button
          type="submit"
          form="handover-form"
          class="su-btn su-btn-sm su-btn-primary"
          data-testid="hand-go"
          [disabled]="busy() || !setId() || !toId() || perm.readOnly()"
          [attr.title]="perm.editHint() || null"
        >
          {{ t().api.flow.tlHandGo }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .note {
      margin: 0;
      font-size: 13px;
      color: var(--color-text-muted);
    }
    .line,
    .warn {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0;
      font-size: 14px;
      > .ph {
        margin-top: 2px;
        flex-shrink: 0;
      }
    }
    .warn > .ph {
      color: var(--color-warning);
    }
  `,
})
export class TimelineHandoverModalComponent {
  readonly open = input(false);
  /** The extension the timeline is filtered to: its first set is the one offered first ('' = none). */
  readonly prefer = input('');
  readonly closed = output<void>();

  private readonly linkSets = inject(LinkSetsStore);
  private readonly accounts = inject(AccountsStore);
  private readonly devices = inject(DevicesStore);
  private readonly posts = inject(PostsStore);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  protected readonly setId = signal('');
  protected readonly toId = signal('');
  protected readonly busy = signal(false);
  protected readonly err = signal('');

  private nameOf(accountId: string): string {
    const a = this.accounts.byId(accountId);
    return a ? extensionNameOf(a, this.devices.list()) : '—';
  }

  /** The extensions that could take a set from its owner: the connected ones except the one that has it. */
  private targetsOf(setId: string): { id: string; name: string }[] {
    const set = this.linkSets.byId(setId);
    if (!set) return [];
    const owner = ownerOfSet(set, this.accounts.list());
    return this.accounts
      .connected()
      .filter((a) => a.id !== owner)
      .map((a) => ({ id: a.id, name: extensionNameOf(a, this.devices.list()) }));
  }

  /** Posts of the set that no browser has taken yet, among the days that are loaded. */
  private waitingOf(setId: string): number {
    const set = this.linkSets.byId(setId);
    if (!set) return 0;
    const links = new Set(set.links.map((l) => l.id));
    return this.posts
      .items()
      .filter(
        (p) =>
          !p.isTest &&
          !!p.linkId &&
          links.has(p.linkId) &&
          (p.status === 'queued' || p.status === 'waiting'),
      ).length;
  }

  /** Every set, with the extension that has it; a set that has nowhere to go is marked and cannot be picked. */
  protected readonly setOptions = computed<SelectOption[]>(() =>
    this.linkSets.sets().map((s) => {
      const owner = ownerOfSet(s, this.accounts.list());
      const who = owner ? this.nameOf(owner) : this.t().api.flow.tlHandNobody;
      return { value: s.id, label: `${s.name} · ${fmt(this.t().api.flow.optExt, { name: who })}` };
    }),
  );

  protected readonly targetOptions = computed<SelectOption[]>(() =>
    this.targetsOf(this.setId()).map((a) => ({ value: a.id, label: a.name })),
  );

  /** The extension that has the chosen set now, and whether it is up. */
  protected readonly current = computed(() => {
    const set = this.linkSets.byId(this.setId());
    if (!set) return null;
    const owner = ownerOfSet(set, this.accounts.list());
    if (!owner) return { name: this.t().api.flow.tlHandNobody, state: '' };
    const f = this.t().api.flow;
    const account = this.accounts.byId(owner);
    const device = this.devices.list().find((d) => d.accountId === owner);
    const state = !account?.connected
      ? f.tlHandUnbound
      : device?.online
        ? f.tlHandOnline
        : f.tlHandOffline;
    return { name: this.nameOf(owner), state };
  });

  protected readonly waitingText = computed(() =>
    fmt(this.t().api.flow.tlHandWaiting, { n: this.waitingOf(this.setId()) }),
  );

  constructor() {
    // Each time it opens: the set of the filtered extension (else the first set that can move), and a target for it.
    effect(() => {
      if (!this.open()) return;
      const sets = this.linkSets.sets();
      const accounts = this.accounts.list();
      const prefer = this.prefer();
      untracked(() => {
        const movable = sets.filter((s) => this.targetsOf(s.id).length > 0);
        const pick =
          (prefer ? movable.find((s) => ownerOfSet(s, accounts) === prefer) : undefined) ??
          movable[0] ??
          sets[0];
        this.err.set('');
        this.busy.set(false);
        this.pickSet(pick?.id ?? '');
      });
    });
  }

  protected pickSet(id: string): void {
    this.setId.set(id);
    this.err.set('');
    this.toId.set(this.targetsOf(id)[0]?.id ?? '');
  }

  protected async move(): Promise<void> {
    const setId = this.setId();
    const toId = this.toId();
    if (!setId || !toId || this.busy() || !this.perm.canEdit()) return;
    const set = this.linkSets.byId(setId);
    this.busy.set(true);
    this.err.set('');
    try {
      const moved = await this.linkSets.handOver(setId, toId);
      await this.posts.refresh();
      this.notify.success(
        fmt(this.t().api.flow.tlHandDone, { s: set?.name ?? '', to: this.nameOf(toId), n: moved }),
      );
      this.closed.emit();
    } catch (e) {
      // The interceptor toasted the reason (a 422 names what stops it); the dialog says it too and stays open.
      this.err.set(problemMessage(e) ?? this.t().api.itemSaveFailed);
    } finally {
      this.busy.set(false);
    }
  }
}

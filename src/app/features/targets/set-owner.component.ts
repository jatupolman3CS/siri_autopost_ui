import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AccountsStore, extensionNameOf } from '../../core/data/accounts.store';
import { DevicesStore } from '../../core/data/devices.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { groupOverlaps, ownerOfSet } from '../../core/flow/link-ownership';
import { ApiLinkSet } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';

interface OverlapRow {
  key: string;
  name: string;
  /** This set's link that the other extension keeps: removable from here. */
  skippedLinkId: string | null;
  text: string;
}

// Who posts a link set, at the top of its card: "Posted by Shop PC · online", or a warning when nobody does. Under it, the
// groups of this set that also sit in the sets of another extension (data from before "one group, one extension"):
// the extension listed first keeps the group, this set's copy is skipped, and the row can be removed from here.
@Component({
  selector: 'app-set-owner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="owner" [class.none]="!owner()" role="status">
      <i
        class="ph"
        [class.ph-desktop]="owner()"
        [class.ph-warning]="!owner()"
        aria-hidden="true"
      ></i>
      @if (ownerName(); as name) {
        <span>{{ line() }}</span>
        @if (online() !== null) {
          <span class="dot" [class.on]="online()" aria-hidden="true"></span>
          <span class="muted">{{
            online() ? t().api.flow.ownOnline : t().api.flow.ovExtOffline
          }}</span>
        }
      } @else {
        <span>{{ t().api.flow.ownerNone }} · {{ t().api.flow.postAsNone }}</span>
      }
    </div>
    @if (rows().length) {
      <div class="callout warn overlaps" role="status">
        <i class="ph ph-warning" aria-hidden="true"></i>
        <div class="grow">
          <div class="fw6">{{ title() }}</div>
          <ul>
            @for (r of rows(); track r.key) {
              <li>
                <span class="min0">
                  <span class="fw6">{{ r.name }}</span> — {{ r.text }}
                </span>
                @if (r.skippedLinkId) {
                  <button
                    type="button"
                    class="su-btn su-btn-sm su-btn-secondary"
                    [disabled]="perm.readOnly()"
                    [attr.title]="perm.editHint() || null"
                    (click)="remove(r.skippedLinkId)"
                  >
                    {{ t().api.flow.overlapRemove }}
                  </button>
                }
              </li>
            }
          </ul>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .owner {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      padding: 6px 10px;
      border-radius: var(--radius-md);
      background: var(--color-surface-muted);
      font-size: 14px;
    }
    .owner.none {
      background: var(--color-warning-bg, var(--color-surface-muted));
      color: var(--color-warning, inherit);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-text-muted);
    }
    .dot.on {
      background: var(--color-success, #1a9d57);
    }
    .muted {
      color: var(--color-text-muted);
    }
    .overlaps {
      margin-top: 8px;
    }
    ul {
      margin: 6px 0 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 6px;
    }
    li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 14px;
    }
    .min0 {
      min-width: 0;
      overflow-wrap: anywhere;
    }
  `,
})
export class SetOwnerComponent {
  readonly set = input.required<ApiLinkSet>();

  private readonly store = inject(LinkSetsStore);
  private readonly accounts = inject(AccountsStore);
  private readonly devices = inject(DevicesStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  /** The extension (account id) that posts the set; null = nobody yet. */
  protected readonly owner = computed(() => ownerOfSet(this.set(), this.accounts.list()));

  protected readonly ownerName = computed(() => {
    const id = this.owner();
    if (!id) return null;
    const account = this.accounts.byId(id);
    return account
      ? extensionNameOf(account, this.devices.list())
      : this.t().api.flow.postAsMissing;
  });

  protected readonly line = computed(() =>
    fmt(this.t().api.flow.ownerLine, { name: this.ownerName() ?? '' }),
  );

  /** Whether the browser is online; null while it is unbound or the browsers have not arrived. */
  protected readonly online = computed(() => {
    const id = this.owner();
    return this.devices.list().find((d) => d.accountId === id)?.online ?? null;
  });

  private readonly overlaps = computed(() =>
    groupOverlaps(this.store.sets(), this.accounts.list()).filter(
      (o) => o.keeper.setId === this.set().id || o.skipped.some((h) => h.setId === this.set().id),
    ),
  );

  protected readonly title = computed(() =>
    fmt(this.t().api.flow.overlapTitle, { n: this.overlaps().length }),
  );

  protected readonly rows = computed<OverlapRow[]>(() => {
    const flow = this.t().api.flow;
    const nameOf = (owner: string) => {
      const account = this.accounts.byId(owner);
      return account ? extensionNameOf(account, this.devices.list()) : flow.postAsMissing;
    };
    return this.overlaps().map((o) => {
      const mine = o.skipped.find((h) => h.setId === this.set().id);
      return mine
        ? {
            key: o.key,
            name: o.name,
            skippedLinkId: mine.linkId,
            text: fmt(flow.overlapSkipped, { set: o.keeper.setName, ext: nameOf(o.keeper.owner) }),
          }
        : { key: o.key, name: o.name, skippedLinkId: null, text: flow.overlapKeeps };
    });
  });

  protected remove(linkId: string): void {
    if (this.perm.readOnly()) return;
    void this.store.removeLink(this.set().id, linkId);
  }
}

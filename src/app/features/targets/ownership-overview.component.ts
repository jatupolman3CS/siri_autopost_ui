import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AccountsStore, extensionNameOf } from '../../core/data/accounts.store';
import { DevicesStore } from '../../core/data/devices.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { groupOverlaps, summarizeOwners } from '../../core/flow/link-ownership';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';

// "Link groups ↔ extensions" at the top of the link-set page: every connected extension with the sets it posts and how many
// groups they hold, then the sets nobody posts yet. One set belongs to one extension and one group to one extension, so
// a person can see at a glance which group goes to which machine. A red note appears when a group sits in the sets of
// two extensions (data from before the rule): the extension listed first posts it and the others skip it.
@Component({
  selector: 'app-ownership-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows().length) {
      <section class="panel own" [attr.aria-label]="t().api.flow.ownTitle">
        <div class="fw6">{{ t().api.flow.ownTitle }}</div>
        <p class="small muted">{{ t().api.flow.ownBody }}</p>
        <ul>
          @for (r of rows(); track r.key) {
            <li [class.none]="r.none">
              <div class="who">
                <i
                  class="ph"
                  [class.ph-desktop]="!r.none"
                  [class.ph-warning]="r.none"
                  aria-hidden="true"
                ></i>
                <span class="fw6">{{ r.name }}</span>
                @if (r.online !== null) {
                  <span class="dot" [class.on]="r.online" aria-hidden="true"></span>
                  <span class="small muted">{{
                    r.online ? t().api.flow.ownOnline : t().api.flow.ovExtOffline
                  }}</span>
                }
                <span class="small muted count">{{ r.count }}</span>
              </div>
              @if (r.sets.length) {
                <div class="sets">
                  @for (s of r.sets; track s) {
                    <span class="set">{{ s }}</span>
                  }
                </div>
              } @else if (!r.none) {
                <p class="small muted">{{ t().api.flow.ownNoSets }}</p>
              }
              @if (r.none) {
                <p class="small muted">{{ t().api.flow.ownUnassignedHint }}</p>
              }
            </li>
          }
        </ul>
        @if (overlaps() > 0) {
          <div class="callout warn" role="status">
            <i class="ph ph-warning" aria-hidden="true"></i>
            <div class="grow">
              <div class="fw6">{{ overlapTitle() }}</div>
              <p class="small">{{ t().api.flow.overlapBody }}</p>
            </div>
          </div>
        }
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .own {
      display: grid;
      gap: 8px;
    }
    p {
      margin: 0;
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 8px;
    }
    li {
      display: grid;
      gap: 6px;
      align-content: start;
      padding: 10px 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
    }
    li.none {
      border-style: dashed;
    }
    .who {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .count {
      margin-left: auto;
      white-space: nowrap;
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
    .sets {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .set {
      padding: 2px 8px;
      border-radius: var(--radius-full);
      background: var(--color-surface-muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
  `,
})
export class OwnershipOverviewComponent {
  private readonly store = inject(LinkSetsStore);
  private readonly accounts = inject(AccountsStore);
  private readonly devices = inject(DevicesStore);
  protected readonly t = inject(I18nService).t;

  protected readonly rows = computed(() => {
    if (!this.store.loaded() || !this.accounts.loaded()) return [];
    const flow = this.t().api.flow;
    const summary = summarizeOwners(this.store.sets(), this.accounts.list());
    return summary
      .filter((r) => r.owner !== null || r.sets.length > 0)
      .map((r) => {
        const account = r.owner ? this.accounts.byId(r.owner) : undefined;
        const device = r.owner
          ? this.devices.list().find((d) => d.accountId === r.owner)
          : undefined;
        return {
          key: r.owner ?? 'none',
          none: r.owner === null,
          name: r.owner
            ? account
              ? extensionNameOf(account, this.devices.list())
              : flow.postAsMissing
            : flow.ownUnassigned,
          online: device ? device.online : null,
          sets: r.sets.map((s) => s.name),
          count: fmt(flow.ownSetsGroups, { s: r.sets.length, g: r.groups }),
        };
      });
  });

  protected readonly overlaps = computed(
    () => groupOverlaps(this.store.sets(), this.accounts.list()).length,
  );

  protected readonly overlapTitle = computed(() =>
    fmt(this.t().api.flow.overlapTitle, { n: this.overlaps() }),
  );
}

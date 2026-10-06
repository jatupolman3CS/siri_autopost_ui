import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { STATUS_DOT } from '../../core/data/models';
import { AccountsStore } from '../../core/data/accounts.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { PostsStore } from '../../core/data/posts.store';
import { PLATFORMS } from '../../core/data/platforms';
import { dkey, fmtDate, hm } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';

@Component({
  selector: 'app-errors-page',
  imports: [PagerComponent, EmptyStateComponent, PermNoteComponent, CheckboxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './errors-page.component.html',
  styleUrl: './errors-page.component.scss',
})
export class ErrorsPageComponent {
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly accounts = inject(AccountsStore);
  protected readonly posts = inject(PostsStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = this.i18n.t;
  protected readonly filter = signal<'all' | 'today'>('all');
  protected readonly bulkBusy = signal(false);
  private readonly selection = signal<ReadonlySet<string>>(new Set());

  protected readonly sorted = computed(() =>
    [...this.posts.errors()].sort((a, b) => b.dt.getTime() - a.dt.getTime()),
  );
  protected readonly todayList = computed(() =>
    this.sorted().filter((e) => dkey(e.dt) === this.posts.todayKey()),
  );

  protected readonly pager = new Pager(20);
  protected readonly pageRows = computed(() => this.pager.slice(this.rows()));

  protected readonly rows = computed(() => {
    const li = this.i18n.li();
    const t = this.t();
    const list = this.filter() === 'today' ? this.todayList() : this.sorted();
    // A failed post whose browser was unbound has nobody to post it: the API leaves those alone when many are
    // retried, so they are not offered for it (until the accounts have arrived nothing is known to be unbound).
    const live = new Set(this.accounts.connected().map((a) => a.id));
    const known = this.accounts.loaded();
    return list.map((e) => {
      const r = t.reasons[e.code];
      const pending = e.code === 'pending_approval';
      const platform = PLATFORMS[e.platform];
      return {
        id: e.id,
        accountId: e.accountId,
        icon: platform.icon,
        title: r.title,
        // What the extension or the server reported says more than the generic reason, so it replaces it.
        body: e.detail || r.body,
        fix: r.fix,
        text: e.text,
        meta: `${fmtDate(e.dt, li)} ${hm(e.dt)} · ${platform.name} · ${e.target}`,
        dot: pending ? STATUS_DOT.pending : STATUS_DOT.failed,
        statusLabel: pending ? t.status.pending : t.status.failed,
        canRetry: !pending,
        canBulk: !pending && (!known || live.has(e.accountId)),
        isSession: e.code === 'session',
        skipLabel: pending ? t.err.dismiss : t.err.skip,
      };
    });
  });

  /** What the selection bar works on: every failed post of the shown list that can be retried together. */
  private readonly selectable = computed(() => this.rows().filter((r) => r.canBulk));
  protected readonly selectableCount = computed(() => this.selectable().length);
  protected readonly unboundCount = computed(
    () => this.rows().filter((r) => r.canRetry && !r.canBulk).length,
  );
  protected readonly selectedIds = computed(() => {
    const on = this.selection();
    return this.selectable()
      .filter((r) => on.has(r.id))
      .map((r) => r.id);
  });
  protected readonly pageSelectable = computed(() => this.pageRows().filter((r) => r.canBulk));
  protected readonly pageSelected = computed(() => {
    const ids = this.pageSelectable();
    const on = this.selection();
    return ids.length > 0 && ids.every((r) => on.has(r.id));
  });
  protected readonly allSelected = computed(
    () => this.selectedIds().length === this.selectableCount(),
  );

  protected readonly readyLine = computed(() =>
    fmt(this.t().api.errReadyLine, { n: this.selectableCount() }),
  );
  protected readonly unboundLine = computed(() =>
    fmt(this.t().api.errUnboundLine, { n: this.unboundCount() }),
  );
  protected readonly selectedLine = computed(() =>
    fmt(this.t().api.errBulkSelected, { n: this.selectedIds().length }),
  );
  protected readonly retryLine = computed(() =>
    fmt(this.t().api.errBulkRetry, { n: this.selectedIds().length }),
  );
  protected readonly selectAllLine = computed(() =>
    fmt(this.t().api.errSelectAll, { n: this.selectableCount() }),
  );

  protected isSelected(id: string): boolean {
    return this.selection().has(id);
  }

  protected select(id: string, on: boolean): void {
    this.selection.update((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  protected selectPage(on: boolean): void {
    this.selection.update((s) => {
      const next = new Set(s);
      for (const r of this.pageSelectable()) {
        if (on) next.add(r.id);
        else next.delete(r.id);
      }
      return next;
    });
  }

  /** Every retryable post of the shown list, on every page. */
  protected selectAll(): void {
    this.selection.set(new Set(this.selectable().map((r) => r.id)));
  }

  protected clearSelection(): void {
    this.selection.set(new Set());
  }

  protected setFilter(filter: 'all' | 'today'): void {
    this.filter.set(filter);
    this.pager.go(1);
    this.clearSelection();
  }

  protected async retry(id: string): Promise<void> {
    await this.posts.retryError(id);
    this.notify.success(this.t().err.retried);
  }

  protected async retrySelected(): Promise<void> {
    const ids = this.selectedIds();
    if (!ids.length || this.bulkBusy() || !this.perm.canEdit()) return;
    this.bulkBusy.set(true);
    try {
      const done = await this.posts.retryErrors(ids);
      const t = this.t().api;
      if (done.retried) this.notify.success(fmt(t.errBulkDone, { n: done.retried }));
      else this.notify.info(t.errBulkNone);
      if (done.unbound) this.notify.info(fmt(t.errBulkUnbound, { n: done.unbound }));
      if (done.notFailed) this.notify.info(fmt(t.errBulkGone, { n: done.notFailed }));
      this.clearSelection();
    } catch {
      // The interceptor tells the user why. What was done before the failure is read back, so the posts still
      // selected are the ones that are still failed: one more press carries on.
    } finally {
      this.bulkBusy.set(false);
    }
  }

  protected async skip(id: string): Promise<void> {
    await this.posts.skipError(id);
    this.notify.info(this.t().err.skipped);
  }

  protected async signin(accountId: string): Promise<void> {
    await this.accounts.reconnect(accountId);
    this.notify.success(this.t().err.signedIn);
  }
}

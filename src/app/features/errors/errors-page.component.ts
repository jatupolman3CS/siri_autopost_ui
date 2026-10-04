import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { STATUS_DOT } from '../../core/data/models';
import { AccountsStore } from '../../core/data/accounts.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { PostsStore } from '../../core/data/posts.store';
import { PLATFORMS } from '../../core/data/platforms';
import { dkey, fmtDate, hm } from '../../core/i18n/format';
import { I18nService } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';

@Component({
  selector: 'app-errors-page',
  imports: [PagerComponent, EmptyStateComponent, PermNoteComponent],
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
        isSession: e.code === 'session',
        skipLabel: pending ? t.err.dismiss : t.err.skip,
      };
    });
  });

  protected async retry(id: string): Promise<void> {
    await this.posts.retryError(id);
    this.notify.success(this.t().err.retried);
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

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { STATUS_DOT } from '../../core/data/models';
import { AccountsStore } from '../../core/data/accounts.store';
import { PostsStore } from '../../core/data/posts.store';
import { SEED } from '../../core/data/seed.data';
import { dkey, fmtDate, hm } from '../../core/i18n/format';
import { I18nService } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-errors-page',
  imports: [EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page gap16">
      <div class="page-head mb8">
        <div>
          <h1>{{ t().err.title }}</h1>
          <p>{{ t().err.sub }}</p>
        </div>
        <div class="seg">
          <button type="button" [class.on]="filter() === 'all'" (click)="filter.set('all')">
            {{ t().err.filterAll }} ({{ sorted().length }})
          </button>
          <button type="button" [class.on]="filter() === 'today'" (click)="filter.set('today')">
            {{ t().err.filterToday }} ({{ todayList().length }})
          </button>
        </div>
      </div>

      @for (e of rows(); track e.id) {
        <section class="panel err">
          <span class="pico s40"><i class="ph" [class]="e.icon"></i></span>
          <div class="body">
            <div class="title-row">
              <h2 class="h2">{{ e.title }}</h2>
              <span class="status"
                ><span class="dot" [style.background]="e.dot"></span>{{ e.statusLabel }}</span
              >
            </div>
            <div class="small muted">{{ e.meta }}</div>
            <p class="fs14 flush">{{ e.body }}</p>
            <div class="callout">
              <i class="ph ph-wrench" style="color: var(--color-primary)"></i>
              <span
                ><span class="fw5">{{ t().err.whatToDo }}: </span>{{ e.fix }}</span
              >
            </div>
            <div class="fs14 muted">“{{ e.text }}”</div>
          </div>
          <div class="btns">
            @if (e.canRetry) {
              <button
                type="button"
                class="su-btn su-btn-sm su-btn-primary su-btn-full"
                (click)="retry(e.id)"
              >
                <i class="ph ph-arrow-counter-clockwise"></i>{{ t().common.retryNow }}
              </button>
            }
            @if (e.isSession) {
              <button
                type="button"
                class="su-btn su-btn-sm su-btn-secondary su-btn-full"
                (click)="signin(e.accountId)"
              >
                {{ t().err.signin }}
              </button>
            }
            <button
              type="button"
              class="su-btn su-btn-sm su-btn-ghost su-btn-full"
              (click)="skip(e.id)"
            >
              {{ e.skipLabel }}
            </button>
          </div>
        </section>
      } @empty {
        <div class="panel nopad">
          <app-empty-state
            [heading]="t().err.empty"
            [description]="t().err.emptyBody"
            icon="ph-check-circle"
          />
        </div>
      }
    </div>
  `,
  styles: `
    .gap16 {
      gap: 16px;
    }
    .mb8 {
      margin-bottom: 8px;
    }
    .fs14 {
      font-size: 14px;
    }
    .flush {
      margin: 0;
    }
    .err {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      flex-wrap: wrap;
    }
    .body {
      flex: 1;
      min-width: 240px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .btns {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 170px;
    }
    .nopad {
      padding: 0;
    }
  `,
})
export class ErrorsPageComponent {
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly accounts = inject(AccountsStore);
  protected readonly posts = inject(PostsStore);
  protected readonly t = this.i18n.t;
  protected readonly filter = signal<'all' | 'today'>('all');

  protected readonly sorted = computed(() =>
    [...this.posts.errors()].sort((a, b) => b.dt.getTime() - a.dt.getTime()),
  );
  protected readonly todayList = computed(() =>
    this.sorted().filter((e) => dkey(e.dt) === this.posts.todayKey()),
  );

  protected readonly rows = computed(() => {
    const li = this.i18n.li();
    const t = this.t();
    const list = this.filter() === 'today' ? this.todayList() : this.sorted();
    return list.map((e) => {
      const r = t.reasons[e.code];
      const pending = e.code === 'pending_approval';
      const platform = SEED.platforms[e.platform];
      return {
        id: e.id,
        accountId: e.accountId,
        icon: platform.icon,
        title: r.title,
        body: r.body,
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

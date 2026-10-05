import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MasterPostsStore } from '../../core/data/master-posts.store';
import { ApiPostActivity } from '../../core/http/api.service';
import { fmtDate, hm } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';

const DOT: Record<ApiPostActivity['status'], string> = {
  success: 'var(--color-success)',
  failed: 'var(--color-danger)',
  queued: 'var(--color-primary)',
  posting: 'var(--color-primary)',
  skipped: 'var(--color-border)',
  pending: 'var(--color-warning)',
  waiting: 'var(--color-warning)',
};

/** Only a web address is made a link (the target of a post is otherwise just a name). */
const isHttp = (url: string | null): url is string => !!url && /^https?:\/\//i.test(url);

// What happened to one post: a row per group it was sent to (newest first), with the status, the time and why
// it failed. Read from the API when it opens.
@Component({
  selector: 'app-post-activity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="act" aria-live="polite">
      @if (state() === 'loading') {
        <p class="small muted">{{ t().api.flow.plActLoading }}</p>
      } @else if (state() === 'error') {
        <p class="small bad" role="alert">{{ t().api.flow.plActFailed }}</p>
      } @else {
        @for (r of rows(); track r.id) {
          <div class="line">
            <span class="status"
              ><span class="dot" [style.background]="r.dot"></span>{{ r.label }}</span
            >
            <span class="grow who">
              @if (r.url) {
                <a
                  [href]="r.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  [title]="t().api.flow.plActOpenGroup"
                  >{{ r.target }}</a
                >
              } @else {
                {{ r.target }}
              }
              <span class="small muted when">{{ r.when }}</span>
              @if (r.detail) {
                <span class="small bad detail">{{ r.detail }}</span>
              }
            </span>
          </div>
        } @empty {
          <p class="small muted">{{ t().api.flow.plActEmpty }}</p>
        }
      }
    </div>
  `,
  styles: `
    .act {
      display: flex;
      flex-direction: column;
    }
    .line {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 8px 0;
      border-top: 1px solid var(--color-border);
      font-size: 14px;
    }
    .status {
      min-width: 112px;
    }
    .who {
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow-wrap: anywhere;
    }
    .bad {
      color: var(--color-danger);
    }
    p {
      margin: 0;
    }
  `,
})
export class PostActivityComponent {
  private readonly store = inject(MasterPostsStore);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  readonly postId = input.required<string>();

  protected readonly state = signal<'loading' | 'error' | 'ready'>('loading');
  private readonly list = signal<ApiPostActivity[]>([]);

  protected readonly rows = computed(() => {
    const t = this.t();
    const li = this.i18n.li();
    const when = (iso: string) => {
      const d = new Date(iso);
      return `${fmtDate(d, li)} ${hm(d)}`;
    };
    return this.list().map((r) => ({
      id: r.id,
      target: r.target,
      url: isHttp(r.targetUrl) ? r.targetUrl : null,
      label: t.status[r.status],
      dot: DOT[r.status],
      detail: r.failureDetail,
      when: r.publishedAt
        ? fmt(t.api.flow.plActPublished, { t: when(r.publishedAt) })
        : fmt(t.api.flow.plActScheduled, { t: when(r.scheduledAt) }),
    }));
  });

  constructor() {
    effect(() => {
      const id = this.postId();
      untracked(() => void this.load(id));
    });
  }

  private async load(id: string): Promise<void> {
    this.state.set('loading');
    try {
      const list = await this.store.activity(id);
      // An answer for a post this view has moved away from is dropped.
      if (this.postId() !== id) return;
      this.list.set(list);
      this.state.set('ready');
    } catch {
      if (this.postId() === id) this.state.set('error');
    }
  }
}

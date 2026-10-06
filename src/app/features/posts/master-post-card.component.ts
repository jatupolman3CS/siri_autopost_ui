import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CollectionsStore } from '../../core/data/collections.store';
import { LibraryStore } from '../../core/data/library.store';
import { MasterPostsStore } from '../../core/data/master-posts.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { postFlags } from '../../core/flow';
import { ApiCollectionPost, ApiPostSettings } from '../../core/http/api.service';
import { fmtDate, hm } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { PostActivityComponent } from './post-activity.component';
import '../../core/i18n/i18n.flow';

const DOT: Record<ApiCollectionPost['approval'], string> = {
  approved: 'var(--color-success)',
  pending: 'var(--color-warning)',
  draft: 'var(--color-border)',
};

/** The post limits its own schedule (dates, weekdays, a time window or a daily cap). */
export const hasOwnSchedule = (s: ApiPostSettings): boolean =>
  !!s.validFrom ||
  !!s.validUntil ||
  (s.weekdays?.length ?? 0) > 0 ||
  !!s.timeFrom ||
  !!s.timeTo ||
  s.maxPerDay > 0;

/** The post writes its own hashtags, footer or footer position instead of following its collection. */
export const hasOwnMessage = (s: ApiPostSettings): boolean =>
  s.hashtags != null || s.footer != null || s.footerPos != null;

// One post of the library: its text (clamped), media thumbnails, the collections it sits in, what came of it
// (posted, queued, failed, last and next time), the on/off switch (a switched-off post is dimmed with a
// hint), the approval buttons, and the buttons that open its editor and its results. The editor is the panel at
// the top of the page (the card only asks for it with `edit`); deleting asks the page too (`remove`), which owns
// the confirmation, so the dialog outlives the card.
@Component({
  selector: 'app-master-post-card',
  imports: [CheckboxComponent, PostActivityComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './master-post-card.component.html',
  styleUrl: './master-post-card.component.scss',
})
export class MasterPostCardComponent {
  private readonly store = inject(MasterPostsStore);
  private readonly collections = inject(CollectionsStore);
  private readonly library = inject(LibraryStore);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  readonly post = input.required<ApiCollectionPost>();
  readonly selected = input(false);
  /** The editor panel is open on this post. */
  readonly editing = input(false);
  readonly select = output<boolean>();
  readonly remove = output<ApiCollectionPost>();
  /** Open this post in the editor panel. */
  readonly edit = output<ApiCollectionPost>();

  protected readonly resultsOpen = signal(false);

  constructor() {
    // Only the three thumbnails shown are fetched.
    effect(() => this.library.ensureThumbs(this.post().mediaIds.slice(0, 3)));
  }

  protected readonly flags = computed(() => postFlags(this.post().text));
  protected readonly dot = computed(() => DOT[this.post().approval]);
  protected readonly statusLabel = computed(() => {
    const c = this.t().col;
    const a = this.post().approval;
    return a === 'approved' ? c.stApproved : a === 'pending' ? c.stPending : c.stDraft;
  });
  protected readonly thumbs = computed(() => {
    const media = this.library.media();
    const urls = this.library.thumbs();
    return this.post()
      .mediaIds.slice(0, 3)
      .map((id) => ({
        id,
        src: urls[id] ?? null,
        icon: media.find((m) => m.id === id)?.kind === 'video' ? 'ph-video' : 'ph-image',
      }));
  });
  /** The collections the post sits in, by name (a collection the store does not know yet is left out). */
  protected readonly inCollections = computed(() =>
    this.post().collectionIds.flatMap((id) => {
      const c = this.collections.byId(id);
      return c ? [{ id, name: c.name, approval: c.settings.requireApproval }] : [];
    }),
  );
  /** A collection that holds the post asks for approval: its approval status matters and its buttons show. */
  protected readonly approvalOn = computed(() => this.inCollections().some((c) => c.approval));
  protected readonly showStatus = computed(
    () => this.approvalOn() || this.post().approval === 'pending',
  );
  protected readonly ownMessage = computed(() => hasOwnMessage(this.post().settings));
  protected readonly ownSchedule = computed(() => hasOwnSchedule(this.post().settings));
  /** The numbers and times of what became of the post, ready to show. */
  protected readonly stats = computed(() => {
    const a = this.t().api.flow;
    const p = this.post();
    const last = this.time(p.lastPostedAt);
    const next = this.time(p.nextAt);
    return {
      posted: fmt(a.plPostedN, { n: p.postedCount }),
      queued: fmt(a.plQueuedN, { n: p.queuedCount }),
      failed: fmt(a.plFailedN, { n: p.failedCount }),
      last: last ? fmt(a.plLastPosted, { t: last }) : a.plNeverPosted,
      next: next ? fmt(a.plNextAt, { t: next }) : null,
    };
  });
  protected readonly mediaLine = computed(() => {
    const n = this.post().mediaIds.length;
    return n ? fmt(this.t().api.flow.plMediaCount, { n }) : this.t().col.noMedia;
  });

  private time(iso: string | null): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    return `${fmtDate(d, this.i18n.li())} ${hm(d)}`;
  }

  protected async setActive(on: boolean): Promise<void> {
    if (!this.perm.canEdit()) return;
    if (await this.store.setActive(this.post().id, on))
      this.notify.success(on ? this.t().api.itemSwitchedOn : this.t().api.itemSwitchedOff);
  }

  protected request(): void {
    void this.store.approval(this.post().id, 'request');
  }

  protected approve(): void {
    void this.store.approval(this.post().id, 'approve');
  }

  protected reject(): void {
    void this.store.approval(this.post().id, 'reject');
  }
}

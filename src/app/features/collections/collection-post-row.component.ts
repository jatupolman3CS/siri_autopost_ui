import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { CollectionsStore } from '../../core/data/collections.store';
import { DraftStore } from '../../core/data/draft.store';
import { LibraryStore } from '../../core/data/library.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { postFlags } from '../../core/flow';
import { ApiCollection, ApiCollectionPost } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { COMPOSER_PATH, composerParams } from '../composer/composer-link';

const DOT: Record<ApiCollectionPost['approval'], string> = {
  approved: 'var(--color-success)',
  pending: 'var(--color-warning)',
  draft: 'var(--color-border)',
};

// One post of a collection: thumbnails of its media, the text, how many files and posts, the code and spintax
// badges, the approval status of a collection that needs approval, and the buttons (request / approve / send
// back, edit, delete). Approving and sending back are admin actions, the rest are the editor's.
@Component({
  selector: 'app-collection-post-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './collection-post-row.component.html',
  styleUrl: './collection-post-row.component.scss',
})
export class CollectionPostRowComponent {
  private readonly store = inject(CollectionsStore);
  private readonly draft = inject(DraftStore);
  private readonly library = inject(LibraryStore);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  readonly collection = input.required<ApiCollection>();
  readonly post = input.required<ApiCollectionPost>();

  constructor() {
    // Only the three thumbnails shown are fetched.
    effect(() => this.library.ensureThumbs(this.post().mediaIds.slice(0, 3)));
  }

  protected readonly flags = computed(() => postFlags(this.post().text));
  protected readonly approvalOn = computed(() => this.collection().settings.requireApproval);
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
  protected readonly meta = computed(() => {
    const c = this.t().col;
    const p = this.post();
    return (
      (p.mediaIds.length ? fmt(c.mediaN, { n: p.mediaIds.length }) : c.noMedia) +
      ' · ' +
      fmt(c.postedN, { n: p.postedCount })
    );
  });

  protected request(): void {
    void this.store.setApproval(this.post(), 'request');
  }

  protected approve(): void {
    void this.store.setApproval(this.post(), 'approve');
  }

  protected reject(): void {
    void this.store.setApproval(this.post(), 'reject');
  }

  protected edit(): void {
    this.draft.edit(this.collection(), this.post());
    void this.router.navigate([COMPOSER_PATH], { queryParams: composerParams(this.draft.draft()) });
  }

  /** Deletes at once (no confirmation, as in the design); the post comes back if the API refuses. */
  protected async remove(): Promise<void> {
    if (await this.store.deletePost(this.post())) this.notify.info(this.t().col.deleted);
  }
}

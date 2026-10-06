import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CollectionsStore } from '../../core/data/collections.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { EXPORT_FILES } from '../../core/flow';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { FlowStepsComponent } from '../../shared/components/flow-steps/flow-steps.component';
import { NextStepComponent } from '../../shared/components/next-step/next-step.component';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import { Pager } from '../../shared/components/pager/pager';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { POSTS_PATH, newPostParams } from '../posts/posts-link';
import { CollectionCardComponent } from './collection-card.component';
import { NewCollectionModalComponent } from './new-collection-modal.component';
import '../../core/i18n/i18n.flow';

// Step 1 of the flow: the workspace's post collections ("ชุดโพสต์") with their posts, composing settings and
// approval. Posts are written in the post library's editor; a collection is paired with a link set on the schedules page.
@Component({
  selector: 'app-collections-page',
  imports: [
    CollectionCardComponent,
    EmptyStateComponent,
    FlowStepsComponent,
    NewCollectionModalComponent,
    NextStepComponent,
    PagerComponent,
    PermNoteComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './collections-page.component.html',
  styleUrl: './collections-page.component.scss',
})
export class CollectionsPageComponent {
  protected readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  protected readonly store = inject(CollectionsStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  protected readonly modal = signal(false);
  protected readonly pager = new Pager(20);
  protected readonly cards = computed(() => this.pager.slice(this.store.collections()));

  constructor() {
    // Posted counts and schedule counts move on other pages: read them again when the page opens.
    void this.store.refresh();
  }

  protected exportCsv(): void {
    const a = this.t().api.flow;
    if (this.store.exportCsv())
      this.notify.success(fmt(this.t().col.exported, { f: EXPORT_FILES.posts }));
    else this.notify.error(a.exportFailed);
  }

  /** Writes a post in the collection that was last saved to (else the open one): the post library's editor opens. */
  protected write(): void {
    const known = (id: string | null) => (id && this.store.byId(id) ? id : null);
    const collection = known(this.store.lastId()) ?? known(this.store.openId());
    void this.router.navigate([POSTS_PATH], { queryParams: newPostParams(collection) });
  }
}

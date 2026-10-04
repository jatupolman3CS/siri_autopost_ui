import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CollectionsStore } from '../../core/data/collections.store';
import { DraftStore } from '../../core/data/draft.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { EXPORT_FILES } from '../../core/flow';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { FlowStepsComponent } from '../../shared/components/flow-steps/flow-steps.component';
import { NextStepComponent } from '../../shared/components/next-step/next-step.component';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { COMPOSER_PATH, composerParams } from '../composer/composer-link';
import { CollectionCardComponent } from './collection-card.component';
import { NewCollectionModalComponent } from './new-collection-modal.component';
import '../../core/i18n/i18n.flow';

// Step 1 of the flow: the workspace's post collections ("ชุดโพสต์") with their posts, composing settings and
// approval. Posts are written in the composer; a collection is paired with a link set on the schedules page.
@Component({
  selector: 'app-collections-page',
  imports: [
    CollectionCardComponent,
    EmptyStateComponent,
    FlowStepsComponent,
    NewCollectionModalComponent,
    NextStepComponent,
    PermNoteComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './collections-page.component.html',
  styleUrl: './collections-page.component.scss',
})
export class CollectionsPageComponent {
  protected readonly router = inject(Router);
  private readonly draft = inject(DraftStore);
  private readonly notify = inject(NotificationService);
  protected readonly store = inject(CollectionsStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  protected readonly modal = signal(false);

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

  /** A blank post for the collection that is open (or the last one saved to). */
  protected write(): void {
    this.draft.startNew();
    void this.router.navigate([COMPOSER_PATH], { queryParams: composerParams(this.draft.draft()) });
  }
}

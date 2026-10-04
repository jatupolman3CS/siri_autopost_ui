import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { EXPORT_FILES } from '../../core/flow/download';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { NotificationService } from '../../core/services/notification.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { FlowStepsComponent } from '../../shared/components/flow-steps/flow-steps.component';
import { NextStepComponent } from '../../shared/components/next-step/next-step.component';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { BulkLinksModalComponent } from './bulk-links-modal.component';
import { CsvLinksModalComponent } from './csv-links-modal.component';
import { ImportGroupsModalComponent } from './import-groups-modal.component';
import { LinkSetCardComponent } from './link-set-card.component';
import { NewSetModalComponent } from './new-set-modal.component';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';

type Dialog = 'set' | 'csv' | 'bulk' | 'import';

// "Group links and link sets" (step 2 of the flow): the Facebook groups to post to, grouped in sets with an
// optional group code and a daily cap per group. Rows are edited in place; the dialogs create a set, paste
// several links, pick groups from an account and import a CSV. Everything that writes is an editor's.
@Component({
  selector: 'app-targets-page',
  imports: [
    PagerComponent,
    EmptyStateComponent,
    FlowStepsComponent,
    NextStepComponent,
    PermNoteComponent,
    LinkSetCardComponent,
    NewSetModalComponent,
    BulkLinksModalComponent,
    ImportGroupsModalComponent,
    CsvLinksModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './targets-page.component.html',
  styleUrl: './targets-page.component.scss',
})
export class TargetsPageComponent {
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  protected readonly store = inject(LinkSetsStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  protected readonly pager = new Pager(20);
  protected readonly setPage = computed(() => this.pager.slice(this.store.sets()));

  protected readonly dialog = signal<Dialog | null>(null);
  /** The set a paste or import dialog adds to. */
  protected readonly dialogSet = signal<string | null>(null);

  protected open(dialog: Dialog, setId: string | null = null): void {
    this.dialogSet.set(setId);
    this.dialog.set(dialog);
  }

  protected close(): void {
    this.dialog.set(null);
  }

  protected exportCsv(): void {
    if (this.store.exportCsv())
      this.notify.success(fmt(this.t().col.exported, { f: EXPORT_FILES.links }));
  }

  protected next(): void {
    void this.router.navigate(['/app/schedules'], { queryParams: { new: 1 } });
  }
}

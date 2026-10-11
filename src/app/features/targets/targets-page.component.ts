import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { AccountsStore, extensionNameOf } from '../../core/data/accounts.store';
import { DevicesStore } from '../../core/data/devices.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { EXPORT_FILES } from '../../core/flow/download';
import { ownerOfSet } from '../../core/flow/link-ownership';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { NotificationService } from '../../core/services/notification.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { FlowStepsComponent } from '../../shared/components/flow-steps/flow-steps.component';
import { NextStepComponent } from '../../shared/components/next-step/next-step.component';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { BulkLinksModalComponent } from './bulk-links-modal.component';
import { CsvLinksModalComponent } from './csv-links-modal.component';
import { LinkSetCardComponent } from './link-set-card.component';
import { NewSetModalComponent } from './new-set-modal.component';
import { OwnershipOverviewComponent } from './ownership-overview.component';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';

type Dialog = 'set' | 'csv' | 'bulk';

// "Group and page links" (step 3 of the flow): the Facebook groups and pages to post to, grouped in sets with an
// optional group code and a daily cap per link. Rows are edited in place; the dialogs create a set, paste
// several links and import a CSV. Everything that writes is an editor's.
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
    OwnershipOverviewComponent,
    BulkLinksModalComponent,
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
  private readonly accounts = inject(AccountsStore);
  private readonly devices = inject(DevicesStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  protected readonly pager = new Pager(20);

  /**
   * The sets side by side with the extension that posts them: in the order of the extensions (the team page's), then the
   * sets nobody posts, each set keeping its own order inside its extension. A heading names the extension.
   */
  private readonly ordered = computed(() => {
    const accounts = this.accounts.list();
    const rank = new Map(accounts.map((a, i) => [a.id, i]));
    const rankOf = (setOwner: string | null) =>
      setOwner === null
        ? Number.MAX_SAFE_INTEGER
        : (rank.get(setOwner) ?? Number.MAX_SAFE_INTEGER - 1);
    return this.store
      .sets()
      .map((s, i) => ({ s, i, r: rankOf(ownerOfSet(s, accounts)) }))
      .sort((a, b) => a.r - b.r || a.i - b.i)
      .map((x) => x.s);
  });
  protected readonly setPage = computed(() => this.pager.slice(this.ordered()));

  /** The extension's name above the first set of its group on this page; null for the sets that follow it. */
  protected heading(index: number): string | null {
    const page = this.setPage();
    const owner = (i: number) => ownerOfSet(page[i], this.accounts.list());
    if (index > 0 && owner(index) === owner(index - 1)) return null;
    const flow = this.t().api.flow;
    const id = owner(index);
    if (!id) return flow.ownUnassigned;
    const account = this.accounts.byId(id);
    return account ? extensionNameOf(account, this.devices.list()) : flow.postAsMissing;
  }

  protected readonly dialog = signal<Dialog | null>(null);
  /** The set a paste dialog adds to. */
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

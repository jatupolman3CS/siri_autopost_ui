import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AccountsStore } from '../../core/data/accounts.store';
import { CollectionsStore } from '../../core/data/collections.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { SchedulesStore } from '../../core/data/schedules.store';
import { parseDateKey } from '../../core/flow/schedule-math';
import { I18nService } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { FlowStepsComponent } from '../../shared/components/flow-steps/flow-steps.component';
import { NextStepComponent } from '../../shared/components/next-step/next-step.component';
import { PermNoteComponent } from '../../shared/components/perm-note/perm-note.component';
import { ScheduleBuilderComponent } from './schedule-builder.component';
import { ScheduleFormService } from './schedule-form.service';
import { ScheduleListComponent } from './schedule-list.component';

// "Schedules" (step 3 of the flow): pair a collection with a link set and choose when it posts. The builder
// card opens from "new schedule" or from the address (`?collection=` and `?set=` from the cards of the other
// steps, `?start=` from the calendar's "add", `?new=1` from the overview): the fields are filled, the builder
// opens and the parameters are taken off the address. Below it, every schedule with its pause, resume and
// delete. Reading is for everyone; creating and changing is an editor's and needs a connected Facebook account.
@Component({
  selector: 'app-schedules-page',
  imports: [
    RouterLink,
    FlowStepsComponent,
    NextStepComponent,
    PermNoteComponent,
    ScheduleBuilderComponent,
    ScheduleListComponent,
  ],
  providers: [ScheduleFormService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './schedules-page.component.html',
  styleUrl: './schedules-page.component.scss',
})
export class SchedulesPageComponent {
  /** ?collection=<id>: opens the builder with that collection chosen. */
  readonly collection = input<string>();
  /** ?set=<id>: opens the builder with that link set chosen. */
  readonly set = input<string>();
  /** ?start=<yyyy-MM-dd>: opens the builder with that start date (the calendar's "add"). */
  readonly start = input<string>();
  /** ?new=1: opens the builder as it is (the overview's "set a schedule"). */
  readonly openNew = input<string | undefined>(undefined, { alias: 'new' });

  private readonly router = inject(Router);
  private readonly collections = inject(CollectionsStore);
  private readonly linkSets = inject(LinkSetsStore);
  private readonly accounts = inject(AccountsStore);
  private readonly schedules = inject(SchedulesStore);
  protected readonly form = inject(ScheduleFormService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  /** A Facebook account with a paired browser: without one the API refuses every new schedule. */
  protected readonly canPost = computed(() =>
    this.accounts.list().some((a) => a.platform === 'fb' && a.connected),
  );
  /** Known to have no browser to post from (the list has arrived and has none). */
  protected readonly needDevice = computed(() => this.accounts.loaded() && !this.canPost());
  protected readonly needCollection = computed(
    () => this.collections.loaded() && this.collections.collections().length === 0,
  );
  protected readonly needLinkSet = computed(
    () => this.linkSets.loaded() && this.linkSets.sets().length === 0,
  );

  constructor() {
    // Posts, today's count and the next run move all the time: read them again when the page opens.
    if (this.schedules.loaded()) void this.schedules.refresh();
    effect(() => {
      const wanted = [this.collection(), this.set(), this.start(), this.openNew()];
      if (wanted.every((v) => v === undefined)) return;
      // The ids can only be told apart from stale ones once the lists have arrived.
      if (!this.collections.loaded() || !this.linkSets.loaded()) return;
      untracked(() => {
        // Someone who cannot create sees the schedules but not an empty form to fill in.
        if (this.perm.canEdit()) {
          const c = this.collection();
          const s = this.set();
          const d = this.start();
          this.form.show({
            collectionId: c && this.collections.byId(c) ? c : undefined,
            linkSetId: s && this.linkSets.byId(s) ? s : undefined,
            start: d && parseDateKey(d) ? d : undefined,
          });
        }
        void this.router.navigate([], {
          queryParams: { collection: null, set: null, start: null, new: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    });
  }

  protected next(): void {
    void this.router.navigateByUrl('/app/calendar');
  }
}

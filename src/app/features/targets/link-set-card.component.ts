import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  Injector,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AccountsStore, extensionNameOf } from '../../core/data/accounts.store';
import { DevicesStore } from '../../core/data/devices.store';
import { SchedulesStore } from '../../core/data/schedules.store';
import { LINK_LIMITS, LinkSetsStore, firstCodedLink } from '../../core/data/link-sets.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { ApiLinkSet } from '../../core/http/api.service';
import { composeFull, seededRandom } from '../../core/flow/compose';
import { linkLabel } from '../../core/flow/group-links';
import { problemMessage } from '../../core/http/problem-details';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { NotificationService } from '../../core/services/notification.service';
import { UiPrefsService } from '../../core/services/ui-prefs.service';
import {
  SelectFieldComponent,
  SelectOption,
} from '../../shared/components/select-field/select-field.component';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { RenameModalComponent } from '../../shared/components/rename-modal/rename-modal.component';
import { LinkRowComponent } from './link-row.component';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';

// One link set (the prototype's set card): its name and counts, the actions (add a link, paste several,
// schedule with it, delete), the link rows of Facebook groups and pages, and under the "more options" toggle the
// extension that posts the set and an example of what is written to a group with a code.
@Component({
  selector: 'app-link-set-card',
  imports: [
    PagerComponent,
    LinkRowComponent,
    SelectFieldComponent,
    CheckboxComponent,
    RenameModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './link-set-card.component.html',
  styleUrl: './link-set-card.component.scss',
})
export class LinkSetCardComponent {
  readonly set = input.required<ApiLinkSet>();
  /** "Paste links" was pressed: the page opens its dialog for this set. */
  readonly bulk = output<void>();

  private readonly store = inject(LinkSetsStore);
  private readonly accounts = inject(AccountsStore);
  private readonly devices = inject(DevicesStore);
  // Looked up when needed: the schedules are only read again after a switch.
  private readonly injector = inject(Injector);
  private readonly prefs = inject(UiPrefsService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  protected readonly nameLimit = LINK_LIMITS.setName;
  protected readonly renameOpen = signal(false);

  /** The row that was just added: its address field takes the cursor. */
  protected readonly newId = signal<string | null>(null);
  protected readonly pager = new Pager(20);
  protected readonly linkPage = computed(() => this.pager.slice(this.set().links));

  protected readonly meta = computed(() => {
    const stats = this.store.stats()[this.set().id];
    const ts = this.t().ts;
    if (!stats) return '';
    return [
      fmt(ts.linksN, { n: stats.links }),
      fmt(ts.onN, { n: stats.on }),
      fmt(ts.codesN, { n: stats.codes }),
    ].join(' · ');
  });

  protected readonly usedBy = computed(() => {
    const n = this.set().scheduleCount;
    return n > 0 ? fmt(this.t().api.flow.linkSetUsedBy, { n }) : this.t().ts.notUsed;
  });

  /** Open by default when simple mode is off; the person's own choice for this set stays. */
  protected readonly more = computed(
    () => this.store.moreOpen()[this.set().id] ?? !this.prefs.simple(),
  );

  /**
   * The extensions that can post the set, by the name of their browser ("Shop PC"): the paired ones (the API keeps
   * a Facebook account for each, which is what a set stores), or "automatic" for the first connected one.
   */
  protected readonly postAsOptions = computed<SelectOption[]>(() => {
    const flow = this.t().api.flow;
    const devices = this.devices.list();
    const options: SelectOption[] = [
      { value: '', label: flow.postAsAuto },
      ...this.accounts
        .connected()
        .map((a) => ({ value: a.id, label: extensionNameOf(a, devices) })),
    ];
    const chosen = this.set().postAsAccountId;
    // An extension that is no longer paired (or gone) stays visible instead of silently showing another one.
    if (chosen && !this.accounts.connected().some((a) => a.id === chosen)) {
      const a = this.accounts.byId(chosen);
      options.push({
        value: chosen,
        label: a
          ? `${extensionNameOf(a, devices)} · ${this.t().api.unboundAccount}`
          : flow.postAsMissing,
      });
    }
    return options;
  });

  /** What is written to a group that has a code: the code, the post text, the collection's footer and tags. */
  protected readonly example = computed(() => {
    const link = firstCodedLink(this.set());
    if (!link) return null;
    const body = this.t().ts.exampleBody;
    const full = composeFull(body, link.code.trim(), this.store.exampleSettings(), seededRandom(1));
    const at = full.indexOf(body);
    return {
      title: fmt(this.t().ts.example, { g: linkLabel(link) }),
      before: at < 0 ? full : full.slice(0, at),
      body: at < 0 ? '' : body,
      after: at < 0 ? '' : full.slice(at + body.length),
    };
  });

  protected readonly saveName = async (name: string): Promise<void> => {
    if (!(await this.store.updateSet(this.set().id, { name }))) throw new Error('rename refused');
    this.notify.success(this.t().api.itemRenamed);
  };

  /** Switches the set on or off; the schedules that use it change with it, so they are read again. */
  protected async setActive(on: boolean): Promise<void> {
    if (this.perm.readOnly()) return;
    try {
      await this.store.setActive(this.set().id, on);
      this.notify.success(on ? this.t().api.itemSwitchedOn : this.t().api.itemSwitchedOff);
    } catch {
      // The interceptor tells the user.
    }
    void this.injector.get(SchedulesStore).refresh();
  }

  protected toggleMore(): void {
    this.store.setMore(this.set().id, !this.more());
  }

  protected async addLink(): Promise<void> {
    try {
      const row = await this.store.addLinkRow(this.set().id);
      this.newId.set(row?.id ?? null);
      // The new row is the last one: show its page.
      this.pager.go(Math.ceil(this.set().links.length / this.pager.size()));
    } catch {
      // The error interceptor has shown why (for example the 200-link limit).
    }
  }

  protected schedule(): void {
    void this.router.navigate(['/app/schedules'], { queryParams: { set: this.set().id } });
  }

  /** The API refuses while a schedule uses the set and names the schedules: that answer is the toast. */
  protected async remove(): Promise<void> {
    const set = this.set();
    try {
      await this.store.deleteSet(set.id);
      this.notify.info(fmt(this.t().ts.setDeleted, { s: set.name }));
    } catch (e) {
      const why = problemMessage(e);
      if (why) this.notify.error(why);
    }
  }

  protected async setPostAs(value: string): Promise<void> {
    const next = value || null;
    if (next === this.set().postAsAccountId) return;
    await this.store.setPostAs(this.set().id, next);
  }
}

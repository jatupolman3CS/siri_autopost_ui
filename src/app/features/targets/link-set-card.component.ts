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
import { Router, RouterLink } from '@angular/router';
import { AccountsStore, deviceOfAccount, extensionNameOf } from '../../core/data/accounts.store';
import { DevicesStore } from '../../core/data/devices.store';
import { SchedulesStore } from '../../core/data/schedules.store';
import { lineStateOf } from '../../core/data/devices.store';
import {
  LINK_LIMITS,
  LinkSetsStore,
  firstCodedLink,
  isActiveLink,
} from '../../core/data/link-sets.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiLinkSet } from '../../core/http/api.service';
import { composeChat, composeFull, seededRandom } from '../../core/flow/compose';
import { linkLabel } from '../../core/flow/group-links';
import { channelOf, chatLabel } from '../../core/flow/line-chats';
import { problemMessage } from '../../core/http/problem-details';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import '../../core/i18n/i18n.line';
import { NotificationService } from '../../core/services/notification.service';
import { UiPrefsService } from '../../core/services/ui-prefs.service';
import { ChipComponent } from '../../shared/components/chip/chip.component';
import {
  SelectFieldComponent,
  SelectOption,
} from '../../shared/components/select-field/select-field.component';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { RenameModalComponent } from '../../shared/components/rename-modal/rename-modal.component';
import { LinkRowComponent } from './link-row.component';
import { SetOwnerComponent } from './set-owner.component';
import { Pager } from '../../shared/components/pager/pager';
import { PagerComponent } from '../../shared/components/pager/pager.component';

/** What the line under the "post as" select says: see `postAsStatus`. */
type PostAsStatus = 'ready' | 'offline' | 'unbound' | 'auto' | 'none' | 'login';

// One link set (the prototype's set card): its name and counts, the actions (add a link, paste several,
// schedule with it, delete), the link rows of Facebook groups and pages, the extension that posts the set (under
// the "more options" toggle for a workspace with one extension and no choice, always visible otherwise, with a
// line saying whether that extension can post right now) and, under the toggle, an example of what is written to
// a group with a code. A LINE chat set (channel "line") has the same card with the customers' wording: a channel badge, "import
// from LINE chats" instead of adding or pasting links, the browsers that are logged in to a LINE Official Account in
// the "post as" select (and a note while one is not logged in), rules per customer and an example written with `{{name}}`.
@Component({
  selector: 'app-link-set-card',
  imports: [
    RouterLink,
    PagerComponent,
    LinkRowComponent,
    SetOwnerComponent,
    SelectFieldComponent,
    CheckboxComponent,
    ChipComponent,
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
  /** "Import from LINE chats" was pressed (a chat set only): the page opens its dialog for this set. */
  readonly chats = output<void>();

  private readonly store = inject(LinkSetsStore);
  private readonly accounts = inject(AccountsStore);
  private readonly devices = inject(DevicesStore);
  private readonly workspaces = inject(WorkspaceStore);
  // Looked up when needed: the schedules are only read again after a switch.
  private readonly injector = inject(Injector);
  private readonly prefs = inject(UiPrefsService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  protected readonly nameLimit = LINK_LIMITS.setName;
  protected readonly dailyMaxLimit = LINK_LIMITS.dailyMax;
  protected readonly renameOpen = signal(false);
  /** A set of LINE customer chats (the channel is fixed when the set is created). */
  protected readonly isLine = computed(() => channelOf(this.set()) === 'line');
  /** Importing chats needs the plan; the dialog explains it, the button says why it is off. */
  protected readonly importHint = computed(
    () =>
      this.perm.editHint() ||
      (this.workspaces.lineChatLocked() ? this.t().api.line.chatLockedBody : ''),
  );

  /** The row that was just added: its address field takes the cursor. */
  protected readonly newId = signal<string | null>(null);
  protected readonly pager = new Pager(20);
  protected readonly linkPage = computed(() => this.pager.slice(this.set().links));

  protected readonly meta = computed(() => {
    const stats = this.store.stats()[this.set().id];
    const ts = this.t().ts;
    if (!stats) return '';
    if (this.isLine()) return fmt(this.t().api.line.chatSetMeta, { n: stats.links, m: stats.on });
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

  /** What the "post as" select is for, under it. */
  protected readonly postAsHint = computed(() =>
    this.isLine() ? this.t().api.line.chatPostAsHint : this.t().api.flow.postAsHint,
  );

  /**
   * The extension a set with no choice goes to: the first connected account, in the order the API lists them (its
   * sort order, then its name). A set that names an extension is posted by that browser and no other.
   */
  private readonly firstConnected = computed(() => this.posters()[0]);

  /** The browsers that can post this set: Facebook accounts, or the LINE Official Accounts for a chat set. */
  private readonly posters = computed(() =>
    this.isLine() ? this.accounts.connectedLine() : this.accounts.connected(),
  );

  /**
   * The "post as" row shows in the open part only for a workspace with one extension and no choice; with two or
   * more extensions, or a set that already names one, which browser posts the set must always be visible.
   */
  protected readonly showPostAs = computed(
    () => this.more() || this.posters().length >= 2 || !!this.set().postAsAccountId,
  );

  /**
   * The extensions that can post the set, by the name of their browser ("Shop PC"): the paired ones (the API keeps
   * a Facebook account for each, which is what a set stores), or "automatic" for the first connected one, which
   * says who that is right now.
   */
  protected readonly postAsOptions = computed<SelectOption[]>(() => {
    const flow = this.t().api.flow;
    const devices = this.devices.list();
    const first = this.firstConnected();
    const several = this.posters().length >= 2;
    // With two or more extensions there is no "automatic": the empty option is only the prompt of a set that still
    // has no extension (the API refuses to leave a set without one), and goes away once one is chosen.
    const empty: SelectOption[] =
      several && this.set().postAsAccountId
        ? []
        : [
            {
              value: '',
              label: several
                ? flow.postAsPick
                : first
                  ? fmt(flow.postAsAutoNow, { name: extensionNameOf(first, devices) })
                  : flow.postAsAuto,
            },
          ];
    const options: SelectOption[] = [
      ...empty,
      ...this.posters().map((a) => ({ value: a.id, label: extensionNameOf(a, devices) })),
    ];
    const chosen = this.set().postAsAccountId;
    // An extension that is no longer paired (or gone) stays visible instead of silently showing another one.
    if (chosen && !this.posters().some((a) => a.id === chosen)) {
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

  /**
   * What the person should know about who posts the set, under the select: the chosen extension is ready, offline
   * (its posts wait) or not connected (the set waits and never moves to another extension), or an automatic set
   * says where it goes now that there is a choice. Null when there is nothing to add, and while the accounts or
   * the browsers have not arrived (a pinned set must not flash a warning on load).
   */
  protected readonly postAsStatus = computed<{ kind: PostAsStatus; text: string } | null>(() => {
    const flow = this.t().api.flow;
    const connected = this.posters();
    const chosen = this.set().postAsAccountId;
    if (!chosen) {
      // Several extensions and no choice: the API posts nothing for the set until a person picks one.
      if (connected.length < 2) return null;
      return { kind: 'none', text: flow.postAsNone };
    }
    if (!this.accounts.loaded()) return null;
    if (!connected.some((a) => a.id === chosen))
      return { kind: 'unbound', text: flow.postAsWaiting };
    const device = deviceOfAccount(chosen, this.devices.list());
    if (!device) return null;
    // A chat set also needs the browser to be logged in to LINE Official Account Manager.
    if (this.isLine() && device.line && lineStateOf(device.line, this.devices.now()) === 'login')
      return { kind: 'login', text: this.t().api.line.chatLoginNeeded };
    return device.online
      ? { kind: 'ready', text: flow.postAsReady }
      : { kind: 'offline', text: flow.postAsOffline };
  });

  /** What is written to a group that has a code: the code, the post text, the collection's footer and tags. */
  protected readonly example = computed(() => {
    if (this.isLine()) return this.chatExample();
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

  /** What the first customer of a chat set would get: the example text with their name in it (no code line, no footer). */
  private chatExample() {
    const link = this.set().links.find(isActiveLink);
    if (!link) return null;
    const line = this.t().api.line;
    const name = chatLabel(link, line.chatCustomer);
    return {
      title: fmt(line.chatExample, { name }),
      before: '',
      body: composeChat(line.chatExampleBody, name, link.code.trim(), seededRandom(1)),
      after: '',
    };
  }

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

  /** The groups of a round go out in a random order; the schedules of the set queue their posts again under the rule. */
  protected async setRandomOrder(on: boolean): Promise<void> {
    if (this.perm.readOnly() || on === this.set().randomOrder) return;
    await this.saveRules({ randomOrder: on });
  }

  /** The most posts a day each group of the set may get: a whole number from 0 (no limit) to 50. */
  protected async setDailyPerGroup(event: Event): Promise<void> {
    if (this.perm.readOnly()) return;
    const input = event.target as HTMLInputElement;
    const n = Math.max(0, Math.min(LINK_LIMITS.dailyMax, parseInt(input.value, 10) || 0));
    input.value = String(n);
    if (n === this.set().dailyPerGroup) return;
    await this.saveRules({ dailyPerGroup: n });
  }

  private async saveRules(patch: { randomOrder?: boolean; dailyPerGroup?: number }): Promise<void> {
    if (!(await this.store.updateSet(this.set().id, patch))) return;
    this.notify.success(this.t().api.flow.setRulesSaved);
    void this.injector.get(SchedulesStore).refresh();
  }

  protected async setPostAs(value: string): Promise<void> {
    const next = value || null;
    if (next === this.set().postAsAccountId) return;
    // The API refuses "no extension" while two or more are connected (it would be a guess): keep the current one.
    if (!next && this.posters().length >= 2) return;
    await this.store.setPostAs(this.set().id, next);
  }
}

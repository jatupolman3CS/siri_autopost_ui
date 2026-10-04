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
import { Router } from '@angular/router';
import { AccountsStore } from '../../core/data/accounts.store';
import { LinkSetsStore, firstCodedLink } from '../../core/data/link-sets.store';
import { SocialAccount, accountKind } from '../../core/data/models';
import { PermissionsService } from '../../core/data/permissions.service';
import { PLATFORMS } from '../../core/data/platforms';
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
import { LinkRowComponent } from './link-row.component';

// One link set (the prototype's set card): its name and counts, the actions (add a link, paste several,
// pick from an account, schedule with it, delete), the link rows, and under the "more options" toggle the
// account that posts, an example of what is written to a group with a code and the other accounts.
@Component({
  selector: 'app-link-set-card',
  imports: [LinkRowComponent, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './link-set-card.component.html',
  styleUrl: './link-set-card.component.scss',
})
export class LinkSetCardComponent {
  readonly set = input.required<ApiLinkSet>();
  /** "Paste links" was pressed: the page opens its dialog for this set. */
  readonly bulk = output<void>();
  /** "Pick from my groups" was pressed. */
  readonly importGroups = output<void>();

  private readonly store = inject(LinkSetsStore);
  private readonly accounts = inject(AccountsStore);
  private readonly prefs = inject(UiPrefsService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  protected readonly perm = inject(PermissionsService);
  protected readonly t = inject(I18nService).t;

  /** The row that was just added: its address field takes the cursor. */
  protected readonly newId = signal<string | null>(null);

  protected readonly meta = computed(() => {
    const stats = this.store.stats()[this.set().id];
    const ts = this.t().ts;
    if (!stats) return '';
    return [
      fmt(ts.linksN, { n: stats.links }),
      fmt(ts.onN, { n: stats.on }),
      fmt(ts.codesN, { n: stats.codes }),
      fmt(ts.accountsN, { n: stats.accounts }),
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

  /** Facebook accounts with a paired browser: the only ones that can post a set. */
  private readonly connectedFb = computed(() =>
    this.accounts.list().filter((a) => a.platform === 'fb' && a.connected),
  );
  /** The account that posts: the chosen one, else the first connected one (what the engine does). */
  private readonly postingAccountId = computed(
    () => this.set().postAsAccountId ?? this.connectedFb()[0]?.id ?? null,
  );

  protected readonly postAsOptions = computed<SelectOption[]>(() => {
    const flow = this.t().api.flow;
    const options: SelectOption[] = [
      { value: '', label: flow.postAsAuto },
      ...this.connectedFb().map((a) => ({ value: a.id, label: a.name })),
    ];
    const chosen = this.set().postAsAccountId;
    // An account that is no longer connected (or gone) stays visible instead of silently showing another one.
    if (chosen && !this.connectedFb().some((a) => a.id === chosen)) {
      const a = this.accounts.byId(chosen);
      options.push({ value: chosen, label: a ? this.accountLabel(a) : flow.postAsMissing });
    }
    return options;
  });

  protected readonly otherAccounts = computed(() =>
    this.set().accountIds.map((id) => {
      const a = this.accounts.byId(id);
      return {
        id,
        label: a ? this.accountLabel(a) : this.t().api.flow.postAsMissing,
        icon: a ? PLATFORMS[a.platform].icon : 'ph-user',
      };
    }),
  );

  protected readonly accountOptions = computed<SelectOption[]>(() => {
    const taken = new Set([...this.set().accountIds, this.postingAccountId()]);
    return this.accounts
      .list()
      .filter((a) => !taken.has(a.id))
      .map((a) => ({ value: a.id, label: this.accountLabel(a) }));
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

  protected toggleMore(): void {
    this.store.setMore(this.set().id, !this.more());
  }

  protected async addLink(): Promise<void> {
    try {
      const row = await this.store.addLinkRow(this.set().id);
      this.newId.set(row?.id ?? null);
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

  protected async addAccount(id: string): Promise<void> {
    if (id && (await this.store.addAccount(this.set().id, id)))
      this.notify.success(this.t().ts.added);
  }

  protected async removeAccount(id: string): Promise<void> {
    if (await this.store.removeAccount(this.set().id, id)) this.notify.info(this.t().ts.removed);
  }

  /** "Facebook · Shop PC" as the API names a browser's account; a sample or unbound one says so. */
  private accountLabel(a: SocialAccount): string {
    const platform = PLATFORMS[a.platform].name;
    const base = a.name.startsWith(platform) ? a.name : `${platform} · ${a.name}`;
    const kind = accountKind(a);
    if (kind === 'sample') return `${base} · ${this.t().api.demoAccount}`;
    if (kind === 'unbound') return `${base} · ${this.t().api.unboundAccount}`;
    return base;
  }
}

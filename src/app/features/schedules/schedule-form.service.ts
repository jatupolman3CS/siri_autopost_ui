import { Injectable, computed, inject, signal } from '@angular/core';
import { AccountsStore } from '../../core/data/accounts.store';
import { CollectionsStore } from '../../core/data/collections.store';
import { LinkSetsStore, isActiveLink } from '../../core/data/link-sets.store';
import { PLATFORMS } from '../../core/data/platforms';
import { PostsStore } from '../../core/data/posts.store';
import { SchedulesStore } from '../../core/data/schedules.store';
import { SettingsStore } from '../../core/data/settings.store';
import { linkLabel } from '../../core/flow/group-links';
import {
  PostOrder,
  ScheduleLike,
  ScheduleMode,
  addDays,
  hourChips,
  isTimesMode,
  normalizeTimes,
  overrideKeyOfAccount,
  overrideKeyOfLink,
  overridesFromInput,
  parseDateKey,
  parseTimes,
  slotsOf,
  taskCountPerDay,
  toMinutes,
  utcOffsetMinutes,
} from '../../core/flow/schedule-math';
import { ApiSaveSchedule } from '../../core/http/api.service';
import { fmtDate } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { UiPrefsService } from '../../core/services/ui-prefs.service';

/** Schedule.MaxNameLength: the name input stops here. */
export const SCHEDULE_NAME_MAX = 120;
/** The posting times the "times" chips offer before the person adds their own: 06:00 to 22:00. */
export const CHIP_FROM_HOUR = 6;
export const CHIP_TO_HOUR = 22;

/** One target of a link set: an enabled group with a valid address, or one of the set's other accounts. */
export interface ScheduleMember {
  /** The key of its time override: the link id as 32 hex digits, or `account:<id>`. */
  key: string;
  icon: string;
  name: string;
  /** The group code written before the text (empty: none). */
  code: string;
}

/** What opens the builder with some fields filled: the query of the page (`?collection=&set=&start=`). */
export interface SchedulePrefill {
  collectionId?: string;
  linkSetId?: string;
  /** `yyyy-MM-dd` */
  start?: string;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// The state and the rules of the schedule builder, shared by the builder and its parts (the time picker, the
// per-group times). It is provided by the schedules page, so it lives as long as the page does: closing the
// builder keeps what was typed (as in the design), and only a created schedule starts the form over.
//
// Everything the form shows about "what would this make" is computed from the same helpers the server's rules
// are mirrored in (`core/flow/schedule-math`): the slots of a day, the members of the chosen link set (enabled,
// valid, not a repeated address, then the set's other accounts) and the posts per day with per-group times.
@Injectable()
export class ScheduleFormService {
  private readonly collections = inject(CollectionsStore);
  private readonly linkSets = inject(LinkSetsStore);
  private readonly accounts = inject(AccountsStore);
  private readonly settings = inject(SettingsStore);
  private readonly posts = inject(PostsStore);
  private readonly schedules = inject(SchedulesStore);
  private readonly prefs = inject(UiPrefsService);
  private readonly i18n = inject(I18nService);

  readonly open = signal(false);
  readonly name = signal('');
  readonly collectionId = signal('');
  readonly linkSetId = signal('');
  readonly mode = signal<ScheduleMode>('daily');
  /** Start date (the post date of "once"), `yyyy-MM-dd`; empty = today. */
  readonly start = signal('');
  readonly times = signal<string[]>(['09:00', '18:00']);
  /** The text of the "add another time" box. */
  readonly extra = signal('');
  readonly every = signal(6);
  readonly first = signal('09:00');
  readonly onceTime = signal('14:00');
  readonly order = signal<PostOrder>('shuffle');
  /** What was typed per member (key → "09:30, 19:00"); empty = follows the schedule. */
  readonly overrides = signal<Record<string, string>>({});
  readonly dripFrom = signal('09:00');
  readonly dripTo = signal('21:00');
  readonly dripCount = signal(3);
  readonly bump = signal(0);
  readonly del = signal(0);
  readonly error = signal('');
  /** The "more" section was opened (true) or closed (false) by hand; null follows simple mode. */
  readonly moreOverride = signal<boolean | null>(null);
  /** The hours that went best (null: not asked yet). */
  readonly best = signal<string[] | null>(null);
  readonly saving = signal(false);

  readonly more = computed(() => this.moreOverride() ?? !this.prefs.simple());

  readonly isTimes = computed(() => isTimesMode(this.mode()));
  readonly isInterval = computed(() => this.mode() === 'interval');
  readonly isOnce = computed(() => this.mode() === 'once');
  readonly isDrip = computed(() => this.mode() === 'drip');

  readonly collection = computed(() => this.collections.byId(this.collectionId()));
  readonly set = computed(() => this.linkSets.byId(this.linkSetId()));
  /** Usable posts of the chosen collection (all, or the approved ones when it needs approval). */
  readonly usablePosts = computed(() => {
    const c = this.collection();
    return c ? this.collections.usablePosts(c).length : 0;
  });

  /** The targets of the chosen link set, in the order the server uses them. */
  readonly members = computed<ScheduleMember[]>(() => {
    const set = this.set();
    if (!set) return [];
    const links = set.links
      .filter((l) => isActiveLink(l) && !l.duplicate)
      .map((l) => ({
        key: overrideKeyOfLink(l.id),
        icon: PLATFORMS.fb.icon,
        name: linkLabel(l),
        code: l.code.trim(),
      }));
    const others = set.accountIds.flatMap((id) => {
      const a = this.accounts.byId(id);
      return a
        ? [
            {
              key: overrideKeyOfAccount(id),
              icon: PLATFORMS[a.platform].icon,
              name: `${a.name} · ${a.defaultTarget}`,
              code: '',
            },
          ]
        : [];
    });
    return [...links, ...others];
  });
  readonly codeCount = computed(() => this.members().filter((m) => m.code !== '').length);

  /** The part of the form the slot rules read. */
  readonly like = computed<ScheduleLike>(() => ({
    mode: this.mode(),
    // Once has its own time; the others keep the chosen ones (interval and drip ignore them).
    times: this.isOnce() ? [] : this.times(),
    everyHours: this.every(),
    firstTime: this.first(),
    startDate: this.start(),
    onceTime: this.onceTime(),
    dripFrom: this.dripFrom(),
    dripTo: this.dripTo(),
    dripCount: this.dripCount(),
    overrides: overridesFromInput(this.overrides()).overrides,
  }));
  /** The times of one day. */
  readonly slots = computed(() => slotsOf(this.like()));
  /** Posts per day over every member, with their own times counted. */
  readonly perDay = computed(() =>
    taskCountPerDay(
      this.like(),
      this.members().map((m) => m.key),
    ),
  );
  /** The quick-pick chips: 06:00 to 22:00 and every other time already chosen. */
  readonly chips = computed(() => hourChips(CHIP_FROM_HOUR, CHIP_TO_HOUR, this.times()));

  readonly summary = computed(() => {
    const t = this.i18n.t();
    if (!this.collection() || !this.set() || !this.slots().length) return t.sch.summaryEmpty;
    const n = this.perDay();
    const m = this.members().length;
    if (this.isOnce()) {
      const p = parseDateKey(this.start() || this.posts.todayKey());
      const day = p ? new Date(p[0], p[1] - 1, p[2]) : new Date();
      return fmt(t.sch.summaryOnce, {
        n,
        m,
        d: fmtDate(day, this.i18n.li()),
        t: this.onceTime(),
      });
    }
    const ab = this.settings.ab();
    return fmt(t.sch.summary, { n, m, p: this.usablePosts(), a: ab.min, b: ab.max });
  });

  // ---------- opening ----------

  /** Opens the builder; `prefill` sets the fields it names (a changed link set forgets the per-group times). */
  show(prefill: SchedulePrefill = {}): void {
    this.apply(prefill);
    if (!this.start()) this.start.set(this.posts.todayKey());
    this.error.set('');
    this.open.set(true);
    void this.askBest();
  }

  toggle(): void {
    if (this.open()) {
      this.error.set('');
      this.open.set(false);
    } else this.show();
  }

  close(): void {
    this.error.set('');
    this.open.set(false);
  }

  /** What a created schedule leaves: a blank form for the next one. */
  clear(): void {
    this.name.set('');
    this.collectionId.set('');
    this.linkSetId.set('');
    this.mode.set('daily');
    this.start.set('');
    this.times.set(['09:00', '18:00']);
    this.extra.set('');
    this.every.set(6);
    this.first.set('09:00');
    this.onceTime.set('14:00');
    this.order.set('shuffle');
    this.overrides.set({});
    this.dripFrom.set('09:00');
    this.dripTo.set('21:00');
    this.dripCount.set(3);
    this.bump.set(0);
    this.del.set(0);
    this.error.set('');
    this.open.set(false);
  }

  toggleMore(): void {
    this.moreOverride.set(!this.more());
  }

  private apply(p: SchedulePrefill): void {
    if (p.collectionId !== undefined) {
      this.collectionId.set(p.collectionId);
      this.error.set('');
    }
    if (p.linkSetId !== undefined) this.pickSet(p.linkSetId);
    if (p.start && parseDateKey(p.start)) this.start.set(p.start);
  }

  // ---------- fields ----------

  pickCollection(id: string): void {
    this.collectionId.set(id);
    this.error.set('');
  }

  /** A new link set has other groups: the times typed for the old ones mean nothing. */
  pickSet(id: string): void {
    if (id !== this.linkSetId()) this.overrides.set({});
    this.linkSetId.set(id);
    this.error.set('');
  }

  pickMode(mode: string): void {
    this.mode.set(mode as ScheduleMode);
    this.error.set('');
  }

  toggleTime(time: string): void {
    const now = this.times();
    this.times.set(
      now.includes(time) ? now.filter((x) => x !== time) : normalizeTimes([...now, time]),
    );
    this.error.set('');
  }

  /** Adds the times typed in the "another time" box (`9:30`, `09.30`, several with commas). */
  addTime(): void {
    const parsed = parseTimes(this.extra());
    if (!parsed.times.length || parsed.bad) {
      this.error.set(this.i18n.t().sch.errTime);
      return;
    }
    this.times.set(normalizeTimes([...this.times(), ...parsed.times]));
    this.extra.set('');
    this.error.set('');
  }

  useBest(): void {
    const best = this.best() ?? [];
    if (!best.length) return;
    this.times.set(best);
    this.error.set('');
  }

  setEvery(raw: string): void {
    this.every.set(clamp(parseInt(raw, 10) || 1, 1, 24));
  }

  setDripCount(raw: string): void {
    this.dripCount.set(clamp(parseInt(raw, 10) || 1, 1, 12));
  }

  setOverride(key: string, text: string): void {
    this.overrides.update((o) => ({ ...o, [key]: text }));
    this.error.set('');
  }

  /** The best hours of the last 30 days, asked once per page visit. */
  async askBest(): Promise<void> {
    if (this.best() !== null) return;
    this.best.set([]);
    this.best.set(await this.schedules.bestTimes());
  }

  // ---------- creating ----------

  /**
   * The request the form makes, or null with `error` set to what is missing: a collection with something to
   * post, a link set with somewhere to post, and a time. The API checks the same again; this saves the trip.
   */
  build(): ApiSaveSchedule | null {
    const t = this.i18n.t();
    const mode = this.mode();
    const times =
      mode === 'once'
        ? normalizeTimes([this.onceTime()])
        : mode === 'interval'
          ? normalizeTimes([this.first()])
          : mode === 'drip'
            ? this.slots()
            : normalizeTimes(this.times());
    const collection = this.collection();
    const set = this.set();
    if (!collection || !set || !times.length) return this.fail(t.sch.errForm);
    const overrides = overridesFromInput(this.overrides());
    if (overrides.bad) return this.fail(t.sch.errTime);
    if (this.usablePosts() === 0) {
      return this.fail(
        collection.settings.requireApproval && collection.posts.length
          ? t.api.flow.schNoApproved
          : t.api.flow.schNoPosts,
      );
    }
    if (!this.members().length) return this.fail(t.api.flow.schNoTargets);
    const start = this.start();
    if (start) {
      const today = this.posts.todayKey();
      if (start < addDays(today, -1) || start > addDays(today, 366))
        return this.fail(t.api.flow.schBadDate);
    }
    this.error.set('');
    return {
      name: this.name().trim() || null,
      collectionId: collection.id,
      linkSetId: set.id,
      mode,
      times,
      everyHours: clamp(this.every(), 1, 24),
      firstTime: toMinutes(this.first()) === null ? null : this.first(),
      startDate: this.start() || null,
      onceTime: toMinutes(this.onceTime()) === null ? null : this.onceTime(),
      order: this.order(),
      dripFrom: toMinutes(this.dripFrom()) === null ? null : this.dripFrom(),
      dripTo: toMinutes(this.dripTo()) === null ? null : this.dripTo(),
      dripCount: clamp(this.dripCount(), 1, 12),
      bumpHours: this.bump(),
      autoDeleteDays: this.del(),
      overrides: overrides.overrides,
      utcOffsetMinutes: utcOffsetMinutes(),
    };
  }

  private fail(message: string): null {
    this.error.set(message);
    return null;
  }
}

import { Injectable, computed, inject, signal } from '@angular/core';
import { normalizeGroupUrl } from '../flow/group-links';
import { ApiReport, ApiReportGroup, ApiReportShare, ApiService } from '../http/api.service';
import { LinkSetsStore } from './link-sets.store';
import { loadWithRetry } from './loading';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

export type ReportDays = 7 | 30;
type ApiReportPost = ApiReport['posts'][number];
/** The period of a shared report: the last 7 days or the last 30 days. */
export type SharePeriod = 'week' | 'month';
/** How many of the most used posts the page lists (the design's 8). */
export const REPORT_TOP_POSTS = 8;
/** A visit older than this reads the numbers again. */
const FRESH_MS = 30_000;
/** How long the brand name of a client report can be (Domain `ReportShare.MaxBrandLength`). */
export const BRAND_MAX = 120;

/** The posts most used first (the API sorts them, this keeps the page right whatever order it gets). */
export function topPosts(
  posts: readonly ApiReportPost[],
  limit = REPORT_TOP_POSTS,
): ApiReportPost[] {
  return [...posts].sort((a, b) => b.used - a.used).slice(0, limit);
}

/** Colour of a success rate bar: green from 90, amber from 70, else red (the design's thresholds). */
export function rateColor(rate: number): string {
  return rate >= 90
    ? 'var(--color-success)'
    : rate >= 70
      ? 'var(--color-warning)'
      : 'var(--color-danger)';
}

/** A group's row is "off": switched off by hand or by the engine. */
export const isGroupOff = (g: Pick<ApiReportGroup, 'enabled' | 'health'>): boolean =>
  !g.enabled || g.health === 'off';

/** Whether "disable" can do something for a group: it has a link or an address, and it is not off already. */
export const canDisableGroup = (g: ApiReportGroup): boolean =>
  (g.linkId !== null || normalizeGroupUrl(g.url) !== '') && !isGroupOff(g);

// The report of the current workspace: how the groups and the posts did over the last 7 or 30 days, and (Agency)
// the shareable copy for a client. Reading is for every role and plan; the numbers are real posts of paired
// accounts only (no test posts, no sample accounts) and carry no likes or comments, because none are collected.
// The page asks again when it is entered (`ensureFresh`) and whenever the period changes.
@Injectable({ providedIn: 'root' })
export class ReportsStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);
  private readonly linkSets = inject(LinkSetsStore);

  readonly days = signal<ReportDays>(7);
  readonly report = signal<ApiReport | null>(null);
  /** The report of the chosen period has arrived (the page shows "—" until then). */
  readonly loaded = signal(false);
  /** The last read gave up (a refusal, or a server that stayed down). */
  readonly failed = signal(false);
  /** The link of the last client report made in this session. */
  readonly lastShare = signal<ApiReportShare | null>(null);

  readonly groups = computed(() => this.report()?.groups ?? []);
  readonly posts = computed(() => topPosts(this.report()?.posts ?? []));
  /** Totals over the groups, for the shared page's summary tiles. */
  readonly totals = computed(() => totalsOf(this.groups()));
  /** The owner's plan includes client reports (Agency). */
  readonly canShare = computed(() => !!this.ws.current()?.clientReports);

  private seq = 0;
  private loadedAt = 0;

  constructor() {
    whenWorkspaceChanges((id) => {
      this.seq++;
      this.report.set(null);
      this.loaded.set(false);
      this.failed.set(false);
      this.lastShare.set(null);
      this.loadedAt = 0;
      if (id) void this.load();
    });
  }

  /** Switches the period and reads it. */
  setDays(days: ReportDays): void {
    if (days === this.days()) return;
    this.days.set(days);
    this.report.set(null);
    this.loaded.set(false);
    void this.load();
  }

  /** Reads the report of the chosen period (transient failures are retried; it never throws). */
  async load(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    const days = this.days();
    const seq = ++this.seq;
    const current = () => seq === this.seq && this.ws.id() === wsId;
    this.failed.set(false);
    this.loadedAt = Date.now();
    const ok = await loadWithRetry(async () => {
      const r = await this.api.report(wsId, days);
      if (current()) this.report.set(r);
    }, current);
    if (!current()) return;
    if (ok) this.loaded.set(true);
    else this.failed.set(true);
  }

  /** Reads again when the numbers on screen are older than half a minute (or never arrived). */
  ensureFresh(): void {
    if (Date.now() - this.loadedAt > FRESH_MS) void this.load();
  }

  /**
   * Switches a group off: every link with the group's address (the same group can sit in several sets) is set to
   * disabled. The links are read fresh first, so a row edited on the link sets page is not overwritten with an
   * old copy. Resolves to how many links were switched off (0 = none found, or the API refused).
   */
  async disableGroup(group: ApiReportGroup): Promise<number> {
    const wsId = this.ws.id();
    if (!wsId) return 0;
    const url = normalizeGroupUrl(group.url);
    let count = 0;
    try {
      const sets = await this.api.linkSets(wsId);
      for (const set of sets)
        for (const link of set.links) {
          const same =
            link.id === group.linkId || (url !== '' && normalizeGroupUrl(link.url) === url);
          if (!same || !link.enabled) continue;
          await this.api.updateLink(wsId, set.id, link.id, {
            name: link.name,
            url: link.url,
            code: link.code,
            dailyMax: link.dailyMax,
            enabled: false,
          });
          count++;
        }
    } catch {
      // The error interceptor has shown why; what was switched off before the failure stays off.
    }
    if (this.ws.id() === wsId) {
      void this.linkSets.refresh();
      void this.load();
    }
    return count;
  }

  /** Makes the shareable copy of the report (Agency, admin). The API refuses (and says why) otherwise. */
  async share(brand: string, period: SharePeriod, logo: boolean): Promise<ApiReportShare> {
    const wsId = this.ws.id();
    if (!wsId) throw new Error('no workspace');
    const share = await this.api.shareReport(wsId, { brand: brand.trim(), period, logo });
    if (this.ws.id() === wsId) this.lastShare.set(share);
    return share;
  }
}

export interface ReportTotals {
  posted: number;
  pending: number;
  failed: number;
  /** round(posted / (posted + failed)), 100 when nothing finished: the server's rate over all groups. */
  rate: number;
}

export function totalsOf(groups: readonly ApiReportGroup[]): ReportTotals {
  const posted = groups.reduce((n, g) => n + g.posted, 0);
  const pending = groups.reduce((n, g) => n + g.pending, 0);
  const failed = groups.reduce((n, g) => n + g.failed, 0);
  const done = posted + failed;
  return { posted, pending, failed, rate: done === 0 ? 100 : Math.round((posted / done) * 100) };
}

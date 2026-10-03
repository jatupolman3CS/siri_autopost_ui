import { Injectable, computed, inject } from '@angular/core';
import { dayNames, dkey, fmtDate, hm } from '../i18n/format';
import { Dict, I18nService } from '../i18n/i18n.service';
import { AccountsStore } from './accounts.store';
import { HEALTH_DOT, accountKind } from './models';
import { PostsStore, QueueItem, postRow } from './posts.store';
import { PLATFORMS } from './platforms';

const DAY_MS = 864e5;

export interface Kpi {
  label: string;
  value: string | number;
  note: string;
}

/**
 * Success/failure counts of the 7 days before now, and today's remaining queue. Until the posts have
 * arrived (`ready` false) every value is "—", and so is the rate when nothing was sent or failed.
 */
export function kpisOf(
  items: QueueItem[],
  today: QueueItem[],
  now: Date,
  t: Dict,
  ready = true,
): Kpi[] {
  const to = now.getTime();
  const from = to - 7 * DAY_MS;
  const in7 = items.filter((p) => p.dt.getTime() >= from && p.dt.getTime() <= to);
  const ok = in7.filter((p) => p.status === 'success').length;
  const fail = in7.filter((p) => p.status === 'failed').length;
  const rate = ok + fail ? `${Math.round((ok / (ok + fail)) * 1000) / 10}%` : '—';
  const queued = today.filter((p) => p.status === 'queued' || p.status === 'waiting').length;
  const val = (v: string | number) => (ready ? v : '—');
  return [
    { label: t.ov.kSuccess, value: val(ok), note: t.ov.last7 },
    { label: t.ov.kFailed, value: val(fail), note: t.ov.last7 },
    { label: t.ov.kRate, value: val(rate), note: t.ov.target },
    { label: t.ov.kQueued, value: val(queued), note: t.ov.remaining },
  ];
}

/** Today's queue: two finished posts before the first live one, eight rows in all. */
export function queueRowsOf(today: QueueItem[], t: Dict) {
  const firstLive = today.findIndex((p) => ['posting', 'queued', 'waiting'].includes(p.status));
  const start = Math.max(0, (firstLive < 0 ? today.length : firstLive) - 2);
  return today.slice(start, start + 8).map((p) => postRow(p, t));
}

// Figures shown on the overview, derived from the posts and accounts stores.
// The landing page preview uses kpisOf/queueRowsOf on sample posts instead.
@Injectable({ providedIn: 'root' })
export class DashboardStatsService {
  private readonly posts = inject(PostsStore);
  private readonly accounts = inject(AccountsStore);
  private readonly i18n = inject(I18nService);

  /** The posts of the workspace have arrived: until then the figures read "—", not 0 or 100%. */
  readonly ready = this.posts.loaded;

  readonly kpis = computed<Kpi[]>(() =>
    kpisOf(this.posts.items(), this.posts.today(), this.posts.now(), this.i18n.t(), this.ready()),
  );

  readonly queueRows = computed(() => queueRowsOf(this.posts.today(), this.i18n.t()));

  readonly nextInMin = computed(() => {
    const nxt = this.posts.next();
    return nxt
      ? Math.max(1, Math.round((nxt.dt.getTime() - this.posts.now().getTime()) / 60000))
      : null;
  });

  /** Posts per day for the last 7 days, failures stacked on top. */
  readonly trend = computed(() => {
    const li = this.i18n.li();
    const raw = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(this.posts.now().getTime() - i * DAY_MS);
      const list = this.posts.byDay().get(dkey(d)) ?? [];
      const ok = list.filter((p) => p.status === 'success').length;
      const fail = list.filter((p) => p.status === 'failed').length;
      raw.push({ d, ok, fail, total: ok + fail });
    }
    const max = Math.max(1, ...raw.map((x) => x.total));
    return raw.map((x) => ({
      total: x.total,
      h: Math.max(6, Math.round((x.total / max) * 100)),
      failPct: x.total ? Math.round((x.fail / x.total) * 100) : 0,
      okRadius: x.fail ? '0' : '4px 4px 0 0',
      label: dayNames(li)[x.d.getDay()],
    }));
  });

  readonly accountRows = computed(() => {
    const t = this.i18n.t();
    return this.accounts.list().map((a) => {
      const kind = accountKind(a);
      return {
        icon: PLATFORMS[a.platform].icon,
        name: a.name,
        handle: a.handle,
        /** "Sample" for a new workspace's demo accounts, "Unbound" for one whose browser was unpaired. */
        badge:
          kind === 'sample' ? t.api.demoAccount : kind === 'unbound' ? t.api.unboundAccount : '',
        badgeHint: kind === 'sample' ? t.api.demoHint : kind === 'unbound' ? t.api.unboundHint : '',
        dot: HEALTH_DOT[a.health],
        healthLabel: t.health[a.health],
      };
    });
  });

  readonly recentErrors = computed(() => {
    const { li, t } = { li: this.i18n.li(), t: this.i18n.t() };
    return [...this.posts.openErrors()]
      .sort((a, b) => b.dt.getTime() - a.dt.getTime())
      .slice(0, 2)
      .map((e) => ({
        title: t.reasons[e.code].title,
        meta: `${fmtDate(e.dt, li)} ${hm(e.dt)} · ${PLATFORMS[e.platform].name} · ${e.target}`,
      }));
  });
}

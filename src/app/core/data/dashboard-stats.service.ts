import { Injectable, computed, inject } from '@angular/core';
import { dayNames, dkey, fmtDate, hm } from '../i18n/format';
import { Dict, I18nService, ago } from '../i18n/i18n.service';
import '../i18n/i18n.flow';
import { DevicesStore, autoPauseOf } from './devices.store';
import { PostsStore, QueueItem, postRow } from './posts.store';
import { PLATFORMS } from './platforms';

const DAY_MS = 864e5;

export interface Kpi {
  label: string;
  value: string | number;
  note: string;
}

/** How a paired browser stands: ready, not reachable, paused from the web, or paused by the engine. */
export type ExtensionState = 'online' | 'offline' | 'paused' | 'auto';

const EXTENSION_DOT: Record<ExtensionState, string> = {
  online: 'var(--color-success)',
  offline: 'var(--color-danger)',
  paused: 'var(--color-warning)',
  auto: 'var(--color-warning)',
};

/** One paired browser in the overview's extensions panel. */
export interface ExtensionRow {
  id: string;
  name: string;
  state: ExtensionState;
  dot: string;
  stateLabel: string;
  meta: string;
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

// Figures shown on the overview, derived from the posts and devices stores.
// The landing page preview uses kpisOf/queueRowsOf on sample posts instead.
@Injectable({ providedIn: 'root' })
export class DashboardStatsService {
  private readonly posts = inject(PostsStore);
  private readonly devices = inject(DevicesStore);
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

  /** The paired browsers have arrived: until then the extensions panel says it is loading. */
  readonly extensionsReady = this.devices.loaded;

  /**
   * The paired browsers (extensions) of the workspace for the overview panel: its name, whether it is online,
   * paused or switched off by the engine, and when it was last seen. Real devices only: a workspace without
   * one gets an empty list, and the panel says how to add one.
   */
  readonly extensionRows = computed<ExtensionRow[]>(() => {
    const t = this.i18n.t();
    const f = t.api.flow;
    const now = this.devices.now();
    return this.devices.list().map((d) => {
      const state: ExtensionState = !d.online
        ? 'offline'
        : autoPauseOf(d, now)
          ? 'auto'
          : d.jobsPaused
            ? 'paused'
            : 'online';
      const seen = d.lastSeenAt ? new Date(d.lastSeenAt) : null;
      return {
        id: d.id,
        name: d.name,
        state,
        dot: EXTENSION_DOT[state],
        stateLabel: {
          online: t.api.deviceOnline,
          offline: f.ovExtOffline,
          paused: f.ovExtPaused,
          auto: f.ovExtAuto,
        }[state],
        /** "Chrome · last seen 5 min ago" (a browser that is reachable is simply "Chrome"). */
        meta: [
          d.browser,
          state !== 'offline' ? '' : seen ? `${f.ovExtSeen} ${ago(t, seen)}` : t.api.deviceNever,
        ]
          .filter(Boolean)
          .join(' · '),
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

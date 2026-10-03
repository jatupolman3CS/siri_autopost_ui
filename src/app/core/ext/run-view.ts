import { Dict, fmt } from '../i18n/i18n.service';
import type { CampaignRun, RunState } from '../data/campaigns.store';
import {
  Campaign,
  activeGroups,
  campaignProblem,
  fmtDateTime,
  fmtDuration,
  normalizeGroupUrl,
  usablePosts,
} from './lib/shared.js';

// Status lines of the extension's settings page (client/dashboard.js campaignView/campaignMeta),
// built from the state the device reports.

export type RunClass = 'off' | 'busy' | 'on' | 'done';

export interface CampaignView {
  cls: RunClass;
  label: string;
  run: CampaignRun | undefined;
  problem: string;
}

type ExtDict = Dict['api']['ext'];

export function campaignView(x: ExtDict, c: Campaign, state: RunState): CampaignView {
  const run = (state.campaigns ?? {})[c.id];
  const problem = campaignProblem(c);
  if (!c.enabled) return { cls: 'off', label: x.stOff, run, problem };
  if (state.current && state.current.campaignId === c.id)
    return { cls: 'busy', label: x.stPosting, run, problem };
  if (!state.running)
    return { cls: 'off', label: problem ? x.stNotReady : x.stReady, run, problem };
  if (!run) return { cls: 'off', label: problem ? x.stNotReady : x.stWaitStart, run, problem };
  if (run.finished) return { cls: 'done', label: x.stDone, run, problem };
  const kinds = x.kinds as Record<string, string>;
  return { cls: 'on', label: kinds[run.nextKind ?? ''] ?? x.stWaiting, run, problem };
}

export function campaignMeta(
  x: ExtDict,
  c: Campaign,
  v: CampaignView,
  state: RunState,
  now = Date.now(),
): string {
  const parts: string[] = [];
  if (v.run?.round) {
    const total = (v.run.queue ?? []).length;
    parts.push(
      fmt(x.metaRound, { n: v.run.round }),
      fmt(x.metaGroupPos, { pos: Math.min(v.run.pos ?? 0, total), total }),
    );
  } else {
    parts.push(
      fmt(x.metaGroups, { n: activeGroups(c).length }),
      fmt(x.metaPosts, { n: usablePosts(c.posts).length }),
    );
  }
  const r = v.run;
  if (state.running && c.enabled && r?.nextAt && !r.busy && !r.finished) {
    parts.push(fmt(x.metaNext, { at: fmtDateTime(r.nextAt), left: fmtDuration(r.nextAt - now) }));
  }
  if (r?.stats) {
    parts.push(
      fmt(x.metaStats, { ok: r.stats.ok ?? 0, fail: r.stats.fail ?? 0, skip: r.stats.skip ?? 0 }),
    );
  }
  if (v.problem && c.enabled) parts.push(`⚠ ${v.problem}`);
  return parts.join(' · ');
}

/** "วันนี้โพสต์แล้ว 3 / 30 โพสต์" and the automatic pause, if any. */
export function guardLine(x: ExtDict, state: RunState, dailyMax: number, now = new Date()): string {
  const parts: string[] = [];
  const d = state.daily ?? {};
  const key = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const count = d.date === key ? (d.count ?? 0) : 0;
  // Today's rolled limit only while it belongs to the current setting.
  const cap = !dailyMax ? 0 : d.date === key && d.cap && d.base === dailyMax ? d.cap : dailyMax;
  parts.push(cap ? fmt(x.todayCap, { n: count, cap }) : fmt(x.todayNoCap, { n: count }));
  if (state.pausedUntil && state.pausedUntil > now.getTime()) {
    parts.push(
      fmt(x.pausedAll, {
        at: fmtDateTime(state.pausedUntil),
        left: fmtDuration(state.pausedUntil - now.getTime()),
        why: state.pauseReason || '-',
      }),
    );
  }
  return parts.join(' · ');
}

/** Posts in this group within the last 24 hours (for "โพสต์ได้ N /วัน"). */
export function usedToday(state: RunState, url: string, now = Date.now()): number {
  const u = normalizeGroupUrl(url);
  if (!u) return 0;
  return ((state.groupPostTimes ?? {})[u] ?? []).filter((t) => now - t < 24 * 3600000).length;
}

/** A group's address as a short label: "group 123" (`word` is "group" in the page's language). */
export const shortGroup = (url: string, word: string) =>
  String(url).replace('https://www.facebook.com/groups/', `${word} `).replace(/\/$/, '');

import { dkey } from '../i18n/format';
import { L10n, PostItem, PostStatus } from './models';
import { SEED } from './seed.data';

// Sample posts from the design handoff, for screens that have no workspace data behind them:
// the landing page preview (guests) and the platform-admin mock.
export const CONTENTS: L10n[] = SEED.posts.map((p) => p.text);

/**
 * The design prototype's deterministic generator: ~4-8 posts a day from 19 days ago to
 * 5 weeks ahead, 16 today, and one post going out right now. Text and target are in `li`.
 */
export function samplePosts(now: Date, li: number): PostItem[] {
  let seed = 20261003;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const todayKey = dkey(now);
  const posts: PostItem[] = [];
  let id = 1;
  const item = (dt: Date, tg: (typeof SEED.targets)[number], cidx: number, status: PostStatus) =>
    posts.push({
      id: 'p' + id++,
      dt,
      accountId: tg.a,
      platform: tg.p,
      target: tg.t[li],
      text: CONTENTS[cidx][li],
      mediaIds: [],
      status,
      code: null,
    });
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 19);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 35);
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const isToday = dkey(d) === todayKey;
    const n = isToday ? 16 : d.getDay() === 0 ? 2 : 4 + Math.floor(rnd() * 5);
    const span = 13 * 60;
    for (let i = 0; i < n; i++) {
      const m = 8 * 60 + Math.floor((span * (i + 0.2 + rnd() * 0.6)) / n);
      const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(m / 60), m % 60);
      const tg = SEED.targets[Math.floor(rnd() * SEED.targets.length)];
      const diff = (dt.getTime() - now.getTime()) / 60000;
      const status: PostStatus = diff < -3 ? (rnd() < 0.04 ? 'skipped' : 'success') : 'queued';
      item(dt, tg, Math.floor(rnd() * CONTENTS.length), status);
    }
  }
  item(new Date(now.getTime() - 3 * 60000), SEED.targets[0], 0, 'posting');
  return posts.sort((a, b) => a.dt.getTime() - b.dt.getTime());
}

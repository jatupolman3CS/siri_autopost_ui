import { Injectable, computed, signal } from '@angular/core';
import { dkey, hm } from '../i18n/format';
import { Dict } from '../i18n/i18n.service';
import { CLOCK, seedDate } from './clock';
import { ErrorItem, Health, L10n, PostItem, PostStatus, STATUS_DOT } from './models';
import { SEED } from './seed.data';

export const CONTENTS: L10n[] = SEED.posts.map((p) => p.text);

/** What a queue/list row shows for one post. */
export interface PostRow {
  id: string;
  time: string;
  icon: string;
  platformName: string;
  text: string;
  target: string;
  dot: string;
  statusLabel: string;
}

/** A post or an error report as one calendar/queue item. */
export interface QueueItem extends PostItem {
  key: string;
  time: string;
}

// Posting tasks (queue, history) and failed tasks. In-memory for now, seeded from the
// design handoff; the shape mirrors what the posting API will return.
@Injectable({ providedIn: 'root' })
export class PostsStore {
  readonly now = CLOCK.now;
  readonly todayKey = dkey(CLOCK.now);

  private readonly _posts = signal<PostItem[]>(generatePosts());
  private readonly _errors = signal<ErrorItem[]>(
    SEED.failed.map((f) => ({ ...f, dt: seedDate(f.dt), status: 'failed' as PostStatus })),
  );
  private readonly _accHealth = signal<Record<string, Health>>({});

  readonly posts = this._posts.asReadonly();
  readonly errors = this._errors.asReadonly();
  readonly openErrors = computed(() => this._errors().filter((e) => e.code !== 'pending_approval'));

  /** Posts and error reports together, each with its day key and HH:MM. */
  readonly items = computed<QueueItem[]>(() =>
    this._posts()
      .map((p) => ({ ...p, key: dkey(p.dt), time: hm(p.dt) }))
      .concat(
        this._errors().map((e) => ({
          ...e,
          status: (e.code === 'pending_approval' ? 'pending' : 'failed') as PostStatus,
          key: dkey(e.dt),
          time: hm(e.dt),
        })),
      ),
  );

  readonly byDay = computed(() => {
    const map = new Map<string, QueueItem[]>();
    for (const p of this.items()) {
      const list = map.get(p.key) ?? [];
      list.push(p);
      map.set(p.key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.dt.getTime() - b.dt.getTime());
    return map;
  });

  readonly today = computed(() => this.byDay().get(this.todayKey) ?? []);
  readonly waiting = computed(() =>
    this._posts()
      .filter((p) => p.status === 'waiting')
      .sort((a, b) => a.dt.getTime() - b.dt.getTime()),
  );
  /** Next queued post after now. */
  readonly next = computed(() =>
    this.today().find((p) => p.status === 'queued' && p.dt > this.now),
  );

  text(p: PostItem, li: number): string {
    return p.text !== undefined ? p.text : CONTENTS[p.cidx ?? 0][li];
  }

  row(p: PostItem, li: number, t: Dict): PostRow {
    const platform = SEED.platforms[p.platform];
    return {
      id: p.id,
      time: hm(p.dt),
      icon: platform.icon,
      platformName: platform.name,
      text: this.text(p, li),
      target: p.target[li],
      dot: STATUS_DOT[p.status],
      statusLabel: t.status[p.status],
    };
  }

  health(accountId: string): Health {
    return (
      this._accHealth()[accountId] ?? SEED.accounts.find((a) => a.id === accountId)?.health ?? 'ok'
    );
  }

  add(list: PostItem[]): void {
    this._posts.update((ps) => sortByDate([...ps, ...list]));
  }

  remove(id: string): void {
    this._posts.update((ps) => ps.filter((p) => p.id !== id));
  }

  setStatuses(fn: (p: PostItem) => PostStatus): void {
    this._posts.update((ps) => ps.map((p) => ({ ...p, status: fn(p) })));
  }

  /** Puts a failed post back in the queue, 15 minutes from now. */
  retryError(id: string): void {
    const e = this._errors().find((x) => x.id === id);
    if (!e) return;
    const dt = new Date(this.now.getTime() + 15 * 60000);
    this._errors.update((es) => es.filter((x) => x.id !== id));
    this.add([
      {
        id: 'r' + id,
        dt,
        accountId: e.accountId,
        platform: e.platform,
        target: e.target,
        cidx: e.cidx,
        status: 'queued',
      },
    ]);
  }

  skipError(id: string): void {
    this._errors.update((es) => es.filter((x) => x.id !== id));
  }

  markHealthy(accountId: string): void {
    this._accHealth.update((h) => ({ ...h, [accountId]: 'ok' }));
  }
}

function sortByDate<T extends { dt: Date }>(list: T[]): T[] {
  return list.sort((a, b) => a.dt.getTime() - b.dt.getTime());
}

// Same deterministic generator as the design prototype: ~4-8 posts a day from 19 days ago
// to 5 weeks ahead, 16 today, and one post going out right now.
function generatePosts(): PostItem[] {
  let seed = 20261003;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const now = CLOCK.now;
  const todayKey = dkey(now);
  const posts: PostItem[] = [];
  let id = 1;
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
      posts.push({
        id: 'p' + id++,
        dt,
        accountId: tg.a,
        platform: tg.p,
        target: tg.t,
        cidx: Math.floor(rnd() * CONTENTS.length),
        status,
      });
    }
  }
  posts.push({
    id: 'p' + id++,
    dt: new Date(now.getTime() - 3 * 60000),
    accountId: 'a1',
    platform: 'fb',
    target: ['ขายของบ้านและสวน', 'ขายของบ้านและสวน'],
    cidx: 0,
    status: 'posting',
  });
  return sortByDate(posts);
}

import { PostItem, PostStatus } from '../../core/data/models';

/**
 * The status light of one post: green went out, yellow is on its way (waiting for its time, being posted, held
 * for the group's approval or for the browser), red failed, grey was left out. The timeline, the schedule dots and
 * the post window all read it from here.
 */
export type PostLight = 'green' | 'yellow' | 'red' | 'grey';

export const LIGHT_OF: Record<PostStatus, PostLight> = {
  success: 'green',
  queued: 'yellow',
  posting: 'yellow',
  pending: 'yellow',
  waiting: 'yellow',
  failed: 'red',
  skipped: 'grey',
};

export const LIGHT_COLOR: Record<PostLight, string> = {
  green: 'var(--color-success)',
  yellow: 'var(--color-warning)',
  red: 'var(--color-danger)',
  grey: 'var(--color-text-muted)',
};

export const LIGHTS: readonly PostLight[] = ['green', 'yellow', 'red', 'grey'];

/** Statuses that "post now" (or the manual rerun of a failed post) accepts; the server refuses the others. */
const RUNNABLE: readonly PostStatus[] = ['queued', 'waiting', 'failed', 'skipped'];

export function lightOf(p: Pick<PostItem, 'status'>): PostLight {
  return LIGHT_OF[p.status];
}

/** The post can be sent now: it has not gone out, is not being posted and is not waiting for a group admin. */
export function canRunNow(p: Pick<PostItem, 'status'>): boolean {
  return RUNNABLE.includes(p.status);
}

/** A queued post whose time has passed and that no browser has taken yet (a paused or offline browser, the anti-ban gap). */
export function isOverdue(p: Pick<PostItem, 'status' | 'dt'>, now: Date): boolean {
  return p.status === 'queued' && p.dt.getTime() < now.getTime() - 60_000;
}

/** How many posts of a list show each light. */
export function lightCounts(list: readonly Pick<PostItem, 'status'>[]): Record<PostLight, number> {
  const out: Record<PostLight, number> = { green: 0, yellow: 0, red: 0, grey: 0 };
  for (const p of list) out[lightOf(p)]++;
  return out;
}

import { ApiBilling } from '../http/api.service';
import { LimitKey } from './models';

/** How full one of the plan's numbers is. */
export type UsageState = 'ok' | 'near' | 'full' | 'over' | 'unlimited';

export interface UsageView {
  used: number;
  /** null (or 0) = unlimited. */
  limit: number | null;
  state: UsageState;
  /** 0-100, for a bar: an unlimited number fills it (its colour says nothing is capped). */
  pct: number;
  /** "12 / 50", or "12 / Unlimited" with the word the caller gives. */
  text: string;
}

/** From this share of the limit the number is "near" it (a warning colour). */
export const NEAR_LIMIT = 0.8;

/**
 * "n / limit" of one of the plan's numbers (a null or 0 limit is unlimited). `full` is at the limit (the next
 * add is refused by the server with a 422), `over` above it (a plan that was lowered, or an admin's override).
 */
export function usageOf(
  used: number,
  limit: number | null | undefined,
  unlimited: string,
): UsageView {
  const max = limit ? limit : null;
  if (max === null)
    return { used, limit: null, state: 'unlimited', pct: 100, text: `${used} / ${unlimited}` };
  const ratio = used / max;
  const state: UsageState =
    used > max ? 'over' : used === max ? 'full' : ratio >= NEAR_LIMIT ? 'near' : 'ok';
  return {
    used,
    limit: max,
    state,
    pct: Math.min(100, Math.round(ratio * 100)),
    text: `${used} / ${max}`,
  };
}

/** Whether one more may be added: the limit is not reached yet. */
export const hasRoom = (v: UsageView): boolean => v.state !== 'full' && v.state !== 'over';

/** Colour of a usage bar. */
export const USAGE_COLOR: Record<UsageState, string> = {
  unlimited: 'var(--color-border)',
  ok: 'var(--color-primary)',
  near: 'var(--color-warning)',
  full: 'var(--color-warning)',
  over: 'var(--color-danger)',
};

/** The usage bars of the billing page, in their order: the number it limits and where its count is in `UsageDto`. */
export const USAGE_ROWS: readonly { key: LimitKey; used: keyof ApiBilling['usage'] }[] = [
  { key: 'groups', used: 'groups' },
  { key: 'images', used: 'images' },
  { key: 'libraryPosts', used: 'libraryPosts' },
  { key: 'posts', used: 'postsLast24h' },
  { key: 'devices', used: 'devices' },
  { key: 'accounts', used: 'accounts' },
];

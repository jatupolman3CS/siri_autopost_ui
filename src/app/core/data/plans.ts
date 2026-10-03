import { baht } from '../i18n/format';
import { Dict, fmt } from '../i18n/i18n.service';
import { PLAN_ORDER, PlanKey, PlanLimits } from './models';

/**
 * The design's plan limits and prices, shown until /api/plans answers (the API's values replace them).
 * null is unlimited.
 */
export const DESIGN_PLANS: Record<PlanKey, PlanLimits> = {
  free: { accounts: 1, posts: 10, devices: 1, seats: 1, price: 0 },
  basic: { accounts: 2, posts: 30, devices: 1, seats: 1, price: 290 },
  pro: { accounts: 10, posts: null, devices: 3, seats: 1, price: 790 },
  agency: { accounts: null, posts: null, devices: null, seats: 10, price: 1990 },
};

export interface TierView {
  k: PlanKey;
  name: string;
  tag: string;
  price: string;
  per: string;
  billed: string;
  features: readonly string[];
}

/** Monthly price for a plan; annual billing is 20% off. */
export function perMonth(
  plans: Record<PlanKey, PlanLimits>,
  k: PlanKey,
  cycle: 'month' | 'year',
): number {
  const price = plans[k].price || 0;
  return cycle === 'year' ? Math.round(price * 0.8) : price;
}

/**
 * The lines of a plan card: the four limits from /api/plans (so an admin's edit shows up at once; null is
 * unlimited), and the advanced anti-ban line on the plans that have it (the API gates it to Pro and Agency).
 * Nothing else is promised: no feature that the API does not gate or does not have is listed.
 */
export function featureLines(
  plans: Record<PlanKey, PlanLimits>,
  k: PlanKey,
  t: Dict,
): readonly string[] {
  const p = plans[k];
  const n = (v: number | null) => v ?? t.common.unlimited;
  const lines = [
    fmt(t.api.planAccounts, { n: n(p.accounts) }),
    fmt(t.api.planPosts, { n: n(p.posts) }),
    fmt(t.api.planDevices, { n: n(p.devices) }),
    fmt(t.api.planSeats, { n: n(p.seats) }),
  ];
  if (ADVANCED_ANTI_BAN.includes(k)) lines.push(t.api.planAntiBan);
  return lines;
}

/** The plans whose owners get the advanced anti-ban settings (User.HasAdvancedAntiBan in the API). */
const ADVANCED_ANTI_BAN: PlanKey[] = ['pro', 'agency'];

/** Plan cards for the landing page and the billing page. */
export function tierViews(
  plans: Record<PlanKey, PlanLimits>,
  cycle: 'month' | 'year',
  t: Dict,
): TierView[] {
  return PLAN_ORDER.map((k) => {
    const pm = perMonth(plans, k, cycle);
    return {
      k,
      name: t.plans[k].name,
      tag: t.plans[k].tag,
      price: baht(pm),
      per: k === 'free' ? '' : t.common.perMonth,
      billed:
        k === 'free'
          ? t.api.freeForever
          : cycle === 'year'
            ? fmt(t.bill.billedYear, { amt: baht(pm * 12) })
            : '',
      features: featureLines(plans, k, t),
    };
  });
}

import { baht } from '../i18n/format';
import { Dict, fmt } from '../i18n/i18n.service';
import {
  LIMIT_KEYS,
  LimitKey,
  PLAN_FEATURES,
  PLAN_ORDER,
  PlanFeature,
  PlanKey,
  PlanLimits,
} from './models';

/** What the Pro plan includes besides its numbers (PlanFeatures.For in the API). */
const PRO_FEATURES: PlanFeature[] = ['advanced_anti_ban', 'notifications', 'auto_reply', 'ai'];

/**
 * The packages as the API ships them, shown until /api/plans answers (the API's values replace them).
 * null is unlimited. Free is for trying it out, Basic for one small shop, Pro for a seller with several
 * browsers, Agency (shown as "Premium") for agencies and heavy use: nothing is capped but the seats.
 */
export const DESIGN_PLANS: Record<PlanKey, PlanLimits> = {
  free: {
    accounts: 1,
    posts: 10,
    devices: 1,
    seats: 1,
    groups: 10,
    images: 20,
    libraryPosts: 20,
    price: 0,
    features: [],
  },
  basic: {
    accounts: 2,
    posts: 50,
    devices: 1,
    seats: 1,
    groups: 50,
    images: 200,
    libraryPosts: 200,
    price: 290,
    features: [],
  },
  pro: {
    accounts: 10,
    posts: 300,
    devices: 3,
    seats: 3,
    groups: 300,
    images: 1000,
    libraryPosts: 1000,
    price: 790,
    features: [...PRO_FEATURES],
  },
  agency: {
    accounts: null,
    posts: null,
    devices: null,
    seats: 10,
    groups: null,
    images: null,
    libraryPosts: null,
    price: 1990,
    features: [...PLAN_FEATURES],
  },
};

/** One of the seven numbers of a plan, as a card line: a short label and the value (a number or "Unlimited"). */
export interface TierLimit {
  key: LimitKey;
  label: string;
  value: string;
  unlimited: boolean;
}

/** One function of the plan: included (a check) or not (a muted dash). */
export interface TierFeature {
  key: PlanFeature;
  label: string;
  included: boolean;
}

export interface TierView {
  k: PlanKey;
  name: string;
  /** "Good for ..." one-liner. */
  tag: string;
  price: string;
  per: string;
  billed: string;
  limits: readonly TierLimit[];
  features: readonly TierFeature[];
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
 * The seven numbers of a plan as card lines (groups, images, library posts, posts a day, extensions, seats,
 * accounts). They come from /api/plans, so an admin's edit shows up at once; null is unlimited.
 */
export function limitLines(
  plans: Record<PlanKey, PlanLimits>,
  k: PlanKey,
  t: Dict,
): readonly TierLimit[] {
  const p = plans[k];
  return LIMIT_KEYS.map((key) => ({
    key,
    label: t.api.planLimit[key],
    value: p[key] === null ? t.common.unlimited : String(p[key]),
    unlimited: p[key] === null,
  }));
}

/**
 * The functions of a plan, each as included or not: the `features` list of /api/plans is the source, and a key
 * this app does not know is ignored. Nothing is promised that the API does not gate.
 */
export function featureLines(
  plans: Record<PlanKey, PlanLimits>,
  k: PlanKey,
  t: Dict,
): readonly TierFeature[] {
  const has = new Set<string>(plans[k].features);
  return PLAN_FEATURES.map((key) => ({
    key,
    label: t.api.planFeature[key],
    included: has.has(key),
  }));
}

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
      limits: limitLines(plans, k, t),
      features: featureLines(plans, k, t),
    };
  });
}

/** One row of the comparison table: what is compared and its value under each plan (in plan order). */
export interface CompareRow {
  key: LimitKey | PlanFeature;
  label: string;
  cells: readonly { value: string; unlimited?: boolean; included?: boolean }[];
}

/**
 * The comparison table of the billing page: a row per number and per function, a column per plan (in plan
 * order). The numbers read as text, the functions as included or not.
 */
export function compareRows(
  plans: Record<PlanKey, PlanLimits>,
  t: Dict,
): { limits: CompareRow[]; features: CompareRow[] } {
  return {
    limits: LIMIT_KEYS.map((key) => ({
      key,
      label: t.api.planLimit[key],
      cells: PLAN_ORDER.map((k) => ({
        value: plans[k][key] === null ? t.common.unlimited : String(plans[k][key]),
        unlimited: plans[k][key] === null,
      })),
    })),
    features: PLAN_FEATURES.map((key) => ({
      key,
      label: t.api.planFeature[key],
      cells: PLAN_ORDER.map((k) => {
        const included = plans[k].features.includes(key);
        return { value: included ? t.api.planIncluded : t.api.planNotIncluded, included };
      }),
    })),
  };
}

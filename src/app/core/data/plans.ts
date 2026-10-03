import { baht } from '../i18n/format';
import { Dict, fmt } from '../i18n/i18n.service';
import { PLAN_ORDER, PlanKey, PlanLimits } from './models';

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
          ? t.bill.trialNote
          : cycle === 'year'
            ? fmt(t.bill.billedYear, { amt: baht(pm * 12) })
            : '',
      features: t.bill.features[k],
    };
  });
}

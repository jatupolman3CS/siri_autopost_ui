import { TestBed } from '@angular/core/testing';
import { I18nService } from '../i18n/i18n.service';
import { PlanKey, PlanLimits } from './models';
import { DESIGN_PLANS, featureLines, tierViews } from './plans';

describe('plan cards', () => {
  afterEach(() => localStorage.clear());

  const t = () => {
    localStorage.clear();
    const i18n = TestBed.inject(I18nService);
    i18n.setLang('en');
    return i18n.t();
  };
  const plans = (over: Partial<Record<PlanKey, Partial<PlanLimits>>> = {}) =>
    Object.fromEntries(
      (Object.keys(DESIGN_PLANS) as PlanKey[]).map((k) => [k, { ...DESIGN_PLANS[k], ...over[k] }]),
    ) as Record<PlanKey, PlanLimits>;

  it('takes the four limits from the plans, so an admin edit shows up', () => {
    const lines = featureLines(
      plans({ basic: { accounts: 5, posts: 80, devices: 2, seats: 3 } }),
      'basic',
      t(),
    );
    expect(lines).toEqual([
      'Social accounts: 5',
      'Posts per 24 h: 80',
      'Devices: 2',
      'Team seats: 3',
    ]);
  });

  it('writes null as unlimited', () => {
    const lines = featureLines(plans(), 'agency', t());
    expect(lines.slice(0, 4)).toEqual([
      'Social accounts: Unlimited',
      'Posts per 24 h: Unlimited',
      'Devices: Unlimited',
      'Team seats: 10',
    ]);
  });

  it('lists advanced anti-ban for Pro and Agency only, and promises nothing else', () => {
    const dict = t();
    const all = (['free', 'basic', 'pro', 'agency'] as PlanKey[]).map((k) =>
      featureLines(plans(), k, dict),
    );
    expect(all.map((l) => l.includes(dict.api.planAntiBan))).toEqual([false, false, true, true]);
    const text = all.flat().join(' | ');
    for (const gone of [
      'Client workspaces',
      'Post templates',
      'Calendar and library',
      'In-depth reports',
    ])
      expect(text).not.toContain(gone);
  });

  it('builds the cards of every plan with those lines', () => {
    const views = tierViews(plans({ pro: { devices: 7 } }), 'month', t());
    expect(views.map((v) => v.k)).toEqual(['free', 'basic', 'pro', 'agency']);
    expect(views[2].features).toContain('Devices: 7');
  });
});

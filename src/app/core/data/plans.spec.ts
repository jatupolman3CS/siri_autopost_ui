import { TestBed } from '@angular/core/testing';
import { I18nService } from '../i18n/i18n.service';
import { LIMIT_KEYS, PLAN_FEATURES, PlanFeature, PlanKey, PlanLimits } from './models';
import { DESIGN_PLANS, compareRows, featureLines, limitLines, tierViews } from './plans';

describe('plan cards', () => {
  afterEach(() => localStorage.clear());

  const t = (lang: 'en' | 'th' = 'en') => {
    localStorage.clear();
    const i18n = TestBed.inject(I18nService);
    i18n.setLang(lang);
    return i18n.t();
  };
  const plans = (over: Partial<Record<PlanKey, Partial<PlanLimits>>> = {}) =>
    Object.fromEntries(
      (Object.keys(DESIGN_PLANS) as PlanKey[]).map((k) => [k, { ...DESIGN_PLANS[k], ...over[k] }]),
    ) as Record<PlanKey, PlanLimits>;
  const included = (k: PlanKey, over: Partial<Record<PlanKey, Partial<PlanLimits>>> = {}) =>
    featureLines(plans(over), k, t())
      .filter((f) => f.included)
      .map((f) => f.key);

  describe('the shipped packages', () => {
    it('are the four packages with the seven numbers of the API', () => {
      const numbers = (k: PlanKey) =>
        ['accounts', 'posts', 'devices', 'seats', 'groups', 'images', 'libraryPosts'].map(
          (n) => DESIGN_PLANS[k][n as keyof PlanLimits],
        );
      expect(numbers('free')).toEqual([1, 10, 1, 1, 10, 20, 20]);
      expect(numbers('basic')).toEqual([2, 50, 1, 1, 50, 200, 200]);
      expect(numbers('pro')).toEqual([10, 300, 3, 3, 300, 1000, 1000]);
      // The top plan caps nothing but the seats.
      expect(numbers('agency')).toEqual([null, null, null, 10, null, null, null]);
      expect(DESIGN_PLANS.free.price).toBe(0);
    });

    it('give the functions: none below Pro, four on Pro, all six on Premium', () => {
      expect(DESIGN_PLANS.free.features).toEqual([]);
      expect(DESIGN_PLANS.basic.features).toEqual([]);
      expect([...DESIGN_PLANS.pro.features].sort()).toEqual(
        ['advanced_anti_ban', 'ai', 'auto_reply', 'notifications'].sort(),
      );
      expect([...DESIGN_PLANS.agency.features].sort()).toEqual([...PLAN_FEATURES].sort());
    });
  });

  describe('limitLines', () => {
    it('lists the seven numbers with a short label each, in a fixed order', () => {
      const lines = limitLines(plans(), 'basic', t());
      expect(lines.map((l) => l.key)).toEqual(LIMIT_KEYS);
      expect(lines.map((l) => [l.label, l.value])).toEqual([
        ['Facebook groups and pages', '50'],
        ['Image library', '200'],
        ['Post library', '200'],
        ['Posts per day (24 h)', '50'],
        ['Extensions (browsers)', '1'],
        ['Team seats', '1'],
        ['Facebook accounts', '2'],
      ]);
    });

    it('takes the numbers from the plans, so an admin edit shows up', () => {
      const lines = limitLines(
        plans({ basic: { groups: 80, images: 5, libraryPosts: 6 } }),
        'basic',
        t(),
      );
      expect(lines.find((l) => l.key === 'groups')?.value).toBe('80');
      expect(lines.find((l) => l.key === 'images')?.value).toBe('5');
      expect(lines.find((l) => l.key === 'libraryPosts')?.value).toBe('6');
    });

    it('writes null as unlimited and says so', () => {
      const lines = limitLines(plans(), 'agency', t());
      expect(lines.filter((l) => l.unlimited).map((l) => l.key)).toEqual([
        'groups',
        'images',
        'libraryPosts',
        'posts',
        'devices',
        'accounts',
      ]);
      expect(lines.find((l) => l.key === 'seats')).toMatchObject({ value: '10', unlimited: false });
      expect(lines.find((l) => l.key === 'groups')?.value).toBe('Unlimited');
    });

    it('has a Thai label for every number', () => {
      const lines = limitLines(plans(), 'free', t('th'));
      expect(lines.map((l) => l.label)).toContain('คลังรูป');
      expect(lines.map((l) => l.label)).toContain('คลังโพสต์');
    });
  });

  describe('featureLines', () => {
    it('marks every function as included or not, from the plan features', () => {
      const pro = featureLines(plans(), 'pro', t());
      expect(pro.map((f) => f.key)).toEqual(PLAN_FEATURES);
      expect(pro.map((f) => [f.key, f.included])).toEqual([
        ['ai', true],
        ['advanced_anti_ban', true],
        ['notifications', true],
        ['auto_reply', true],
        ['bump', false],
        ['client_reports', false],
      ]);
    });

    it('puts AI, anti-ban, notifications and auto-reply on Pro and everything on Premium only', () => {
      expect(included('free')).toEqual([]);
      expect(included('basic')).toEqual([]);
      expect(included('pro')).toEqual(['ai', 'advanced_anti_ban', 'notifications', 'auto_reply']);
      expect(included('agency')).toEqual(PLAN_FEATURES);
    });

    it('follows the features the API sends and ignores a key it does not know', () => {
      const odd = ['bump', 'teleport'] as unknown as PlanFeature[];
      expect(included('basic', { basic: { features: odd } })).toEqual(['bump']);
    });

    it('names each function in plain words', () => {
      const labels = featureLines(plans(), 'agency', t()).map((f) => f.label);
      expect(labels).toEqual([
        'AI post drafts',
        'Advanced anti-ban',
        'Notifications (Telegram / LINE)',
        'Auto-reply',
        'Auto bump',
        'Client reports',
      ]);
    });
  });

  describe('tierViews', () => {
    it('builds the cards of every plan with the numbers and the functions', () => {
      const views = tierViews(plans({ pro: { devices: 7 } }), 'month', t());
      expect(views.map((v) => v.k)).toEqual(['free', 'basic', 'pro', 'agency']);
      expect(views[2].limits.find((l) => l.key === 'devices')?.value).toBe('7');
      expect(views[2].features.filter((f) => f.included)).toHaveLength(4);
      expect(views.every((v) => v.limits.length === 7 && v.features.length === 6)).toBe(true);
    });

    it('calls the top plan Premium and says who each plan is good for', () => {
      const views = tierViews(plans(), 'month', t());
      expect(views.map((v) => v.name)).toEqual(['Free', 'Basic', 'Pro', 'Premium']);
      expect(views.map((v) => v.tag)).toEqual([
        'Good for: trying it out, free with no time limit',
        'Good for: a small shop with one seller',
        'Good for: a seller who works with several browsers',
        'Good for: agencies and heavy use',
      ]);
    });

    it('prices the yearly cycle 20% off', () => {
      const month = tierViews(plans(), 'month', t());
      const year = tierViews(plans(), 'year', t());
      expect(month[3].price).not.toBe(year[3].price);
      expect(year[3].billed).not.toBe('');
      expect(month[0].per).toBe('');
    });
  });

  describe('compareRows', () => {
    it('has a row per number and per function and a cell per plan, in plan order', () => {
      const rows = compareRows(plans(), t());
      expect(rows.limits).toHaveLength(7);
      expect(rows.features).toHaveLength(6);
      expect(rows.limits.every((r) => r.cells.length === 4)).toBe(true);
      const groups = rows.limits.find((r) => r.key === 'groups')!;
      expect(groups.cells.map((c) => c.value)).toEqual(['10', '50', '300', 'Unlimited']);
      expect(groups.cells.map((c) => c.unlimited)).toEqual([false, false, false, true]);
    });

    it('says included or not under each plan for every function', () => {
      const rows = compareRows(plans(), t());
      const bump = rows.features.find((r) => r.key === 'bump')!;
      expect(bump.cells.map((c) => c.included)).toEqual([false, false, false, true]);
      expect(bump.cells.map((c) => c.value)).toEqual([
        'Not included',
        'Not included',
        'Not included',
        'Included',
      ]);
      const ai = rows.features.find((r) => r.key === 'ai')!;
      expect(ai.cells.map((c) => c.included)).toEqual([false, false, true, true]);
    });
  });
});

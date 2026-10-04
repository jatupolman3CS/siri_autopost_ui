import { Title } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { Route, Router, TitleStrategy, provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { ADMIN_ROUTES } from '../../features/admin/admin.routes';
import { DictionaryTitleStrategy, lookup } from '../services/title.strategy';
import { fmtDate } from './format';
import { AP_I18N } from './i18n.data';
import { I18nService, applyFixes, fmt } from './i18n.service';
import { AP_I18N_FIXES } from './i18n.fixes';

describe('I18nService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('picks Thai by default and English after switching', () => {
    const i18n = TestBed.inject(I18nService);
    expect(i18n.t().nav.overview).toBe('ภาพรวม');
    i18n.setLang('en');
    expect(i18n.t().nav.overview).toBe('Overview');
  });

  it('fills {placeholders} and leaves unknown ones', () => {
    expect(fmt('{n} of {m} groups', { n: 3 })).toBe('3 of {m} groups');
  });

  it('formats Thai dates with the Buddhist year', () => {
    const d = new Date(2026, 9, 3);
    expect(fmtDate(d, 0, true)).toBe('3 ต.ค. 2569');
    expect(fmtDate(d, 1, true)).toBe('3 Oct 2026');
  });
});

describe('the corrections over the design copy', () => {
  // The language choice is kept in localStorage: do not leave English behind for other specs.
  afterEach(() => localStorage.clear());

  const i18n = () => {
    localStorage.clear();
    return TestBed.inject(I18nService);
  };

  it('lays a fix over the generated leaf and leaves every other leaf alone', () => {
    const merged = applyFixes(AP_I18N, AP_I18N_FIXES);
    expect(merged.land.heroNote).toEqual(AP_I18N_FIXES.land.heroNote);
    expect(merged.land.heroNote).not.toEqual(AP_I18N.land.heroNote);
    expect(merged.land.heroTitle).toBe(AP_I18N.land.heroTitle);
    expect(merged.reasons.quota.title).toEqual(AP_I18N_FIXES.reasons.quota.title);
    expect(merged.reasons.quota.body).toEqual(AP_I18N_FIXES.reasons.quota.body);
    // A branch is merged, not replaced: the other reasons survive.
    expect(merged.reasons.pending_approval).toBe(AP_I18N.reasons.pending_approval);
  });

  it('gives every fix both languages', () => {
    const walk = (node: unknown, path: string): void => {
      if (Array.isArray(node)) {
        expect(node.length, path).toBe(2);
        expect(String(node[0]).trim(), path + ' th').not.toBe('');
        expect(String(node[1]).trim(), path + ' en').not.toBe('');
        return;
      }
      for (const [k, v] of Object.entries(node as object)) walk(v, `${path}.${k}`);
    };
    walk(AP_I18N_FIXES, 'fixes');
  });

  it('no longer promises a trial: Free is permanent', () => {
    const t = i18n().t();
    for (const text of [
      t.land.heroNote,
      t.land.trial,
      t.auth.signup,
      t.auth.signupSub,
      t.plans.free.name,
      t.plans.free.tag,
    ])
      expect(text).not.toMatch(/14|ทดลอง|trial/i);
  });

  it('says the daily limit fails a post instead of rolling it over, and that the window is 24 hours', () => {
    const service = i18n();
    service.setLang('en');
    const t = service.t();
    expect(t.ab.limitsBody).not.toMatch(/rolls the rest over/);
    expect(t.ab.limitsBody).toMatch(/quota/i);
    expect(t.off.wDay).not.toMatch(/same day/i);
    expect(t.off.wDay).toMatch(/24/);
  });

  it('describes failures for any platform, not the design samples (TikTok, LINE OA, X video)', () => {
    const service = i18n();
    for (const lang of ['th', 'en'] as const) {
      service.setLang(lang);
      const reasons = service.t().reasons;
      for (const code of [
        'session',
        'network',
        'quota',
        'media_too_large',
        'rate_limit',
      ] as const) {
        const text = [reasons[code].title, reasons[code].body, reasons[code].fix].join(' ');
        expect(text, code).not.toMatch(/TikTok|LINE OA|512|1 พ\.ย\.|1 Nov/);
      }
    }
  });

  it('does not show a made-up extension version or pause time', () => {
    const service = i18n();
    service.setLang('en');
    const t = service.t();
    expect(t.ext.version).toContain('{v}');
    expect(t.ext.version).not.toContain('2.4.1');
    expect(t.ext.paused).not.toMatch(/11:30/);
    expect(t.ext.pause).not.toMatch(/1 hour/);
  });

  it('tells the real wait for a command and how long a late one can still run', async () => {
    const service = i18n();
    service.setLang('en');
    await import('./i18n.ext');
    const { COMMAND_LIFETIME_MIN, COMMAND_WAIT_MIN } = await import('../data/campaigns.store');
    const ext = service.t().api.ext;
    expect(fmt(ext.cmdSent, { n: COMMAND_WAIT_MIN })).toContain(`${COMMAND_WAIT_MIN} minutes`);
    expect(fmt(ext.cmdSent, { n: COMMAND_WAIT_MIN })).not.toMatch(/a minute\b/);
    expect(fmt(ext.cmdTimeout, { m: COMMAND_LIFETIME_MIN })).toContain(
      `${COMMAND_LIFETIME_MIN} minutes`,
    );
  });

  it('loads the campaigns page strings only once their module is imported', async () => {
    const service = i18n();
    await import('./i18n.ext');
    expect(service.t().api.ext.start).toBe('เริ่มทำงาน');
    service.setLang('en');
    expect(service.t().api.ext.start).toBe('Start');
  });
});

describe('lazy dictionary packs', () => {
  afterEach(() => localStorage.clear());

  const pairs = (node: unknown, path = ''): [string, readonly [string, string]][] =>
    Array.isArray(node) && typeof node[0] === 'string'
      ? [[path, node as [string, string]]]
      : Object.entries(node as object).flatMap(([k, v]) => pairs(v, path ? `${path}.${k}` : k));
  const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

  it('adds t().api.flow once its module is imported, in both languages, and updates t() at once', async () => {
    localStorage.clear();
    const service = TestBed.inject(I18nService);
    const before = service.t();
    // Specs share modules inside a worker: another spec may have imported the pack already.
    const loadedBefore = 'flow' in before.api;
    await import('./i18n.flow');
    const after = service.t();
    if (!loadedBefore) expect(after).not.toBe(before);
    expect(after.api.flow.storedOnlyBadge).toBe('บันทึกเท่านั้น');
    service.setLang('en');
    expect(service.t().api.flow.storedOnlyBadge).toBe('Saved only');
  });

  it('adds t().api.engine the same way', async () => {
    localStorage.clear();
    const service = TestBed.inject(I18nService);
    await import('./i18n.engine');
    expect(service.t().api.engine.storedOnlyBadge).toBe('บันทึกเท่านั้น');
    service.setLang('en');
    expect(service.t().api.engine.planLocked).toBe('Available on {plan} and above');
  });

  it('keeps every pack side by side: registering one does not drop another', async () => {
    localStorage.clear();
    const service = TestBed.inject(I18nService);
    await Promise.all([import('./i18n.ext'), import('./i18n.flow'), import('./i18n.engine')]);
    const api = service.t().api;
    expect(api.ext.start).toBe('เริ่มทำงาน');
    expect(api.flow.storedOnly).toBeTruthy();
    expect(api.engine.storedOnly).toBeTruthy();
    // A pack never leaks into the shared strings.
    expect(api.save).toBe('บันทึกการตั้งค่า');
  });

  it('keeps registerExt working for the campaigns page', async () => {
    localStorage.clear();
    const service = TestBed.inject(I18nService);
    const { registerExt } = await import('./i18n.service');
    const { AP_I18N_EXT } = await import('./i18n.ext');
    registerExt(AP_I18N_EXT);
    expect(service.t().api.ext.title).toBe('ชุดโพสต์ของส่วนขยาย');
  });

  it('gives every leaf of the packs and of the fixes both languages with the same {placeholders}', async () => {
    const { AP_I18N_FLOW } = await import('./i18n.flow');
    const { AP_I18N_ENGINE } = await import('./i18n.engine');
    const all = [
      ...pairs(AP_I18N_FLOW, 'flow'),
      ...pairs(AP_I18N_ENGINE, 'engine'),
      ...pairs(AP_I18N_FIXES, 'fixes'),
    ];
    expect(all.length).toBeGreaterThan(30);
    for (const [path, [th, en]] of all) {
      expect(th.trim(), `${path} th`).not.toBe('');
      expect(en.trim(), `${path} en`).not.toBe('');
      expect(placeholders(th), path).toEqual(placeholders(en));
    }
  });

  it('gives each pack its own copy of the shared hints (stored only, plan locked)', async () => {
    // The pack files are edited by different pages, so the hints every page needs are repeated in each pack.
    const { AP_I18N_FLOW } = await import('./i18n.flow');
    const { AP_I18N_ENGINE } = await import('./i18n.engine');
    for (const pack of [AP_I18N_FLOW, AP_I18N_ENGINE])
      for (const key of ['storedOnly', 'storedOnlyBadge', 'planLocked'] as const)
        expect(pack[key], key).toBeDefined();
  });
});

describe('page titles from the dictionary', () => {
  afterEach(() => localStorage.clear());

  const titled = (list: Route[]): string[] =>
    list.flatMap((r) => [
      ...(typeof r.title === 'string' ? [r.title] : []),
      ...titled(r.children ?? []),
    ]);

  it('has a text for the title of every route, in both languages', () => {
    const keys = [...titled(routes), ...titled(ADMIN_ROUTES)];
    expect(keys.length).toBeGreaterThan(15);
    localStorage.clear();
    const service = TestBed.inject(I18nService);
    for (const lang of ['th', 'en'] as const) {
      service.setLang(lang);
      for (const key of keys) expect(lookup(service.t(), key), `${lang} ${key}`).toBeTruthy();
    }
  });

  it('puts the title in the tab and follows the language switch', async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'app/overview', title: 'nav.overview', children: [] }]),
        { provide: TitleStrategy, useClass: DictionaryTitleStrategy },
      ],
    });
    const router = TestBed.inject(Router);
    const i18n = TestBed.inject(I18nService);
    const title = TestBed.inject(Title);
    await router.navigateByUrl('/app/overview');
    expect(title.getTitle()).toBe('ภาพรวม · AutoPost');
    i18n.setLang('en');
    TestBed.tick();
    expect(title.getTitle()).toBe('Overview · AutoPost');
  });
});

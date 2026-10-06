import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Type } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { assistStorage } from '../../core/auth/token';
import { AccountsStore } from '../../core/data/accounts.store';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { DevicesStore } from '../../core/data/devices.store';
import { EDIT_DEBOUNCE_MS, LinkSetsStore } from '../../core/data/link-sets.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiCollection, ApiDevice, ApiRole } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { NotificationService } from '../../core/services/notification.service';
import { lookup } from '../../core/services/title.strategy';
import { UiPrefsService } from '../../core/services/ui-prefs.service';
import {
  ACCOUNTS,
  WS,
  answerWorkspaceLoads,
  provideApiTesting,
  settle,
  signIn,
} from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import {
  FB_CONNECTED,
  SET_URL,
  apiDevice,
  apiLink,
  apiLinkSet,
  apiPageLink,
} from '../../testing/link-sets.fixtures';
import { TargetsPageComponent } from './targets-page.component';

const SETS_URL = `/api/workspaces/${WS}/link-sets`;
const A = apiLink({ id: 'a', name: 'Condo BKK', code: '#Jan24', dailyMax: 5 });
const B = apiLink({ id: 'b', name: 'Condo rent', url: 'https://www.facebook.com/groups/rent' });
const SET = apiLinkSet({
  id: 's1',
  name: 'Condo groups',
  links: [A, B],
  scheduleCount: 1,
});

describe('TargetsPageComponent', () => {
  let http: HttpTestingController;

  async function open(
    opts: {
      role?: ApiRole;
      sets?: (typeof SET)[];
      assist?: boolean;
      /** Answer the sets only when the test says so (to see the page before they arrive). */
      holdSets?: boolean;
      connected?: boolean;
      /** The paired browsers (default: "Shop PC", the one that brought FB_CONNECTED). */
      devices?: ApiDevice[];
      /** Simple mode off: the "more options" of every set start open. */
      simple?: boolean;
      /** What GET collections answers (the first collection's settings feed the example under "more options"). */
      collections?: ApiCollection[];
    } = {},
  ) {
    http = provideApiTesting({
      imports: [TargetsPageComponent],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: DeviceEventsService, useClass: FakeDeviceEvents },
      ],
    });
    if (opts.assist)
      assistStorage.set({
        adminToken: 'a',
        customerId: 'u-1',
        email: 'owner@shop.co',
        expiresAt: '2099-01-01T00:00:00Z',
      });
    if (opts.simple === false) TestBed.inject(UiPrefsService).set(false);
    TestBed.inject(WorkspaceStore);
    TestBed.inject(AccountsStore);
    TestBed.inject(DevicesStore);
    TestBed.inject(LinkSetsStore);
    await signIn(http, {
      workspace: { role: opts.role ?? 'owner' },
      linkSets: opts.holdSets ? [] : (opts.sets ?? [SET]),
      collections: opts.collections,
      devices: opts.devices ?? (opts.connected === false ? [] : [apiDevice()]),
    });
    TestBed.inject(AccountsStore).list.set(
      opts.connected === false ? ACCOUNTS : [...ACCOUNTS, FB_CONNECTED],
    );
    const fixture = TestBed.createComponent(TargetsPageComponent);
    fixture.detectChanges();
    await settle();
    await settle();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const t = () => TestBed.inject(I18nService).t();
  const toasts = () => TestBed.inject(NotificationService).toasts();
  const cards = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('app-link-set-card')];
  const rows = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('app-link-row')];
  const cell = (row: HTMLElement, n: number) =>
    row.querySelectorAll<HTMLInputElement>('input.cell')[n];
  const NAME = 0;
  const URL_ = 1;
  const CODE = 2;
  const MAX = 3;
  const button = (root: ParentNode, text: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(text),
    );
  const type = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const modalBody = () => document.querySelector<HTMLElement>('.su-modal-body');
  const modalButtons = () => [
    ...document.querySelectorAll<HTMLButtonElement>('.su-modal-foot button'),
  ];
  const wait = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    await settle();
  };

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    try {
      http?.verify();
    } finally {
      http = undefined!;
      TestBed.resetTestingModule();
      localStorage.clear();
    }
  });

  describe('route', () => {
    it('is a lazy page of the signed-in area, titled with its dictionary text', async () => {
      const route = routes
        .find((r) => r.path === 'app')!
        .children!.find((c) => c.path === 'targets')!;
      expect(route.title).toBe('nav.targets');
      expect(lookup(TestBed.inject(I18nService).t(), route.title as string)).toBeTruthy();
      const loaded = await (route.loadComponent as () => Promise<Type<unknown>>)();
      expect(loaded).toBe(TargetsPageComponent);
    });
  });

  describe('page', () => {
    it('shows the title, the subtitle, the stepper on step 3 and the code explainer', async () => {
      const { el } = await open();
      expect(el.querySelector('h1')?.textContent).toBe(t().ts.title);
      expect(el.querySelector('.page-head p')?.textContent).toBe(t().ts.sub);
      expect(el.querySelector('a.step[aria-current="step"] .num')?.textContent?.trim()).toBe('3');
      expect(el.querySelector('.code .fw6')?.textContent).toBe(t().ts.codeTitle);
      expect(el.querySelector('.code p')?.textContent).toBe(t().ts.codeBody);
    });

    it('waits for the sets before it shows any, then lists them', async () => {
      const { fixture, el } = await open({ holdSets: true });
      TestBed.inject(LinkSetsStore).loaded.set(false);
      fixture.detectChanges();
      expect(el.textContent).toContain(t().api.loading);
      expect(cards(el)).toHaveLength(0);
      expect(el.querySelector('app-empty-state')).toBeNull();
      TestBed.inject(LinkSetsStore).sets.set([SET]);
      TestBed.inject(LinkSetsStore).loaded.set(true);
      fixture.detectChanges();
      expect(cards(el)).toHaveLength(1);
    });

    it('says so when there is no link set yet', async () => {
      const { el } = await open({ sets: [] });
      expect(cards(el)).toHaveLength(0);
      expect(el.querySelector('app-empty-state')?.textContent).toContain(
        t().api.flow.emptyLinkSetsTitle,
      );
    });

    it('has the next-step card that opens the schedule builder', async () => {
      const { fixture, el } = await open();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
      expect(el.querySelector('.next')?.textContent).toContain(t().flow.n2);
      el.querySelector<HTMLButtonElement>('.next button')!.click();
      expect(navigate).toHaveBeenCalledWith(['/app/schedules'], { queryParams: { new: 1 } });
      fixture.detectChanges();
    });

    it('hides the next-step card when simple mode is off', async () => {
      const { el } = await open({ simple: false });
      expect(el.querySelector('.next')).toBeNull();
    });
  });

  describe('a set card', () => {
    it('shows the name, the counts, the rows and how many schedules use it', async () => {
      const { el } = await open();
      const card = cards(el)[0];
      expect(card.querySelector('.title .fw6')?.textContent).toBe('Condo groups');
      expect(card.querySelector('.title .small')?.textContent).toBe(
        [
          fmt(t().ts.linksN, { n: 2 }),
          fmt(t().ts.onN, { n: 2 }),
          fmt(t().ts.codesN, { n: 1 }),
        ].join(' · '),
      );
      expect(rows(card)).toHaveLength(2);
      const first = rows(card)[0];
      expect(cell(first, NAME).value).toBe('Condo BKK');
      expect(cell(first, URL_).value).toBe('https://www.facebook.com/groups/a');
      expect(cell(first, CODE).value).toBe('#Jan24');
      expect(cell(first, MAX).value).toBe('5');
      expect(cell(first, MAX).min).toBe('0');
      expect(cell(first, MAX).max).toBe('50');
      expect(card.querySelector('.panel > .small.muted')?.textContent).toBe(
        fmt(t().api.flow.linkSetUsedBy, { n: 1 }),
      );
    });

    it('says when no schedule uses the set, and when it has no link', async () => {
      const { el } = await open({ sets: [apiLinkSet({ id: 's2', name: 'Empty' })] });
      expect(cards(el)[0].textContent).toContain(t().ts.notUsed);
      expect(cards(el)[0].textContent).toContain(t().ts.empty);
    });

    it('counts only links that are on and real groups or pages in the header line', async () => {
      const off = apiLink({ id: 'c', enabled: false, code: 'X' });
      const bad = apiLink({ id: 'd', url: 'nope', valid: false, code: 'Y' });
      const page = apiPageLink({ id: 'baandee.shop' });
      const { el } = await open({
        sets: [apiLinkSet({ id: 's2', links: [A, off, bad, page] })],
      });
      expect(cards(el)[0].querySelector('.title .small')?.textContent).toBe(
        [
          fmt(t().ts.linksN, { n: 4 }),
          fmt(t().ts.onN, { n: 2 }),
          fmt(t().ts.codesN, { n: 1 }),
        ].join(' · '),
      );
    });

    it('has no button for picking groups from an account, and no other accounts of a set', async () => {
      const set = apiLinkSet({ id: 's1', links: [A], accountIds: ['old-1'] });
      const { el } = await open({ sets: [set], simple: false });
      const card = cards(el)[0];
      expect(card.querySelectorAll('.head button').length).toBeGreaterThan(0);
      expect(card.textContent).not.toContain(t().ts.fromAccount);
      expect(card.querySelector('.accs, .chip, .add')).toBeNull();
    });

    it('sends the schedule button to the schedules with the set in the address', async () => {
      const { el } = await open();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      button(cards(el)[0], t().ts.schedule)!.click();
      expect(navigate).toHaveBeenCalledWith(['/app/schedules'], { queryParams: { set: 's1' } });
    });
  });

  describe('link rows', () => {
    const chip = (row: HTMLElement) => row.querySelector<HTMLElement>('.urlwrap app-chip');

    it('asks for a group or page link in the address and the name fields', async () => {
      const { el } = await open();
      const row = rows(el)[0];
      expect(cell(row, URL_).placeholder).toBe(t().ts.urlPh);
      expect(cell(row, URL_).getAttribute('aria-label')).toBe(t().ts.urlPh);
      expect(cell(row, NAME).placeholder).toBe(t().ts.namePh);
      expect(t().ts.urlPh).toBe('ลิงก์กลุ่มหรือเพจ Facebook');
      expect(t().ts.invalidUrl).toContain('เพจ');
    });

    it('says on each row whether the address is a group or a page', async () => {
      const page = apiPageLink({ id: 'baandee.shop', name: 'Baan Dee' });
      const { el } = await open({ sets: [apiLinkSet({ id: 's1', links: [A, page] })] });
      const [group, shop] = rows(el);
      expect(chip(group)?.textContent?.trim()).toBe(t().api.flow.linkKindGroup);
      expect(chip(group)?.getAttribute('title')).toBe(t().api.flow.linkKindGroupHint);
      expect(group.querySelector('.urlwrap .ph-users-three')).not.toBeNull();
      expect(chip(shop)?.textContent?.trim()).toBe(t().api.flow.linkKindPage);
      expect(chip(shop)?.getAttribute('title')).toBe(t().api.flow.linkKindPageHint);
      expect(shop.querySelector('.urlwrap .ph-flag')).not.toBeNull();
      expect(cell(shop, URL_).value).toBe('https://www.facebook.com/baandee.shop');
      expect(cell(shop, URL_).classList.contains('bad')).toBe(false);
      expect(cell(shop, URL_).classList.contains('has-kind')).toBe(true);
    });

    it('shows no chip for a blank row or an address that is neither', async () => {
      const blank = apiLink({ id: 'x', url: '', name: '', valid: false });
      const bad = apiLink({ id: 'y', url: 'https://example.com/y', valid: false });
      const { el } = await open({ sets: [apiLinkSet({ id: 's1', links: [blank, bad] })] });
      expect(chip(rows(el)[0])).toBeNull();
      expect(chip(rows(el)[1])).toBeNull();
      expect(cell(rows(el)[1], URL_).classList.contains('has-kind')).toBe(false);
    });

    it('follows the address while it is typed: group, page, nothing', async () => {
      const { fixture, el } = await open();
      const row = rows(el)[1];
      expect(chip(row)?.textContent?.trim()).toBe(t().api.flow.linkKindGroup);
      type(cell(row, URL_), 'https://www.facebook.com/baandee.shop');
      fixture.detectChanges();
      expect(chip(row)?.textContent?.trim()).toBe(t().api.flow.linkKindPage);
      expect(row.querySelector('.note')).toBeNull();
      type(cell(row, URL_), 'https://www.facebook.com/watch');
      fixture.detectChanges();
      expect(chip(row)).toBeNull();
      expect(row.querySelector('.note')?.textContent).toBe(t().ts.invalidUrl);
      type(cell(row, URL_), 'https://www.facebook.com/groups/fresh');
      fixture.detectChanges();
      expect(chip(row)?.textContent?.trim()).toBe(t().api.flow.linkKindGroup);
      await wait(EDIT_DEBOUNCE_MS);
      http.expectOne(`${SET_URL('s1')}/links/b`).flush({ ...B, url: cell(row, URL_).value });
    });

    it('marks an address that is not a Facebook group or page, with the note', async () => {
      const bad = apiLink({ id: 'x', url: 'https://example.com/y', valid: false });
      const { el } = await open({ sets: [apiLinkSet({ id: 's1', links: [bad] })] });
      const row = rows(el)[0];
      expect(cell(row, URL_).classList.contains('bad')).toBe(true);
      expect(cell(row, URL_).getAttribute('aria-invalid')).toBe('true');
      expect(row.querySelector('.note')?.textContent).toBe(t().ts.invalidUrl);
      expect(cell(row, URL_).getAttribute('aria-describedby')).toBe(row.querySelector('.note')!.id);
    });

    it('marks a repeated address with its own note', async () => {
      const dup = apiLink({ id: 'x', duplicate: true });
      const { el } = await open({ sets: [apiLinkSet({ id: 's1', links: [A, dup] })] });
      expect(cell(rows(el)[0], URL_).classList.contains('bad')).toBe(false);
      expect(cell(rows(el)[1], URL_).classList.contains('bad')).toBe(true);
      expect(rows(el)[1].querySelector('.note')?.textContent).toBe(t().ts.dup);
    });

    it('does not flag a blank row that was just added', async () => {
      const blank = apiLink({ id: 'x', url: '', name: '', valid: false });
      const { el } = await open({ sets: [apiLinkSet({ id: 's1', links: [blank] })] });
      expect(cell(rows(el)[0], URL_).classList.contains('bad')).toBe(false);
      expect(rows(el)[0].querySelector('.note')).toBeNull();
    });

    it('flags an address while it is being typed, and unflags it when it is fixed', async () => {
      const { fixture, el } = await open();
      const row = rows(el)[1];
      type(cell(row, URL_), 'https://example.com/z');
      fixture.detectChanges();
      expect(cell(row, URL_).classList.contains('bad')).toBe(true);
      expect(row.querySelector('.note')?.textContent).toBe(t().ts.invalidUrl);
      type(cell(row, URL_), 'https://www.facebook.com/groups/a');
      fixture.detectChanges();
      expect(row.querySelector('.note')?.textContent).toBe(t().ts.dup);
      type(cell(row, URL_), 'https://www.facebook.com/groups/fresh');
      fixture.detectChanges();
      expect(row.querySelector('.note')).toBeNull();
      await wait(EDIT_DEBOUNCE_MS);
      http.expectOne(`${SET_URL('s1')}/links/b`).flush({ ...B, url: cell(row, URL_).value });
    });

    it('dims a link that is switched off', async () => {
      const off = apiLink({ id: 'x', enabled: false });
      const { el } = await open({ sets: [apiLinkSet({ id: 's1', links: [off] })] });
      expect(rows(el)[0].querySelector('.row')?.classList.contains('off')).toBe(true);
      expect(rows(el)[0].querySelector<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(
        false,
      );
    });

    it('shows a link waiting for approval, without a button', async () => {
      const pending = apiLink({ id: 'x', health: 'pending' });
      const { el } = await open({ sets: [apiLinkSet({ id: 's1', links: [pending] })] });
      const health = rows(el)[0].querySelector('.health')!;
      expect(health.textContent).toContain(t().ts.hPending);
      expect(health.querySelector('button')).toBeNull();
      expect(health.querySelector('.dot.warn')).not.toBeNull();
    });

    it('says how many failures switched a link off, and offers to enable it again', async () => {
      const off = apiLink({ id: 'x', enabled: false, health: 'off', failStreak: 3 });
      const { fixture, el } = await open({ sets: [apiLinkSet({ id: 's1', links: [off] })] });
      const health = rows(el)[0].querySelector('.health')!;
      expect(health.textContent).toContain(fmt(t().ts.hOffReason, { n: 3 }));
      expect(health.querySelector('.dot.bad')).not.toBeNull();
      button(health, t().ts.enableAgain)!.click();
      const req = http.expectOne(`${SET_URL('s1')}/links/x/enable`);
      req.flush({ ...off, enabled: true, health: 'ok', failStreak: 0 });
      await settle();
      fixture.detectChanges();
      expect(rows(el)[0].querySelector('.health')).toBeNull();
      expect(rows(el)[0].querySelector<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(
        true,
      );
      expect(toasts().some((x) => x.message === t().ts.reenabled)).toBe(true);
    });

    it('calls a link that was switched off by hand just "switched off"', async () => {
      const off = apiLink({ id: 'x', enabled: false, health: 'off', failStreak: 0 });
      const { el } = await open({ sets: [apiLinkSet({ id: 's1', links: [off] })] });
      const text = rows(el)[0].querySelector('.health')!.textContent!;
      expect(text).toContain(t().ts.hOff);
      expect(text).not.toContain(fmt(t().ts.hOffReason, { n: 0 }));
      expect(t().ts.hOff).not.toMatch(/auto|อัตโนมัติ/i);
    });

    it('saves the whole row after the pause when a field is edited', async () => {
      const { el } = await open();
      const row = rows(el)[0];
      type(cell(row, CODE), '#Feb24');
      type(cell(row, NAME), 'BKK condo');
      http.expectNone(`${SET_URL('s1')}/links/a`);
      await wait(EDIT_DEBOUNCE_MS);
      const req = http.expectOne(`${SET_URL('s1')}/links/a`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        name: 'BKK condo',
        url: A.url,
        code: '#Feb24',
        dailyMax: 5,
        enabled: true,
      });
      req.flush({ ...A, name: 'BKK condo', code: '#Feb24' });
    });

    it('keeps the daily cap between 0 and 50', async () => {
      const { el } = await open();
      const max = cell(rows(el)[0], MAX);
      max.value = '99';
      max.dispatchEvent(new Event('change'));
      expect(max.value).toBe('50');
      await wait(EDIT_DEBOUNCE_MS);
      const first = http.expectOne(`${SET_URL('s1')}/links/a`);
      expect(first.request.body.dailyMax).toBe(50);
      first.flush({ ...A, dailyMax: 50 });
      await settle();
      max.value = '-3';
      max.dispatchEvent(new Event('change'));
      expect(max.value).toBe('0');
      await wait(EDIT_DEBOUNCE_MS);
      const second = http.expectOne(`${SET_URL('s1')}/links/a`);
      expect(second.request.body.dailyMax).toBe(0);
      second.flush({ ...A, dailyMax: 0 });
    });

    it('treats a cap that is not a number as "no cap"', async () => {
      const { el } = await open();
      const max = cell(rows(el)[0], MAX);
      max.value = '';
      max.dispatchEvent(new Event('change'));
      expect(max.value).toBe('0');
      await wait(EDIT_DEBOUNCE_MS);
      http.expectOne(`${SET_URL('s1')}/links/a`).flush({ ...A, dailyMax: 0 });
    });

    it('switches a link off at once, with no pause', async () => {
      const { fixture, el } = await open();
      const box = rows(el)[0].querySelector<HTMLInputElement>('input[type=checkbox]')!;
      expect(box.getAttribute('aria-label')).toBe('Condo BKK');
      box.click();
      await settle();
      const req = http.expectOne(`${SET_URL('s1')}/links/a`);
      expect(req.request.body.enabled).toBe(false);
      fixture.detectChanges();
      expect(rows(el)[0].querySelector('.row')?.classList.contains('off')).toBe(true);
      req.flush({ ...A, enabled: false });
    });

    it('puts the text back when the save is refused', async () => {
      const { fixture, el } = await open();
      const row = rows(el)[0];
      type(cell(row, CODE), '#Bad');
      await wait(EDIT_DEBOUNCE_MS);
      http
        .expectOne(`${SET_URL('s1')}/links/a`)
        .flush({ title: 'รหัสไม่ถูกต้อง' }, { status: 400, statusText: 'Bad Request' });
      await settle();
      fixture.detectChanges();
      expect(cell(row, CODE).value).toBe('#Jan24');
    });

    it('removes a row with a toast', async () => {
      const { fixture, el } = await open();
      rows(el)[0].querySelector<HTMLButtonElement>('.rm')!.click();
      fixture.detectChanges();
      expect(rows(el)).toHaveLength(1);
      http
        .expectOne({ method: 'DELETE', url: `${SET_URL('s1')}/links/a` })
        .flush(null, { status: 204, statusText: 'No Content' });
      await settle();
      expect(toasts().some((x) => x.message === t().ts.removed)).toBe(true);
    });

    it('brings a row back when its delete is refused', async () => {
      const { fixture, el } = await open();
      rows(el)[0].querySelector<HTMLButtonElement>('.rm')!.click();
      http
        .expectOne({ method: 'DELETE', url: `${SET_URL('s1')}/links/a` })
        .flush(null, { status: 500, statusText: 'x' });
      await settle();
      fixture.detectChanges();
      expect(rows(el)).toHaveLength(2);
      expect(toasts().some((x) => x.message === t().ts.removed)).toBe(false);
    });

    it('adds an empty row and puts the cursor in its address', async () => {
      const { fixture, el } = await open();
      button(cards(el)[0], t().ts.addLink)!.click();
      const req = http.expectOne({ method: 'POST', url: `${SET_URL('s1')}/links` });
      expect(req.request.body).toEqual({ name: null, url: null, code: null, dailyMax: null });
      req.flush(apiLink({ id: 'n', url: '', name: '', valid: false }));
      // The answer reaches the card before the next render, as it does in the browser (a render is a task).
      for (let i = 0; i < 10; i++) await Promise.resolve();
      fixture.detectChanges();
      TestBed.tick();
      expect(rows(el)).toHaveLength(3);
      expect(document.activeElement).toBe(cell(rows(el)[2], URL_));
    });
  });

  describe('more options', () => {
    it('are closed in simple mode, with the toggle that opens and closes them', async () => {
      const { fixture, el } = await open();
      const card = cards(el)[0];
      expect(card.querySelector('.postas')).toBeNull();
      const toggle = button(card, t().common.more)!;
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      toggle.click();
      fixture.detectChanges();
      expect(card.querySelector('.postas')).not.toBeNull();
      expect(button(card, t().common.less)!.getAttribute('aria-expanded')).toBe('true');
      button(card, t().common.less)!.click();
      fixture.detectChanges();
      expect(card.querySelector('.postas')).toBeNull();
    });

    it('are open when simple mode is off, and the person can still close them', async () => {
      const { fixture, el } = await open({ simple: false });
      const card = cards(el)[0];
      expect(card.querySelector('.postas')).not.toBeNull();
      button(card, t().common.less)!.click();
      fixture.detectChanges();
      expect(card.querySelector('.postas')).toBeNull();
      // The choice outlives the card: the store keeps it.
      expect(TestBed.inject(LinkSetsStore).moreOpen()['s1']).toBe(false);
    });

    const openMore = (opts: Parameters<typeof open>[0] = {}) => open({ ...opts, simple: false });

    it('list the paired extensions by the name of their browser, with the automatic choice first', async () => {
      const { el } = await openMore();
      const postas = cards(el)[0].querySelector('.postas')!;
      expect(postas.querySelector('label')?.textContent).toContain(t().ts.postAs);
      const select = postas.querySelector<HTMLSelectElement>('select')!;
      expect([...select.options].map((o) => [o.value, o.textContent])).toEqual([
        ['', t().api.flow.postAsAuto],
        ['acc-fb', 'Shop PC'],
      ]);
      expect(select.value).toBe('');
      expect(postas.querySelector('.su-field-help')?.textContent).toBe(t().api.flow.postAsHint);
    });

    it('follow a rename of the browser, and show a connected account by its own name before the browsers arrive', async () => {
      const { fixture, el } = await openMore({ devices: [apiDevice({ name: 'Back office' })] });
      const options = () =>
        [...cards(el)[0].querySelectorAll<HTMLOptionElement>('.postas option')].map(
          (o) => o.textContent,
        );
      expect(options()).toEqual([t().api.flow.postAsAuto, 'Back office']);
      TestBed.inject(DevicesStore).list.set([]);
      fixture.detectChanges();
      // No device knows it yet: the account's name without its "Facebook · " prefix stands in.
      expect(options()).toEqual([t().api.flow.postAsAuto, 'Shop PC']);
    });

    it('list every paired extension, and none that no browser posts for', async () => {
      const laptop = { ...FB_CONNECTED, id: 'acc-fb2', name: 'Facebook · Laptop' };
      const { fixture, el } = await openMore({
        devices: [apiDevice(), apiDevice({ id: 'dev-2', name: 'Laptop', accountId: 'acc-fb2' })],
      });
      TestBed.inject(AccountsStore).list.update((l) => [...l, laptop]);
      fixture.detectChanges();
      const options = [...cards(el)[0].querySelectorAll<HTMLOptionElement>('.postas option')];
      expect(options.map((o) => o.textContent)).toEqual([
        t().api.flow.postAsAuto,
        'Shop PC',
        'Laptop',
      ]);
      // The unbound browser's account (ACCOUNTS[0]) is not on the list.
      expect(options.map((o) => o.value)).not.toContain('acc-page');
    });

    it('keep an extension that is no longer paired visible, labelled', async () => {
      const set = apiLinkSet({ id: 's1', links: [A], postAsAccountId: 'acc-page' });
      const { el } = await openMore({ sets: [set] });
      const select = cards(el)[0].querySelector<HTMLSelectElement>('.postas select')!;
      expect(select.value).toBe('acc-page');
      expect([...select.options].at(-1)?.textContent).toBe(`Old PC · ${t().api.unboundAccount}`);
    });

    it('say that an extension that is gone is gone', async () => {
      const set = apiLinkSet({ id: 's1', links: [A], postAsAccountId: 'acc-nobody' });
      const { el } = await openMore({ sets: [set] });
      const select = cards(el)[0].querySelector<HTMLSelectElement>('.postas select')!;
      expect([...select.options].at(-1)?.textContent).toBe(t().api.flow.postAsMissing);
    });

    it('send the chosen account, and the automatic choice as null', async () => {
      const { el } = await openMore();
      const select = cards(el)[0].querySelector<HTMLSelectElement>('.postas select')!;
      select.value = 'acc-fb';
      select.dispatchEvent(new Event('change'));
      const req = http.expectOne({ method: 'PUT', url: SET_URL('s1') });
      expect(req.request.body).toEqual({
        name: 'Condo groups',
        postAsAccountId: 'acc-fb',
        accountIds: [],
      });
      req.flush({ ...SET, postAsAccountId: 'acc-fb' });
      await settle();
      select.value = '';
      select.dispatchEvent(new Event('change'));
      const back = http.expectOne({ method: 'PUT', url: SET_URL('s1') });
      expect(back.request.body.postAsAccountId).toBeNull();
      back.flush(SET);
    });

    it('write an example of the text sent to the first group that has a code', async () => {
      const settings = { hashtags: '#condo', footer: 'Call 081', footerPos: 'end' };
      const { el } = await openMore({
        collections: [{ id: 'c1', settings } as unknown as ApiCollection],
      });
      const card = cards(el)[0];
      expect(card.querySelector('.eg .small')?.textContent).toBe(
        fmt(t().ts.example, { g: 'Condo BKK' }),
      );
      expect(card.querySelector('.sample')?.textContent).toBe(
        `#Jan24\n${t().ts.exampleBody}\n\nCall 081\n#condo`,
      );
      expect(card.querySelector('.sample .fw6')?.textContent).toBe('#Jan24\n');
    });

    it('write the example without footer and tags when there is no collection', async () => {
      const { el } = await openMore();
      expect(cards(el)[0].querySelector('.sample')?.textContent).toBe(
        `#Jan24\n${t().ts.exampleBody}`,
      );
    });

    it('have no example when no group has a code', async () => {
      const set = apiLinkSet({ id: 's1', links: [B] });
      const { el } = await openMore({ sets: [set] });
      expect(cards(el)[0].querySelector('.eg')).toBeNull();
    });
  });

  describe('new link set', () => {
    it('refuses an empty name inside the dialog', async () => {
      const { fixture, el } = await open();
      button(el, t().ts.newSet)!.click();
      fixture.detectChanges();
      expect(document.querySelector('.su-modal-title')?.textContent).toBe(t().ts.newSet);
      expect(modalBody()?.querySelector('input')?.getAttribute('maxlength')).toBe('120');
      modalButtons()[1].click();
      fixture.detectChanges();
      expect(modalBody()?.querySelector('.su-field-err')?.textContent).toBe(t().ts.errName);
      http.expectNone(SETS_URL);
    });

    it('creates the set, thanks with a toast and closes', async () => {
      const { fixture, el } = await open();
      button(el, t().ts.newSet)!.click();
      fixture.detectChanges();
      type(modalBody()!.querySelector('input')!, '  Villas  ');
      fixture.detectChanges();
      modalButtons()[1].click();
      const req = http.expectOne({ method: 'POST', url: SETS_URL });
      expect(req.request.body).toEqual({ name: 'Villas', postAsAccountId: null });
      req.flush(apiLinkSet({ id: 's2', name: 'Villas' }));
      await settle();
      fixture.detectChanges();
      expect(toasts().some((x) => x.message === fmt(t().ts.created, { s: 'Villas' }))).toBe(true);
      expect(document.querySelector('.su-modal-panel')).toBeNull();
      expect(cards(el)).toHaveLength(2);
    });

    it('keeps the dialog open, with the name, when the API refuses', async () => {
      const { fixture, el } = await open();
      button(el, t().ts.newSet)!.click();
      fixture.detectChanges();
      type(modalBody()!.querySelector('input')!, 'Villas');
      modalButtons()[1].click();
      http.expectOne(SETS_URL).flush({ title: 'เต็ม' }, { status: 422, statusText: 'x' });
      await settle();
      fixture.detectChanges();
      expect(document.querySelector('.su-modal-panel')).not.toBeNull();
      expect(modalBody()!.querySelector('input')!.value).toBe('Villas');
      expect(modalButtons()[1].disabled).toBe(false);
    });

    it('opens empty every time', async () => {
      const { fixture, el } = await open();
      button(el, t().ts.newSet)!.click();
      fixture.detectChanges();
      type(modalBody()!.querySelector('input')!, 'Draft');
      modalButtons()[0].click();
      fixture.detectChanges();
      expect(document.querySelector('.su-modal-panel')).toBeNull();
      button(el, t().ts.newSet)!.click();
      fixture.detectChanges();
      await settle();
      fixture.detectChanges();
      expect(modalBody()!.querySelector('input')!.value).toBe('');
    });
  });

  describe('paste links', () => {
    async function openBulk() {
      const page = await open();
      button(cards(page.el)[0], t().ts.bulk)!.click();
      page.fixture.detectChanges();
      return page;
    }

    it('shows the hint and the box, and refuses a text without any group link', async () => {
      const { fixture } = await openBulk();
      expect(document.querySelector('.su-modal-title')?.textContent).toBe(t().ts.bulkTitle);
      expect(modalBody()?.textContent).toContain(t().ts.bulkHint);
      type(modalBody()!.querySelector('textarea')!, 'hello\nworld');
      modalButtons()[1].click();
      fixture.detectChanges();
      expect(modalBody()?.querySelector('.su-field-err')?.textContent).toBe(t().ts.bulkEmpty);
      http.expectNone(`${SET_URL('s1')}/links/bulk`);
    });

    it('adds the pasted lines and reports what happened', async () => {
      const { fixture, el } = await openBulk();
      const text = 'https://www.facebook.com/groups/new | #C\nbad line';
      type(modalBody()!.querySelector('textarea')!, text);
      modalButtons()[1].click();
      const req = http.expectOne({ method: 'POST', url: `${SET_URL('s1')}/links/bulk` });
      expect(req.request.body).toEqual({ text });
      req.flush({
        added: 1,
        duplicates: 0,
        recoded: 0,
        invalid: 1,
        set: { ...SET, links: [A, B, apiLink({ id: 'n', code: '#C' })] },
      });
      await settle();
      fixture.detectChanges();
      const toast = toasts().find(
        (x) => x.message === fmt(t().ts.bulkResult, { n: 1, d: 0, r: 0, i: 1 }),
      );
      expect(toast?.type).toBe('info');
      expect(document.querySelector('.su-modal-panel')).toBeNull();
      expect(rows(el)).toHaveLength(3);
    });

    it('takes a page address like a group address, and says both in its words', async () => {
      const { fixture } = await openBulk();
      expect(modalBody()?.textContent).toContain(t().ts.bulkHint);
      const box = modalBody()!.querySelector('textarea')!;
      expect(box.placeholder).toContain('https://www.facebook.com/baandee.shop');
      expect(t().ts.bulkTitle).toContain('เพจ');
      type(box, 'https://www.facebook.com/baandee.shop | P1');
      modalButtons()[1].click();
      fixture.detectChanges();
      expect(modalBody()?.querySelector('.su-field-err')).toBeNull();
      const req = http.expectOne({ method: 'POST', url: `${SET_URL('s1')}/links/bulk` });
      expect(req.request.body).toEqual({ text: 'https://www.facebook.com/baandee.shop | P1' });
      req.flush({
        added: 1,
        duplicates: 0,
        recoded: 0,
        invalid: 0,
        set: { ...SET, links: [A, B, apiPageLink({ id: 'baandee.shop', code: 'P1' })] },
      });
      await settle();
      fixture.detectChanges();
    });

    it('refuses a text of Facebook screens that are not a group or a page', async () => {
      const { fixture } = await openBulk();
      type(
        modalBody()!.querySelector('textarea')!,
        'https://www.facebook.com/watch\nfacebook.com/abc',
      );
      modalButtons()[1].click();
      fixture.detectChanges();
      expect(modalBody()?.querySelector('.su-field-err')?.textContent).toBe(t().ts.bulkEmpty);
      http.expectNone(`${SET_URL('s1')}/links/bulk`);
    });

    it('reports a clean paste as a success', async () => {
      const { fixture } = await openBulk();
      type(modalBody()!.querySelector('textarea')!, 'https://www.facebook.com/groups/a');
      modalButtons()[1].click();
      http
        .expectOne(`${SET_URL('s1')}/links/bulk`)
        .flush({ added: 0, duplicates: 1, recoded: 0, invalid: 0, set: SET });
      await settle();
      fixture.detectChanges();
      expect(
        toasts().find((x) => x.message === fmt(t().ts.bulkResult, { n: 0, d: 1, r: 0, i: 0 }))
          ?.type,
      ).toBe('success');
    });
  });

  describe('import a CSV', () => {
    async function openCsv() {
      const page = await open();
      button(page.el, t().ts.csvImport)!.click();
      page.fixture.detectChanges();
      return page;
    }

    it('refuses an empty box and a text without a usable row', async () => {
      const { fixture } = await openCsv();
      expect(document.querySelector('.su-modal-title')?.textContent).toBe(t().ts.csvTitle);
      modalButtons()[1].click();
      fixture.detectChanges();
      expect(modalBody()?.querySelector('.su-field-err')?.textContent).toBe(t().ts.bulkEmpty);
      type(modalBody()!.querySelector('textarea')!, 'only one column\nset,name,not a link');
      modalButtons()[1].click();
      fixture.detectChanges();
      expect(modalBody()?.querySelector('.su-field-err')?.textContent).toBe(t().api.flow.csvNoRows);
      http.expectNone(`${SETS_URL}/import-csv`);
    });

    it('sends the rows, reads the sets again and reports what was imported', async () => {
      const { fixture, el } = await openCsv();
      type(
        modalBody()!.querySelector('textarea')!,
        'set,name,url,code\nVillas,Villas BKK,facebook.com/groups/villas,#V\nbroken',
      );
      modalButtons()[1].click();
      const req = http.expectOne({ method: 'POST', url: `${SETS_URL}/import-csv` });
      expect(req.request.body).toEqual({
        rows: [
          {
            set: 'Villas',
            name: 'Villas BKK',
            url: 'https://www.facebook.com/groups/villas',
            code: '#V',
          },
        ],
      });
      req.flush({ links: 1, sets: 1, invalid: 0 });
      await settle();
      http
        .expectOne(SETS_URL)
        .flush([SET, apiLinkSet({ id: 's2', name: 'Villas', links: [apiLink({ id: 'v' })] })]);
      await settle();
      fixture.detectChanges();
      // The row the browser dropped (one column) counts as invalid next to the server's own count.
      const toast = toasts().find((x) => x.message === fmt(t().ts.csvDone, { n: 1, s: 1, i: 1 }));
      expect(toast?.type).toBe('info');
      expect(document.querySelector('.su-modal-panel')).toBeNull();
      expect(cards(el)).toHaveLength(2);
    });

    it('takes a row with a page address next to a group', async () => {
      const { fixture } = await openCsv();
      type(
        modalBody()!.querySelector('textarea')!,
        'Shops,Baan Dee,https://m.facebook.com/baandee.shop/,P1\nShops,Group,facebook.com/groups/g1,',
      );
      modalButtons()[1].click();
      fixture.detectChanges();
      const req = http.expectOne({ method: 'POST', url: `${SETS_URL}/import-csv` });
      expect(req.request.body.rows.map((r: { url: string }) => r.url)).toEqual([
        'https://www.facebook.com/baandee.shop',
        'https://www.facebook.com/groups/g1',
      ]);
      req.flush({ links: 2, sets: 1, invalid: 0 });
      await settle();
      http.expectOne(SETS_URL).flush([SET]);
      await settle();
    });

    /** Chooses `file` in the dialog's file input, as the browser reports it. */
    async function choose(fixture: { detectChanges(): void }, file: File) {
      const input = modalBody()!.querySelector<HTMLInputElement>('input[type=file]')!;
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));
      await settle();
      fixture.detectChanges();
    }
    const box = () => modalBody()!.querySelector('textarea')!;

    it('reads a file into the box', async () => {
      const { fixture } = await openCsv();
      const file = new File(['set,name,url\nA,B,https://www.facebook.com/groups/x'], 'links.csv', {
        type: 'text/csv',
      });
      await choose(fixture, file);
      expect(box().value).toContain('https://www.facebook.com/groups/x');
    });

    it('reads it as UTF-8 (Thai text intact) and drops a leading BOM', async () => {
      const { fixture } = await openCsv();
      const text = 'set,name,url\nชุดคอนโด,ตกแต่งคอนโด,https://www.facebook.com/groups/x';
      const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(text)]);
      await choose(fixture, new File([bytes], 'links.csv', { type: 'text/csv' }));
      expect(box().value).toBe(text);
      expect(box().value.charCodeAt(0)).not.toBe(0xfeff);
    });

    it('says in the hint that the file must be UTF-8 and at most 2 MB', async () => {
      await openCsv();
      const hint = modalBody()!.querySelector('.hint')!.textContent!;
      expect(hint).toBe(t().ts.csvHint);
      expect(hint).toContain('UTF-8');
      expect(hint).toContain('2 MB');
    });

    it('refuses a file over 2 MB with a toast, and leaves the box alone', async () => {
      const { fixture } = await openCsv();
      type(box(), 'what was typed');
      const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.csv', { type: 'text/csv' });
      await choose(fixture, big);
      expect(box().value).toBe('what was typed');
      const toast = toasts().find((x) => x.message === t().api.flow.csvTooBig);
      expect(toast?.type).toBe('error');
      expect(modalBody()!.querySelector('.su-field-err')).toBeNull();
    });

    it('takes a file of exactly 2 MB', async () => {
      const { fixture } = await openCsv();
      const line = 'set,name,url\n';
      const body = 'a'.repeat(2 * 1024 * 1024 - line.length);
      await choose(fixture, new File([line + body], 'edge.csv', { type: 'text/csv' }));
      expect(box().value.length).toBe(2 * 1024 * 1024);
      expect(toasts().some((x) => x.message === t().api.flow.csvTooBig)).toBe(false);
    });

    it('says when the file is not UTF-8 and leaves the box alone', async () => {
      const { fixture } = await openCsv();
      type(box(), 'what was typed');
      // A Windows-874 file: the Thai letters are single bytes that are not valid UTF-8.
      await choose(fixture, new File([new Uint8Array([0xa1, 0xb2, 0xc3, 0x2c])], 'old.csv'));
      expect(box().value).toBe('what was typed');
      expect(modalBody()!.querySelector('.su-field-err')?.textContent).toBe(
        t().api.flow.csvNotUtf8,
      );
    });

    it('can choose the same file again', async () => {
      const { fixture } = await openCsv();
      const input = modalBody()!.querySelector<HTMLInputElement>('input[type=file]')!;
      await choose(fixture, new File(['a'], 'a.csv'));
      expect(input.value).toBe('');
    });
  });

  describe('rename and switch a set on or off', () => {
    const head = (el: HTMLElement) => cards(el)[0].querySelector<HTMLElement>('.head')!;

    it('renames a set through the dialog and shows the new name', async () => {
      const { fixture, el } = await open();
      head(el).querySelector<HTMLButtonElement>('.ibtn')!.click();
      fixture.detectChanges();
      await settle();
      const input = el.querySelector<HTMLInputElement>('app-rename-modal input')!;
      expect(input.value).toBe('Condo groups');
      type(input, ' Condo VIP ');
      el.querySelector<HTMLFormElement>('#rename-form')!.requestSubmit();
      await settle();
      const put = http.expectOne({ method: 'PUT', url: SET_URL('s1') });
      expect(put.request.body).toMatchObject({ name: 'Condo VIP' });
      put.flush({ ...SET, name: 'Condo VIP' });
      await settle();
      fixture.detectChanges();
      expect(cards(el)[0].querySelector('.title .fw6')!.textContent).toBe('Condo VIP');
      expect(el.querySelector('app-rename-modal .su-modal-panel')).toBeNull();
    });

    it('switches a set off and says what that means for its schedules', async () => {
      const { fixture, el } = await open();
      expect(cards(el)[0].querySelector('.off-note')).toBeNull();
      head(el).querySelector<HTMLInputElement>('app-checkbox input')!.click();
      await settle();
      const req = http.expectOne({ method: 'PUT', url: `${SET_URL('s1')}/active` });
      expect(req.request.body).toEqual({ active: false });
      req.flush({ ...SET, active: false });
      await settle();
      fixture.detectChanges();
      answerWorkspaceLoads(http);
      await settle();
      fixture.detectChanges();
      expect(cards(el)[0].querySelector('section')!.classList.contains('off-item')).toBe(true);
      expect(cards(el)[0].querySelector('.off-note')!.textContent).toBe(t().api.setOffHint);
    });

    it('is off for a viewer', async () => {
      const { el } = await open({ role: 'viewer' });
      expect(head(el).querySelector<HTMLButtonElement>('.ibtn')!.disabled).toBe(true);
      expect(head(el).querySelector<HTMLInputElement>('app-checkbox input')!.disabled).toBe(true);
    });
  });

  describe('delete a set', () => {
    it('deletes it at once and says so', async () => {
      const { fixture, el } = await open();
      button(cards(el)[0], t().ts.removeSet)!.click();
      const req = http.expectOne({ method: 'DELETE', url: SET_URL('s1') });
      req.flush(null, { status: 204, statusText: 'No Content' });
      await settle();
      fixture.detectChanges();
      expect(
        toasts().some((x) => x.message === fmt(t().ts.setDeleted, { s: 'Condo groups' })),
      ).toBe(true);
      expect(cards(el)).toHaveLength(0);
    });

    it('keeps the set and toasts the API answer when a schedule uses it', async () => {
      const { fixture, el } = await open();
      button(cards(el)[0], t().ts.removeSet)!.click();
      http
        .expectOne({ method: 'DELETE', url: SET_URL('s1') })
        .flush(
          { title: 'ชุดนี้ถูกใช้ในตาราง ขายคอนโด ลบตารางนั้นก่อน' },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
      await settle();
      fixture.detectChanges();
      const toast = toasts().find((x) => x.message.includes('ขายคอนโด'));
      expect(toast?.type).toBe('error');
      expect(cards(el)).toHaveLength(1);
      expect(toasts().some((x) => x.message.startsWith(t().ts.setDeleted.slice(0, 6)))).toBe(false);
    });
  });

  describe('CSV export', () => {
    it('saves the links file and says so', async () => {
      const { el } = await open();
      const created: Blob[] = [];
      URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
        created.push(b as Blob);
        return 'blob:x';
      });
      URL.revokeObjectURL = vi.fn();
      const clicks: string[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        clicks.push(this.download);
      });
      button(el, t().ts.csvExport)!.click();
      expect(clicks).toEqual(['autopost-links.csv']);
      expect(await created[0].text()).toContain('Condo groups,Condo BKK,');
      expect(
        toasts().some((x) => x.message === fmt(t().col.exported, { f: 'autopost-links.csv' })),
      ).toBe(true);
      vi.restoreAllMocks();
    });

    it('is off while there is nothing to export', async () => {
      const { el } = await open({ sets: [] });
      expect(button(el, t().ts.csvExport)!.disabled).toBe(true);
    });
  });

  describe('permissions', () => {
    for (const [name, opts] of [
      ['a viewer', { role: 'viewer' as const }],
      ['an admin in assist mode', { role: 'owner' as const, assist: true }],
    ] as const) {
      it(`makes every control read-only for ${name}, and says why`, async () => {
        const set = apiLinkSet({
          id: 's1',
          links: [A, apiLink({ id: 'o', enabled: false, health: 'off', failStreak: 2 })],
        });
        const { el } = await open({ ...opts, sets: [set], simple: false });
        expect(el.querySelector('app-perm-note')?.textContent).toContain(
          opts.assist ? t().api.permAssist : t().api.permEdit,
        );
        // Header: new set and import are off, the export stays.
        expect(button(el, t().ts.newSet)!.disabled).toBe(true);
        expect(button(el, t().ts.csvImport)!.disabled).toBe(true);
        expect(button(el, t().ts.csvExport)!.disabled).toBe(false);
        const card = cards(el)[0];
        for (const label of [t().ts.addLink, t().ts.bulk, t().ts.schedule, t().ts.removeSet]) {
          const b = button(card, label)!;
          expect(b.disabled, label).toBe(true);
          expect(b.getAttribute('title'), label).toBeTruthy();
        }
        for (const row of rows(card)) {
          expect(
            [...row.querySelectorAll<HTMLInputElement>('input')].every((i) => i.disabled),
          ).toBe(true);
          expect(row.querySelector<HTMLButtonElement>('.rm')!.disabled).toBe(true);
        }
        expect(button(card, t().ts.enableAgain)!.disabled).toBe(true);
        expect(card.querySelector<HTMLSelectElement>('.postas select')!.disabled).toBe(true);
      });
    }

    it('leaves everything on for an editor', async () => {
      const { el } = await open({ role: 'editor', simple: false });
      expect(el.querySelector('app-perm-note')?.textContent?.trim()).toBe('');
      expect(button(el, t().ts.newSet)!.disabled).toBe(false);
      const card = cards(el)[0];
      expect(button(card, t().ts.addLink)!.disabled).toBe(false);
      expect(button(card, t().ts.removeSet)!.disabled).toBe(false);
      expect(rows(card)[0].querySelector<HTMLButtonElement>('.rm')!.disabled).toBe(false);
      expect(cell(rows(card)[0], URL_).disabled).toBe(false);
    });
  });
});

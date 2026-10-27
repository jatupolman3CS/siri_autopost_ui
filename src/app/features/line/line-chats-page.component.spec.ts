import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { DevicesStore } from '../../core/data/devices.store';
import { LineChatsStore } from '../../core/data/line-chats.store';
import { NotificationService } from '../../core/services/notification.service';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiDevice, ApiLineChatPage, ApiWorkspace } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.line';
import { provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { apiDevice } from '../../testing/link-sets.fixtures';
import { apiLineChat, apiLineChatPage, apiLineDevice } from '../../testing/line.fixtures';
import { LineChatsPageComponent } from './line-chats-page.component';

const WS_BASE = '/api/workspaces/ws-1';

const SOMCHAI = apiLineChat({
  id: 'a',
  name: 'สมชาย',
  labels: ['VIP'],
  lastMessageAt: '2026-10-20T10:05:00',
  unread: true,
  linkedSetCount: 2,
});
const MANEE = apiLineChat({ id: 'b', name: 'มานี' });
const PITI = apiLineChat({ id: 'c', name: 'ปิติ', doNotSend: true });

describe('LineChatsPageComponent', () => {
  let http: HttpTestingController;
  let events: FakeDeviceEvents;

  /** The page, signed in; `devices` is what GET devices answers, `chats` the first page of the roster. */
  async function open(
    opts: {
      workspace?: Partial<ApiWorkspace>;
      devices?: ApiDevice[];
      chats?: ApiLineChatPage;
    } = {},
  ) {
    http = provideApiTesting({
      imports: [LineChatsPageComponent],
      providers: [provideRouter([]), { provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    events = TestBed.inject(DeviceEventsService) as unknown as FakeDeviceEvents;
    TestBed.inject(WorkspaceStore);
    TestBed.inject(DevicesStore);
    // The stores the page builds on exist before the sign-in, so its loads are answered with the others.
    TestBed.inject(LineChatsStore);
    await signIn(http, { workspace: opts.workspace, devices: opts.devices ?? [] });
    const fixture = TestBed.createComponent(LineChatsPageComponent);
    fixture.detectChanges();
    await settle();
    // The page looks at the browsers once when it opens, and reads the first page of the roster.
    for (const r of http.match((x) => x.method === 'GET' && x.url === `${WS_BASE}/devices`))
      r.flush(opts.devices ?? []);
    const locked = opts.workspace?.lineChat === false;
    if (!locked) {
      http
        .expectOne((x) => x.method === 'GET' && x.url === `${WS_BASE}/line/chats`)
        .flush(opts.chats ?? apiLineChatPage([SOMCHAI, MANEE, PITI], { labels: ['VIP', 'ใหม่'] }));
    }
    await settle();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const t = () => TestBed.inject(I18nService).t();
  const toasts = () =>
    TestBed.inject(NotificationService)
      .toasts()
      .map((x) => x.message);
  const rows = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('app-line-chat-row')];
  const reads = () => http.match((x) => x.method === 'GET' && x.url === `${WS_BASE}/line/chats`);

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    try {
      http?.verify();
    } finally {
      http = undefined!;
      TestBed.resetTestingModule();
      localStorage.clear();
    }
  });

  describe('the roster', () => {
    it('has its title and subtitle, and lists every customer with the name LINE shows', async () => {
      const { el } = await open({ devices: [apiLineDevice()] });
      expect(el.querySelector('h1')?.textContent).toBe(t().api.line.chatTitle);
      expect(el.querySelector('.page-head p')?.textContent).toBe(t().api.line.chatSub);
      expect(rows(el).map((r) => r.querySelector('.text')?.textContent?.trim())).toEqual([
        'สมชาย',
        'มานี',
        'ปิติ',
      ]);
    });

    it('shows labels, when the customer last chatted, how many link sets hold the chat and a dot for unread', async () => {
      const { el } = await open({ devices: [apiLineDevice()] });
      const [first, second] = rows(el);
      expect(first.textContent).toContain('VIP');
      expect(first.textContent).toContain(fmt(t().api.line.chatInSets, { n: 2 }));
      expect(first.textContent).toContain('10:05');
      expect(first.querySelector('.unread')).not.toBeNull();
      expect(second.querySelector('.unread')).toBeNull();
      expect(second.textContent).toContain(t().api.line.chatLastUnknown);
      expect(second.textContent).toContain(t().api.line.chatInNoSet);
    });

    it('never has a message to show: no text, no preview, only name, labels, time and the mark', async () => {
      const { el } = await open({ devices: [apiLineDevice()] });
      // The API gives no message text, so nothing of the page may promise or show it.
      expect(el.querySelector('textarea')).toBeNull();
      expect(el.textContent).not.toMatch(/ข้อความล่าสุด|last message:/i);
    });

    it('shows the do-not-send mark of each customer in its switch', async () => {
      const { el } = await open({ devices: [apiLineDevice()] });
      const boxes = rows(el).map((r) => r.querySelector<HTMLInputElement>('input[type=checkbox]')!);
      expect(boxes.map((b) => b.checked)).toEqual([false, false, true]);
      expect(boxes[0].getAttribute('aria-label')).toBe(
        fmt(t().api.line.chatDoNotSendAria, { name: 'สมชาย' }),
      );
    });

    it('turns do-not-send on with one request, says so and keeps it', async () => {
      const { fixture, el } = await open({ devices: [apiLineDevice()] });
      const box = rows(el)[0].querySelector<HTMLInputElement>('input[type=checkbox]')!;
      box.checked = true;
      box.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      const req = http.expectOne((x) => x.method === 'PUT' && x.url === `${WS_BASE}/line/chats/a`);
      expect(req.request.body).toEqual({ doNotSend: true });
      req.flush({ ...SOMCHAI, doNotSend: true });
      await settle();
      fixture.detectChanges();
      expect(rows(el)[0].querySelector<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(
        true,
      );
      expect(rows(el)[0].querySelector('.dns')).not.toBeNull();
      expect(toasts()).toContain(fmt(t().api.line.chatDnsOn, { name: 'สมชาย' }));
    });

    it('puts the switch back when the server refuses', async () => {
      const { fixture, el } = await open({ devices: [apiLineDevice()] });
      const box = rows(el)[2].querySelector<HTMLInputElement>('input[type=checkbox]')!;
      box.checked = false;
      box.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      http
        .expectOne((x) => x.method === 'PUT' && x.url === `${WS_BASE}/line/chats/c`)
        .flush(null, { status: 403, statusText: 'Forbidden' });
      await settle();
      fixture.detectChanges();
      expect(rows(el)[2].querySelector<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(
        true,
      );
    });

    it('lets a viewer look but not change anything', async () => {
      const { el } = await open({ workspace: { role: 'viewer' }, devices: [apiLineDevice()] });
      expect(el.querySelector('app-perm-note')?.textContent).toContain(t().api.permEdit);
      for (const r of rows(el))
        expect(r.querySelector<HTMLInputElement>('input[type=checkbox]')!.disabled).toBe(true);
      expect(el.querySelector<HTMLButtonElement>('app-line-status button')!.disabled).toBe(true);
    });
  });

  describe('filters', () => {
    it('sends the label, the recency and the do-not-send choice from the first page', async () => {
      const { fixture, el } = await open({ devices: [apiLineDevice()] });
      const selects = [...el.querySelectorAll<HTMLSelectElement>('app-select-field select')];
      // label, recency, do-not-send (one account: no account picker)
      expect(selects).toHaveLength(3);
      expect([...selects[0].options].map((o) => o.textContent?.trim())).toEqual([
        t().api.line.chatLabelAll,
        'VIP',
        'ใหม่',
      ]);
      selects[0].value = 'VIP';
      selects[0].dispatchEvent(new Event('change'));
      fixture.detectChanges();
      await settle();
      let [r] = reads();
      expect(r.request.params.get('label')).toBe('VIP');
      expect(r.request.params.get('page')).toBe('1');
      r.flush(apiLineChatPage([SOMCHAI], { labels: ['VIP', 'ใหม่'] }));
      await settle();
      fixture.detectChanges();
      selects[1].value = '7';
      selects[1].dispatchEvent(new Event('change'));
      selects[2].value = 'false';
      selects[2].dispatchEvent(new Event('change'));
      fixture.detectChanges();
      await settle();
      [r] = reads();
      expect(r.request.params.get('activeWithinDays')).toBe('7');
      expect(r.request.params.get('doNotSend')).toBe('false');
      expect(r.request.params.get('label')).toBe('VIP');
      r.flush(apiLineChatPage([SOMCHAI]));
    });

    it('sends what is typed in the search, and clears every filter with one button', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        const { fixture, el } = await open({ devices: [apiLineDevice()] });
        const input = el.querySelector<HTMLInputElement>('app-input-field input')!;
        input.value = 'สมชาย';
        input.dispatchEvent(new Event('input'));
        vi.advanceTimersByTime(400);
        fixture.detectChanges();
        await settle();
        let [r] = reads();
        expect(r.request.params.get('q')).toBe('สมชาย');
        r.flush(apiLineChatPage([SOMCHAI]));
        await settle();
        fixture.detectChanges();
        expect(el.textContent).toContain(fmt(t().api.line.chatShown, { n: 1 }));
        const clear = [...el.querySelectorAll<HTMLButtonElement>('.foot button')].find((b) =>
          b.textContent?.includes(t().api.line.chatClearFilters),
        )!;
        clear.click();
        fixture.detectChanges();
        await settle();
        [r] = reads();
        expect(r.request.params.has('q')).toBe(false);
        r.flush(apiLineChatPage([SOMCHAI, MANEE, PITI]));
        await settle();
      } finally {
        vi.useRealTimers();
      }
    });

    it('says nothing matches when a filter leaves no chat, and keeps the filters to change', async () => {
      const { fixture, el } = await open({ devices: [apiLineDevice()] });
      const select = el.querySelector<HTMLSelectElement>('app-select-field select')!;
      select.value = 'ใหม่';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      await settle();
      reads()[0].flush(apiLineChatPage([], { labels: ['VIP', 'ใหม่'] }));
      await settle();
      fixture.detectChanges();
      expect(el.querySelector('.nomatch')?.textContent).toBe(t().api.line.chatNoMatch);
      expect(el.querySelector('app-select-field select')).not.toBeNull();
    });

    it('offers an account picker only with two or more LINE accounts', async () => {
      const { fixture, el } = await open({
        devices: [apiLineDevice()],
        chats: apiLineChatPage([SOMCHAI], {
          accounts: [
            { id: 'acc-line', name: 'LINE · Shop OA', deviceId: 'dev-1', ready: true },
            { id: 'acc-2', name: 'LINE · Branch OA', deviceId: 'dev-2', ready: false },
          ],
        }),
      });
      const select = el.querySelector<HTMLSelectElement>('app-select-field select')!;
      expect([...select.options].map((o) => o.textContent?.trim())).toEqual([
        t().api.line.chatAccountAll,
        'Shop OA',
        'Branch OA',
      ]);
      select.value = 'acc-2';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      await settle();
      const [r] = reads();
      expect(r.request.params.get('accountId')).toBe('acc-2');
      r.flush(apiLineChatPage([SOMCHAI]));
    });

    it('pages: the pager asks for the next page', async () => {
      const many = Array.from({ length: 20 }, (_, i) => apiLineChat({ id: `n${i}` }));
      const { fixture, el } = await open({
        devices: [apiLineDevice()],
        chats: apiLineChatPage(many, { total: 45 }),
      });
      expect(el.querySelector('app-pager')?.textContent).toContain('1');
      const next = [...el.querySelectorAll<HTMLButtonElement>('app-pager button')].find(
        (b) => !b.disabled && /next|ถัดไป|chevron-right/i.test(b.outerHTML),
      );
      expect(next).toBeDefined();
      next!.click();
      fixture.detectChanges();
      await settle();
      const [r] = reads();
      expect(r.request.params.get('page')).toBe('2');
      r.flush(apiLineChatPage([apiLineChat({ id: 'z' })], { total: 45 }));
    });
  });

  describe('the status of the browsers', () => {
    const syncButton = (el: HTMLElement) =>
      el.querySelector<HTMLButtonElement>('app-line-status button')!;

    it('names the Official Account, the browser, the chats synced and when', async () => {
      const { el } = await open({ devices: [apiLineDevice({}, { chatCount: 41 })] });
      const card = el.querySelector('app-line-status')!;
      expect(card.textContent).toContain('Shop OA');
      expect(card.textContent).toContain('Shop PC');
      expect(card.textContent).toContain(t().api.line.chatStateReady);
      expect(card.textContent).toContain(fmt(t().api.line.chatCount, { n: 41 }));
      expect(card.textContent).not.toContain(t().api.line.chatNeverSynced);
    });

    it('says the sync was never done when there is no time', async () => {
      const { el } = await open({ devices: [apiLineDevice({}, { syncedAt: null, chatCount: 0 })] });
      expect(el.querySelector('app-line-status')!.textContent).toContain(
        t().api.line.chatNeverSynced,
      );
    });

    it('sends the sync command to the browser and says so', async () => {
      const { fixture, el } = await open({ devices: [apiLineDevice()] });
      syncButton(el).click();
      fixture.detectChanges();
      const req = http.expectOne(
        (x) => x.method === 'POST' && x.url === `${WS_BASE}/devices/dev-1/commands`,
      );
      expect(req.request.body).toEqual({ cmd: 'syncLineChats', args: {} });
      req.flush({ id: 'c1', cmd: 'syncLineChats', status: 'pending' });
      await settle();
      expect(toasts()).toContain(fmt(t().api.line.chatSyncSent, { name: 'Shop PC' }));
      // A second click right away does not send another.
      fixture.detectChanges();
      expect(syncButton(el).disabled).toBe(true);
    });

    it('cannot sync while the browser is offline or not logged in to LINE, and says why', async () => {
      const { el } = await open({
        devices: [
          apiLineDevice({ online: false }),
          apiLineDevice({ id: 'dev-2', name: 'Laptop' }, { ready: false, sessionLost: true }),
        ],
      });
      const buttons = [...el.querySelectorAll<HTMLButtonElement>('app-line-status .su-btn-secondary')];
      expect(buttons.map((b) => b.disabled)).toEqual([true, true]);
      expect(buttons[0].title).toBe(t().api.line.chatDeviceOffline);
      expect(buttons[1].title).toBe(t().api.line.chatSyncNeedsLogin);
      const text = el.querySelector('app-line-status')!.textContent!;
      expect(text).toContain(t().api.line.chatStateLogin);
      expect(text).toContain(t().api.line.chatStateLoginHint);
    });

    it('has a change-LINE-OA button on every connected browser that opens the confirm dialog', async () => {
      const { el, fixture } = await open({ devices: [apiLineDevice()] });
      const change = [...el.querySelectorAll<HTMLButtonElement>('app-line-status .su-btn-ghost')].find((b) =>
        b.textContent?.includes(t().api.line.chatChange),
      )!;
      expect(change.disabled).toBe(false);
      change.click();
      fixture.detectChanges();
      expect(el.ownerDocument.body.textContent).toContain(t().api.line.chatChangeTitle);
    });

    it('says a LINE account that is resting, with the time it rests until', async () => {
      const until = new Date(Date.now() + 3 * 3600_000).toISOString();
      const { el } = await open({ devices: [apiLineDevice({}, { restUntil: until })] });
      const card = el.querySelector('app-line-status')!;
      expect(card.textContent).toContain(t().api.line.chatStateResting);
      expect(card.textContent).toContain('·'); // the hint names the time
      expect(card.querySelector('.dot')?.getAttribute('data-state')).toBe('resting');
    });

    it('explains how to connect when no browser reports a LINE account, and has no roster to show', async () => {
      const { el } = await open({
        devices: [apiDevice()],
        chats: apiLineChatPage([], { accounts: [] }),
      });
      expect(el.querySelector('app-line-status app-empty-state')?.textContent).toContain(
        t().api.line.chatNoLineTitle,
      );
      expect(el.textContent).not.toContain(t().api.line.chatEmptyTitle);
      expect(rows(el)).toHaveLength(0);
      // The browser is listed with a button that opens its extension's LINE setup.
      const connect = el.querySelector<HTMLButtonElement>('app-line-status .su-btn-primary')!;
      expect(connect.textContent).toContain(t().api.line.chatConnect);
      expect(connect.disabled).toBe(false);
    });

    it('says the list fills after the sync when a browser is connected but no chat is there yet', async () => {
      const { el } = await open({
        devices: [apiLineDevice({}, { chatCount: 0, syncedAt: null })],
        chats: apiLineChatPage([]),
      });
      expect(el.textContent).toContain(t().api.line.chatEmptyTitle);
      expect(el.textContent).toContain(t().api.line.chatEmptyBody);
    });
  });

  describe('a plan without LINE chats', () => {
    it('shows the lock and asks the server for nothing', async () => {
      const { el } = await open({ workspace: { lineChat: false } });
      expect(el.querySelector('app-feature-lock')).not.toBeNull();
      expect(el.querySelector('app-feature-lock')!.textContent).toContain(
        fmt(t().api.line.chatLockedTitle, { plan: t().plans.pro.name }),
      );
      expect(el.querySelector('app-line-status')).toBeNull();
      expect(rows(el)).toHaveLength(0);
      expect(reads()).toHaveLength(0);
    });

    it('shows the lock when the server says 403 although the workspace did not', async () => {
      http = provideApiTesting({
        imports: [LineChatsPageComponent],
        providers: [
          provideRouter([]),
          { provide: DeviceEventsService, useClass: FakeDeviceEvents },
        ],
      });
      TestBed.inject(WorkspaceStore);
      TestBed.inject(LineChatsStore);
      await signIn(http);
      const fixture = TestBed.createComponent(LineChatsPageComponent);
      fixture.detectChanges();
      await settle();
      for (const r of http.match((x) => x.url === `${WS_BASE}/devices`)) r.flush([]);
      http
        .expectOne((x) => x.method === 'GET' && x.url === `${WS_BASE}/line/chats`)
        .flush({ title: 'x' }, { status: 403, statusText: 'Forbidden' });
      await settle();
      fixture.detectChanges();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('app-feature-lock'),
      ).not.toBeNull();
      expect(TestBed.inject(LineChatsStore).locked()).toBe(true);
    });
  });

  it('reads the roster again when the browser reports a new sync', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const { fixture, el } = await open({ devices: [apiLineDevice()] });
      events.emit('device.line_chats', { count: 4 });
      vi.advanceTimersByTime(1600);
      await settle();
      // The device list follows the same event (its chat count changed).
      for (const r of http.match((x) => x.method === 'GET' && x.url === `${WS_BASE}/devices`))
        r.flush([apiLineDevice({}, { chatCount: 4 })]);
      const [r] = reads();
      r.flush(apiLineChatPage([SOMCHAI, MANEE, PITI, apiLineChat({ id: 'd', name: 'ใหม่' })]));
      await settle();
      fixture.detectChanges();
      expect(rows(el)).toHaveLength(4);
    } finally {
      vi.useRealTimers();
    }
  });
});

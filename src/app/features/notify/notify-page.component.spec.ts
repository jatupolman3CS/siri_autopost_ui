import { HttpTestingController } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { assistStorage } from '../../core/auth/token';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { NotificationsStore } from '../../core/data/notifications.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiLinkSet, ApiNotifications, ApiRole } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.engine';
import { NotificationService } from '../../core/services/notification.service';
import { lookup } from '../../core/services/title.strategy';
import {
  WS,
  provideApiTesting,
  settle,
  signIn,
  signInHoldingWorkspaces,
} from '../../testing/api-testing';
import {
  COLLECTIONS_URL,
  NOTIFY_URL,
  TELEGRAM_READY,
  notifications,
} from '../../testing/engine.fixtures';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { apiLink, apiLinkSet } from '../../testing/link-sets.fixtures';
import { NotifyPageComponent } from './notify-page.component';

const SETS_URL = `/api/workspaces/${WS}/link-sets`;
const A = apiLink({ id: 'a', name: 'Condo BKK', code: '#Jan24' });
const B = apiLink({ id: 'b', name: 'Condo rent' });
const OFF = apiLink({ id: 'c', name: 'Switched off', enabled: false });
const SET = apiLinkSet({ id: 's1', name: 'Condo groups', links: [A, B, OFF] });
const SET2 = apiLinkSet({
  id: 's2',
  name: 'Cars',
  links: [apiLink({ id: 'd', name: 'Cars BKK' })],
});

describe('NotifyPageComponent', () => {
  let http: HttpTestingController;

  async function open(
    opts: {
      role?: ApiRole;
      plan?: boolean;
      assist?: boolean;
      notifications?: ApiNotifications;
      sets?: ApiLinkSet[];
      posts?: string[];
    } = {},
  ) {
    http = provideApiTesting({
      imports: [NotifyPageComponent],
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
    TestBed.inject(WorkspaceStore);
    await signIn(http, {
      workspace: { role: opts.role ?? 'owner', notifications: opts.plan ?? true },
    });
    const fixture = TestBed.createComponent(NotifyPageComponent);
    fixture.detectChanges();
    await settle();
    http.expectOne(NOTIFY_URL).flush(opts.notifications ?? notifications());
    http.expectOne(SETS_URL).flush(opts.sets ?? [SET, SET2]);
    await settle();
    http.expectOne(COLLECTIONS_URL).flush([
      {
        id: 'c1',
        name: 'Shelves',
        posts: (opts.posts ?? ['Teak shelf']).map((text) => ({ text })),
      },
    ]);
    await settle();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const t = () => TestBed.inject(I18nService).t();
  const toasts = () => TestBed.inject(NotificationService).toasts();
  const store = () => TestBed.inject(NotificationsStore);
  const button = (root: ParentNode, text: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.trim().includes(text),
    );
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const cards = (el: HTMLElement) => [
    ...el.querySelectorAll<HTMLElement>('app-notify-channel-card'),
  ];
  const pill = (root: ParentNode, label: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button.pill')].find(
      (b) => b.textContent?.trim() === label,
    )!;
  const select = (root: ParentNode, n = 0) =>
    root.querySelectorAll<HTMLSelectElement>('select.su-select')[n];
  const choose = (sel: HTMLSelectElement, value: string) => {
    sel.value = value;
    sel.dispatchEvent(new Event('change'));
  };
  const save = (el: HTMLElement) => button(el.querySelector('.page-head')!, t().common.save)!;

  afterEach(() => {
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
      http = provideApiTesting();
      const route = routes
        .find((r) => r.path === 'app')!
        .children!.find((c) => c.path === 'notify')!;
      expect(route.title).toBe('nav.notify');
      expect(lookup(TestBed.inject(I18nService).t(), route.title as string)).toBeTruthy();
      const loaded = await (route.loadComponent as () => Promise<Type<unknown>>)();
      expect(loaded).toBe(NotifyPageComponent);
    });
  });

  describe('page', () => {
    it('shows the title, the corrected subtitle, the two channels and the sections', async () => {
      const { el } = await open();
      expect(el.querySelector('h1')?.textContent).toBe(t().ntf.title);
      // The design said the extension sends the messages and the tokens stay on the machine: not true.
      expect(el.querySelector('.page-head p')?.textContent).toBe(t().ntf.sub);
      expect(t().ntf.sub).not.toMatch(/ส่วนขยาย/);
      expect(cards(el).map((c) => c.querySelector('h2')?.textContent)).toEqual([
        t().ntf.tg,
        t().ntf.line,
      ]);
      const headings = [...el.querySelectorAll('h2')].map((h) => h.textContent);
      expect(headings).toContain(t().ntf.events);
      expect(headings).toContain(t().ntf.perSet);
      expect(headings).toContain(t().ntf.cmdTitle);
    });

    it('waits for the settings before it shows any controls', async () => {
      http = provideApiTesting({
        imports: [NotifyPageComponent],
        providers: [
          provideRouter([{ path: '**', children: [] }]),
          { provide: DeviceEventsService, useClass: FakeDeviceEvents },
        ],
      });
      TestBed.inject(WorkspaceStore);
      await signIn(http);
      const fixture = TestBed.createComponent(NotifyPageComponent);
      fixture.detectChanges();
      await settle();
      expect(fixture.nativeElement.textContent).toContain(t().api.loading);
      expect(fixture.nativeElement.querySelector('app-notify-channel-card')).toBeNull();
      http.expectOne(NOTIFY_URL).flush(notifications());
      http.expectOne(SETS_URL).flush([]);
      await settle();
      http.expectOne(COLLECTIONS_URL).flush([]);
      await settle();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-notify-channel-card')).not.toBeNull();
    });

    it('shows the default channel and the event pills as saved', async () => {
      const { el } = await open();
      const ev = el.querySelectorAll('.panel')[2]; // the events panel (after the two channel cards)
      expect(select(ev).value).toBe('tg');
      expect(pill(el, t().ntf.eFail).getAttribute('aria-pressed')).toBe('true');
      expect(pill(el, t().ntf.eSuccess).getAttribute('aria-pressed')).toBe('false');
      expect(pill(el, t().ntf.eQuota).getAttribute('aria-pressed')).toBe('false');
    });

    it('previews an alert in the format the server sends, with a coded group and a post', async () => {
      const { el } = await open();
      const sample = el.querySelector('.sample')!.textContent;
      expect(sample).toBe(fmt(t().ntf.sample, { g: 'Condo BKK (#Jan24)', t: '#Jan24 Teak shelf' }));
      expect(sample).not.toContain('10:21');
      expect(sample).not.toContain('✅');
    });

    it('writes the post as the server would for that group: spintax resolved, the code in, one line', async () => {
      const { el } = await open({ posts: ['{สวัสดี|หวัดดี} ห้อง {{code}}\nโทรเลย'] });
      expect(el.querySelector('.sample')!.textContent).toBe(
        fmt(t().ntf.sample, { g: 'Condo BKK (#Jan24)', t: 'สวัสดี ห้อง #Jan24 โทรเลย' }),
      );
    });

    it('cuts a long post in the preview', async () => {
      const { el } = await open({ posts: ['x'.repeat(60)] });
      expect(el.querySelector('.sample')!.textContent).toContain(
        `“${('#Jan24 ' + 'x'.repeat(60)).slice(0, 40)}…”`,
      );
    });
  });

  describe('honest controls', () => {
    it('has a real switch for every event, the machine-takes-a-job one off by default', async () => {
      const { el } = await open();
      // The screenshot goes with the Telegram message of a post, and the offline message comes from the device watcher.
      for (const label of [t().ntf.eShot, t().ntf.eOffline, t().ntf.eFail, t().ntf.eJob]) {
        expect(pill(el, label).disabled).toBe(false);
        expect(pill(el, label).title).toBe('');
      }
      expect(pill(el, t().ntf.eJob).getAttribute('aria-pressed')).toBe('false');
      expect(pill(el, t().ntf.eOffline).getAttribute('aria-pressed')).toBe('true');
    });

    it('says the chat commands are only saved, with a badge', async () => {
      const { el } = await open();
      const card = el.querySelector('app-notify-commands-card')!;
      expect(card.textContent).toContain(t().ntf.cmdBody);
      expect(t().ntf.cmdBody).toMatch(/ยังใช้ไม่ได้|Not available/);
      expect(card.querySelector('app-chip')?.textContent).toBe(t().api.engine.storedOnlyBadge);
      expect([...card.querySelectorAll('app-chip')].map((c) => c.textContent)).toContain('/status');
    });

    it('saves the command switch and the allowed users', async () => {
      const { fixture, el } = await open();
      const card = el.querySelector('app-notify-commands-card')!;
      card.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
      type(card.querySelector<HTMLInputElement>('input.su-input')!, '123, U9');
      fixture.detectChanges();
      expect(store().settings()).toMatchObject({ commandsOn: true, commandsUsers: '123, U9' });
    });
  });

  describe('write-only tokens', () => {
    it('shows a mask and the stored note when a token is stored, and never the token', async () => {
      const { el } = await open({ notifications: notifications({ ...TELEGRAM_READY }) });
      const input = cards(el)[0].querySelector<HTMLInputElement>('input[type=password]')!;
      expect(input.value).toBe('');
      expect(input.placeholder).toBe('••••••••••••');
      expect(input.autocomplete).toBe('new-password');
      expect(cards(el)[0].textContent).toContain(t().api.engine.tokenSaved);
      expect(
        cards(el)[1].querySelector<HTMLInputElement>('input[type=password]')!.placeholder,
      ).toBe('eyJhbGciOi…');
      expect(cards(el)[1].textContent).not.toContain(t().api.engine.tokenSaved);
    });

    it('sends the typed token once, and the next save sends none', async () => {
      const { fixture, el } = await open();
      type(cards(el)[0].querySelector<HTMLInputElement>('input[type=password]')!, '123:ABC');
      fixture.detectChanges();
      save(el).click();
      await settle();
      const req = http.expectOne({ url: NOTIFY_URL, method: 'PUT' });
      expect(req.request.body.telegram.token).toBe('123:ABC');
      req.flush({
        ...req.request.body,
        telegram: { ...req.request.body.telegram, token: null, hasToken: true },
      });
      await settle();
      fixture.detectChanges();
      const input = cards(el)[0].querySelector<HTMLInputElement>('input[type=password]')!;
      expect(input.value).toBe('');
      expect(input.placeholder).toBe('••••••••••••');
      expect(cards(el)[0].textContent).toContain(t().api.engine.tokenSaved);

      save(el).click();
      await settle();
      const again = http.expectOne({ url: NOTIFY_URL, method: 'PUT' });
      expect(again.request.body.telegram.token).toBeNull();
      again.flush(again.request.body);
      await settle();
    });

    it('removes a stored token on request: an empty string is sent', async () => {
      const { fixture, el } = await open({ notifications: notifications({ ...TELEGRAM_READY }) });
      button(cards(el)[0], t().api.engine.notifyRemoveToken)!.click();
      fixture.detectChanges();
      expect(cards(el)[0].textContent).toContain(t().api.engine.notifyTokenRemoves);
      save(el).click();
      await settle();
      const req = http.expectOne({ url: NOTIFY_URL, method: 'PUT' });
      expect(req.request.body.telegram.token).toBe('');
      req.flush({
        ...req.request.body,
        telegram: { ...req.request.body.telegram, token: null, hasToken: false },
      });
      await settle();
      fixture.detectChanges();
      expect(cards(el)[0].textContent).not.toContain(t().api.engine.tokenSaved);
      expect(
        cards(el)[0].querySelector<HTMLInputElement>('input[type=password]')!.placeholder,
      ).toBe('123456789:AA…');
    });

    it('lets the person keep the token after asking to remove it', async () => {
      const { fixture, el } = await open({ notifications: notifications({ ...TELEGRAM_READY }) });
      button(cards(el)[0], t().api.engine.notifyRemoveToken)!.click();
      fixture.detectChanges();
      button(cards(el)[0], t().api.engine.notifyKeepToken)!.click();
      fixture.detectChanges();
      expect(store().tokens().tg).toBeNull();
      expect(cards(el)[0].textContent).toContain(t().api.engine.tokenSaved);
    });
  });

  describe('saving', () => {
    it('sends the complete body and tells the person', async () => {
      const { fixture, el } = await open();
      const tg = cards(el)[0];
      tg.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
      type(tg.querySelectorAll<HTMLInputElement>('input.su-input')[1], '-100555');
      pill(el, t().ntf.eSuccess).click();
      choose(select(el.querySelectorAll('.panel')[2]), 'both');
      fixture.detectChanges();
      save(el).click();
      await settle();
      const req = http.expectOne({ url: NOTIFY_URL, method: 'PUT' });
      const body = req.request.body as ApiNotifications;
      expect(body.telegram).toMatchObject({ on: true, chatId: '-100555', token: null });
      expect(body.events.success).toBe(true);
      expect(body.channel).toBe('both');
      req.flush(body);
      await settle();
      expect(toasts().some((x) => x.message === t().ntf.saved)).toBe(true);
    });

    it('does not say saved when the API refuses', async () => {
      const { el } = await open();
      save(el).click();
      await settle();
      http
        .expectOne({ url: NOTIFY_URL, method: 'PUT' })
        .flush({ title: 'no' }, { status: 403, statusText: 'Forbidden' });
      await settle();
      expect(toasts().some((x) => x.message === t().ntf.saved)).toBe(false);
    });
  });

  describe('permissions and plan', () => {
    it('is turned off under a lock banner on a plan without notifications, but keeps its content', async () => {
      const { el } = await open({ plan: false });
      expect(el.querySelector('app-feature-lock')?.textContent).toContain(t().ntf.advanced);
      expect(el.querySelector('app-feature-lock')?.textContent).toContain(t().ntf.locked);
      expect(el.querySelector('a[href="/app/billing"]')?.textContent).toContain(t().common.upgrade);
      expect(cards(el)).toHaveLength(2);
      expect(el.querySelector('.content')?.classList.contains('locked')).toBe(true);
      expect(save(el).disabled).toBe(true);
      expect(save(el).title).toBe(fmt(t().api.engine.planLocked, { plan: t().plans.pro.name }));
      for (const c of el.querySelectorAll<HTMLInputElement>('app-notify-channel-card input'))
        expect(c.disabled).toBe(true);
      expect(pill(el, t().ntf.eFail).disabled).toBe(true);
      expect(button(cards(el)[0], t().ntf.sendTest)!.disabled).toBe(true);
      expect(button(cards(el)[0], t().ntf.tgFind)!.disabled).toBe(true);
    });

    it('shows no lock banner and no dimmed content before the workspaces have arrived, then locks', async () => {
      http = provideApiTesting({
        imports: [NotifyPageComponent],
        providers: [
          provideRouter([{ path: '**', children: [] }]),
          { provide: DeviceEventsService, useClass: FakeDeviceEvents },
        ],
      });
      const ws = TestBed.inject(WorkspaceStore);
      const held = await signInHoldingWorkspaces(http);
      const fixture = TestBed.createComponent(NotifyPageComponent);
      fixture.detectChanges();
      await settle();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(ws.loaded()).toBe(false);
      expect(el.querySelector('app-feature-lock')).toBeNull();
      expect(el.querySelector('.locked')).toBeNull();
      await held.answer({ notifications: false });
      fixture.detectChanges();
      await settle();
      fixture.detectChanges();
      expect(el.querySelector('app-feature-lock')).not.toBeNull();
      expect(el.querySelector('.content')?.classList.contains('locked')).toBe(true);
    });

    it('offers no upgrade to someone who is not the owner (the plan is the owner’s)', async () => {
      const { el } = await open({ plan: false, role: 'admin' });
      expect(el.querySelector('app-feature-lock')).not.toBeNull();
      expect(el.querySelector('a[href="/app/billing"]')).toBeNull();
    });

    it('turns every control off for an editor and says why', async () => {
      const { el } = await open({ role: 'editor' });
      expect(el.querySelector('app-perm-note')?.textContent).toContain(
        TestBed.inject(I18nService).t().api.permAdmin,
      );
      expect(el.querySelector('app-feature-lock')).toBeNull();
      expect(save(el).disabled).toBe(true);
      expect(save(el).title).toBe(t().api.permAdmin);
      expect(pill(el, t().ntf.eFail).disabled).toBe(true);
      expect(cards(el)[0].querySelector<HTMLInputElement>('input[type=checkbox]')!.disabled).toBe(
        true,
      );
      expect(select(el.querySelectorAll('.panel')[2]).disabled).toBe(true);
    });

    it('is read-only in assist mode', async () => {
      const { el } = await open({ assist: true });
      expect(el.querySelector('app-perm-note')?.textContent).toContain(t().api.permAssist);
      expect(save(el).disabled).toBe(true);
    });

    it('lets an admin edit', async () => {
      const { el } = await open({ role: 'admin' });
      expect(el.querySelector('app-perm-note')?.textContent?.trim()).toBe('');
      expect(save(el).disabled).toBe(false);
      expect(pill(el, t().ntf.eFail).disabled).toBe(false);
    });
  });

  describe('Telegram chat lookup', () => {
    const find = (el: HTMLElement) => button(cards(el)[0], t().ntf.tgFind)!;

    it('asks for the token first', async () => {
      const { el } = await open();
      find(el).click();
      await settle();
      expect(toasts().some((x) => x.message === t().api.engine.notifyFindNeedsToken)).toBe(true);
    });

    it('fills the chat id when exactly one chat is found, with the typed token', async () => {
      const { fixture, el } = await open();
      type(cards(el)[0].querySelector<HTMLInputElement>('input[type=password]')!, '123:ABC');
      fixture.detectChanges();
      find(el).click();
      await settle();
      const req = http.expectOne(`${NOTIFY_URL}/telegram/chats`);
      expect(req.request.body).toEqual({ token: '123:ABC' });
      req.flush({ chats: [{ id: '-100777', title: 'AutoPost alerts' }] });
      await settle();
      fixture.detectChanges();
      expect(store().settings()?.telegram.chatId).toBe('-100777');
      expect(cards(el)[0].querySelectorAll<HTMLInputElement>('input.su-input')[1].value).toBe(
        '-100777',
      );
      expect(
        toasts().some(
          (x) => x.message === fmt(t().ntf.tgFound, { n: 'AutoPost alerts', id: '-100777' }),
        ),
      ).toBe(true);
    });

    it('lets the person pick when several chats are found', async () => {
      const { fixture, el } = await open({ notifications: notifications({ ...TELEGRAM_READY }) });
      find(el).click();
      await settle();
      const req = http.expectOne(`${NOTIFY_URL}/telegram/chats`);
      expect(req.request.body).toEqual({ token: null });
      req.flush({
        chats: [
          { id: '-1', title: 'One' },
          { id: '-2', title: 'Two' },
        ],
      });
      await settle();
      fixture.detectChanges();
      const picks = cards(el)[0].querySelectorAll<HTMLButtonElement>('.chats button');
      expect([...picks].map((b) => b.textContent?.trim())).toEqual(['One · -1', 'Two · -2']);
      picks[1].click();
      fixture.detectChanges();
      expect(store().settings()?.telegram.chatId).toBe('-2');
      expect(cards(el)[0].querySelector('.chats')).toBeNull();
    });

    it('says when no chat is found yet, and shows Telegram’s reason when it refuses', async () => {
      const { el } = await open({ notifications: notifications({ ...TELEGRAM_READY }) });
      find(el).click();
      await settle();
      http.expectOne(`${NOTIFY_URL}/telegram/chats`).flush({ chats: [] });
      await settle();
      expect(toasts().some((x) => x.message === t().api.engine.notifyChatsNone)).toBe(true);
      find(el).click();
      await settle();
      http
        .expectOne(`${NOTIFY_URL}/telegram/chats`)
        .flush({ title: 'Telegram: Unauthorized' }, { status: 422, statusText: 'Unprocessable' });
      await settle();
      expect(toasts().some((x) => x.message === 'Telegram: Unauthorized')).toBe(true);
    });
  });

  describe('test message', () => {
    it('asks for the token and the recipient first', async () => {
      const { el } = await open();
      button(cards(el)[1], t().ntf.sendTest)!.click();
      await settle();
      expect(toasts().some((x) => x.message === t().ntf.needToken)).toBe(true);
    });

    it('sends through the channel with what is saved and says it was sent', async () => {
      const { el } = await open({ notifications: notifications({ ...TELEGRAM_READY }) });
      button(cards(el)[0], t().ntf.sendTest)!.click();
      await settle();
      const req = http.expectOne(`${NOTIFY_URL}/test`);
      expect(req.request.body).toEqual({ channel: 'tg' });
      req.flush({ ok: true, message: 'ส่งข้อความทดสอบไปยัง Telegram แล้ว' });
      await settle();
      expect(toasts().some((x) => x.message === fmt(t().ntf.testSent, { ch: t().ntf.tg }))).toBe(
        true,
      );
    });

    it('shows the reason when the channel says no', async () => {
      const { el } = await open({ notifications: notifications({ ...TELEGRAM_READY }) });
      button(cards(el)[0], t().ntf.sendTest)!.click();
      await settle();
      http
        .expectOne(`${NOTIFY_URL}/test`)
        .flush({ ok: false, message: 'Telegram: chat not found' });
      await settle();
      expect(toasts().some((x) => x.message === 'Telegram: chat not found')).toBe(true);
    });
  });

  describe('per link set', () => {
    const panel = (el: HTMLElement) => el.querySelectorAll<HTMLElement>('.panel')[3];
    const sets = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('app-notify-set-rule')];

    it('lists the sets with the channel they follow and how many groups post', async () => {
      const { el } = await open();
      expect(sets(el).map((s) => s.querySelector('.fw6')?.textContent)).toEqual([
        'Condo groups',
        'Cars',
      ]);
      // The switched-off link is not a group that posts.
      expect(sets(el)[0].querySelector('.small')?.textContent).toBe(
        `${t().ntf.tg} · ${fmt(t().ts.linksN, { n: 2 })}`,
      );
    });

    it('says how many groups are reached, counting only a channel that is ready', async () => {
      const notReady = await open();
      expect(notReady.el.querySelector('[role=status]')?.textContent).toBe(
        fmt(t().ntf.summary, { on: 0, n: 3, tg: 0, ln: 0 }),
      );
      expect(panel(notReady.el).querySelector('.callout')?.textContent).toContain(
        fmt(t().api.engine.notifyNotReady, { ch: t().ntf.tg }),
      );
    });

    it('counts them all once Telegram is ready, with no warning', async () => {
      const { el } = await open({ notifications: notifications({ ...TELEGRAM_READY }) });
      expect(el.querySelector('[role=status]')?.textContent).toBe(
        fmt(t().ntf.summary, { on: 3, n: 3, tg: 3, ln: 0 }),
      );
      expect(panel(el).querySelector('.callout')).toBeNull();
    });

    it('gives a set its own channel, and drops the rule when it goes back to the default', async () => {
      const { fixture, el } = await open({ notifications: notifications({ ...TELEGRAM_READY }) });
      choose(select(sets(el)[0]), 'off');
      fixture.detectChanges();
      expect(store().settings()?.sets).toEqual([
        { linkSetId: 's1', channel: 'off', events: null, groups: {} },
      ]);
      expect(sets(el)[0].querySelector('.small')?.textContent).toContain(t().ntf.chOff);
      expect(el.querySelector('[role=status]')?.textContent).toBe(
        fmt(t().ntf.summary, { on: 1, n: 3, tg: 1, ln: 0 }),
      );
      choose(select(sets(el)[0]), 'default');
      fixture.detectChanges();
      expect(store().settings()?.sets).toEqual([]);
    });

    it('offers custom events for a set, starting from the workspace’s, and goes back', async () => {
      const { fixture, el } = await open();
      const set = sets(el)[0];
      expect(set.querySelector('app-notify-pills')).toBeNull();
      button(set, t().ntf.customEvents)!.click();
      fixture.detectChanges();
      expect(set.querySelector('app-notify-pills')).not.toBeNull();
      pill(set, t().ntf.eSuccess).click();
      fixture.detectChanges();
      expect(pill(set, t().ntf.eSuccess).getAttribute('aria-pressed')).toBe('true');
      expect(
        pill(el.querySelectorAll<HTMLElement>('.panel')[2], t().ntf.eSuccess).getAttribute(
          'aria-pressed',
        ),
      ).toBe('false');
      expect(store().settings()?.sets[0].events?.success).toBe(true);
      button(set, t().ntf.useDefaultEvents)!.click();
      fixture.detectChanges();
      expect(set.querySelector('app-notify-pills')).toBeNull();
      expect(store().settings()?.sets).toEqual([]);
    });

    it('opens the groups of a set and sets one group, keyed by the link', async () => {
      const { fixture, el } = await open({ notifications: notifications({ ...TELEGRAM_READY }) });
      const set = sets(el)[0];
      expect(set.querySelector('.group')).toBeNull();
      button(set, t().ntf.groups)!.click();
      fixture.detectChanges();
      const groups = [...set.querySelectorAll<HTMLElement>('.group')];
      expect(groups.map((g) => g.querySelector('.name')?.textContent)).toEqual([
        'Condo BKK',
        'Condo rent',
      ]);
      expect(groups[0].querySelector('.small')?.textContent).toBe(
        `${t().ntf.tg} · 6/9 · ${t().cal.code} #Jan24`,
      );
      expect(groups[1].querySelector('.small')?.textContent).toBe(`${t().ntf.tg} · 6/9`);
      choose(select(groups[0]), 'line');
      fixture.detectChanges();
      expect(store().settings()?.sets).toEqual([
        {
          linkSetId: 's1',
          channel: 'default',
          events: null,
          groups: { a: { channel: 'line', events: null } },
        },
      ]);
      button(groups[1], t().ntf.customEvents)!.click();
      fixture.detectChanges();
      pill(groups[1], t().ntf.eFail).click();
      fixture.detectChanges();
      expect(store().settings()?.sets[0].groups['b'].events?.fail).toBe(false);
      expect(groups[1].querySelector('.small')?.textContent).toBe(`${t().ntf.tg} · 5/9`);
      expect(button(set, t().ntf.hideGroups)).toBeTruthy();
    });

    it('says what to do when there is no link set yet', async () => {
      const { el } = await open({ sets: [] });
      expect(panel(el).textContent).toContain(t().api.engine.notifyNoSets);
      expect(panel(el).querySelector('a[href="/app/targets"]')).not.toBeNull();
    });

    it('says when a set has no group that posts', async () => {
      const { fixture, el } = await open({
        sets: [apiLinkSet({ id: 's3', name: 'Empty', links: [OFF] })],
      });
      button(el.querySelector('app-notify-set-rule')!, t().ntf.groups)!.click();
      fixture.detectChanges();
      expect(el.querySelector('app-notify-set-rule')!.textContent).toContain(
        t().api.engine.notifyNoGroups,
      );
    });
  });

  describe('English and the language packs', () => {
    afterEach(() => TestBed.inject(I18nService).setLang('th'));

    it('reads the dictionary in the chosen language', async () => {
      const { fixture, el } = await open();
      TestBed.inject(I18nService).setLang('en');
      fixture.detectChanges();
      expect(el.querySelector('h1')?.textContent).toBe('Notifications');
    });
  });
});

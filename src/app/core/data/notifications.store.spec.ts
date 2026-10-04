import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiCollection, ApiLinkSet, ApiNotifications, ApiWorkspace } from '../http/api.service';
import { WORKSPACE, WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import {
  COLLECTIONS_URL,
  NOTIFY_URL,
  TELEGRAM_READY,
  notifications,
} from '../../testing/engine.fixtures';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { apiLink, apiLinkSet } from '../../testing/link-sets.fixtures';
import { DeviceEventsService } from './device-events.service';
import {
  NOTIFY_EVENTS,
  NotificationsStore,
  SENT_EVENTS,
  UNSENT_EVENTS,
  channelOf,
  eventsOf,
  sentCount,
} from './notifications.store';
import { WorkspaceStore } from './workspace.store';

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

describe('NotificationsStore', () => {
  let http: HttpTestingController;
  let store: NotificationsStore;

  async function start(
    opts: {
      notifications?: ApiNotifications;
      sets?: ApiLinkSet[];
      workspace?: Partial<ApiWorkspace>;
      collections?: Partial<ApiCollection>[];
    } = {},
  ): Promise<void> {
    http = provideApiTesting({
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    TestBed.inject(WorkspaceStore);
    await signIn(http, { workspace: opts.workspace });
    store = TestBed.inject(NotificationsStore);
    await settle();
    http.expectOne(NOTIFY_URL).flush(opts.notifications ?? notifications());
    http.expectOne(SETS_URL).flush(opts.sets ?? [SET, SET2]);
    await settle();
    http.expectOne(COLLECTIONS_URL).flush(opts.collections ?? []);
    await settle();
  }

  afterEach(() => http.verify());

  describe('loading', () => {
    it('loads the settings, keeps them as the saved copy and reports them loaded', async () => {
      await start();
      expect(store.loaded()).toBe(true);
      expect(store.settings()?.channel).toBe('tg');
      expect(store.dirty()).toBe(false);
      expect(store.tokens()).toEqual({ tg: null, line: null });
    });

    it('is locked below Pro (the owner plan flag of the workspace), not by the signed-in role', async () => {
      await start({ workspace: { notifications: false } });
      expect(store.locked()).toBe(true);
    });

    it('is not locked on a plan with notifications', async () => {
      await start();
      expect(store.locked()).toBe(false);
    });

    it('takes the first post text of the collections for the sample alert', async () => {
      await start({
        collections: [
          { id: 'c1', posts: [{ text: '  ' }, { text: 'Teak shelf 1,290 baht' }] as never },
        ],
      });
      expect(store.samplePost()).toBe('Teak shelf 1,290 baht');
    });

    it('empties itself with the workspace and loads the next one', async () => {
      await start();
      const ws = TestBed.inject(WorkspaceStore);
      ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
      ws.switchTo('ws-2');
      await settle();
      expect(store.settings()).toBeNull();
      expect(store.loaded()).toBe(false);
      http.expectOne('/api/workspaces/ws-2/notifications').flush(notifications({ channel: 'off' }));
      http.expectOne('/api/workspaces/ws-2/link-sets').flush([]);
      await settle();
      http.expectOne('/api/workspaces/ws-2/collections').flush([]);
      await settle();
      expect(store.settings()?.channel).toBe('off');
    });
  });

  describe('resolution (group, then set, then workspace)', () => {
    const S = notifications({
      channel: 'tg',
      events: { ...notifications().events, success: true },
      sets: [
        {
          linkSetId: 's1',
          channel: 'line',
          events: null,
          groups: {
            a: { channel: 'both', events: null },
            b: { channel: 'default', events: { ...notifications().events, fail: false } },
          },
        },
      ],
    });

    it('a group follows its set, a set follows the workspace', () => {
      expect(channelOf(S, 's1', 'a')).toBe('both');
      expect(channelOf(S, 's1', 'b')).toBe('line'); // its own rule says default
      expect(channelOf(S, 's1', 'zzz')).toBe('line'); // no rule of its own at all
      expect(channelOf(S, 's1')).toBe('line');
      expect(channelOf(S, 's2', 'd')).toBe('tg');
    });

    it('events follow the same order', () => {
      expect(eventsOf(S, 's1', 'b').fail).toBe(false);
      expect(eventsOf(S, 's1', 'a').fail).toBe(true); // group has none: the set has none: the workspace's
      expect(eventsOf(S, 's1', 'a').success).toBe(true);
      expect(eventsOf(S, 's2').success).toBe(true);
    });

    it('counts only the events that are really sent', () => {
      expect(UNSENT_EVENTS).toEqual(['shot', 'offline']);
      expect(SENT_EVENTS).toHaveLength(NOTIFY_EVENTS.length - 2);
      expect(sentCount(notifications().events)).toBe(4); // fail, round, startStop, block (shot and offline are on but not sent)
      expect(sentCount({ ...notifications().events, success: true, quota: true })).toBe(6);
    });
  });

  describe('summary', () => {
    it('counts groups that post (switched on, a real address) and the alerts that can reach them', async () => {
      await start({ notifications: notifications({ ...TELEGRAM_READY }) });
      // SET has 2 active links + 1 switched off; SET2 has 1: four links post to 3 groups.
      expect(store.summary()).toEqual({ n: 3, on: 3, tg: 3, ln: 0 });
    });

    it('counts nothing for a channel that is not ready (off, or no recipient)', async () => {
      await start({
        notifications: notifications({
          telegram: { on: true, token: null, hasToken: true, chatId: '' },
        }),
      });
      expect(store.telegramReady()).toBe(false);
      expect(store.summary()).toEqual({ n: 3, on: 0, tg: 0, ln: 0 });
      expect(store.notReady()).toEqual(['tg']);
    });

    it('follows the rules: a set on LINE, a group off, a group on both', async () => {
      await start({
        notifications: notifications({
          ...TELEGRAM_READY,
          line: { on: true, token: null, hasToken: true, to: 'U1' },
          sets: [
            {
              linkSetId: 's1',
              channel: 'line',
              events: null,
              groups: { a: { channel: 'both', events: null }, b: { channel: 'off', events: null } },
            },
          ],
        }),
      });
      // a: tg+line, b: off, d (set 2): tg by default.
      expect(store.summary()).toEqual({ n: 3, on: 2, tg: 2, ln: 1 });
      expect(store.notReady()).toEqual([]);
    });

    it('does not count Telegram while its token is being removed', async () => {
      await start({ notifications: notifications({ ...TELEGRAM_READY }) });
      store.setTokenRemoved('tg', true);
      expect(store.telegramState()).toBe('clear');
      expect(store.summary().on).toBe(0);
    });
  });

  describe('tokens are write-only', () => {
    it('never puts a typed token into the settings and saves null when nothing was typed', async () => {
      await start({ notifications: notifications({ ...TELEGRAM_READY }) });
      expect(store.telegramState()).toBe('saved');
      store.setChannelOn('line', true);
      const saving = store.save();
      const req = http.expectOne({ url: NOTIFY_URL, method: 'PUT' });
      expect(req.request.body.telegram.token).toBeNull();
      expect(req.request.body.line.token).toBeNull();
      expect(req.request.body.telegram.hasToken).toBe(true);
      req.flush({ ...req.request.body, line: { ...req.request.body.line, token: null } });
      expect(await saving).toBe(true);
    });

    it('sends the typed text, then forgets it and shows the stored state from the answer', async () => {
      await start();
      expect(store.telegramState()).toBe('none');
      store.setToken('tg', '123:ABC');
      expect(store.telegramState()).toBe('new');
      expect(store.settings()?.telegram.token).toBeNull();
      expect(store.dirty()).toBe(true);

      const saving = store.save();
      const req = http.expectOne({ url: NOTIFY_URL, method: 'PUT' });
      expect(req.request.body.telegram.token).toBe('123:ABC');
      expect(req.request.body.line.token).toBeNull();
      req.flush({
        ...req.request.body,
        telegram: { ...req.request.body.telegram, token: null, hasToken: true },
      });
      expect(await saving).toBe(true);
      expect(store.tokens()).toEqual({ tg: null, line: null });
      expect(store.telegramState()).toBe('saved');
      expect(store.settings()?.telegram.token).toBeNull();
      expect(store.dirty()).toBe(false);
    });

    it('sends an empty string to remove the stored token, and typing again takes that back', async () => {
      await start({ notifications: notifications({ ...TELEGRAM_READY }) });
      store.setTokenRemoved('tg', true);
      expect(store.tokens().tg).toBe('');
      expect(store.dirty()).toBe(true);
      store.setTokenRemoved('tg', false);
      expect(store.tokens().tg).toBeNull();
      expect(store.dirty()).toBe(false);

      store.setTokenRemoved('tg', true);
      const saving = store.save();
      const req = http.expectOne({ url: NOTIFY_URL, method: 'PUT' });
      expect(req.request.body.telegram.token).toBe('');
      req.flush({
        ...req.request.body,
        telegram: { ...req.request.body.telegram, token: null, hasToken: false },
      });
      await saving;
      expect(store.telegramState()).toBe('none');
    });

    it('treats an emptied text field as "nothing typed" (the stored token stays)', async () => {
      await start({ notifications: notifications({ ...TELEGRAM_READY }) });
      store.setToken('tg', 'abc');
      store.setToken('tg', '');
      expect(store.tokens().tg).toBeNull();
      expect(store.telegramState()).toBe('saved');
    });

    it('keeps what was typed while a save is in flight', async () => {
      await start();
      store.setToken('line', 'first');
      const saving = store.save();
      const req = http.expectOne({ url: NOTIFY_URL, method: 'PUT' });
      store.setToken('line', 'second');
      req.flush({
        ...req.request.body,
        line: { ...req.request.body.line, token: null, hasToken: true },
      });
      await saving;
      expect(store.tokens().line).toBe('second');
      expect(store.dirty()).toBe(true);
    });
  });

  describe('edits and save', () => {
    it('sends the complete body with every edit', async () => {
      await start();
      store.setChannelOn('tg', true);
      store.setTarget('tg', '-100777');
      store.setDefaultChannel('both');
      store.setDefaultEvent('success', true);
      store.setCommands({ on: true, users: '123' });
      store.setRuleChannel('s1', null, 'line');
      store.setRuleChannel('s1', 'a', 'off');
      expect(store.dirty()).toBe(true);

      const saving = store.save();
      const req = http.expectOne({ url: NOTIFY_URL, method: 'PUT' });
      const body = req.request.body as ApiNotifications;
      expect(body.telegram).toEqual({ on: true, token: null, hasToken: false, chatId: '-100777' });
      expect(body.channel).toBe('both');
      expect(body.events.success).toBe(true);
      expect(body.commandsOn).toBe(true);
      expect(body.commandsUsers).toBe('123');
      expect(body.sets).toEqual([
        {
          linkSetId: 's1',
          channel: 'line',
          events: null,
          groups: { a: { channel: 'off', events: null } },
        },
      ]);
      req.flush(body);
      expect(await saving).toBe(true);
      expect(store.dirty()).toBe(false);
      expect(store.saving()).toBe(false);
    });

    it('stays dirty and says so when the API refuses', async () => {
      await start();
      store.setDefaultChannel('off');
      const saving = store.save();
      http
        .expectOne({ url: NOTIFY_URL, method: 'PUT' })
        .flush({ title: 'ต้องใช้แผน Pro ขึ้นไป' }, { status: 403, statusText: 'Forbidden' });
      expect(await saving).toBe(false);
      expect(store.dirty()).toBe(true);
      expect(store.saving()).toBe(false);
      expect(store.settings()?.channel).toBe('off');
    });

    it('does not start a second save while one is in flight', async () => {
      await start();
      store.setDefaultChannel('off');
      const first = store.save();
      expect(await store.save()).toBe(false);
      http.expectOne({ url: NOTIFY_URL, method: 'PUT' }).flush(store.settings());
      await first;
    });

    it('gives a set its own events as a copy of what it follows, then back', async () => {
      await start();
      store.setCustomEvents('s1', null, true);
      expect(eventsOf(store.settings()!, 's1')).toEqual(store.settings()!.events);
      store.setRuleEvent('s1', null, 'success', true);
      expect(eventsOf(store.settings()!, 's1').success).toBe(true);
      expect(store.settings()!.events.success).toBe(false);
      // A group under it starts from the set's events.
      store.setCustomEvents('s1', 'a', true);
      expect(eventsOf(store.settings()!, 's1', 'a').success).toBe(true);
      store.setRuleEvent('s1', 'a', 'fail', false);
      expect(eventsOf(store.settings()!, 's1', 'a').fail).toBe(false);
      expect(eventsOf(store.settings()!, 's1', 'b').fail).toBe(true);

      store.setCustomEvents('s1', 'a', false);
      store.setCustomEvents('s1', null, false);
      expect(store.settings()!.sets).toEqual([]); // back at the defaults: nothing to save
      expect(store.dirty()).toBe(false);
    });

    it('leaves a rule that is already custom alone when asked for custom again', async () => {
      await start();
      store.setCustomEvents('s1', null, true);
      store.setRuleEvent('s1', null, 'quota', true);
      const before = store.settings();
      store.setCustomEvents('s1', null, true);
      expect(store.settings()).toBe(before);
    });

    it('drops rules that went back to the defaults and keeps the others in place', async () => {
      await start();
      store.setRuleChannel('s1', null, 'line');
      store.setRuleChannel('s2', null, 'off');
      store.setRuleChannel('s1', null, 'tg');
      expect(store.settings()!.sets.map((r) => [r.linkSetId, r.channel])).toEqual([
        ['s1', 'tg'],
        ['s2', 'off'],
      ]);
      store.setRuleChannel('s1', null, 'default');
      expect(store.settings()!.sets.map((r) => r.linkSetId)).toEqual(['s2']);
    });
  });

  describe('testing a channel', () => {
    it('sends nothing without a token and a recipient', async () => {
      await start();
      expect(await store.testChannel('tg')).toEqual({ status: 'incomplete' });
      store.setToken('tg', 'abc');
      expect(await store.testChannel('tg')).toEqual({ status: 'incomplete' }); // no chat id yet
      store.setTarget('tg', '-1');
      store.setTokenRemoved('tg', true);
      expect(await store.testChannel('tg')).toEqual({ status: 'incomplete' }); // token being removed
    });

    it('tests what is saved: unsaved changes are saved first', async () => {
      await start({ notifications: notifications({ ...TELEGRAM_READY }) });
      store.setTarget('tg', '-100999');
      const testing = store.testChannel('tg');
      await settle();
      const save = http.expectOne({ url: NOTIFY_URL, method: 'PUT' });
      expect(save.request.body.telegram.chatId).toBe('-100999');
      save.flush(save.request.body);
      await settle();
      const test = http.expectOne(`${NOTIFY_URL}/test`);
      expect(test.request.body).toEqual({ channel: 'tg' });
      test.flush({ ok: true, message: 'ส่งข้อความทดสอบไปยัง Telegram แล้ว' });
      expect(await testing).toEqual({ status: 'ok' });
    });

    it('does not save when nothing changed, and reports the gateway’s reason when it fails', async () => {
      await start({
        notifications: notifications({
          line: { on: true, token: null, hasToken: true, to: 'U1' },
        }),
      });
      const testing = store.testChannel('line');
      await settle();
      http.expectNone({ url: NOTIFY_URL, method: 'PUT' });
      http.expectOne(`${NOTIFY_URL}/test`).flush({ ok: false, message: 'LINE: token ไม่ถูกต้อง' });
      expect(await testing).toEqual({ status: 'failed', message: 'LINE: token ไม่ถูกต้อง' });
    });

    it('reports a refusal of the API (a plan below Pro) with its title', async () => {
      await start({ notifications: notifications({ ...TELEGRAM_READY }) });
      const testing = store.testChannel('tg');
      await settle();
      http
        .expectOne(`${NOTIFY_URL}/test`)
        .flush({ title: 'ต้องใช้แผน Pro ขึ้นไป' }, { status: 403, statusText: 'Forbidden' });
      expect(await testing).toEqual({ status: 'failed', message: 'ต้องใช้แผน Pro ขึ้นไป' });
    });

    it('says the API did not answer when the request never arrives', async () => {
      await start({ notifications: notifications({ ...TELEGRAM_READY }) });
      const testing = store.testChannel('tg');
      await settle();
      http.expectOne(`${NOTIFY_URL}/test`).error(new ProgressEvent('error'));
      expect(await testing).toEqual({ status: 'unreachable' });
    });

    it('stops when the save before the test is refused', async () => {
      await start({ notifications: notifications({ ...TELEGRAM_READY }) });
      store.setTarget('tg', '-1');
      const testing = store.testChannel('tg');
      await settle();
      http
        .expectOne({ url: NOTIFY_URL, method: 'PUT' })
        .flush({ title: 'no' }, { status: 403, statusText: 'Forbidden' });
      expect(await testing).toEqual({ status: 'saveFailed' });
      http.expectNone(`${NOTIFY_URL}/test`);
    });
  });

  describe('finding Telegram chats', () => {
    it('needs a token (typed or stored)', async () => {
      await start();
      expect(await store.findChats()).toEqual({ status: 'incomplete' });
    });

    it('looks up with the typed token', async () => {
      await start();
      store.setToken('tg', '123:ABC');
      const finding = store.findChats();
      await settle();
      const req = http.expectOne(`${NOTIFY_URL}/telegram/chats`);
      expect(req.request.body).toEqual({ token: '123:ABC' });
      req.flush({ chats: [{ id: '-100', title: 'Alerts' }] });
      expect(await finding).toEqual({ status: 'ok', chats: [{ id: '-100', title: 'Alerts' }] });
    });

    it('looks up with the stored token when none is typed (the body carries none)', async () => {
      await start({ notifications: notifications({ ...TELEGRAM_READY }) });
      const finding = store.findChats();
      await settle();
      const req = http.expectOne(`${NOTIFY_URL}/telegram/chats`);
      expect(req.request.body).toEqual({ token: null });
      req.flush({ chats: [] });
      expect(await finding).toEqual({ status: 'ok', chats: [] });
    });

    it('says the API did not answer when the request never arrives', async () => {
      await start({ notifications: notifications({ ...TELEGRAM_READY }) });
      const finding = store.findChats();
      await settle();
      http.expectOne(`${NOTIFY_URL}/telegram/chats`).error(new ProgressEvent('error'));
      expect(await finding).toEqual({ status: 'unreachable' });
    });

    it('reports Telegram refusing the token', async () => {
      await start();
      store.setToken('tg', 'bad');
      const finding = store.findChats();
      await settle();
      http
        .expectOne(`${NOTIFY_URL}/telegram/chats`)
        .flush({ title: 'Telegram: Unauthorized' }, { status: 422, statusText: 'Unprocessable' });
      expect(await finding).toEqual({ status: 'failed', message: 'Telegram: Unauthorized' });
    });
  });
});

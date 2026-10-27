import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ACCOUNTS,
  WORKSPACE,
  WS,
  apiPost,
  provideApiTesting,
  settle,
  signIn,
} from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { AccountsStore } from './accounts.store';
import { DeviceEventsService } from './device-events.service';
import { SettingsStore, defaultAdvanced, defaultAntiBan } from './settings.store';
import { WorkspaceStore } from './workspace.store';

const engine = (min: number, devices = 0, typingSpeed = 'normal') => ({
  antiBan: {
    min,
    max: 20,
    limits: { fb: 25 },
    typing: true,
    typingSpeed,
    scroll: false,
    shuffle: false,
    autoPause: false,
    warmup: false,
  },
  offline: { policy: 'skip', window: '30m', line: false, email: false, push: false },
  extensionOnline: true,
  simulatedOffline: false,
  devices,
  devicesOnline: 0,
});

describe('SettingsStore', () => {
  let http: HttpTestingController;
  let store: SettingsStore;
  let events: FakeDeviceEvents;
  const now = Date.now();
  const ago = (h: number) => new Date(now - h * 3600_000).toISOString();

  beforeEach(async () => {
    http = provideApiTesting({
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    store = TestBed.inject(SettingsStore);
    events = TestBed.inject(DeviceEventsService) as unknown as FakeDeviceEvents;
    await signIn(http, {
      posts: [
        // Sent in the last 24 h by the connected account, a pending one, a failed one, and an old one.
        apiPost({
          id: 'a',
          accountId: 'acc-page',
          platform: 'fb',
          status: 'success',
          scheduledAt: ago(2),
          publishedAt: ago(2),
        }),
        apiPost({
          id: 'b',
          accountId: 'acc-page',
          platform: 'fb',
          status: 'pending',
          scheduledAt: ago(3),
          publishedAt: ago(3),
        }),
        apiPost({
          id: 'c',
          accountId: 'acc-page',
          platform: 'fb',
          status: 'failed',
          scheduledAt: ago(4),
        }),
        apiPost({
          id: 'd',
          accountId: 'acc-page',
          platform: 'fb',
          status: 'success',
          scheduledAt: ago(30),
          publishedAt: ago(30),
        }),
        // By an account that is not a browser's (nothing counts for it).
        apiPost({
          id: 'e',
          accountId: 'acc-other',
          platform: 'fb',
          status: 'success',
          scheduledAt: ago(1),
          publishedAt: ago(1),
        }),
        // Two LINE chats sent by the connected LINE account: they count against the LINE limit, not the Facebook one.
        apiPost({
          id: 'l1',
          accountId: 'acc-line',
          platform: 'line',
          status: 'success',
          scheduledAt: ago(1),
          publishedAt: ago(1),
        }),
        apiPost({
          id: 'l2',
          accountId: 'acc-line',
          platform: 'line',
          status: 'success',
          scheduledAt: ago(5),
          publishedAt: ago(5),
        }),
      ],
    });
  });

  afterEach(() => http.verify());

  it('counts what the server counts: Facebook posts of connected accounts, success and pending, last 24 hours', async () => {
    const accounts = TestBed.inject(AccountsStore);
    const account = (id: string, connected: boolean) => ({ ...ACCOUNTS[0], id, connected });
    // Only acc-page is a connected (device) account; acc-other is not.
    accounts.list.set([account('acc-page', true), account('acc-other', false)]);
    expect(store.used24h()).toBe(2);
    accounts.list.set([account('acc-page', false), account('acc-other', false)]);
    expect(store.used24h()).toBe(0);
  });

  it('counts Facebook posts and LINE chats apart, each against its own limit', () => {
    const accounts = TestBed.inject(AccountsStore);
    const account = (id: string, platform: 'fb' | 'line', connected: boolean) => ({
      ...ACCOUNTS[0],
      id,
      platform,
      connected,
    });
    accounts.list.set([account('acc-page', 'fb', true), account('acc-line', 'line', true)]);
    expect(store.usedByPlatform()).toEqual({ fb: 2, line: 2 });
    // The Facebook figure is what the Facebook limit has always been compared with.
    expect(store.used24h()).toBe(2);
    accounts.list.set([account('acc-page', 'fb', true), account('acc-line', 'line', false)]);
    expect(store.usedByPlatform()).toEqual({ fb: 2, line: 0 });
  });

  it('starts from the workspace settings once they have arrived', () => {
    expect(store.loaded()).toBe(true);
    expect(store.ab().min).toBe(3);
    // A limit for Facebook posts and one for LINE chats, the LINE gap, and a typing speed.
    expect(Object.keys(store.ab().limits)).toEqual(['fb', 'line']);
    expect(store.ab().typingSpeed).toBe('normal');
  });

  describe('LINE chats', () => {
    const ANTI_BAN = `/api/workspaces/${WS}/engine/anti-ban`;

    it('has the server defaults before the settings arrive: 100 chats a day, 45 to 120 seconds apart', () => {
      expect(defaultAntiBan().limits).toEqual({ fb: 40, line: 100 });
      expect(defaultAntiBan().lineChat).toEqual({ minGapSeconds: 45, maxGapSeconds: 120 });
    });

    it('reads the LINE limit and gap the server holds', async () => {
      const loading = store.load(WS);
      const e = engine(3, 0);
      http.expectOne(`/api/workspaces/${WS}/engine`).flush({
        ...e,
        antiBan: {
          ...e.antiBan,
          limits: { fb: 25, line: 60 },
          lineChat: { minGapSeconds: 50, maxGapSeconds: 90 },
        },
      });
      await loading;
      expect(store.ab().limits).toEqual({ fb: 25, line: 60 });
      expect(store.ab().lineChat).toEqual({ minGapSeconds: 50, maxGapSeconds: 90 });
    });

    it('falls back to the defaults for a server that sends neither (it predates LINE chats)', async () => {
      const loading = store.load(WS);
      http.expectOne(`/api/workspaces/${WS}/engine`).flush(engine(3, 0));
      await loading;
      expect(store.ab().limits).toEqual({ fb: 25, line: 100 });
      expect(store.ab().lineChat).toEqual({ minGapSeconds: 45, maxGapSeconds: 120 });
    });

    it('sends both with the other anti-ban settings, so saving never drops them', async () => {
      store.patchAb({ limits: { ...store.ab().limits, line: 80 } });
      store.patchAb({ lineChat: { minGapSeconds: 60, maxGapSeconds: 150 } });
      const saving = store.saveAb();
      const req = http.expectOne((r) => r.method === 'PUT' && r.url === ANTI_BAN);
      expect(req.request.body.limits).toEqual({ fb: 40, line: 80 });
      expect(req.request.body.lineChat).toEqual({ minGapSeconds: 60, maxGapSeconds: 150 });
      req.flush(engine(3, 0));
      await saving;
    });
  });

  describe('typing speed', () => {
    const ANTI_BAN = `/api/workspaces/${WS}/engine/anti-ban`;

    it('is normal until the workspace says otherwise', () => {
      expect(defaultAntiBan().typingSpeed).toBe('normal');
    });

    it.each(['slow', 'normal', 'fast'] as const)(
      'reads %s from the settings the server holds',
      async (speed) => {
        const loading = store.load(WS);
        http.expectOne(`/api/workspaces/${WS}/engine`).flush(engine(3, 0, speed));
        await loading;
        expect(store.ab().typingSpeed).toBe(speed);
      },
    );

    it('falls back to normal for a value it does not know', async () => {
      const loading = store.load(WS);
      http.expectOne(`/api/workspaces/${WS}/engine`).flush(engine(3, 0, 'turbo'));
      await loading;
      expect(store.ab().typingSpeed).toBe('normal');
    });

    it('is sent with the other anti-ban settings and shows what the server stored', async () => {
      store.patchAb({ typingSpeed: 'slow' });
      const saving = store.saveAb();
      const req = http.expectOne((r) => r.method === 'PUT' && r.url === ANTI_BAN);
      expect(req.request.body.typingSpeed).toBe('slow');
      expect(req.request.body.limits).toEqual({ fb: 40, line: 100 });
      // A plan below Pro keeps the old speed: what comes back is shown.
      req.flush(engine(3, 0, 'normal'));
      await saving;
      expect(store.ab().typingSpeed).toBe('normal');
    });
  });

  it('forgets the previous workspace at once and refuses to save before the new one has loaded', async () => {
    const ws = TestBed.inject(WorkspaceStore);
    store.patchAb({ min: 9, max: 30 });
    ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
    ws.switchTo('ws-2');
    await settle();
    expect(store.loaded()).toBe(false);
    expect(store.ab()).toEqual(defaultAntiBan());
    // Saving now would write defaults (or the old workspace's values) into the new workspace.
    await store.saveAb();
    await store.saveOff();
    http.expectNone((r) => r.method === 'PUT');
    for (const r of http.match((r) => r.url === '/api/workspaces/ws-2/engine')) r.flush(engine(5));
    for (const r of http.match((r) => r.url.startsWith('/api/workspaces/ws-2/'))) r.flush([]);
    await settle();
    expect(store.loaded()).toBe(true);
    expect(store.ab().min).toBe(5);
  });

  describe('advanced anti-ban rules', () => {
    const ANTI_BAN = `/api/workspaces/${WS}/engine/anti-ban`;

    it('starts from the defaults the server uses and changes some rules at a time', () => {
      expect(store.ab().advanced).toEqual(defaultAdvanced());
      store.patchAdvanced({ minGap: 5, focus: false });
      expect(store.ab().advanced).toEqual({ ...defaultAdvanced(), minGap: 5, focus: false });
      // The rest of the settings is untouched.
      expect(store.ab().min).toBe(3);
    });

    it('sends them with the anti-ban settings and shows what the server stored', async () => {
      store.patchAdvanced({ dailyAll: 50, blockMin: 12, blockMax: 36 });
      store.patchAb({ autopause: false });
      const saving = store.saveAb();
      const req = http.expectOne((r) => r.method === 'PUT' && r.url === ANTI_BAN);
      expect(req.request.body.advanced).toEqual({
        ...defaultAdvanced(),
        dailyAll: 50,
        blockMin: 12,
        blockMax: 36,
      });
      // The switch is called autoPause on the wire.
      expect(req.request.body.autoPause).toBe(false);
      expect('autopause' in req.request.body).toBe(false);
      // A plan below Pro keeps the old advanced values: what comes back is shown.
      req.flush({
        ...engine(3),
        antiBan: { ...engine(3).antiBan, advanced: { ...defaultAdvanced(), dailyAll: 0 } },
      });
      await saving;
      expect(store.ab().advanced.dailyAll).toBe(0);
    });

    it('fills in the defaults when an answer has no advanced rules', async () => {
      const loading = store.load(WS);
      http.expectOne(`/api/workspaces/${WS}/engine`).flush(engine(4));
      await loading;
      expect(store.ab().min).toBe(4);
      expect(store.ab().advanced).toEqual(defaultAdvanced());
    });
  });

  it('ignores an engine answer that arrives after the workspace changed', async () => {
    const ws = TestBed.inject(WorkspaceStore);
    ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
    const stale = store.load(WS);
    ws.switchTo('ws-2');
    await settle();
    const [forOld, forNew] = http.match((r) => r.url.endsWith('/engine'));
    forNew.flush(engine(7));
    forOld.flush(engine(2));
    await stale;
    await settle();
    for (const r of http.match((r) => r.url.startsWith('/api/workspaces/ws-2/'))) r.flush([]);
    expect(store.ab().min).toBe(7);
  });

  it('reads the connection state again when a device pairs, and keeps the edited settings', async () => {
    store.patchAb({ min: 9, max: 30 });
    events.emit('device.paired');
    await settle();
    http.expectOne(`/api/workspaces/${WS}/engine`).flush(engine(3, 1));
    http.expectOne(`/api/workspaces/${WS}/accounts`).flush(ACCOUNTS); // the accounts follow the pairing too
    await settle();
    expect(store.devices()).toBe(1);
    expect(store.ab().min).toBe(9);
  });
});

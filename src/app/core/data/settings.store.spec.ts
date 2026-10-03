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
import { SettingsStore, defaultAntiBan } from './settings.store';
import { WorkspaceStore } from './workspace.store';

const engine = (min: number, devices = 0) => ({
  antiBan: {
    min,
    max: 20,
    limits: { fb: 25, x: 20, ig: 10, tt: 5, line: 3, th: 10 },
    typing: true,
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
        // Sent in the last 24 h by the connected account, by a sample account, a failed one, and an old one.
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
        apiPost({
          id: 'e',
          accountId: 'acc-ig',
          platform: 'ig',
          status: 'success',
          scheduledAt: ago(1),
          publishedAt: ago(1),
        }),
      ],
    });
  });

  afterEach(() => http.verify());

  it('counts what the server counts: connected accounts, success and pending, last 24 hours', async () => {
    const accounts = TestBed.inject(AccountsStore);
    // Only the page is a connected (device) account; Instagram is a sample.
    accounts.list.set(ACCOUNTS.map((a) => ({ ...a, connected: a.id === 'acc-page' })));
    expect(store.used24h().fb).toBe(2);
    expect(store.used24h().ig).toBe(0);
    accounts.list.set(ACCOUNTS.map((a) => ({ ...a, connected: false })));
    expect(store.used24h().fb).toBe(0);
  });

  it('starts from the workspace settings once they have arrived', () => {
    expect(store.loaded()).toBe(true);
    expect(store.ab().min).toBe(3);
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

import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ACCOUNTS,
  WORKSPACE,
  WS,
  provideApiTesting,
  settle,
  signIn,
} from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { AccountsStore } from './accounts.store';
import { DeviceEventsService } from './device-events.service';
import { WorkspaceStore } from './workspace.store';

const URL = `/api/workspaces/${WS}/accounts`;

describe('AccountsStore', () => {
  let http: HttpTestingController;
  let store: AccountsStore;
  let events: FakeDeviceEvents;

  beforeEach(async () => {
    http = provideApiTesting({
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    store = TestBed.inject(AccountsStore);
    events = TestBed.inject(DeviceEventsService) as unknown as FakeDeviceEvents;
    await signIn(http);
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  it('knows when the list has arrived', () => {
    expect(store.loaded()).toBe(true);
    expect(store.list().length).toBe(ACCOUNTS.length);
  });

  it.each(['device.groups', 'device.updated', 'device.paired', 'device.revoked', 'post'])(
    'reads the accounts again on %s',
    async (type) => {
      events.emit(type);
      await settle();
      const renamed = { ...ACCOUNTS[0], name: 'Facebook · Shop PC', groups: ['A', 'B'] };
      http.expectOne(URL).flush([renamed, ...ACCOUNTS.slice(1)]);
      await settle();
      expect(store.list()[0].name).toBe('Facebook · Shop PC');
      expect(store.list()[0].groups).toEqual(['A', 'B']);
    },
  );

  it('leaves the list alone for events that do not touch accounts', async () => {
    events.emit('device.state', { state: {} });
    events.emit('device.log', { lines: [] });
    await settle();
    http.expectNone(URL);
  });

  it('reads again when the event stream comes back after a drop', async () => {
    events.resume();
    await settle();
    http.expectOne(URL).flush(ACCOUNTS);
  });

  it('keeps the list when a live refresh fails', async () => {
    events.emit('post');
    await settle();
    http.expectOne(URL).flush(null, { status: 503, statusText: 'x' });
    await settle();
    expect(store.list().length).toBe(ACCOUNTS.length);
  });

  it('retries a first load that failed, then reports it loaded', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    store.loaded.set(false);
    const done = store.load(WS);
    http.expectOne(URL).flush(null, { status: 503, statusText: 'x' });
    await vi.advanceTimersByTimeAsync(2500);
    http.expectOne(URL).flush([ACCOUNTS[0]]);
    await done;
    expect(store.loaded()).toBe(true);
    expect(store.list()).toEqual([ACCOUNTS[0]]);
  });

  it('drops an answer that arrives after the workspace changed', async () => {
    const ws = TestBed.inject(WorkspaceStore);
    ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
    const old = store.load(WS);
    ws.switchTo('ws-2');
    await settle();
    // The new workspace asked for its own list; the old request is still in flight.
    const [forOld, forNew] = http.match((r) => r.url.endsWith('/accounts'));
    expect(forOld.request.url).toBe(URL);
    expect(forNew.request.url).toBe('/api/workspaces/ws-2/accounts');
    forNew.flush([]);
    forOld.flush(ACCOUNTS);
    await old;
    await settle();
    expect(store.list()).toEqual([]);
  });
});

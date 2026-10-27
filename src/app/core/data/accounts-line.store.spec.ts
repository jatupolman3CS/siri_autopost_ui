import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { LINE_CONNECTED } from '../../testing/line.fixtures';
import { FB_CONNECTED } from '../../testing/link-sets.fixtures';
import { AccountsStore, deviceOfAccount, extensionNameOf, lineOaName } from './accounts.store';
import { DeviceEventsService } from './device-events.service';

const URL = `/api/workspaces/${WS}/accounts`;

// A browser that is logged in to a LINE Official Account has a second account, "LINE · <OA name>". It is not another
// extension: every "extension" select reads `connected`, which stays Facebook only.
describe('AccountsStore: LINE accounts', () => {
  let http: HttpTestingController;
  let store: AccountsStore;

  beforeEach(async () => {
    http = provideApiTesting({
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    store = TestBed.inject(AccountsStore);
    await signIn(http);
    store.list.set([{ ...FB_CONNECTED }, { ...LINE_CONNECTED }]);
  });

  afterEach(() => http.verify());

  it('keeps `connected` to the Facebook accounts, so no extension select offers the LINE one', () => {
    expect(store.connected().map((a) => a.id)).toEqual(['acc-fb']);
  });

  it('lists the LINE accounts apart, and the ones a browser sends chats for', () => {
    expect(store.lineAccounts().map((a) => a.id)).toEqual(['acc-line']);
    expect(store.connectedLine().map((a) => a.id)).toEqual(['acc-line']);
    store.list.update((l) => l.map((a) => (a.id === 'acc-line' ? { ...a, connected: false } : a)));
    expect(store.lineAccounts()).toHaveLength(1);
    expect(store.connectedLine()).toEqual([]);
    expect(store.connected().map((a) => a.id)).toEqual(['acc-fb']);
  });

  it('reads the list again after a LINE chat sync: the browser has its LINE account by then', async () => {
    const events = TestBed.inject(DeviceEventsService) as unknown as FakeDeviceEvents;
    store.list.set([FB_CONNECTED]);
    events.emit('device.line_chats', { count: 3 });
    await settle();
    http.expectOne(URL).flush([FB_CONNECTED, LINE_CONNECTED]);
    await settle();
    expect(store.list().map((a) => a.platform)).toEqual(['fb', 'line']);
    expect(store.lineAccounts()).toHaveLength(1);
  });
});

describe('extensionNameOf for a LINE account', () => {
  const line = { id: 'acc-line', name: 'LINE · Shop OA' };

  it('names it by the browser, through the `line` entry of the device list', () => {
    const devices = [{ accountId: 'acc-fb', name: 'Shop PC', line: { accountId: 'acc-line' } }];
    expect(extensionNameOf(line, devices as never)).toBe('Shop PC');
    expect(deviceOfAccount('acc-line', devices as never)).toBe(devices[0]);
    expect(deviceOfAccount('acc-fb', devices as never)).toBe(devices[0]);
    expect(deviceOfAccount('nope', devices as never)).toBeUndefined();
  });

  it('falls back to the Official Account’s name without its "LINE · " prefix', () => {
    expect(extensionNameOf(line, [])).toBe('Shop OA');
    expect(lineOaName(line)).toBe('Shop OA');
    expect(lineOaName({ name: 'Baan Dee' })).toBe('Baan Dee');
  });

  it('still names a Facebook account without its "Facebook · " prefix', () => {
    expect(extensionNameOf({ id: 'x', name: 'Facebook · Shop PC' }, [])).toBe('Shop PC');
  });
});

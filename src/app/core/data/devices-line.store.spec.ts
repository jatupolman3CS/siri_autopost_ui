import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiDevice } from '../http/api.service';
import { WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { apiDeviceLine, apiLineDevice } from '../../testing/line.fixtures';
import { DeviceEventsService } from './device-events.service';
import { DevicesStore, lineStateOf } from './devices.store';

const URL = `/api/workspaces/${WS}/devices`;

// A browser may also be logged in to a LINE Official Account: the device list says so in `line`.
describe('DevicesStore: LINE', () => {
  let http: HttpTestingController;
  let store: DevicesStore;
  let events: FakeDeviceEvents;
  const withLine = (
    over: Partial<ApiDevice> = {},
    line: Parameters<typeof apiLineDevice>[1] = {},
  ) => apiLineDevice(over, line);

  beforeEach(async () => {
    http = provideApiTesting({
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    store = TestBed.inject(DevicesStore);
    events = TestBed.inject(DeviceEventsService) as unknown as FakeDeviceEvents;
    await signIn(http, { devices: [withLine()] });
  });

  afterEach(() => http.verify());

  it('keeps what the API says of the LINE account of a browser', () => {
    expect(store.list()[0].line).toMatchObject({
      accountId: 'acc-line',
      ready: true,
      chatCount: 3,
      sessionLost: false,
    });
  });

  it('reads the devices again when the browser has synced its chats (the count and the time change)', async () => {
    events.emit('device.line_chats', { count: 9 });
    await settle();
    http.expectOne(URL).flush([withLine({}, { chatCount: 9, syncedAt: '2026-10-05T01:00:00Z' })]);
    await settle();
    expect(store.list()[0].line?.chatCount).toBe(9);
  });

  it('tells a browser to sync its LINE chat list now, with the syncLineChats command', async () => {
    const done = store.syncLineChats('dev-1');
    const req = http.expectOne(`${URL}/dev-1/commands`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ cmd: 'syncLineChats', args: {} });
    req.flush({ id: 'c1', cmd: 'syncLineChats', status: 'pending' });
    await done;
  });

  it('tells a browser to open its LINE setup with the openLineSetup command', async () => {
    const done = store.openLineSetup('dev-1');
    const req = http.expectOne(`${URL}/dev-1/commands`);
    expect(req.request.body).toEqual({ cmd: 'openLineSetup', args: {} });
    req.flush({ id: 'c2', cmd: 'openLineSetup', status: 'pending' });
    await done;
  });
});

describe('lineStateOf', () => {
  const now = new Date('2026-10-05T12:00:00Z');
  const line = (over: Parameters<typeof apiDeviceLine>[0] = {}) => apiDeviceLine(over);

  it('is ready for a browser that reported ready, is logged in and does not rest', () => {
    expect(lineStateOf(line(), now)).toBe('ready');
  });

  it('waits for the LINE login when the browser lost it or has not reported ready lately', () => {
    expect(lineStateOf(line({ sessionLost: true }), now)).toBe('login');
    expect(lineStateOf(line({ ready: false }), now)).toBe('login');
    // A login that is lost beats a rest that is running.
    expect(lineStateOf(line({ sessionLost: true, restUntil: '2026-10-05T15:00:00Z' }), now)).toBe(
      'login',
    );
  });

  it('rests while the engine rests the account, and is ready again once that time has passed', () => {
    expect(lineStateOf(line({ restUntil: '2026-10-05T15:00:00Z' }), now)).toBe('resting');
    expect(lineStateOf(line({ restUntil: '2026-10-05T11:59:59Z' }), now)).toBe('ready');
    expect(lineStateOf(line({ restUntil: null }), now)).toBe('ready');
  });
});

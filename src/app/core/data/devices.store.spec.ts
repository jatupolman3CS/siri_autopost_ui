import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiDevice } from '../http/api.service';
import { WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { DeviceEventsService } from './device-events.service';
import { DevicesStore } from './devices.store';

const device = (id: string, over: Partial<ApiDevice> = {}): ApiDevice => ({
  id,
  name: 'PC ' + id,
  browser: 'Chrome 130',
  version: '2.2.0',
  createdAt: '2026-10-01T00:00:00Z',
  lastSeenAt: '2026-10-03T00:00:00Z',
  online: false,
  accountId: null,
  jobsPaused: false,
  ...over,
});
const URL = `/api/workspaces/${WS}/devices`;

describe('DevicesStore', () => {
  let http: HttpTestingController;
  let store: DevicesStore;
  let events: FakeDeviceEvents;

  beforeEach(async () => {
    http = provideApiTesting({
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    store = TestBed.inject(DevicesStore);
    events = TestBed.inject(DeviceEventsService) as unknown as FakeDeviceEvents;
    await signIn(http, { devices: [device('d1')] });
  });

  afterEach(() => http.verify());

  it.each(['device.online', 'device.paired', 'device.revoked', 'device.updated'])(
    'reads the devices again on %s, so the online dots follow',
    async (type) => {
      expect(store.list()[0].online).toBe(false);
      events.emit(type);
      await settle();
      http.expectOne(URL).flush([device('d1', { online: true }), device('d2')]);
      await settle();
      expect(store.list().map((d) => [d.id, d.online])).toEqual([
        ['d1', true],
        ['d2', false],
      ]);
    },
  );

  it('ignores what does not change the list, and reads again when the stream returns', async () => {
    events.emit('post');
    events.emit('device.log', { lines: [] });
    await settle();
    http.expectNone(URL);
    events.resume();
    await settle();
    http.expectOne(URL).flush([device('d1')]);
  });
});

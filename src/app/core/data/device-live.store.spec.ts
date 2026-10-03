import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiDevice, ApiDeviceLive } from '../http/api.service';
import { WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { DeviceEventsService } from './device-events.service';
import { DeviceLiveStore } from './device-live.store';
import { ExtensionStore } from './extension.store';

const device = (id: string, over: Partial<ApiDevice> = {}): ApiDevice => ({
  id,
  name: `PC ${id}`,
  browser: 'Chrome 130',
  version: '2.2.0',
  createdAt: '2026-10-01T00:00:00Z',
  lastSeenAt: '2026-10-03T00:00:00Z',
  online: true,
  accountId: null,
  jobsPaused: false,
  ...over,
});

const live = (id: string, msgs: string[]): ApiDeviceLive => ({
  deviceId: id,
  online: true,
  lastSeenAt: '2026-10-03T00:00:00Z',
  version: '2.2.0',
  state: null,
  stateAt: null,
  revision: 1,
  logs: msgs.map((msg, i) => ({ t: i + 1, level: 'info', msg })),
});

describe('DeviceLiveStore', () => {
  let http: HttpTestingController;
  let store: DeviceLiveStore;
  let seq = 0;

  const emit = (deviceId: string, type: string, payload: object): void =>
    (TestBed.inject(DeviceEventsService) as unknown as { dispatch(block: string): void }).dispatch(
      `id: 1\nevent: ${type}\ndata: ${JSON.stringify({ seq: ++seq, deviceId, type, payload, at: '2026-10-03T01:00:00Z' })}`,
    );

  async function start(devices: ApiDevice[]) {
    http = provideApiTesting();
    store = TestBed.inject(DeviceLiveStore);
    await signIn(http);
    http.expectOne(`/api/workspaces/${WS}/devices`).flush(devices);
    await settle();
  }

  afterEach(() => http.verify());

  it('shows the first online browser and follows its log from the event stream', async () => {
    await start([device('d1', { online: false }), device('d2')]);
    expect(store.device()?.id).toBe('d2');
    const stop = store.watch();
    http.expectOne(`/api/workspaces/${WS}/devices/d2/live`).flush(live('d2', ['เริ่มทำงาน']));
    await settle();
    expect(store.logs().map((l) => l.msg)).toEqual(['เริ่มทำงาน']);

    emit('d2', 'device.log', {
      lines: [{ t: 9, level: 'warn', msg: 'ช้าหน่อย' }],
      truncated: false,
    });
    emit('d1', 'device.log', {
      lines: [{ t: 10, level: 'info', msg: 'เครื่องอื่น' }],
      truncated: false,
    });
    expect(store.logs().map((l) => l.msg)).toEqual(['เริ่มทำงาน', 'ช้าหน่อย']); // only the shown browser
    emit('d2', 'device.log_cleared', {});
    expect(store.logs()).toEqual([]);
    stop();
  });

  it('starts over when another browser is picked', async () => {
    await start([device('d1'), device('d2')]);
    const stop = store.watch();
    http.expectOne(`/api/workspaces/${WS}/devices/d1/live`).flush(live('d1', ['a']));
    await settle();
    store.select('d2');
    await settle();
    expect(store.logs()).toEqual([]);
    http.expectOne(`/api/workspaces/${WS}/devices/d2/live`).flush(live('d2', ['b']));
    await settle();
    expect(store.logs().map((l) => l.msg)).toEqual(['b']);
    stop();
  });

  it('has nothing to show without a paired browser', async () => {
    await start([]);
    const stop = store.watch();
    expect(store.device()).toBeNull();
    expect(store.logs()).toEqual([]);
    stop();
  });

  it('pauses the shown browser through the API, not just on the page', async () => {
    await start([device('d1')]);
    const ext = TestBed.inject(ExtensionStore);
    expect(ext.paused()).toBe(false);
    const done = ext.togglePause();
    const req = http.expectOne(`/api/workspaces/${WS}/devices/d1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ name: null, jobsPaused: true }); // null keeps the name
    req.flush(device('d1', { jobsPaused: true }));
    await done;
    expect(ext.paused()).toBe(true);
  });
});

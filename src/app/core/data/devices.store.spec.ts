import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiDevice, QUIET } from '../http/api.service';
import { problemMessage } from '../http/problem-details';
import { WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { DeviceEventsService } from './device-events.service';
import { DevicesStore, autoPauseOf } from './devices.store';

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

  describe('names are unique in a workspace', () => {
    beforeEach(() => {
      store.list.set([device('d1', { name: 'Shop PC' }), device('d2', { name: 'Laptop' })]);
    });

    it('knows when another extension has a name, ignoring case and surrounding spaces', () => {
      expect(store.nameTaken('Laptop')).toBe(true);
      expect(store.nameTaken('  laptop ')).toBe(true);
      expect(store.nameTaken('Office')).toBe(false);
      expect(store.nameTaken('')).toBe(false);
      // An extension's own name is not "taken" for that extension (a rename that changes only the case).
      expect(store.nameTaken('LAPTOP', 'd2')).toBe(false);
      expect(store.nameTaken('Laptop', 'd1')).toBe(true);
    });

    it('works out the name an extension gets when it pairs, like the server: name, then name (2), (3)...', () => {
      expect(store.freeName('Office')).toBe('Office');
      expect(store.freeName('  Office  ')).toBe('Office');
      expect(store.freeName('Laptop')).toBe('Laptop (2)');
      expect(store.freeName('laptop')).toBe('laptop (2)');
      store.list.update((l) => [...l, device('d3', { name: 'Laptop (2)' })]);
      expect(store.freeName('Laptop')).toBe('Laptop (3)');
      expect(store.freeName('')).toBe('');
    });

    it('keeps a numbered name within the longest name the API takes', () => {
      const long = 'x'.repeat(80);
      store.list.set([device('d1', { name: long })]);
      const next = store.freeName(long);
      expect(next).toHaveLength(80);
      expect(next.endsWith(' (2)')).toBe(true);
    });

    it('renames through the API, quietly, and shows the name the server kept', async () => {
      const done = store.rename('d1', 'Front desk');
      const req = http.expectOne({ method: 'PUT', url: `${URL}/d1` });
      expect(req.request.body).toEqual({ name: 'Front desk', jobsPaused: null });
      // A quiet request: the page shows a refusal itself, the interceptor does not toast it.
      expect(req.request.context.get(QUIET)).toBe(true);
      req.flush(device('d1', { name: 'Front desk' }));
      await done;
      expect(store.list().find((d) => d.id === 'd1')!.name).toBe('Front desk');
    });

    it('throws the refusal and keeps the old name when the name is taken', async () => {
      const done = store.rename('d1', 'Laptop').catch((e) => e);
      http
        .expectOne({ method: 'PUT', url: `${URL}/d1` })
        .flush(
          { title: 'มีส่วนขยายชื่อ “Laptop” อยู่แล้ว', status: 422 },
          { status: 422, statusText: 'Unprocessable' },
        );
      const error = await done;
      expect(problemMessage(error)).toBe('มีส่วนขยายชื่อ “Laptop” อยู่แล้ว');
      expect(store.list().find((d) => d.id === 'd1')!.name).toBe('Shop PC');
    });
  });

  describe('automatic pause', () => {
    const NOW = new Date('2026-10-04T10:00:00Z');
    const at = (min: number) => new Date(NOW.getTime() + min * 60_000).toISOString();

    it('is the pause the API reports while it lasts, with its reason', () => {
      expect(autoPauseOf(device('a'), NOW)).toBeNull();
      expect(
        autoPauseOf(device('a', { autoPausedUntil: null, autoPauseReason: null }), NOW),
      ).toBeNull();
      expect(
        autoPauseOf(
          device('a', { autoPausedUntil: at(30), autoPauseReason: 'Facebook เตือน' }),
          NOW,
        ),
      ).toEqual({ until: new Date(at(30)), reason: 'Facebook เตือน' });
      // Run out (or running out right now): not paused.
      expect(
        autoPauseOf(device('a', { autoPausedUntil: at(-1), autoPauseReason: 'x' }), NOW),
      ).toBeNull();
      expect(autoPauseOf(device('a', { autoPausedUntil: at(0) }), NOW)).toBeNull();
      expect(autoPauseOf(device('a', { autoPausedUntil: at(30) }), NOW)?.reason).toBe('');
    });

    it('lists the browsers paused right now', () => {
      store.now.set(NOW);
      store.list.set([
        device('d1', { autoPausedUntil: at(1), autoPauseReason: 'r1' }),
        device('d2'),
        device('d3', { autoPausedUntil: at(-5), autoPauseReason: 'old' }),
      ]);
      expect(store.autoPaused().map((p) => [p.device.id, p.reason])).toEqual([['d1', 'r1']]);
      // A later time: the pause has run out (nothing arrives when it ends).
      store.now.set(new Date(NOW.getTime() + 2 * 60_000));
      expect(store.autoPaused()).toEqual([]);
    });
  });
});

describe('DevicesStore clock', () => {
  it('moves the time every 30 s, so a pause the engine put on a browser runs out on screen', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const NOW = new Date('2026-10-04T10:00:00Z');
    vi.setSystemTime(NOW);
    const http = provideApiTesting({
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    try {
      const store = TestBed.inject(DevicesStore);
      await signIn(http, {
        devices: [
          device('d1', {
            autoPausedUntil: new Date(NOW.getTime() + 60_000).toISOString(),
            autoPauseReason: 'r',
          }),
        ],
      });
      expect(store.autoPaused()).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(90_000);
      expect(store.autoPaused()).toEqual([]);
      http.verify();
    } finally {
      vi.useRealTimers();
    }
  });
});

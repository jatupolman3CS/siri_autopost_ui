import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WORKSPACE, WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import {
  SCHEDULES_URL,
  answerChangeRefresh,
  apiSchedule,
  apiScheduleCreated,
  saveBody,
} from '../../testing/schedules.fixtures';
import { utcOffsetMinutes } from '../flow/schedule-math';
import { QUIET } from '../http/api.service';
import { NotificationService } from '../services/notification.service';
import { DeviceEventsService } from './device-events.service';
import { SchedulesStore } from './schedules.store';
import { WorkspaceStore } from './workspace.store';

const A = apiSchedule({
  id: 'a',
  name: 'Morning',
  collectionId: 'c1',
  linkSetId: 's1',
  todayCount: 3,
});
const B = apiSchedule({
  id: 'b',
  name: 'Weekend',
  collectionId: 'c2',
  linkSetId: 's1',
  active: false,
  todayCount: 1,
});

describe('SchedulesStore', () => {
  let http: HttpTestingController;
  let store: SchedulesStore;
  let events: FakeDeviceEvents;

  async function start(schedules = [A, B]): Promise<void> {
    http = provideApiTesting({
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    store = TestBed.inject(SchedulesStore);
    events = TestBed.inject(DeviceEventsService) as unknown as FakeDeviceEvents;
    await signIn(http, { schedules });
  }

  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
  afterEach(() => {
    vi.useRealTimers();
    // The link sets follow the same post events (their groups' health): their read is not this test's business.
    for (const r of http.match((x) => x.url.endsWith('/link-sets'))) r.flush([]);
    http.verify();
  });

  describe('loading', () => {
    it('loads the schedules of the workspace and reports them loaded', async () => {
      await start();
      expect(store.loaded()).toBe(true);
      expect(store.schedules()).toEqual([A, B]);
      expect(store.byId('b')?.name).toBe('Weekend');
      expect(store.byId('zzz')).toBeUndefined();
      expect(store.byId(null)).toBeUndefined();
    });

    it('is not loaded before the answer, and empties itself with the workspace', async () => {
      http = provideApiTesting({
        providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
      });
      store = TestBed.inject(SchedulesStore);
      expect(store.loaded()).toBe(false);
      await signIn(http, { schedules: [A] });
      expect(store.loaded()).toBe(true);

      const ws = TestBed.inject(WorkspaceStore);
      ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
      ws.switchTo('ws-2');
      await settle();
      expect(store.schedules()).toEqual([]);
      expect(store.loaded()).toBe(false);
      http.expectOne('/api/workspaces/ws-2/schedules').flush([]);
      await settle();
      expect(store.loaded()).toBe(true);
      // The other workspace's collections, link sets and posts ask for themselves too: not this test's business.
      for (const r of http.match((x) => x.url.startsWith('/api/workspaces/ws-2'))) r.flush([]);
    });

    it('keeps asking while the server is busy, and gives the list once it answers', async () => {
      http = provideApiTesting({
        providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
      });
      store = TestBed.inject(SchedulesStore);
      await signIn(http);
      // signIn answered with an empty list; a later load fails once, then works.
      const again = store.load();
      http
        .expectOne(SCHEDULES_URL)
        .flush('busy', { status: 503, statusText: 'Service Unavailable' });
      await settle();
      expect(store.loaded()).toBe(true);
      await vi.advanceTimersByTimeAsync(2000);
      await settle();
      http.expectOne(SCHEDULES_URL).flush([A]);
      await again;
      expect(store.schedules()).toEqual([A]);
    });
  });

  describe('figures', () => {
    it('counts the active schedules and the posts of today over all of them', async () => {
      await start();
      expect(store.activeCount()).toBe(1);
      expect(store.todayCount()).toBe(4);
    });

    it('names the schedules that use a collection or a link set', async () => {
      await start();
      expect(store.namesUsingCollection('c1')).toEqual(['Morning']);
      expect(store.namesUsingCollection('c2')).toEqual(['Weekend']);
      expect(store.namesUsingCollection('c3')).toEqual([]);
      expect(store.namesUsingLinkSet('s1')).toEqual(['Morning', 'Weekend']);
      expect(store.usingLinkSet('s2')).toEqual([]);
      expect(store.usingCollection('c1')).toEqual([A]);
    });
  });

  describe('live updates', () => {
    it('reads the schedules again, once, after a burst of post events', async () => {
      await start();
      events.emit('post');
      events.emit('post');
      events.emit('post');
      http.expectNone(SCHEDULES_URL);
      await vi.advanceTimersByTimeAsync(1500);
      const req = http.expectOne(SCHEDULES_URL);
      req.flush([{ ...A, todayCount: 4 }, B]);
      await settle();
      expect(store.byId('a')?.todayCount).toBe(4);
      expect(store.todayCount()).toBe(5);
    });

    it('ignores events that do not move a schedule', async () => {
      await start();
      events.emit('device.online');
      await vi.advanceTimersByTimeAsync(5000);
      http.expectNone(SCHEDULES_URL);
    });

    it('reads again when the stream comes back', async () => {
      await start();
      events.resume();
      http.expectOne(SCHEDULES_URL).flush([A]);
      await settle();
      expect(store.schedules()).toEqual([A]);
    });

    it('leaves the list as it is when a quiet read fails', async () => {
      await start();
      const done = store.refresh();
      http.expectOne(SCHEDULES_URL).flush('x', { status: 500, statusText: 'Server Error' });
      await done;
      expect(store.schedules()).toEqual([A, B]);
    });
  });

  describe('create', () => {
    it('posts the request, adds the schedule and reads the queue, collections and link sets again', async () => {
      await start([A]);
      const created = apiSchedule({ id: 'n', name: 'New one' });
      const done = store.create(saveBody());
      const req = http.expectOne(SCHEDULES_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(saveBody());
      req.flush(apiScheduleCreated(created, { created: 14 }));
      await settle();
      // The follow-up reads wait for the answer: the new schedule is already in the list.
      expect(store.schedules().map((s) => s.id)).toEqual(['a', 'n']);
      const asked = answerChangeRefresh(http);
      expect(asked.posts).toBeGreaterThan(0);
      expect(asked.errors).toBe(1);
      expect(asked.collections).toBe(1);
      expect(asked.linkSets).toBe(1);
      await settle();
      const result = await done;
      expect(result.created).toBe(14);
      expect(result.schedule.id).toBe('n');
    });

    it('rejects with the API refusal and leaves the list alone', async () => {
      await start([A]);
      const done = store.create(saveBody());
      http
        .expectOne(SCHEDULES_URL)
        .flush(
          { title: 'ยังไม่มีบัญชี Facebook ที่ผูกกับเครื่อง' },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
      await expect(done).rejects.toBeInstanceOf(HttpErrorResponse);
      expect(store.schedules()).toEqual([A]);
    });
  });

  describe('pause, resume and delete', () => {
    it('pauses: PUT active=false, replaces the schedule with the answer and reads the queue again', async () => {
      await start();
      const done = store.setActive('a', false);
      await settle();
      expect(store.isBusy('a')).toBe(true);
      const req = http.expectOne(`${SCHEDULES_URL}/a/active`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ active: false });
      req.flush({ ...A, active: false, nextRunAt: null });
      await settle();
      expect(store.byId('a')?.active).toBe(false);
      const asked = answerChangeRefresh(http);
      expect([asked.posts > 0, asked.collections, asked.linkSets]).toEqual([true, 1, 1]);
      const saved = await done;
      expect(saved?.active).toBe(false);
      expect(store.isBusy('a')).toBe(false);
      expect(store.activeCount()).toBe(0);
    });

    it('resumes: PUT active=true', async () => {
      await start();
      const done = store.setActive('b', true);
      await settle();
      const req = http.expectOne(`${SCHEDULES_URL}/b/active`);
      expect(req.request.body).toEqual({ active: true });
      req.flush({ ...B, active: true, nextRunAt: '2026-10-05T02:00:00Z' });
      await settle();
      answerChangeRefresh(http);
      await done;
      expect(store.byId('b')?.nextRunAt).toBe('2026-10-05T02:00:00Z');
      expect(store.activeCount()).toBe(2);
    });

    it('keeps the schedule as it was when the pause is refused, and is not busy any more', async () => {
      await start();
      const done = store.setActive('a', false);
      await settle();
      http.expectOne(`${SCHEDULES_URL}/a/active`).flush('x', { status: 500, statusText: 'x' });
      await expect(done).rejects.toBeInstanceOf(HttpErrorResponse);
      expect(store.byId('a')?.active).toBe(true);
      expect(store.isBusy('a')).toBe(false);
    });

    it('deletes: DELETE, drops it from the list and reads the queue and counts again', async () => {
      await start();
      const done = store.remove('a');
      await settle();
      expect(store.isBusy('a')).toBe(true);
      const req = http.expectOne(`${SCHEDULES_URL}/a`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      await settle();
      expect(store.schedules().map((s) => s.id)).toEqual(['b']);
      const asked = answerChangeRefresh(http);
      expect([asked.posts > 0, asked.collections, asked.linkSets]).toEqual([true, 1, 1]);
      await done;
      expect(store.isBusy('a')).toBe(false);
    });

    it('keeps the schedule when the delete is refused', async () => {
      await start();
      const done = store.remove('a');
      await settle();
      http.expectOne(`${SCHEDULES_URL}/a`).flush('x', { status: 500, statusText: 'x' });
      await expect(done).rejects.toBeInstanceOf(HttpErrorResponse);
      expect(store.schedules().length).toBe(2);
    });
  });

  describe('best times', () => {
    const BEST_URL = (ws = 'ws-1') => `/api/workspaces/${ws}/schedules/best-times`;
    const switchTo = async (id: string) => {
      const ws = TestBed.inject(WorkspaceStore);
      ws.list.update((l) => [...l, { ...WORKSPACE, id, name: 'Other' }]);
      ws.switchTo(id);
      await settle();
    };
    /** The other workspace asks for its own data; none of it is this test's business. */
    const flushOther = (id: string) => {
      for (const r of http.match((x) => x.url.startsWith(`/api/workspaces/${id}`))) r.flush([]);
    };

    it('asks for the hours in the time zone of this browser', async () => {
      await start();
      const done = store.bestTimes();
      await settle();
      const req = http.expectOne((r) => r.url === BEST_URL());
      expect(req.request.params.get('utcOffsetMinutes')).toBe(String(utcOffsetMinutes()));
      req.flush(['18:00', '09:00']);
      expect(await done).toEqual(['09:00', '18:00']);
    });

    it('asks quietly: a failure shows no toast', async () => {
      await start();
      const done = store.bestTimes();
      await settle();
      const req = http.expectOne((r) => r.url === BEST_URL());
      expect(req.request.context.get(QUIET)).toBe(true);
      req.flush('x', { status: 500, statusText: 'x' });
      await done;
      expect(TestBed.inject(NotificationService).toasts()).toEqual([]);
    });

    it('gives no hours when the answer fails: it is only a hint', async () => {
      await start();
      const done = store.bestTimes();
      await settle();
      http.expectOne((r) => r.url === BEST_URL()).flush('x', { status: 500, statusText: 'x' });
      expect(await done).toEqual([]);
    });

    it('keeps the hours in `best`: none until asked, then what the API says', async () => {
      await start();
      expect(store.best()).toBeNull();
      const done = store.askBest();
      await settle();
      expect(store.best()).toEqual([]); // asking
      http.expectOne((r) => r.url === BEST_URL()).flush(['19:00', '09:00', '12:00']);
      await done;
      expect(store.best()).toEqual(['09:00', '12:00', '19:00']);
    });

    it('does not ask again while the hours are fresh, and does after ten minutes', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      await start();
      let done = store.askBest();
      await settle();
      http.expectOne((r) => r.url === BEST_URL()).flush(['09:00']);
      await done;
      await store.askBest();
      http.expectNone((r) => r.url === BEST_URL());
      expect(store.best()).toEqual(['09:00']);

      vi.setSystemTime(Date.now() + 11 * 60_000);
      done = store.askBest();
      await settle();
      http.expectOne((r) => r.url === BEST_URL()).flush(['21:00']);
      await done;
      expect(store.best()).toEqual(['21:00']);
    });

    it('is asked for again after a failed read', async () => {
      await start();
      let done = store.askBest();
      await settle();
      http.expectOne((r) => r.url === BEST_URL()).flush('x', { status: 500, statusText: 'x' });
      await done;
      expect(store.best()).toEqual([]);
      done = store.askBest();
      await settle();
      http.expectOne((r) => r.url === BEST_URL()).flush(['08:00']);
      await done;
      expect(store.best()).toEqual(['08:00']);
    });

    it('empties with the workspace, so one workspace’s hours never show in another', async () => {
      await start();
      const done = store.askBest();
      await settle();
      http.expectOne((r) => r.url === BEST_URL()).flush(['09:00']);
      await done;
      expect(store.best()).toEqual(['09:00']);

      await switchTo('ws-2');
      expect(store.best()).toBeNull();
      flushOther('ws-2');
      await settle();
      expect(store.best()).toBeNull();

      // The other workspace asks for its own hours.
      const again = store.askBest();
      await settle();
      http.expectOne((r) => r.url === BEST_URL('ws-2')).flush(['22:00']);
      await again;
      expect(store.best()).toEqual(['22:00']);
    });

    it('drops an answer that arrives after the workspace has changed', async () => {
      await start();
      const done = store.askBest();
      await settle();
      const late = http.expectOne((r) => r.url === BEST_URL());
      await switchTo('ws-2');
      flushOther('ws-2');
      late.flush(['09:00', '12:00']);
      await done;
      await settle();
      expect(store.best()).toBeNull();
    });

    it('forgets the hours after sign-out too', async () => {
      await start();
      const done = store.askBest();
      await settle();
      http.expectOne((r) => r.url === BEST_URL()).flush(['09:00']);
      await done;
      TestBed.inject(WorkspaceStore).id.set(null);
      await settle();
      expect(store.best()).toBeNull();
      await store.askBest(); // no workspace: nothing is asked
      http.expectNone((r) => r.url.endsWith('/best-times'));
    });
  });

  it('keeps no pending timer after the workspace is left', async () => {
    await start();
    events.emit('post');
    TestBed.inject(WorkspaceStore).id.set(null);
    await settle();
    await vi.advanceTimersByTimeAsync(5000);
    http.expectNone(SCHEDULES_URL);
    expect(WS).toBe('ws-1');
  });
});

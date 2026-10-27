import { HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WS, WORKSPACE, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { apiChatLink, apiLineChat, apiLineChatPage, apiLineSet } from '../../testing/line.fixtures';
import { DeviceEventsService } from './device-events.service';
import { LinkSetsStore } from './link-sets.store';
import { LineChatsStore, SEARCH_DEBOUNCE_MS } from './line-chats.store';
import { RETRY_DELAYS_MS } from './loading';
import { WorkspaceStore } from './workspace.store';

const CHATS = `/api/workspaces/${WS}/line/chats`;
const SETS = `/api/workspaces/${WS}/link-sets`;

const a = apiLineChat({ id: 'a', name: 'สมชาย', labels: ['VIP'], linkedSetCount: 1 });
const b = apiLineChat({ id: 'b', name: 'มานี', lastMessageAt: '2026-10-20T10:00:00Z' });
const c = apiLineChat({ id: 'c', name: 'ปิติ', doNotSend: true });

describe('LineChatsStore', () => {
  let http: HttpTestingController;
  let store: LineChatsStore;
  let events: FakeDeviceEvents;

  // A read of the roster is one GET of the chats with its query in the parameters.
  const isRead = (r: HttpRequest<unknown>) => r.method === 'GET' && r.url === CHATS;
  /** Exactly one read is waiting: takes it. */
  const next = () => http.expectOne(isRead);
  /** No read is waiting. */
  const none = () => http.expectNone(isRead);
  /** The stream coming back makes every live store read again; the others are not this spec's business. */
  const answerOthers = () => {
    for (const other of http.match((r) => !isRead(r))) other.flush([]);
  };
  /** Answers the one read that is waiting (the first page of a, b, c by default). */
  const answer = async (page = apiLineChatPage([a, b, c], { labels: ['VIP', 'ใหม่'] })) => {
    const r = next();
    r.flush(page);
    await settle();
    return r;
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    http = provideApiTesting({
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    store = TestBed.inject(LineChatsStore);
    events = TestBed.inject(DeviceEventsService) as unknown as FakeDeviceEvents;
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  describe('reading', () => {
    it('asks for the first page of 20 once the workspace is there, and holds what comes back', async () => {
      expect(store.loaded()).toBe(false);
      await signIn(http);
      const r = next();
      expect(r.request.params.get('page')).toBe('1');
      expect(r.request.params.get('pageSize')).toBe('20');
      // No filter is sent when none is on.
      for (const key of ['q', 'label', 'activeWithinDays', 'doNotSend', 'accountId'])
        expect(r.request.params.has(key), key).toBe(false);
      r.flush(apiLineChatPage([a, b, c], { labels: ['VIP', 'ใหม่'], total: 41 }));
      await settle();
      expect(store.loaded()).toBe(true);
      expect(store.chats().map((x) => x.id)).toEqual(['a', 'b', 'c']);
      expect(store.total()).toBe(41);
      expect(store.labels()).toEqual(['VIP', 'ใหม่']);
      expect(store.accounts().map((x) => x.id)).toEqual(['acc-line']);
      // The pager knows the 41 chats: three pages of 20.
      expect(store.pager.count()).toBe(41);
      expect(store.pager.pageCount()).toBe(3);
    });

    it('does not ask at all when the owner plan has no LINE chats, and says it is locked', async () => {
      await signIn(http, { workspace: { lineChat: false } });
      none();
      expect(store.locked()).toBe(true);
      expect(store.loaded()).toBe(true);
    });

    it('treats a 403 as the plan lock (no retry, no failure)', async () => {
      await signIn(http);
      next().flush(
        { title: 'แชท LINE ใช้ได้ในแพ็กเกจ Pro ขึ้นไป' },
        { status: 403, statusText: 'Forbidden' },
      );
      await settle();
      expect(store.locked()).toBe(true);
      expect(store.failed()).toBe(false);
      expect(store.loaded()).toBe(true);
      vi.advanceTimersByTime(60_000);
      await settle();
      none();
    });

    it('tries again after a server error, then gives up and says it failed', async () => {
      await signIn(http);
      next().flush(null, { status: 503, statusText: 'x' });
      await settle();
      expect(store.loaded()).toBe(false);
      for (const delay of RETRY_DELAYS_MS) {
        none();
        vi.advanceTimersByTime(delay);
        await settle();
        next().flush(null, { status: 503, statusText: 'x' });
        await settle();
      }
      expect(store.loaded()).toBe(false);
      expect(store.failed()).toBe(true);
      none();
    });

    it('drops the answer of a read the person has moved on from', async () => {
      await signIn(http);
      const old = next();
      store.setLabel('VIP');
      await settle();
      const fresh = next();
      expect(fresh.request.params.get('label')).toBe('VIP');
      fresh.flush(apiLineChatPage([a]));
      old.flush(apiLineChatPage([b, c]));
      await settle();
      expect(store.chats().map((x) => x.id)).toEqual(['a']);
    });
  });

  describe('filters and pages', () => {
    beforeEach(async () => {
      await signIn(http);
      await answer(apiLineChatPage([a, b, c], { total: 60 }));
    });

    it('goes back to the first page when a filter changes', async () => {
      store.pager.go(3);
      await settle();
      const third = next();
      expect(third.request.params.get('page')).toBe('3');
      third.flush(apiLineChatPage([a], { total: 60 }));
      await settle();
      store.setLabel('VIP');
      await settle();
      const r = next();
      expect(r.request.params.get('label')).toBe('VIP');
      expect(r.request.params.get('page')).toBe('1');
      r.flush(apiLineChatPage([a]));
    });

    it('sends a typed search shortly after the last keystroke, not before', async () => {
      store.setSearch('สม');
      store.setSearch('สมช');
      expect(store.q()).toBe('สมช');
      await settle();
      none();
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await settle();
      const r = next();
      expect(r.request.params.get('q')).toBe('สมช');
      r.flush(apiLineChatPage([a]));
    });

    it('sends the search at once on Enter', async () => {
      store.setSearch('มานี');
      store.applySearch();
      await settle();
      const r = next();
      expect(r.request.params.get('q')).toBe('มานี');
      r.flush(apiLineChatPage([b]));
    });

    it('sends the recency, the do-not-send mark and the account', async () => {
      store.setActiveWithinDays(7);
      await settle();
      let r = next();
      expect(r.request.params.get('activeWithinDays')).toBe('7');
      r.flush(apiLineChatPage([b]));
      await settle();
      store.setDoNotSendFilter(true);
      await settle();
      r = next();
      expect(r.request.params.get('doNotSend')).toBe('true');
      expect(r.request.params.get('activeWithinDays')).toBe('7');
      r.flush(apiLineChatPage([]));
      await settle();
      store.setDoNotSendFilter(false);
      store.setAccount('acc-line');
      await settle();
      r = next();
      expect(r.request.params.get('doNotSend')).toBe('false');
      expect(r.request.params.get('accountId')).toBe('acc-line');
      r.flush(apiLineChatPage([a]));
    });

    it('asks for the page the pager is on, and for the size it is set to', async () => {
      store.pager.go(2);
      await settle();
      let r = next();
      expect(r.request.params.get('page')).toBe('2');
      r.flush(apiLineChatPage([b], { total: 60 }));
      await settle();
      store.pager.setSize(50);
      await settle();
      r = next();
      expect(r.request.params.get('pageSize')).toBe('50');
      expect(r.request.params.get('page')).toBe('1');
      r.flush(apiLineChatPage([a], { total: 60 }));
    });

    it('knows when a filter is on, and clears them all', async () => {
      expect(store.filtered()).toBe(false);
      store.setLabel('VIP');
      await settle();
      next().flush(apiLineChatPage([a]));
      expect(store.filtered()).toBe(true);
      store.clearFilters();
      await settle();
      const r = next();
      expect(r.request.params.has('label')).toBe(false);
      expect(store.filtered()).toBe(false);
      r.flush(apiLineChatPage([a, b, c]));
    });
  });

  describe('do not send', () => {
    beforeEach(async () => {
      await signIn(http);
      await answer();
    });

    it('shows the mark at once and keeps what the server answers', async () => {
      const done = store.setDoNotSend('a', true);
      expect(store.chats().find((x) => x.id === 'a')?.doNotSend).toBe(true);
      const req = http.expectOne((r) => r.method === 'PUT' && r.url === `${CHATS}/a`);
      expect(req.request.body).toEqual({ doNotSend: true });
      req.flush({ ...a, doNotSend: true, linkedSetCount: 2 });
      expect(await done).toBe(true);
      expect(store.chats().find((x) => x.id === 'a')).toMatchObject({
        doNotSend: true,
        linkedSetCount: 2,
      });
    });

    it('puts the mark back when the server refuses', async () => {
      const done = store.setDoNotSend('c', false);
      expect(store.chats().find((x) => x.id === 'c')?.doNotSend).toBe(false);
      http
        .expectOne((r) => r.method === 'PUT' && r.url === `${CHATS}/c`)
        .flush(null, { status: 403, statusText: 'Forbidden' });
      expect(await done).toBe(false);
      expect(store.chats().find((x) => x.id === 'c')?.doNotSend).toBe(true);
    });
  });

  describe('staying current', () => {
    beforeEach(async () => {
      await signIn(http);
      await answer();
    });

    it('reads the page again after the browser synced its chats (one read for a burst)', async () => {
      events.emit('device.line_chats', { count: 5 });
      events.emit('device.line_chats', { count: 6 });
      await settle();
      none();
      vi.advanceTimersByTime(1500);
      await settle();
      await answer(apiLineChatPage([a, b, c, apiLineChat({ id: 'd' })]));
      expect(store.chats()).toHaveLength(4);
      none();
    });

    it('ignores other events and reads again after the stream came back', async () => {
      events.emit('post');
      events.emit('device.online');
      vi.advanceTimersByTime(5000);
      await settle();
      none();
      events.resume();
      await settle();
      answerOthers();
      await answer();
    });

    it('keeps the list when a live read fails', async () => {
      events.resume();
      await settle();
      answerOthers();
      next().flush(null, { status: 500, statusText: 'x' });
      await settle();
      expect(store.chats()).toHaveLength(3);
      expect(store.failed()).toBe(false);
    });

    it('empties itself, filters included, when the workspace changes', async () => {
      store.setLabel('VIP');
      await settle();
      await answer(apiLineChatPage([a]));
      const ws = TestBed.inject(WorkspaceStore);
      ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
      ws.switchTo('ws-2');
      await settle();
      expect(store.chats()).toEqual([]);
      expect(store.label()).toBe('');
      expect(store.loaded()).toBe(false);
      const r = http.expectOne(
        (req) => req.method === 'GET' && req.url === '/api/workspaces/ws-2/line/chats',
      );
      expect(r.request.params.has('label')).toBe(false);
      // Whatever else the new workspace loads is not this spec's business.
      for (const other of http.match(() => true)) other.flush([]);
    });
  });

  describe('importing into a set', () => {
    const imported = (links: string[], extra: Record<string, number> = {}) => ({
      set: apiLineSet({ id: 'ls', links: links.map((id) => apiChatLink({ id })) }),
      added: links.length,
      duplicates: 0,
      recoded: 0,
      invalid: 0,
      conflicts: 0,
      skippedDoNotSend: 0,
      ...extra,
    });

    it('sends the picked chats, puts the answer into the set and reads the roster again', async () => {
      const sets = TestBed.inject(LinkSetsStore);
      await signIn(http, { linkSets: [apiLineSet({ id: 'ls' })] });
      await answer();
      const done = store.importIntoSet('ls', { accountId: 'acc-line', chatIds: ['a', 'b'] });
      const req = http.expectOne(
        (r) => r.method === 'POST' && r.url === `${SETS}/ls/links/from-line-chats`,
      );
      expect(req.request.body).toEqual({
        accountId: 'acc-line',
        chatIds: ['a', 'b'],
        allMatching: false,
      });
      req.flush(imported(['a', 'b']));
      const result = await done;
      expect(result.added).toBe(2);
      expect(sets.byId('ls')?.links).toHaveLength(2);
      await settle();
      // Each chat now sits in one more set: the roster is read again.
      await answer();
    });

    it('sends a filter and "everything that matches" when asked to', async () => {
      await signIn(http, { linkSets: [apiLineSet({ id: 'ls' })] });
      await answer();
      const done = store.importIntoSet('ls', {
        accountId: 'acc-line',
        allMatching: true,
        filter: { q: null, label: 'VIP', activeWithinDays: 30 },
      });
      const req = http.expectOne((r) => r.url === `${SETS}/ls/links/from-line-chats`);
      expect(req.request.body).toEqual({
        accountId: 'acc-line',
        allMatching: true,
        filter: { q: null, label: 'VIP', activeWithinDays: 30 },
      });
      req.flush(imported([], { skippedDoNotSend: 2 }));
      expect((await done).skippedDoNotSend).toBe(2);
      await settle();
      await answer();
    });

    it('rejects when the API refuses, so the dialog can say why', async () => {
      await signIn(http, { linkSets: [apiLineSet({ id: 'ls' })] });
      await answer();
      const done = store.importIntoSet('ls', { accountId: 'acc-line', chatIds: ['a'] });
      const rejected = expect(done).rejects.toBeTruthy();
      http
        .expectOne((r) => r.url === `${SETS}/ls/links/from-line-chats`)
        .flush({ title: 'ชุดนี้ไม่ใช่ชุดแชท LINE' }, { status: 422, statusText: 'x' });
      await rejected;
    });
  });
});

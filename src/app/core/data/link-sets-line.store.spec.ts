import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { apiChatLink, apiLineSet } from '../../testing/line.fixtures';
import { SET_URL, apiLink, apiLinkSet } from '../../testing/link-sets.fixtures';
import { DeviceEventsService } from './device-events.service';
import { EDIT_DEBOUNCE_MS, LinkSetsStore, isActiveLink, statsOf } from './link-sets.store';

const SETS_URL = `/api/workspaces/${WS}/link-sets`;
const CHAT_A = apiChatLink({ id: 'a', name: 'สมชาย' });
const CHAT_B = apiChatLink({ id: 'b', name: 'มานี' });
const LINE_SET = apiLineSet({ id: 'ls', links: [CHAT_A, CHAT_B] });
const FB_SET = apiLinkSet({ id: 'fs', links: [apiLink({ id: 'g' })] });

// Sets of LINE customer chats live in the same store as the Facebook ones, with the server's flags standing for them: the
// Facebook parser would call every chat address invalid.
describe('LinkSetsStore: LINE chat sets', () => {
  let http: HttpTestingController;
  let store: LinkSetsStore;
  let events: FakeDeviceEvents;

  async function start(sets = [LINE_SET, FB_SET]): Promise<void> {
    http = provideApiTesting({
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    store = TestBed.inject(LinkSetsStore);
    events = TestBed.inject(DeviceEventsService) as unknown as FakeDeviceEvents;
    await signIn(http, { linkSets: sets });
  }

  const wait = async (ms = EDIT_DEBOUNCE_MS) => {
    await vi.advanceTimersByTimeAsync(ms);
    await settle();
  };
  const rowOf = (setId: string, id: string) => store.byId(setId)!.links.find((l) => l.id === id)!;

  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
  afterEach(() => {
    vi.useRealTimers();
    for (const r of http.match((x) => x.url.endsWith('/collections'))) r.flush([]);
    http.verify();
  });

  it('keeps the channel of each set as the server says it', async () => {
    await start();
    expect(store.byId('ls')?.channel).toBe('line');
    expect(store.byId('fs')?.channel).toBe('fb');
  });

  it('counts a chat that is on and valid as one the engine would send to', async () => {
    await start();
    expect(isActiveLink(CHAT_A)).toBe(true);
    expect(isActiveLink({ ...CHAT_A, enabled: false })).toBe(false);
    expect(statsOf(store.byId('ls')!)).toEqual({ links: 2, on: 2, codes: 0 });
    expect(store.linkCount()).toBe(3);
  });

  describe('editing a customer', () => {
    it('leaves the server’s flags on the row: valid, not a duplicate, kind "chat"', async () => {
      await start();
      store.editLink('ls', 'a', { name: 'คุณสมชาย' });
      // Before the save comes back: the row on screen still reads as a good chat, not as an invalid group.
      expect(rowOf('ls', 'a')).toMatchObject({
        name: 'คุณสมชาย',
        valid: true,
        duplicate: false,
        kind: 'chat',
      });
      await wait();
      const req = http.expectOne(`${SET_URL('ls')}/links/a`);
      expect(req.request.body).toEqual({
        name: 'คุณสมชาย',
        url: CHAT_A.url,
        code: '',
        dailyMax: 0,
        enabled: true,
      });
      req.flush({ ...CHAT_A, name: 'คุณสมชาย' });
      await settle();
      expect(rowOf('ls', 'a')).toMatchObject({ valid: true, kind: 'chat', name: 'คุณสมชาย' });
    });

    it('switches a customer off at once and keeps the flags', async () => {
      await start();
      store.editLink('ls', 'b', { enabled: false }, true);
      await settle();
      const req = http.expectOne(`${SET_URL('ls')}/links/b`);
      req.flush({ ...CHAT_B, enabled: false });
      await settle();
      expect(rowOf('ls', 'b')).toMatchObject({ enabled: false, valid: true, kind: 'chat' });
      expect(statsOf(store.byId('ls')!).on).toBe(1);
    });

    it('does not turn the chats of a live read into invalid groups while one is being edited', async () => {
      await start();
      store.editLink('ls', 'a', { name: 'พี่สมชาย' });
      events.resume();
      await settle();
      http.expectOne(SETS_URL).flush([LINE_SET, FB_SET]);
      await settle();
      expect(rowOf('ls', 'a')).toMatchObject({ name: 'พี่สมชาย', valid: true, kind: 'chat' });
      expect(rowOf('ls', 'b')).toMatchObject({ valid: true, kind: 'chat' });
      await wait();
      http.expectOne(`${SET_URL('ls')}/links/a`).flush({ ...CHAT_A, name: 'พี่สมชาย' });
    });

    it('still flags a Facebook row the old way when its address is typed wrong', async () => {
      await start();
      store.editLink('fs', 'g', { url: 'not a group' });
      expect(rowOf('fs', 'g')).toMatchObject({ valid: false });
      await wait();
      http
        .expectOne(`${SET_URL('fs')}/links/g`)
        .flush({ ...apiLink({ id: 'g' }), url: 'not a group', valid: false });
    });
  });

  it('removes a customer from the set at once and puts it back when the server refuses', async () => {
    await start();
    const gone = store.removeLink('ls', 'a');
    expect(store.byId('ls')!.links.map((l) => l.id)).toEqual(['b']);
    http.expectOne(`${SET_URL('ls')}/links/a`).flush(null, { status: 422, statusText: 'x' });
    expect(await gone).toBe(false);
    expect(store.byId('ls')!.links.map((l) => l.id)).toEqual(['a', 'b']);
    expect(rowOf('ls', 'a').kind).toBe('chat');
  });

  describe('creating a chat set', () => {
    it('sends the channel "line" with the set and keeps the set the API answers', async () => {
      await start();
      const done = store.createSet('ลูกค้าใหม่', 'acc-line', 'line');
      const req = http.expectOne(SETS_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        name: 'ลูกค้าใหม่',
        postAsAccountId: 'acc-line',
        channel: 'line',
      });
      req.flush(apiLineSet({ id: 'new', name: 'ลูกค้าใหม่' }));
      expect((await done).channel).toBe('line');
      expect(store.byId('new')?.channel).toBe('line');
    });

    it('sends "fb" when no channel is given', async () => {
      await start();
      const done = store.createSet('Villas');
      const req = http.expectOne(SETS_URL);
      expect(req.request.body).toEqual({ name: 'Villas', postAsAccountId: null, channel: 'fb' });
      req.flush(apiLinkSet({ id: 'v', name: 'Villas' }));
      await done;
    });
  });

  it('leaves the chat sets out of the CSV of links: they are customers, and the import reads group addresses', async () => {
    await start();
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
      created.push(blob as Blob);
      return 'blob:x';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    expect(store.exportCsv()).toBe(true);
    const text = await created[0].text();
    expect(text).toContain('https://www.facebook.com/groups/g');
    expect(text).not.toContain('chat.line.biz');
    expect(text).not.toContain('สมชาย');
    vi.restoreAllMocks();
  });

  describe('importing chats', () => {
    it('puts the set the API answers into the store, flags and all', async () => {
      await start([apiLineSet({ id: 'ls' }), FB_SET]);
      const done = store.importChats('ls', {
        accountId: 'acc-line',
        chatIds: ['c1', 'c2'],
        allMatching: false,
      });
      const req = http.expectOne(`${SET_URL('ls')}/links/from-line-chats`);
      expect(req.request.method).toBe('POST');
      req.flush({
        set: apiLineSet({ id: 'ls', links: [CHAT_A, CHAT_B] }),
        added: 2,
        duplicates: 0,
        recoded: 0,
        invalid: 0,
        conflicts: 0,
        skippedDoNotSend: 0,
      });
      const result = await done;
      expect(result.added).toBe(2);
      expect(store.byId('ls')!.links.map((l) => [l.id, l.valid, l.kind])).toEqual([
        ['a', true, 'chat'],
        ['b', true, 'chat'],
      ]);
    });

    it('rejects when the API refuses and leaves the set as it was', async () => {
      await start();
      const done = store.importChats('ls', { accountId: 'x', chatIds: ['c1'], allMatching: false });
      const rejected = expect(done).rejects.toBeTruthy();
      http
        .expectOne(`${SET_URL('ls')}/links/from-line-chats`)
        .flush({ title: 'no' }, { status: 422, statusText: 'x' });
      await rejected;
      expect(store.byId('ls')!.links).toHaveLength(2);
    });
  });
});

import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiCollection } from '../http/api.service';
import { WORKSPACE, WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { SET_URL, apiLink, apiLinkSet } from '../../testing/link-sets.fixtures';
import { CollectionsStore } from './collections.store';
import { DeviceEventsService } from './device-events.service';
import {
  EDIT_DEBOUNCE_MS,
  LinkSetsStore,
  firstCodedLink,
  isActiveLink,
  statsOf,
} from './link-sets.store';
import { WorkspaceStore } from './workspace.store';

const SETS_URL = `/api/workspaces/${WS}/link-sets`;
const A = apiLink({ id: 'a', name: 'Condo BKK', code: '#Jan24' });
const B = apiLink({ id: 'b', name: 'Condo rent', url: 'https://www.facebook.com/groups/rent' });
const SET = apiLinkSet({ id: 's1', links: [A, B], accountIds: ['acc-ig'], scheduleCount: 1 });

describe('LinkSetsStore', () => {
  let http: HttpTestingController;
  let store: LinkSetsStore;
  let events: FakeDeviceEvents;

  async function start(sets = [SET]): Promise<void> {
    http = provideApiTesting({
      providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    store = TestBed.inject(LinkSetsStore);
    events = TestBed.inject(DeviceEventsService) as unknown as FakeDeviceEvents;
    await signIn(http, { linkSets: sets });
  }

  /** Lets the debounce of an inline edit run out. */
  async function wait(ms = EDIT_DEBOUNCE_MS): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    await settle();
  }

  const rowOf = (setId: string, id: string) => store.byId(setId)!.links.find((l) => l.id === id)!;

  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
  afterEach(() => {
    vi.useRealTimers();
    // The collections store (the source of the example settings) asks for its own list on a workspace switch.
    for (const r of http.match((x) => x.url.endsWith('/collections'))) r.flush([]);
    http.verify();
  });

  describe('loading', () => {
    it('loads the sets of the workspace and reports them loaded', async () => {
      await start();
      expect(store.loaded()).toBe(true);
      expect(store.sets()).toEqual([SET]);
      expect(store.setCount()).toBe(1);
      expect(store.byId('s1')?.name).toBe('Condo groups');
    });

    it('is not loaded before the answer, and empties itself with the workspace', async () => {
      http = provideApiTesting({
        providers: [{ provide: DeviceEventsService, useClass: FakeDeviceEvents }],
      });
      store = TestBed.inject(LinkSetsStore);
      expect(store.loaded()).toBe(false);
      await signIn(http, { linkSets: [SET] });
      expect(store.loaded()).toBe(true);

      const ws = TestBed.inject(WorkspaceStore);
      ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
      ws.switchTo('ws-2');
      await settle();
      expect(store.sets()).toEqual([]);
      expect(store.loaded()).toBe(false);
      http.expectOne(`/api/workspaces/ws-2/link-sets`).flush([]);
      await settle();
      expect(store.loaded()).toBe(true);
    });

    it('counts per set: links, enabled valid ones, those with a code, other accounts', async () => {
      const off = apiLink({ id: 'c', enabled: false, code: 'X' });
      const bad = apiLink({ id: 'd', url: 'nope', valid: false, code: 'Y' });
      await start([apiLinkSet({ id: 's1', links: [A, B, off, bad], accountIds: ['x', 'y'] })]);
      expect(store.stats()['s1']).toEqual({ links: 4, on: 2, codes: 1, accounts: 2 });
      expect(statsOf(store.byId('s1')!)).toEqual(store.stats()['s1']);
    });

    it('counts the links the engine would post to over every set', async () => {
      await start([
        SET,
        apiLinkSet({
          id: 's2',
          links: [
            apiLink({ id: 'e', enabled: false }),
            apiLink({ id: 'f', url: 'https://example.com', valid: false }),
          ],
        }),
      ]);
      expect(store.linkCount()).toBe(2);
      expect(store.setCount()).toBe(2);
      expect(isActiveLink(rowOf('s2', 'e'))).toBe(false);
    });

    it('finds the first coded link that is switched on and valid', () => {
      const set = apiLinkSet({
        id: 's',
        links: [
          apiLink({ id: 'a', code: 'off', enabled: false }),
          apiLink({ id: 'b', url: 'x', code: 'bad', valid: false }),
          apiLink({ id: 'c', code: '  ' }),
          apiLink({ id: 'd', code: '#ok' }),
        ],
      });
      expect(firstCodedLink(set)?.id).toBe('d');
      expect(
        firstCodedLink(apiLinkSet({ id: 'x', links: [apiLink({ id: 'q' })] })),
      ).toBeUndefined();
    });

    it('takes the example settings from the first collection', async () => {
      await start();
      expect(store.exampleSettings()).toBeNull();
      const collections = TestBed.inject(CollectionsStore);
      collections.collections.set([
        {
          id: 'c1',
          settings: { hashtags: '#a', footer: 'F', footerPos: 'top' },
        } as unknown as ApiCollection,
      ]);
      expect(store.exampleSettings()).toEqual({ hashtags: '#a', footer: 'F', footerPos: 'top' });
    });
  });

  describe('inline edits of a link', () => {
    it('shows the change at once and saves the complete row after the debounce', async () => {
      await start();
      store.editLink('s1', 'b', { code: '#New' });
      expect(rowOf('s1', 'b').code).toBe('#New');
      http.expectNone(`${SET_URL('s1')}/links/b`);
      await wait(EDIT_DEBOUNCE_MS - 1);
      http.expectNone(`${SET_URL('s1')}/links/b`);
      await wait(1);
      const req = http.expectOne(`${SET_URL('s1')}/links/b`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        name: 'Condo rent',
        url: 'https://www.facebook.com/groups/rent',
        code: '#New',
        dailyMax: 0,
        enabled: true,
      });
      req.flush({ ...B, code: '#New' });
    });

    it('sends one request for a burst of keystrokes, with the last text', async () => {
      await start();
      for (const code of ['#', '#N', '#Ne', '#New']) {
        store.editLink('s1', 'b', { code });
        await wait(300);
      }
      http.expectNone(`${SET_URL('s1')}/links/b`);
      await wait(300);
      const req = http.expectOne(`${SET_URL('s1')}/links/b`);
      expect(req.request.body.code).toBe('#New');
      req.flush({ ...B, code: '#New' });
    });

    it('sends the edits of two fields in one complete row', async () => {
      await start();
      store.editLink('s1', 'a', { name: 'Renamed' });
      store.editLink('s1', 'a', { dailyMax: 7 });
      await wait();
      const req = http.expectOne(`${SET_URL('s1')}/links/a`);
      expect(req.request.body).toEqual({
        name: 'Renamed',
        url: A.url,
        code: '#Jan24',
        dailyMax: 7,
        enabled: true,
      });
      req.flush({ ...A, name: 'Renamed', dailyMax: 7 });
    });

    it('saves a switch at once', async () => {
      await start();
      store.editLink('s1', 'a', { enabled: false }, true);
      await settle();
      const req = http.expectOne(`${SET_URL('s1')}/links/a`);
      expect(req.request.body.enabled).toBe(false);
      expect(rowOf('s1', 'a').enabled).toBe(false);
      req.flush({ ...A, enabled: false });
    });

    it('takes the normalised address the server stores', async () => {
      await start();
      store.editLink('s1', 'a', { url: 'fb.com/groups/condo.bkk' });
      await wait();
      http
        .expectOne(`${SET_URL('s1')}/links/a`)
        .flush({ ...A, url: 'https://www.facebook.com/groups/condo.bkk' });
      await settle();
      expect(rowOf('s1', 'a').url).toBe('https://www.facebook.com/groups/condo.bkk');
    });

    it('keeps a space typed at the end of a text the server only trimmed', async () => {
      await start();
      store.editLink('s1', 'a', { name: 'คอนโด ', code: '#Jan24 ' });
      await wait();
      http.expectOne(`${SET_URL('s1')}/links/a`).flush({ ...A, name: 'คอนโด', code: '#Jan24' });
      await settle();
      expect(rowOf('s1', 'a').name).toBe('คอนโด ');
      expect(rowOf('s1', 'a').code).toBe('#Jan24 ');
    });

    it('keeps an emptied name empty while the server derives one from the address', async () => {
      await start();
      store.editLink('s1', 'a', { name: '' });
      await wait();
      http.expectOne(`${SET_URL('s1')}/links/a`).flush({ ...A, name: 'a' });
      await settle();
      expect(rowOf('s1', 'a').name).toBe('');
    });

    it('shows another text the server stored instead of what was typed', async () => {
      await start();
      store.editLink('s1', 'a', { code: '#x' });
      await wait();
      http.expectOne(`${SET_URL('s1')}/links/a`).flush({ ...A, code: '#X' });
      await settle();
      expect(rowOf('s1', 'a').code).toBe('#X');
    });

    it('flags an address that is not a Facebook group before the server answers', async () => {
      await start();
      store.editLink('s1', 'a', { url: 'https://example.com/x' });
      expect(rowOf('s1', 'a').valid).toBe(false);
      store.editLink('s1', 'a', { url: 'https://www.facebook.com/groups/ok' });
      expect(rowOf('s1', 'a').valid).toBe(true);
      await wait();
      http.expectOne(`${SET_URL('s1')}/links/a`).flush(rowOf('s1', 'a'));
    });

    it('flags the second row with the same address, and clears it when it changes', async () => {
      await start();
      store.editLink('s1', 'b', { url: 'facebook.com/groups/a' });
      expect(rowOf('s1', 'a').duplicate).toBe(false);
      expect(rowOf('s1', 'b').duplicate).toBe(true);
      store.editLink('s1', 'b', { url: 'https://www.facebook.com/groups/other' });
      expect(rowOf('s1', 'b').duplicate).toBe(false);
      await wait();
      http.expectOne(`${SET_URL('s1')}/links/b`).flush(rowOf('s1', 'b'));
    });

    it('does not write the server answer over text typed while the request was in flight', async () => {
      await start();
      store.editLink('s1', 'a', { name: 'One' });
      await wait();
      const first = http.expectOne(`${SET_URL('s1')}/links/a`);
      store.editLink('s1', 'a', { name: 'One two' });
      first.flush({ ...A, name: 'One' });
      await settle();
      expect(rowOf('s1', 'a').name).toBe('One two');
      await wait();
      const second = http.expectOne(`${SET_URL('s1')}/links/a`);
      expect(second.request.body.name).toBe('One two');
      second.flush({ ...A, name: 'One two' });
      await settle();
      expect(rowOf('s1', 'a').name).toBe('One two');
    });

    it('sends the next edit only after the request in flight has answered', async () => {
      await start();
      store.editLink('s1', 'a', { name: 'One' }, true);
      await settle();
      const first = http.expectOne(`${SET_URL('s1')}/links/a`);
      store.editLink('s1', 'a', { name: 'Two' }, true);
      await settle();
      http.expectNone(`${SET_URL('s1')}/links/a`);
      first.flush({ ...A, name: 'One' });
      await settle();
      const second = http.expectOne(`${SET_URL('s1')}/links/a`);
      expect(second.request.body.name).toBe('Two');
      second.flush({ ...A, name: 'Two' });
    });

    it('puts the row back to what the server confirmed when the save is refused', async () => {
      await start();
      store.editLink('s1', 'a', { name: 'x'.repeat(300) });
      await wait();
      http
        .expectOne(`${SET_URL('s1')}/links/a`)
        .flush({ title: 'ชื่อยาวเกินไป' }, { status: 400, statusText: 'Bad Request' });
      await settle();
      expect(rowOf('s1', 'a').name).toBe('Condo BKK');
      // Nothing is left waiting: a later edit starts a fresh save.
      store.editLink('s1', 'a', { name: 'Fine' });
      await wait();
      http.expectOne(`${SET_URL('s1')}/links/a`).flush({ ...A, name: 'Fine' });
    });

    it('goes back to the last confirmed row, not to the one before all edits', async () => {
      await start();
      store.editLink('s1', 'a', { code: '#1' }, true);
      await settle();
      http.expectOne(`${SET_URL('s1')}/links/a`).flush({ ...A, code: '#1' });
      await settle();
      store.editLink('s1', 'a', { code: '#2' }, true);
      await settle();
      http.expectOne(`${SET_URL('s1')}/links/a`).flush(null, { status: 422, statusText: 'x' });
      await settle();
      expect(rowOf('s1', 'a').code).toBe('#1');
    });

    it('ignores an edit of a row that is not there', async () => {
      await start();
      store.editLink('s1', 'nope', { name: 'x' });
      store.editLink('nope', 'a', { name: 'x' });
      await wait();
      expect(store.sets()).toEqual([SET]);
    });

    it('drops the edits of a row that was removed meanwhile', async () => {
      await start();
      store.editLink('s1', 'a', { name: 'Gone' });
      const removing = store.removeLink('s1', 'a');
      http.expectOne(`${SET_URL('s1')}/links/a`).flush(null, { status: 204, statusText: 'x' });
      await removing;
      await wait();
      http.expectNone(`${SET_URL('s1')}/links/a`);
    });
  });

  describe('adding and removing links', () => {
    it('adds an empty row from the server and keeps it flagged until it is filled in', async () => {
      await start();
      const added = store.addLinkRow('s1');
      const req = http.expectOne(`${SET_URL('s1')}/links`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: null, url: null, code: null, dailyMax: null });
      req.flush(apiLink({ id: 'n', url: '', name: '', valid: false }));
      const row = await added;
      expect(row?.id).toBe('n');
      expect(store.byId('s1')!.links.map((l) => l.id)).toEqual(['a', 'b', 'n']);
      expect(rowOf('s1', 'n').valid).toBe(false);
    });

    it('removes a row at once and keeps it removed when the server agrees', async () => {
      await start();
      const done = store.removeLink('s1', 'a');
      expect(store.byId('s1')!.links.map((l) => l.id)).toEqual(['b']);
      const req = http.expectOne(`${SET_URL('s1')}/links/a`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
      expect(await done).toBe(true);
      expect(store.byId('s1')!.links.map((l) => l.id)).toEqual(['b']);
    });

    it('puts a row back where it was when the delete is refused', async () => {
      await start();
      const done = store.removeLink('s1', 'a');
      http.expectOne(`${SET_URL('s1')}/links/a`).flush(null, { status: 500, statusText: 'x' });
      expect(await done).toBe(false);
      expect(store.byId('s1')!.links.map((l) => l.id)).toEqual(['a', 'b']);
    });

    it('turns a switched-off link back on from the server answer', async () => {
      const off = apiLink({ id: 'a', enabled: false, health: 'off', failStreak: 3 });
      await start([apiLinkSet({ id: 's1', links: [off, B] })]);
      const done = store.reenable('s1', 'a');
      const req = http.expectOne(`${SET_URL('s1')}/links/a/enable`);
      expect(req.request.method).toBe('POST');
      req.flush({ ...off, enabled: true, health: 'ok', failStreak: 0 });
      await done;
      expect(rowOf('s1', 'a')).toMatchObject({ enabled: true, health: 'ok', failStreak: 0 });
    });
  });

  describe('bulk paste, import and CSV', () => {
    it('adds pasted lines and answers the counts', async () => {
      await start();
      const done = store.bulkAdd('s1', 'https://www.facebook.com/groups/new | #C\nbad');
      const req = http.expectOne(`${SET_URL('s1')}/links/bulk`);
      expect(req.request.body).toEqual({ text: 'https://www.facebook.com/groups/new | #C\nbad' });
      const n = apiLink({ id: 'n', code: '#C' });
      req.flush({
        added: 1,
        duplicates: 0,
        recoded: 0,
        invalid: 1,
        set: { ...SET, links: [A, B, n] },
      });
      const result = await done;
      expect(result).toMatchObject({ added: 1, duplicates: 0, recoded: 0, invalid: 1 });
      expect(store.byId('s1')!.links.map((l) => l.id)).toEqual(['a', 'b', 'n']);
    });

    it('keeps a row being edited when the bulk answer brings the set again', async () => {
      await start();
      store.editLink('s1', 'a', { name: 'Typing' });
      const done = store.bulkAdd('s1', 'x');
      http.expectOne(`${SET_URL('s1')}/links/bulk`).flush({
        added: 0,
        duplicates: 1,
        recoded: 0,
        invalid: 0,
        set: SET,
      });
      await done;
      expect(rowOf('s1', 'a').name).toBe('Typing');
      await wait();
      http.expectOne(`${SET_URL('s1')}/links/a`).flush({ ...A, name: 'Typing' });
    });

    it('lists the synced groups of an account', async () => {
      await start();
      const done = store.accountGroups('acc-fb');
      http
        .expectOne(`/api/workspaces/${WS}/accounts/acc-fb/groups`)
        .flush([{ name: 'Condo BKK', url: A.url }]);
      expect(await done).toEqual([{ name: 'Condo BKK', url: A.url }]);
    });

    it('imports the picked groups of an account into the set', async () => {
      await start();
      const done = store.importGroups('s1', 'acc-fb', ['https://www.facebook.com/groups/g1']);
      const req = http.expectOne(`${SET_URL('s1')}/links/import`);
      expect(req.request.body).toEqual({
        accountId: 'acc-fb',
        urls: ['https://www.facebook.com/groups/g1'],
      });
      req.flush({ ...SET, links: [A, B, apiLink({ id: 'g1' })] });
      const set = await done;
      expect(set.links).toHaveLength(3);
      expect(store.byId('s1')!.links).toHaveLength(3);
    });

    it('imports CSV rows and reads the sets again, which may include new ones', async () => {
      await start();
      const rows = [{ set: 'New set', name: 'G', url: A.url, code: '' }];
      const done = store.importCsv(rows);
      const req = http.expectOne(`${SETS_URL}/import-csv`);
      expect(req.request.body).toEqual({ rows });
      req.flush({ links: 1, sets: 1, invalid: 0 });
      await settle();
      http
        .expectOne(SETS_URL)
        .flush([SET, apiLinkSet({ id: 's2', name: 'New set', links: [apiLink({ id: 'z' })] })]);
      expect(await done).toEqual({ links: 1, sets: 1, invalid: 0 });
      expect(store.setCount()).toBe(2);
    });
  });

  describe('sets', () => {
    it('creates a set and lists it', async () => {
      await start();
      const done = store.createSet('Fresh');
      const req = http.expectOne(SETS_URL);
      expect(req.request.body).toEqual({ name: 'Fresh', postAsAccountId: null });
      req.flush(apiLinkSet({ id: 's9', name: 'Fresh' }));
      expect((await done).id).toBe('s9');
      expect(store.sets().map((s) => s.id)).toEqual(['s1', 's9']);
    });

    it('deletes a set', async () => {
      await start();
      const done = store.deleteSet('s1');
      const req = http.expectOne(SET_URL('s1'));
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
      await done;
      expect(store.sets()).toEqual([]);
    });

    it('keeps a set a schedule uses: the API refuses and the error reaches the caller', async () => {
      await start();
      const done = store.deleteSet('s1');
      http
        .expectOne(SET_URL('s1'))
        .flush(
          { title: 'ชุดนี้ถูกใช้ในตาราง ขายคอนโด' },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
      await expect(done).rejects.toMatchObject({ status: 422 });
      expect(store.sets().map((s) => s.id)).toEqual(['s1']);
    });

    it('sets the account that posts, at once, with the complete set in the request', async () => {
      await start();
      const done = store.setPostAs('s1', 'acc-fb');
      expect(store.byId('s1')?.postAsAccountId).toBe('acc-fb');
      const req = http.expectOne(SET_URL('s1'));
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        name: 'Condo groups',
        postAsAccountId: 'acc-fb',
        accountIds: ['acc-ig'],
      });
      req.flush({ ...SET, postAsAccountId: 'acc-fb' });
      expect(await done).toBe(true);
    });

    it('goes back to the old account when the save is refused', async () => {
      await start();
      const done = store.setPostAs('s1', 'acc-fb');
      http.expectOne(SET_URL('s1')).flush(null, { status: 403, statusText: 'Forbidden' });
      expect(await done).toBe(false);
      expect(store.byId('s1')?.postAsAccountId).toBeNull();
    });

    it('adds and removes other accounts', async () => {
      await start();
      const adding = store.addAccount('s1', 'acc-tt');
      expect(store.byId('s1')?.accountIds).toEqual(['acc-ig', 'acc-tt']);
      const add = http.expectOne(SET_URL('s1'));
      expect(add.request.body.accountIds).toEqual(['acc-ig', 'acc-tt']);
      add.flush({ ...SET, accountIds: ['acc-ig', 'acc-tt'] });
      expect(await adding).toBe(true);

      const removing = store.removeAccount('s1', 'acc-ig');
      expect(store.byId('s1')?.accountIds).toEqual(['acc-tt']);
      const remove = http.expectOne(SET_URL('s1'));
      expect(remove.request.body.accountIds).toEqual(['acc-tt']);
      remove.flush({ ...SET, accountIds: ['acc-tt'] });
      expect(await removing).toBe(true);
    });

    it('ignores an account that is already there, or not there', async () => {
      await start();
      expect(await store.addAccount('s1', 'acc-ig')).toBe(false);
      expect(await store.removeAccount('s1', 'zzz')).toBe(false);
      expect(await store.addAccount('nope', 'x')).toBe(false);
    });

    it('sends quick changes one after the other, the second with the set as it is then', async () => {
      await start();
      const first = store.addAccount('s1', 'acc-tt');
      const second = store.addAccount('s1', 'acc-x');
      expect(store.byId('s1')?.accountIds).toEqual(['acc-ig', 'acc-tt', 'acc-x']);
      const one = http.expectOne(SET_URL('s1'));
      expect(one.request.body.accountIds).toEqual(['acc-ig', 'acc-tt']);
      // The first answer is not applied: a newer change is still on its way.
      one.flush({ ...SET, accountIds: ['acc-ig', 'acc-tt'] });
      expect(await first).toBe(true);
      await settle();
      expect(store.byId('s1')?.accountIds).toEqual(['acc-ig', 'acc-tt', 'acc-x']);
      const two = http.expectOne(SET_URL('s1'));
      expect(two.request.body.accountIds).toEqual(['acc-ig', 'acc-tt', 'acc-x']);
      two.flush({ ...SET, accountIds: ['acc-ig', 'acc-tt', 'acc-x'] });
      expect(await second).toBe(true);
      expect(store.byId('s1')?.accountIds).toEqual(['acc-ig', 'acc-tt', 'acc-x']);
    });
  });

  describe('"more options" of a set', () => {
    it('remembers the choice per set, and forgets it with the workspace', async () => {
      await start();
      expect(store.moreOpen()).toEqual({});
      store.setMore('s1', true);
      store.setMore('s2', false);
      expect(store.moreOpen()).toEqual({ s1: true, s2: false });
      const ws = TestBed.inject(WorkspaceStore);
      ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
      ws.switchTo('ws-2');
      await settle();
      expect(store.moreOpen()).toEqual({});
      http.expectOne(`/api/workspaces/ws-2/link-sets`).flush([]);
    });
  });

  describe('live updates', () => {
    it('reads the sets again when the engine changes a link, after a short pause', async () => {
      await start();
      events.emit('links.changed', { linkSetId: 's1', linkId: 'a', health: 'off' });
      events.emit('links.changed', { linkSetId: 's1', linkId: 'b', health: 'pending' });
      await settle();
      http.expectNone(SETS_URL);
      await wait(1500);
      const off = { ...A, enabled: false, health: 'off' as const, failStreak: 3 };
      http.expectOne(SETS_URL).flush([{ ...SET, links: [off, B] }]);
      await settle();
      expect(rowOf('s1', 'a')).toMatchObject({ health: 'off', failStreak: 3 });
    });

    it('also reads them when a post settles', async () => {
      await start();
      events.emit('post');
      await wait(1500);
      http.expectOne(SETS_URL).flush([SET]);
    });

    it('leaves the sets alone for other events', async () => {
      await start();
      events.emit('device.state');
      events.emit('device.log');
      await wait(3000);
      http.expectNone(SETS_URL);
    });

    it('reads them again when the stream comes back', async () => {
      await start();
      events.resume();
      await settle();
      http.expectOne(SETS_URL).flush([SET]);
    });

    it('keeps the sets when a live read fails', async () => {
      await start();
      events.resume();
      await settle();
      http.expectOne(SETS_URL).flush(null, { status: 503, statusText: 'x' });
      await settle();
      expect(store.sets()).toEqual([SET]);
    });

    it('keeps a row being edited when a live read brings the set again', async () => {
      await start();
      store.editLink('s1', 'a', { code: '#typing' });
      events.resume();
      await settle();
      http.expectOne(SETS_URL).flush([SET]);
      await settle();
      expect(rowOf('s1', 'a').code).toBe('#typing');
      await wait();
      http.expectOne(`${SET_URL('s1')}/links/a`).flush({ ...A, code: '#typing' });
    });
  });

  describe('CSV export', () => {
    it('saves every link of every set as autopost-links.csv', async () => {
      await start();
      const created: Blob[] = [];
      URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
        created.push(blob as Blob);
        return 'blob:x';
      });
      URL.revokeObjectURL = vi.fn();
      const clicks: string[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        clicks.push(this.download);
      });
      expect(store.exportCsv()).toBe(true);
      expect(clicks).toEqual(['autopost-links.csv']);
      const text = await created[0].text();
      expect(text).toContain('set,name,url,code,enabled,dailyMax');
      expect(text).toContain('Condo groups,Condo BKK,https://www.facebook.com/groups/a,#Jan24,1,0');
      vi.restoreAllMocks();
    });
  });

  it('drops an answer that arrives after the workspace changed', async () => {
    await start();
    const ws = TestBed.inject(WorkspaceStore);
    ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
    const old = store.load(WS);
    ws.switchTo('ws-2');
    await settle();
    const [forOld, forNew] = http.match((r) => r.url.endsWith('/link-sets'));
    expect(forOld.request.url).toBe(SETS_URL);
    forNew.flush([]);
    forOld.flush([SET]);
    await old;
    await settle();
    expect(store.sets()).toEqual([]);
  });
});

import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WS, WORKSPACE, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { apiCollection, apiCollectionPost } from '../../testing/collection-fixtures';
import { CollectionsStore } from './collections.store';
import { MasterPostsStore } from './master-posts.store';
import { RETRY_DELAYS_MS } from './loading';
import { WorkspaceStore } from './workspace.store';

const BASE = `/api/workspaces/${WS}/master-posts`;
const COLS = `/api/workspaces/${WS}/collections`;

const p1 = apiCollectionPost({ id: 'p1', collectionIds: ['a'], text: 'one', postedCount: 2 });
const p2 = apiCollectionPost({
  id: 'p2',
  collectionIds: ['a', 'b'],
  text: 'two',
  mediaIds: ['m1'],
});
const p3 = apiCollectionPost({ id: 'p3', text: 'three', approval: 'draft', active: false });

describe('MasterPostsStore', () => {
  let http: HttpTestingController;
  let store: MasterPostsStore;

  beforeEach(async () => {
    http = provideApiTesting();
    store = TestBed.inject(MasterPostsStore);
    await signIn(http, {
      masterPosts: [p1, p2, p3],
      collections: [
        apiCollection({ id: 'a', posts: [p1, p2] }),
        apiCollection({ id: 'b', posts: [p2] }),
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  describe('reading', () => {
    it('loads every post of the workspace, oldest first as the API lists them', () => {
      expect(store.loaded()).toBe(true);
      expect(store.posts().map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    });

    it('counts the posts for the filters', () => {
      expect(store.counts()).toEqual({ all: 3, on: 2, off: 1, pending: 0, loose: 1 });
      store.posts.update((l) => l.map((p) => (p.id === 'p3' ? { ...p, approval: 'pending' } : p)));
      expect(store.counts().pending).toBe(1);
    });

    it('finds a post by id', () => {
      expect(store.byId('p2')?.text).toBe('two');
      expect(store.byId('nope')).toBeUndefined();
      expect(store.byId(null)).toBeUndefined();
    });

    it('reads again in the background and keeps what is shown when that fails', async () => {
      const done = store.refresh();
      const req = http.expectOne(BASE);
      expect(req.request.method).toBe('GET');
      req.flush([{ ...p1, postedCount: 9 }]);
      await done;
      expect(store.posts().map((p) => [p.id, p.postedCount])).toEqual([['p1', 9]]);
      const failing = store.refresh();
      http.expectOne(BASE).flush({}, { status: 500, statusText: 'Server Error' });
      await failing;
      expect(store.posts().map((p) => p.id)).toEqual(['p1']);
    });

    it('does not read again before the first load has arrived', async () => {
      TestBed.resetTestingModule();
      http = provideApiTesting();
      const fresh = TestBed.inject(MasterPostsStore);
      await fresh.refresh();
      http.expectNone(BASE);
    });

    it('empties itself and loads the other workspace when the workspace changes', async () => {
      const ws = TestBed.inject(WorkspaceStore);
      ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
      ws.switchTo('ws-2');
      await settle();
      expect(store.posts()).toEqual([]);
      expect(store.loaded()).toBe(false);
      http.expectOne('/api/workspaces/ws-2/master-posts').flush([apiCollectionPost({ id: 'z' })]);
      await settle();
      expect(store.posts().map((p) => p.id)).toEqual(['z']);
      expect(store.loaded()).toBe(true);
      for (const r of http.match((r) => r.url.startsWith('/api/workspaces/ws-2/'))) r.flush([]);
    });

    it('drops an answer that arrives after the workspace was left', async () => {
      const ws = TestBed.inject(WorkspaceStore);
      ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
      ws.switchTo('ws-2');
      await settle();
      const slow = http.expectOne('/api/workspaces/ws-2/master-posts');
      ws.switchTo(WS);
      await settle();
      slow.flush([apiCollectionPost({ id: 'late' })]);
      await settle();
      expect(store.posts().map((p) => p.id)).not.toContain('late');
      for (const r of http.match((r) => /\/api\/workspaces\/ws-[12]\//.test(r.url))) r.flush([]);
    });

    it('asks again when the server is busy, and gives up on a refusal', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const ws = TestBed.inject(WorkspaceStore);
      ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
      ws.switchTo('ws-2');
      await vi.advanceTimersByTimeAsync(0);
      await settle();
      http
        .expectOne('/api/workspaces/ws-2/master-posts')
        .flush({}, { status: 503, statusText: 'Busy' });
      await settle();
      expect(store.loaded()).toBe(false);
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);
      http
        .expectOne('/api/workspaces/ws-2/master-posts')
        .flush({}, { status: 403, statusText: 'Forbidden' });
      await settle();
      expect(store.loaded()).toBe(false);
      http.expectNone('/api/workspaces/ws-2/master-posts');
      for (const r of http.match((r) => r.url.startsWith('/api/workspaces/ws-2/'))) r.flush([]);
    });
  });

  describe('creating and editing', () => {
    it('creates a post that waits in the library when no collection is given', async () => {
      const done = store.create({
        text: 'new',
        mediaIds: [],
        collectionIds: null,
        settings: null,
        active: null,
      });
      const req = http.expectOne({ method: 'POST', url: BASE });
      expect(req.request.body).toEqual({
        text: 'new',
        mediaIds: [],
        collectionIds: null,
        settings: null,
        active: null,
      });
      req.flush(apiCollectionPost({ id: 'n1', text: 'new' }));
      expect((await done).id).toBe('n1');
      expect(store.posts().map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'n1']);
    });

    it('rejects a post the API refuses and leaves the list alone', async () => {
      const done = store.create({
        text: '',
        mediaIds: null,
        collectionIds: null,
        settings: null,
        active: true,
      });
      http.expectOne({ method: 'POST', url: BASE }).flush({}, { status: 400, statusText: 'Bad' });
      await expect(done).rejects.toBeDefined();
      expect(store.posts().length).toBe(3);
    });

    it('saves a post in its place and sends its collections and settings', async () => {
      const settings = { ...p1.settings, hashtags: '#own', maxPerDay: 3 };
      const done = store.update('p1', {
        text: 'one edited',
        mediaIds: ['m1'],
        collectionIds: ['a', 'b'],
        settings,
      });
      const req = http.expectOne({ method: 'PUT', url: `${BASE}/p1` });
      expect(req.request.body).toEqual({
        text: 'one edited',
        mediaIds: ['m1'],
        collectionIds: ['a', 'b'],
        settings,
      });
      req.flush({ ...p1, text: 'one edited', collectionIds: ['a', 'b'], settings });
      await done;
      expect(store.posts().map((p) => p.text)).toEqual(['one edited', 'two', 'three']);
      expect(store.byId('p1')?.settings.hashtags).toBe('#own');
    });

    it('rejects an edit the API refuses and keeps the old post', async () => {
      const done = store.update('p1', {
        text: 'x',
        mediaIds: null,
        collectionIds: null,
        settings: null,
      });
      http
        .expectOne({ method: 'PUT', url: `${BASE}/p1` })
        .flush({}, { status: 422, statusText: 'No' });
      await expect(done).rejects.toBeDefined();
      expect(store.byId('p1')?.text).toBe('one');
    });
  });

  describe('switching on and off', () => {
    it('shows the switch at once and takes the answer of the server', async () => {
      const done = store.setActive('p1', false);
      expect(store.byId('p1')?.active).toBe(false);
      const req = http.expectOne({ method: 'PUT', url: `${BASE}/p1/active` });
      expect(req.request.body).toEqual({ active: false });
      req.flush({ ...p1, active: false, queuedCount: 0 });
      expect(await done).toBe(true);
      expect(store.byId('p1')).toMatchObject({ active: false, queuedCount: 0 });
    });

    it('switches it back when the API refuses', async () => {
      const done = store.setActive('p3', true);
      expect(store.byId('p3')?.active).toBe(true);
      http
        .expectOne({ method: 'PUT', url: `${BASE}/p3/active` })
        .flush({}, { status: 403, statusText: 'Forbidden' });
      expect(await done).toBe(false);
      expect(store.byId('p3')?.active).toBe(false);
    });
  });

  describe('deleting', () => {
    it('takes the post off the page at once and keeps it off when the API agrees', async () => {
      const done = store.remove('p2');
      expect(store.posts().map((p) => p.id)).toEqual(['p1', 'p3']);
      http.expectOne({ method: 'DELETE', url: `${BASE}/p2` }).flush(null);
      expect(await done).toBe(true);
      expect(store.posts().map((p) => p.id)).toEqual(['p1', 'p3']);
    });

    it('puts the post back where it was when the API refuses', async () => {
      const done = store.remove('p2');
      http
        .expectOne({ method: 'DELETE', url: `${BASE}/p2` })
        .flush({}, { status: 403, statusText: 'Forbidden' });
      expect(await done).toBe(false);
      expect(store.posts().map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    });
  });

  describe('approval', () => {
    it.each([
      ['request', 'pending'],
      ['approve', 'approved'],
      ['reject', 'draft'],
    ] as const)('%s shows %s at once and takes the answer', async (action, next) => {
      const done = store.approval('p3', action);
      expect(store.byId('p3')?.approval).toBe(next);
      const req = http.expectOne({ method: 'POST', url: `${BASE}/p3/approval` });
      expect(req.request.body).toEqual({ action });
      req.flush({ ...p3, approval: next, updatedAt: '2026-10-02T00:00:00Z' });
      expect(await done).toBe(true);
      expect(store.byId('p3')).toMatchObject({ approval: next, updatedAt: '2026-10-02T00:00:00Z' });
    });

    it('goes back to the old state when the API refuses', async () => {
      const done = store.approval('p3', 'approve');
      http
        .expectOne({ method: 'POST', url: `${BASE}/p3/approval` })
        .flush({}, { status: 403, statusText: 'Forbidden' });
      expect(await done).toBe(false);
      expect(store.byId('p3')?.approval).toBe('draft');
    });
  });

  describe('bulk changes', () => {
    it('sends the action and the collection, answers how many posts changed, then reads again', async () => {
      const done = store.bulk(['p1', 'p3'], 'add_to_collection', 'b');
      const req = http.expectOne({ method: 'POST', url: `${BASE}/bulk` });
      expect(req.request.body).toEqual({
        postIds: ['p1', 'p3'],
        action: 'add_to_collection',
        collectionId: 'b',
      });
      req.flush({ changed: 2 });
      await settle();
      http
        .expectOne({ method: 'GET', url: BASE })
        .flush([{ ...p1, collectionIds: ['a', 'b'] }, p2, { ...p3, collectionIds: ['b'] }]);
      expect(await done).toBe(2);
      expect(store.byId('p3')?.collectionIds).toEqual(['b']);
    });

    it('sends no collection for the actions that need none', async () => {
      const done = store.bulk(['p1'], 'deactivate');
      const req = http.expectOne({ method: 'POST', url: `${BASE}/bulk` });
      expect(req.request.body).toEqual({
        postIds: ['p1'],
        action: 'deactivate',
        collectionId: null,
      });
      req.flush({ changed: 1 });
      await settle();
      http.expectOne({ method: 'GET', url: BASE }).flush([p1, p2, p3]);
      expect(await done).toBe(1);
    });

    it('sends at most 500 posts per request and adds up the answers', async () => {
      const ids = Array.from({ length: 1201 }, (_, i) => 'x' + i);
      const done = store.bulk(ids, 'activate');
      const sizes: number[] = [];
      for (const changed of [500, 500, 1]) {
        await settle();
        const req = http.expectOne({ method: 'POST', url: `${BASE}/bulk` });
        sizes.push(req.request.body.postIds.length);
        req.flush({ changed });
      }
      await settle();
      http.expectOne({ method: 'GET', url: BASE }).flush([p1, p2, p3]);
      expect(await done).toBe(1001);
      expect(sizes).toEqual([500, 500, 201]);
    });

    it('rejects when the API refuses, and still reads the library again (part of it may be done)', async () => {
      const done = store.bulk(['p1'], 'delete');
      const assertion = expect(done).rejects.toBeDefined();
      http
        .expectOne({ method: 'POST', url: `${BASE}/bulk` })
        .flush({}, { status: 403, statusText: 'Forbidden' });
      await settle();
      http.expectOne({ method: 'GET', url: BASE }).flush([p1, p2, p3]);
      await assertion;
    });

    it('sends nothing for no posts', async () => {
      await expect(store.bulk([], 'activate')).resolves.toBe(0);
      http.expectNone(`${BASE}/bulk`);
    });
  });

  describe('results of a post', () => {
    it('asks for the latest 50 by default and returns the rows', async () => {
      const done = store.activity('p1');
      const req = http.expectOne((r) => r.url === `${BASE}/p1/activity`);
      expect(req.request.params.get('take')).toBe('50');
      const rows = [
        {
          id: 'r1',
          target: 'กลุ่มคอนโด',
          targetUrl: 'https://www.facebook.com/groups/condo',
          status: 'success',
          scheduledAt: '2026-10-04T09:00:00Z',
          publishedAt: '2026-10-04T09:01:00Z',
          failureDetail: null,
          scheduleId: null,
        },
      ];
      req.flush(rows);
      expect(await done).toEqual(rows);
    });

    it('asks for as many as it is told and rejects when the API refuses', async () => {
      const done = store.activity('p1', 10);
      const req = http.expectOne((r) => r.url === `${BASE}/p1/activity`);
      expect(req.request.params.get('take')).toBe('10');
      req.flush({}, { status: 404, statusText: 'Not found' });
      await expect(done).rejects.toBeDefined();
    });
  });

  describe('agreeing with the collections', () => {
    let collections: CollectionsStore;

    beforeEach(async () => {
      // The collections page is open too: its list has loaded, so it is one the library keeps current.
      collections = TestBed.inject(CollectionsStore);
      await settle();
      http
        .expectOne({ method: 'GET', url: COLS })
        .flush([
          apiCollection({ id: 'a', posts: [p1, p2] }),
          apiCollection({ id: 'b', posts: [p2] }),
        ]);
      await settle();
    });

    it('asks the collections to read again after an edit, so both lists agree', async () => {
      const done = store.update('p2', {
        text: 'two edited',
        mediaIds: null,
        collectionIds: ['a'],
        settings: null,
      });
      http
        .expectOne({ method: 'PUT', url: `${BASE}/p2` })
        .flush({ ...p2, text: 'two edited', collectionIds: ['a'] });
      await done;
      await settle();
      http.expectOne({ method: 'GET', url: COLS }).flush([
        apiCollection({
          id: 'a',
          posts: [p1, { ...p2, text: 'two edited', collectionIds: ['a'] }],
        }),
        apiCollection({ id: 'b', posts: [] }),
      ]);
      await settle();
      expect(collections.byId('a')?.posts[1].text).toBe('two edited');
      expect(collections.byId('b')?.posts).toEqual([]);
    });

    it.each([
      [
        'switching a post off',
        () => store.setActive('p1', false),
        { method: 'PUT', suffix: '/p1/active' },
        { ...p1, active: false },
      ],
      ['deleting a post', () => store.remove('p1'), { method: 'DELETE', suffix: '/p1' }, null],
      [
        'an approval',
        () => store.approval('p1', 'request'),
        { method: 'POST', suffix: '/p1/approval' },
        { ...p1, approval: 'pending' },
      ],
    ] as const)('%s reads the collections again', async (_name, run, call, answer) => {
      const done = run();
      http.expectOne({ method: call.method, url: BASE + call.suffix }).flush(answer);
      await done;
      await settle();
      http.expectOne({ method: 'GET', url: COLS }).flush([]);
    });

    it('a bulk change reads both lists again', async () => {
      const done = store.bulk(['p1'], 'remove_from_collection', 'a');
      http.expectOne({ method: 'POST', url: `${BASE}/bulk` }).flush({ changed: 1 });
      await settle();
      http.expectOne({ method: 'GET', url: BASE }).flush([p1, p2, p3]);
      await done;
      await settle();
      http.expectOne({ method: 'GET', url: COLS }).flush([]);
    });

    it('does not read the collections when they are not in use', async () => {
      TestBed.resetTestingModule();
      http = provideApiTesting();
      const alone = TestBed.inject(MasterPostsStore);
      await signIn(http, { masterPosts: [p1] });
      const done = alone.setActive('p1', false);
      http.expectOne({ method: 'PUT', url: `${BASE}/p1/active` }).flush({ ...p1, active: false });
      await done;
      await settle();
      http.expectNone(COLS);
    });

    it('a collection that takes a post in or out reads the library again', async () => {
      const done = collections.removePost('b', 'p2');
      http.expectOne({ method: 'DELETE', url: `${COLS}/b/posts/p2` }).flush(null);
      await done;
      await settle();
      http.expectOne({ method: 'GET', url: BASE }).flush([p1, { ...p2, collectionIds: ['a'] }, p3]);
      await settle();
      expect(store.byId('p2')?.collectionIds).toEqual(['a']);
    });
  });
});

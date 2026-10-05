import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  WS,
  WORKSPACE,
  answerWorkspaceLoads,
  provideApiTesting,
  settle,
  signIn,
} from '../../testing/api-testing';
import { apiCollection, apiCollectionPost } from '../../testing/collection-fixtures';
import { CollectionsStore, isUsable } from './collections.store';
import { MasterPostsStore } from './master-posts.store';
import { WorkspaceStore } from './workspace.store';

const BASE = `/api/workspaces/${WS}/collections`;
const MASTER = `/api/workspaces/${WS}/master-posts`;

const posts = {
  a1: apiCollectionPost({ id: 'a1', collectionIds: ['a'], text: 'one', postedCount: 2 }),
  a2: apiCollectionPost({ id: 'a2', collectionIds: ['a'], text: 'two', mediaIds: ['m1'] }),
  b1: apiCollectionPost({ id: 'b1', collectionIds: ['b'], text: 'three', approval: 'draft' }),
  b2: apiCollectionPost({ id: 'b2', collectionIds: ['b'], text: 'four', approval: 'pending' }),
};

describe('CollectionsStore', () => {
  let http: HttpTestingController;
  let store: CollectionsStore;

  beforeEach(async () => {
    http = provideApiTesting();
    store = TestBed.inject(CollectionsStore);
    await signIn(http, {
      collections: [
        apiCollection({ id: 'a', name: 'Condo', posts: [posts.a1, posts.a2], scheduleCount: 1 }),
        apiCollection({
          id: 'b',
          name: 'Tickets',
          description: 'movies',
          posts: [posts.b1, posts.b2],
          settings: { requireApproval: true, footer: 'LINE @shop' },
        }),
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  /** Puts a1 into collection b as well, the way the server lists a post that sits in two collections. */
  function shareA1() {
    const shared = { ...posts.a1, collectionIds: ['a', 'b'] };
    store.collections.update((l) =>
      l.map((c) =>
        c.id === 'b'
          ? { ...c, posts: [...c.posts, shared] }
          : { ...c, posts: c.posts.map((p) => (p.id === 'a1' ? shared : p)) },
      ),
    );
    return shared;
  }

  describe('reading', () => {
    it('loads the collections of the workspace and opens the first one, as the design does', () => {
      expect(store.loaded()).toBe(true);
      expect(store.collections().map((c) => c.id)).toEqual(['a', 'b']);
      expect(store.openId()).toBe('a');
    });

    it('finds a collection and a post with the collection it is in', () => {
      expect(store.byId('b')?.name).toBe('Tickets');
      expect(store.byId('nope')).toBeUndefined();
      expect(store.postById('b2')).toEqual({ collection: store.byId('b'), post: posts.b2 });
      expect(store.postById(null)).toBeUndefined();
    });

    it('counts a post as usable unless the collection needs approval and it is not approved', () => {
      const [a, b] = store.collections();
      expect(isUsable(a, posts.a1)).toBe(true);
      expect(isUsable(b, posts.b1)).toBe(false);
      expect(isUsable(b, posts.b2)).toBe(false);
      expect(isUsable(b, { ...posts.b2, approval: 'approved' })).toBe(true);
      expect(store.usablePosts(a).map((p) => p.id)).toEqual(['a1', 'a2']);
      expect(store.usablePosts(b)).toEqual([]);
    });

    it('reads again in the background without losing what the person is editing', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      store.updateSettings('a', { footer: 'typed so far' });
      const done = store.refresh();
      const req = http.expectOne(BASE);
      req.flush([
        apiCollection({ id: 'a', name: 'Condo', scheduleCount: 3, posts: [posts.a1] }),
        apiCollection({ id: 'b', name: 'Tickets', posts: [] }),
      ]);
      await done;
      expect(store.byId('a')?.settings.footer).toBe('typed so far');
      expect(store.byId('a')?.scheduleCount).toBe(3);
      expect(store.byId('a')?.posts.length).toBe(1);
      vi.advanceTimersByTime(800);
      http.expectOne({ method: 'PUT', url: `${BASE}/a` }).flush(apiCollection({ id: 'a' }));
      await settle();
    });

    it('empties itself and loads the other workspace when the workspace changes', async () => {
      const ws = TestBed.inject(WorkspaceStore);
      ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
      ws.switchTo('ws-2');
      await settle();
      expect(store.collections()).toEqual([]);
      expect(store.loaded()).toBe(false);
      expect(store.openId()).toBeNull();
      const req = http.expectOne('/api/workspaces/ws-2/collections');
      req.flush([apiCollection({ id: 'z' })]);
      await settle();
      expect(store.collections().map((c) => c.id)).toEqual(['z']);
      expect(store.loaded()).toBe(true);
      for (const r of http.match((r) => r.url.startsWith('/api/workspaces/ws-2/'))) r.flush([]);
    });

    it('drops an answer that arrives after the workspace was left', async () => {
      const ws = TestBed.inject(WorkspaceStore);
      ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
      ws.switchTo('ws-2');
      await settle();
      const slow = http.expectOne('/api/workspaces/ws-2/collections');
      ws.switchTo(WS);
      await settle();
      slow.flush([apiCollection({ id: 'late' })]);
      await settle();
      expect(store.collections().some((c) => c.id === 'late')).toBe(false);
      answerWorkspaceLoads(http, { collections: [apiCollection({ id: 'back' })] });
      for (const r of http.match((r) => r.url.startsWith('/api/workspaces/ws-2/'))) r.flush([]);
      await settle();
      expect(store.collections().map((c) => c.id)).toEqual(['back']);
    });
  });

  describe('collections', () => {
    it('creates a collection, opens it and answers it', async () => {
      const done = store.create('  Shoes ', ' for sale ');
      const req = http.expectOne({ method: 'POST', url: BASE });
      expect(req.request.body).toEqual({ name: 'Shoes', description: 'for sale' });
      req.flush(apiCollection({ id: 'c', name: 'Shoes', description: 'for sale' }));
      const made = await done;
      expect(made.id).toBe('c');
      expect(store.collections().map((c) => c.id)).toEqual(['a', 'b', 'c']);
      expect(store.openId()).toBe('c');
    });

    it('rejects when the API refuses and adds nothing', async () => {
      const done = store.create('Shoes');
      http
        .expectOne({ method: 'POST', url: BASE })
        .flush({ title: 'ครบ 100 ชุด' }, { status: 422, statusText: 'Unprocessable' });
      await expect(done).rejects.toBeDefined();
      expect(store.collections().length).toBe(2);
    });
  });

  describe('settings', () => {
    beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));

    it('shows an edit at once and saves one complete PUT 800 ms after the last change', async () => {
      store.updateSettings('b', { hashtags: '#a' });
      store.updateSettings('b', { hashtags: '#ab', watermark: true });
      store.rename('b', 'Cinema');
      expect(store.byId('b')).toMatchObject({
        name: 'Cinema',
        settings: { hashtags: '#ab', watermark: true, footer: 'LINE @shop', requireApproval: true },
      });
      vi.advanceTimersByTime(799);
      http.expectNone({ method: 'PUT', url: `${BASE}/b` });
      vi.advanceTimersByTime(1);
      const req = http.expectOne({ method: 'PUT', url: `${BASE}/b` });
      // The body carries every field, not only what changed.
      expect(req.request.body).toEqual({
        name: 'Cinema',
        description: 'movies',
        icon: 'ph-folder',
        settings: {
          hashtags: '#ab',
          pageTags: '',
          footer: 'LINE @shop',
          footerPos: 'end',
          shuffle: true,
          watermark: true,
          watermarkPos: 'br',
          requireApproval: true,
        },
      });
      req.flush(
        apiCollection({
          id: 'b',
          name: 'Cinema',
          description: 'movies',
          scheduleCount: 2,
          settings: {
            hashtags: '#ab',
            watermark: true,
            requireApproval: true,
            footer: 'LINE @shop',
          },
        }),
      );
      await settle();
      expect(store.byId('b')?.scheduleCount).toBe(2);
      expect(store.byId('b')?.posts.length).toBe(2); // the answer carries no posts: the shown ones stay
    });

    it('goes back to what the server last had when it refuses, and says nothing is left to save', async () => {
      store.updateSettings('a', { requireApproval: true, footer: 'new footer' });
      expect(store.byId('a')?.settings.requireApproval).toBe(true);
      vi.advanceTimersByTime(800);
      http
        .expectOne({ method: 'PUT', url: `${BASE}/a` })
        .flush({ title: 'ข้อความยาวเกินไป' }, { status: 400, statusText: 'Bad Request' });
      await settle();
      expect(store.byId('a')?.settings).toMatchObject({ requireApproval: false, footer: '' });
      vi.advanceTimersByTime(5000);
      http.expectNone({ method: 'PUT', url: `${BASE}/a` });
    });

    it('takes back only the approval switch when the server refuses it for the role, and saves the other edits', async () => {
      store.updateSettings('a', { requireApproval: true, footer: 'kept footer' });
      store.rename('a', 'Renamed');
      vi.advanceTimersByTime(800);
      http
        .expectOne({ method: 'PUT', url: `${BASE}/a` })
        .flush({ title: 'ไม่มีสิทธิ์' }, { status: 403, statusText: 'Forbidden' });
      await settle();
      // The refused switch is off again at once; the other edits stay on screen and are sent again.
      expect(store.byId('a')).toMatchObject({
        name: 'Renamed',
        settings: { requireApproval: false, footer: 'kept footer' },
      });
      const retry = http.expectOne({ method: 'PUT', url: `${BASE}/a` });
      expect(retry.request.body).toMatchObject({
        name: 'Renamed',
        settings: { requireApproval: false, footer: 'kept footer' },
      });
      retry.flush(apiCollection({ id: 'a', name: 'Renamed', settings: { footer: 'kept footer' } }));
      await settle();
      expect(store.byId('a')).toMatchObject({
        name: 'Renamed',
        settings: { requireApproval: false, footer: 'kept footer' },
      });
      vi.advanceTimersByTime(5000);
      http.expectNone({ method: 'PUT', url: `${BASE}/a` });
    });

    it('goes back to the last confirmed values when even the retry without the switch is refused', async () => {
      store.updateSettings('a', { requireApproval: true, footer: 'x' });
      vi.advanceTimersByTime(800);
      http
        .expectOne({ method: 'PUT', url: `${BASE}/a` })
        .flush({ title: 'ไม่มีสิทธิ์' }, { status: 403, statusText: 'Forbidden' });
      await settle();
      http
        .expectOne({ method: 'PUT', url: `${BASE}/a` })
        .flush({ title: 'ไม่มีสิทธิ์' }, { status: 403, statusText: 'Forbidden' });
      await settle();
      expect(store.byId('a')?.settings).toMatchObject({ requireApproval: false, footer: '' });
      vi.advanceTimersByTime(5000);
      http.expectNone({ method: 'PUT', url: `${BASE}/a` });
    });

    it('keeps a space or line break typed at the end of a text the server only trimmed', async () => {
      store.updateSettings('a', { hashtags: '#a #b ', pageTags: 'tag ', footer: 'LINE @shop\n' });
      store.rename('a', 'Condo ', 'about ');
      vi.advanceTimersByTime(800);
      const req = http.expectOne({ method: 'PUT', url: `${BASE}/a` });
      req.flush(
        apiCollection({
          id: 'a',
          name: 'Condo',
          description: 'about',
          settings: { hashtags: '#a #b', pageTags: 'tag', footer: 'LINE @shop' },
        }),
      );
      await settle();
      expect(store.byId('a')).toMatchObject({
        name: 'Condo ',
        description: 'about ',
        settings: { hashtags: '#a #b ', pageTags: 'tag ', footer: 'LINE @shop\n' },
      });
    });

    it('shows another text the server stored instead of what was typed', async () => {
      store.updateSettings('a', { footer: 'typed' });
      vi.advanceTimersByTime(800);
      http
        .expectOne({ method: 'PUT', url: `${BASE}/a` })
        .flush(apiCollection({ id: 'a', settings: { footer: 'typed (server)' } }));
      await settle();
      expect(store.byId('a')?.settings.footer).toBe('typed (server)');
    });

    it('sends what was typed while a save was on its way, with a body of its own', async () => {
      store.updateSettings('a', { hashtags: '#1' });
      vi.advanceTimersByTime(800);
      const first = http.expectOne({ method: 'PUT', url: `${BASE}/a` });
      store.updateSettings('a', { footer: 'typed meanwhile' });
      vi.advanceTimersByTime(800);
      // One request at a time: the second goes when the first is answered.
      http.expectNone({ method: 'PUT', url: `${BASE}/a` });
      first.flush(apiCollection({ id: 'a', settings: { hashtags: '#1' } }));
      await settle();
      const second = http.expectOne({ method: 'PUT', url: `${BASE}/a` });
      expect(second.request.body.settings).toMatchObject({
        hashtags: '#1',
        footer: 'typed meanwhile',
      });
      second.flush(
        apiCollection({ id: 'a', settings: { hashtags: '#1', footer: 'typed meanwhile' } }),
      );
      await settle();
      expect(store.byId('a')?.settings.footer).toBe('typed meanwhile');
    });

    it('keeps the edits made after a refused save, which the next request carries', async () => {
      store.updateSettings('a', { hashtags: '#1' });
      vi.advanceTimersByTime(800);
      const first = http.expectOne({ method: 'PUT', url: `${BASE}/a` });
      store.updateSettings('a', { footer: 'kept' });
      first.flush({ title: 'x' }, { status: 500, statusText: 'Server Error' });
      await settle();
      expect(store.byId('a')?.settings).toMatchObject({ hashtags: '#1', footer: 'kept' });
      vi.advanceTimersByTime(800);
      http.expectOne({ method: 'PUT', url: `${BASE}/a` }).flush(apiCollection({ id: 'a' }));
      await settle();
    });

    it('sends the waiting edits at once on flush()', async () => {
      store.updateSettings('a', { hashtags: '#now' });
      const done = store.flush();
      http.expectOne({ method: 'PUT', url: `${BASE}/a` }).flush(apiCollection({ id: 'a' }));
      await done;
    });

    it('sends the edits of a workspace that was left, to that workspace', async () => {
      store.updateSettings('a', { hashtags: '#left' });
      const ws = TestBed.inject(WorkspaceStore);
      ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
      ws.switchTo('ws-2');
      await settle();
      const req = http.expectOne({ method: 'PUT', url: `${BASE}/a` });
      expect(req.request.body.settings.hashtags).toBe('#left');
      req.flush(apiCollection({ id: 'a' }));
      await settle();
      expect(store.collections()).toEqual([]);
      for (const r of http.match((r) => r.url.startsWith('/api/workspaces/ws-2/'))) r.flush([]);
    });
  });

  describe('posts', () => {
    it('adds a post to its collection', async () => {
      const done = store.addPost('a', 'new text', ['m1', 'm2']);
      const req = http.expectOne({ method: 'POST', url: `${BASE}/a/posts` });
      expect(req.request.body).toEqual({ text: 'new text', mediaIds: ['m1', 'm2'] });
      req.flush(apiCollectionPost({ id: 'a3', text: 'new text' }));
      expect((await done).id).toBe('a3');
      expect(store.byId('a')?.posts.map((p) => p.id)).toEqual(['a1', 'a2', 'a3']);
    });

    it('adds a batch in one request', async () => {
      const done = store.addPosts('b', [{ text: 'x' }, { text: 'y', mediaIds: ['m1'] }]);
      const req = http.expectOne({ method: 'POST', url: `${BASE}/b/posts/batch` });
      expect(req.request.body).toEqual({
        items: [
          { text: 'x', mediaIds: [] },
          { text: 'y', mediaIds: ['m1'] },
        ],
      });
      req.flush([
        apiCollectionPost({ id: 'n1', text: 'x', approval: 'draft' }),
        apiCollectionPost({ id: 'n2', text: 'y', approval: 'draft' }),
      ]);
      expect((await done).length).toBe(2);
      expect(store.byId('b')?.posts.map((p) => p.id)).toEqual(['b1', 'b2', 'n1', 'n2']);
    });

    it('rejects a post the API refuses and leaves the list alone', async () => {
      const done = store.addPost('a', 'x');
      http
        .expectOne({ method: 'POST', url: `${BASE}/a/posts` })
        .flush({}, { status: 400, statusText: 'Bad' });
      await expect(done).rejects.toBeDefined();
      expect(store.byId('a')?.posts.length).toBe(2);
    });

    it('updates a post in its place', async () => {
      const done = store.updatePost('a', posts.a2, { text: 'two edited', mediaIds: [] });
      const req = http.expectOne({ method: 'PUT', url: `${BASE}/a/posts/a2` });
      expect(req.request.body).toEqual({ text: 'two edited', mediaIds: [], collectionId: null });
      req.flush({ ...posts.a2, text: 'two edited', mediaIds: [] });
      await done;
      expect(store.byId('a')?.posts.map((p) => p.text)).toEqual(['one', 'two edited']);
    });

    it('moves a post to another collection', async () => {
      const done = store.updatePost('a', posts.a1, {
        text: 'one',
        mediaIds: [],
        toCollectionId: 'b',
      });
      const req = http.expectOne({ method: 'PUT', url: `${BASE}/a/posts/a1` });
      expect(req.request.body.collectionId).toBe('b');
      req.flush({ ...posts.a1, collectionIds: ['b'], approval: 'draft' });
      await done;
      expect(store.byId('a')?.posts.map((p) => p.id)).toEqual(['a2']);
      expect(store.byId('b')?.posts.map((p) => p.id)).toEqual(['b1', 'b2', 'a1']);
      expect(store.postById('a1')?.collection.id).toBe('b');
    });

    it('does not move a post that is saved into the collection it is already in', async () => {
      const done = store.updatePost('a', posts.a1, {
        text: 'one',
        mediaIds: [],
        toCollectionId: 'a',
      });
      const req = http.expectOne({ method: 'PUT', url: `${BASE}/a/posts/a1` });
      expect(req.request.body.collectionId).toBeNull();
      req.flush(posts.a1);
      await done;
      expect(store.byId('a')?.posts.map((p) => p.id)).toEqual(['a1', 'a2']);
    });

    it('shows the saved post in every collection that holds it', async () => {
      const shared = shareA1();
      const done = store.updatePost('b', shared, { text: 'edited once', mediaIds: [] });
      http
        .expectOne({ method: 'PUT', url: `${BASE}/b/posts/a1` })
        .flush({ ...shared, text: 'edited once' });
      await done;
      expect(store.byId('a')?.posts[0].text).toBe('edited once');
      expect(store.byId('b')?.posts[2].text).toBe('edited once');
    });

    it('prefers the collection it is asked about when a post sits in several', () => {
      shareA1();
      expect(store.postById('a1')?.collection.id).toBe('a');
      expect(store.postById('a1', 'b')?.collection.id).toBe('b');
      expect(store.postById('a1', 'zzz')?.collection.id).toBe('a');
    });

    it('puts library posts into a collection with one request', async () => {
      const done = store.addExistingPosts('b', ['a1']);
      const req = http.expectOne({ method: 'POST', url: `${BASE}/b/posts/add` });
      expect(req.request.body).toEqual({ postIds: ['a1'] });
      const moved = { ...posts.a1, collectionIds: ['a', 'b'] };
      req.flush(apiCollection({ id: 'b', posts: [posts.b1, posts.b2, moved] }));
      await done;
      expect(store.byId('b')?.posts.map((p) => p.id)).toEqual(['b1', 'b2', 'a1']);
      // The other collection's copy learns it sits in two collections now.
      expect(store.byId('a')?.posts[0].collectionIds).toEqual(['a', 'b']);
      // The settings of the collection (and anything being edited) are not replaced by the answer.
      expect(store.byId('b')?.settings.requireApproval).toBe(true);
    });

    it('rejects when the API refuses to add library posts', async () => {
      const done = store.addExistingPosts('b', ['zzz']);
      http
        .expectOne({ method: 'POST', url: `${BASE}/b/posts/add` })
        .flush({}, { status: 404, statusText: 'Not found' });
      await expect(done).rejects.toBeDefined();
      expect(store.byId('b')?.posts.length).toBe(2);
    });

    it('asks the post library to read again after a change (when it is in use)', async () => {
      const master = TestBed.inject(MasterPostsStore);
      await settle();
      http.expectOne(MASTER).flush([]);
      await settle();
      const done = store.addPost('a', 'fresh');
      http
        .expectOne({ method: 'POST', url: `${BASE}/a/posts` })
        .flush(apiCollectionPost({ id: 'a3', collectionIds: ['a'], text: 'fresh' }));
      await done;
      const again = http.expectOne(MASTER);
      expect(again.request.method).toBe('GET');
      again.flush([apiCollectionPost({ id: 'a3', collectionIds: ['a'], text: 'fresh' })]);
      await settle();
      expect(master.posts().map((p) => p.id)).toEqual(['a3']);
    });
  });

  describe('taking a post out and approval', () => {
    it('takes a post out of the collection at once and keeps it out when the API agrees', async () => {
      const done = store.removePost('a', 'a1');
      expect(store.byId('a')?.posts.map((p) => p.id)).toEqual(['a2']);
      http.expectOne({ method: 'DELETE', url: `${BASE}/a/posts/a1` }).flush(null);
      expect(await done).toBe(true);
      expect(store.byId('a')?.posts.map((p) => p.id)).toEqual(['a2']);
    });

    it('leaves the post in the collections it also sits in', async () => {
      shareA1();
      const done = store.removePost('a', 'a1');
      http.expectOne({ method: 'DELETE', url: `${BASE}/a/posts/a1` }).flush(null);
      await done;
      expect(store.byId('a')?.posts.map((p) => p.id)).toEqual(['a2']);
      expect(store.byId('b')?.posts.map((p) => p.id)).toEqual(['b1', 'b2', 'a1']);
    });

    it('puts the post back where it was when the API refuses', async () => {
      const done = store.removePost('a', 'a1');
      expect(store.byId('a')?.posts.length).toBe(1);
      http
        .expectOne({ method: 'DELETE', url: `${BASE}/a/posts/a1` })
        .flush({}, { status: 403, statusText: 'Forbidden' });
      expect(await done).toBe(false);
      expect(store.byId('a')?.posts.map((p) => p.id)).toEqual(['a1', 'a2']);
    });

    it.each([
      ['request', posts.b1, 'pending'],
      ['approve', posts.b2, 'approved'],
      ['reject', posts.b2, 'draft'],
    ] as const)('%s: shows %s at once and takes the server answer', async (action, post, next) => {
      const done = store.setApproval('b', post, action);
      expect(store.postById(post.id)?.post.approval).toBe(next);
      const req = http.expectOne({
        method: 'POST',
        url: `${BASE}/b/posts/${post.id}/approval`,
      });
      expect(req.request.body).toEqual({ action });
      req.flush({ ...post, approval: next, updatedAt: '2026-10-02T00:00:00Z' });
      expect(await done).toBe(true);
      expect(store.postById(post.id)?.post).toMatchObject({
        approval: next,
        updatedAt: '2026-10-02T00:00:00Z',
      });
    });

    it('approval belongs to the post: every collection that holds it shows the new state', async () => {
      const shared = { ...posts.b2, collectionIds: ['a', 'b'] };
      store.collections.update((l) =>
        l.map((c) => (c.id === 'a' ? { ...c, posts: [...c.posts, shared] } : c)),
      );
      const done = store.setApproval('b', posts.b2, 'approve');
      expect(store.byId('a')?.posts[2].approval).toBe('approved');
      http
        .expectOne({ method: 'POST', url: `${BASE}/b/posts/b2/approval` })
        .flush({ ...shared, approval: 'approved' });
      await done;
      expect(store.byId('a')?.posts[2].approval).toBe('approved');
      expect(store.byId('b')?.posts[1].approval).toBe('approved');
    });

    it('goes back to the old state when the approval is refused', async () => {
      const done = store.setApproval('b', posts.b2, 'approve');
      http
        .expectOne({ method: 'POST', url: `${BASE}/b/posts/b2/approval` })
        .flush({}, { status: 403, statusText: 'Forbidden' });
      expect(await done).toBe(false);
      expect(store.postById('b2')?.post.approval).toBe('pending');
    });

    it('a deleted collection leaves its posts in the library: the library is read again', async () => {
      const master = TestBed.inject(MasterPostsStore);
      await settle();
      http.expectOne(MASTER).flush([]);
      await settle();
      const done = store.remove('a');
      http.expectOne({ method: 'DELETE', url: `${BASE}/a` }).flush(null);
      await done;
      http.expectOne(MASTER).flush([]);
      await settle();
      expect(store.byId('a')).toBeUndefined();
    });
  });

  describe('export', () => {
    it('saves a CSV with a row per post: collection, text, media, status', async () => {
      const blobs: Blob[] = [];
      const [create, revoke] = [URL.createObjectURL, URL.revokeObjectURL];
      URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
        blobs.push(b as Blob);
        return 'blob:x';
      });
      URL.revokeObjectURL = vi.fn();
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);
      try {
        expect(store.exportCsv()).toBe(true);
        expect(click).toHaveBeenCalled();
        const text = await blobs[0].text();
        const lines = text.replace('\ufeff', '').trim().split(/\r?\n/);
        expect(lines[0]).toBe('collection,text,media,status');
        expect(lines.length).toBe(5);
        expect(lines[2]).toContain('Condo');
        expect(lines[2]).toContain(',1,approved');
        expect(lines[4]).toContain('Tickets');
        expect(lines[4]).toContain('pending');
      } finally {
        URL.createObjectURL = create;
        URL.revokeObjectURL = revoke;
        vi.restoreAllMocks();
      }
    });
  });
});

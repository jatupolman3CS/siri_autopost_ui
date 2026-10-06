import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  WS,
  apiPost,
  answerWorkspaceLoads,
  provideApiTesting,
  settle,
  signIn,
} from '../../testing/api-testing';
import { PostsStore } from './posts.store';

describe('PostsStore', () => {
  let http: HttpTestingController;
  let store: PostsStore;
  // Noon, so "an hour from now" is still today whatever time the suite runs at.
  const now = new Date(2026, 9, 3, 12, 0);
  const at = (min: number) => new Date(now.getTime() + min * 60000).toISOString();

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    http = provideApiTesting();
    store = TestBed.inject(PostsStore);
    await signIn(http, {
      posts: [
        apiPost({ id: 'p1', scheduledAt: at(-60), status: 'success' }),
        apiPost({ id: 'p2', scheduledAt: at(60), content: 'later' }),
      ],
      errors: [
        apiPost({ id: 'e1', scheduledAt: at(-30), status: 'failed', failureCode: 'rate_limit' }),
        apiPost({
          id: 'e2',
          scheduledAt: at(-90),
          status: 'pending',
          failureCode: 'pending_approval',
        }),
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  it('loads the months around today and the open errors of the workspace', () => {
    expect(store.posts().map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(store.posts()[1].text).toBe('later');
    expect(store.next()?.id).toBe('p2');
  });

  it('keeps "awaiting approval" out of the open errors', () => {
    expect(store.errors().length).toBe(2);
    expect(store.openErrors().map((e) => e.id)).toEqual(['e1']);
  });

  it('retries through the API and reloads', async () => {
    const done = store.retryError('e1');
    http.expectOne({ method: 'POST', url: `/api/workspaces/${WS}/posts/e1/retry` }).flush({});
    await settle();
    answerWorkspaceLoads(http, { errors: [] });
    await done;
    expect(store.errors().length).toBe(0);
  });

  it('posts now through the API, then reads the posts again: the post is where "now" is, marked as moved to the front', async () => {
    expect(store.items().find((p) => p.id === 'p2')?.rushed).toBe(false);
    const done = store.runNow('p2');
    http.expectOne({ method: 'POST', url: `/api/workspaces/${WS}/posts/p2/run-now` }).flush({});
    await settle();
    answerWorkspaceLoads(http, {
      posts: [
        apiPost({ id: 'p1', scheduledAt: at(-60), status: 'success' }),
        apiPost({ id: 'p2', scheduledAt: at(0), content: 'later', rushed: true }),
      ],
      errors: [],
    });
    await done;
    const moved = store.items().find((p) => p.id === 'p2')!;
    expect(moved.rushed).toBe(true);
    expect(moved.dt.getTime()).toBe(now.getTime());
  });

  it('rejects when the server refuses "post now" (a post that went out), and keeps what is shown', async () => {
    const done = store.runNow('p1');
    const failed = done.then(
      () => 'resolved',
      () => 'rejected',
    );
    http
      .expectOne({ method: 'POST', url: `/api/workspaces/${WS}/posts/p1/run-now` })
      .flush({ title: 'no' }, { status: 422, statusText: 'Unprocessable' });
    await settle();
    expect(await failed).toBe('rejected');
    expect(store.posts().map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('retries many posts in rounds of 500, adds up the answers and reloads once', async () => {
    const ids = Array.from({ length: 1100 }, (_, i) => `e${i}`);
    const done = store.retryErrors(ids);
    const answers = [
      { retried: 500, unbound: 0, notFailed: 0 },
      { retried: 400, unbound: 90, notFailed: 10 },
      { retried: 0, unbound: 100, notFailed: 0 },
    ];
    for (const [i, size] of [500, 500, 100].entries()) {
      await settle();
      const req = http.expectOne({ method: 'POST', url: `/api/workspaces/${WS}/posts/retry` });
      expect((req.request.body as { postIds: string[] }).postIds).toEqual(
        ids.slice(i * 500, i * 500 + size),
      );
      req.flush(answers[i]);
    }
    await settle();
    answerWorkspaceLoads(http, { errors: [] });
    expect(await done).toEqual({ retried: 900, unbound: 190, notFailed: 10 });
    expect(store.errors().length).toBe(0);
  });

  it('reloads what was done even when a round of retries fails, then rejects', async () => {
    const ids = Array.from({ length: 600 }, (_, i) => `e${i}`);
    const done = store.retryErrors(ids);
    const failed = done.then(
      () => 'resolved',
      () => 'rejected',
    );
    await settle();
    http
      .expectOne({ method: 'POST', url: `/api/workspaces/${WS}/posts/retry` })
      .flush({ retried: 500, unbound: 0, notFailed: 0 });
    await settle();
    http
      .expectOne({ method: 'POST', url: `/api/workspaces/${WS}/posts/retry` })
      .flush({ title: 'down' }, { status: 500, statusText: 'Server Error' });
    await settle();
    answerWorkspaceLoads(http, { errors: [] });
    expect(await failed).toBe('rejected');
    expect(store.errors().length).toBe(0);
  });

  it('loads another month only once', async () => {
    void store.ensureMonth(now.getFullYear(), now.getMonth() + 5);
    void store.ensureMonth(now.getFullYear(), now.getMonth() + 5);
    expect(http.match((r) => r.url === `/api/workspaces/${WS}/posts`).length).toBe(1);
  });
});

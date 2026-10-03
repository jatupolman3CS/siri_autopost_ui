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
  const now = new Date();
  const at = (min: number) => new Date(now.getTime() + min * 60000).toISOString();

  beforeEach(async () => {
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

  afterEach(() => http.verify());

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

  it('loads another month only once', async () => {
    void store.ensureMonth(now.getFullYear(), now.getMonth() + 5);
    void store.ensureMonth(now.getFullYear(), now.getMonth() + 5);
    expect(http.match((r) => r.url === `/api/workspaces/${WS}/posts`).length).toBe(1);
  });
});

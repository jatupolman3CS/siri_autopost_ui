import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Post } from '../models/post.model';
import { PostsStore } from './posts.store';

const post = (id: string, status: Post['status']): Post => ({
  id,
  content: 'hello',
  groupUrl: 'https://www.facebook.com/groups/1/',
  status,
  scheduledAt: null,
  publishedAt: null,
  failureReason: null,
  createdAt: '2026-10-03T09:00:00Z',
  updatedAt: '2026-10-03T09:00:00Z',
});

describe('PostsStore', () => {
  let store: PostsStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PostsStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(PostsStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads posts and counts them by status', async () => {
    const done = store.load();
    expect(store.loading()).toBe(true);
    http
      .expectOne('/api/posts')
      .flush([post('a', 'Draft'), post('b', 'Scheduled'), post('c', 'Draft')]);
    await done;

    expect(store.loading()).toBe(false);
    expect(store.posts().length).toBe(3);
    expect(store.countByStatus()).toEqual({ Draft: 2, Scheduled: 1, Published: 0, Failed: 0 });
  });

  it('keeps field errors from a 400 response', async () => {
    const done = store.create({ content: '', groupUrl: '', scheduledAt: null });
    http
      .expectOne({ method: 'POST', url: '/api/posts' })
      .flush(
        { title: 'ข้อมูลไม่ถูกต้อง', errors: { content: ['กรุณาใส่ข้อความโพสต์'] } },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(await done).toBe(false);
    expect(store.fieldErrors()['content']).toEqual(['กรุณาใส่ข้อความโพสต์']);
    expect(store.posts()).toEqual([]);
  });

  it('removes a deleted post', async () => {
    const loaded = store.load();
    http.expectOne('/api/posts').flush([post('a', 'Draft'), post('b', 'Draft')]);
    await loaded;

    const done = store.remove('a');
    http
      .expectOne({ method: 'DELETE', url: '/api/posts/a' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await done;

    expect(store.posts().map((p) => p.id)).toEqual(['b']);
  });
});

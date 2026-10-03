import { TestBed } from '@angular/core/testing';
import { PostsStore } from './posts.store';

describe('PostsStore', () => {
  let store: PostsStore;

  beforeEach(() => (store = TestBed.inject(PostsStore)));

  it('generates a full day for today with one post going out now', () => {
    const today = store
      .posts()
      .filter((p) => store.items().find((i) => i.id === p.id)?.key === store.todayKey);
    expect(today.length).toBe(17);
    expect(today.filter((p) => p.status === 'posting').length).toBe(1);
  });

  it('keeps "awaiting approval" out of the open errors', () => {
    expect(store.errors().length).toBe(6);
    expect(store.openErrors().length).toBe(5);
    expect(store.openErrors().some((e) => e.code === 'pending_approval')).toBe(false);
  });

  it('puts a retried error back in the queue 15 minutes from now', () => {
    const before = store.posts().length;
    store.retryError('f1');
    expect(store.errors().find((e) => e.id === 'f1')).toBeUndefined();
    const retried = store.posts().find((p) => p.id === 'rf1');
    expect(store.posts().length).toBe(before + 1);
    expect(retried?.status).toBe('queued');
    expect(retried!.dt.getTime() - store.now.getTime()).toBe(15 * 60000);
  });
});

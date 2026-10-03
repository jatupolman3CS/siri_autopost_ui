import { TestBed } from '@angular/core/testing';
import { ExtensionStore } from './extension.store';
import { PostsStore } from './posts.store';
import { SettingsStore } from './settings.store';

describe('ExtensionStore', () => {
  let ext: ExtensionStore;
  let posts: PostsStore;

  beforeEach(() => {
    ext = TestBed.inject(ExtensionStore);
    posts = TestBed.inject(PostsStore);
  });

  it('holds at most the next 4 posts of today while offline', () => {
    const due = posts.today().filter((p) => p.status === 'queued' && p.dt > posts.now).length;
    ext.toggleOnline();
    expect(ext.online()).toBe(false);
    expect(posts.waiting().length).toBe(Math.min(4, due));
  });

  it('sends waiting posts on reconnect, or skips them with the skip policy', () => {
    ext.toggleOnline();
    const waiting = posts.waiting().map((p) => p.id);
    TestBed.inject(SettingsStore).patchOff({ policy: 'skip' });
    ext.toggleOnline();
    expect(ext.online()).toBe(true);
    expect(posts.waiting().length).toBe(0);
    for (const id of waiting)
      expect(posts.posts().find((p) => p.id === id)?.status).toBe('skipped');
  });
});

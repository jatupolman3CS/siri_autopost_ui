import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { POSTS_PATH, composerRedirect, editPostParams, newPostParams } from './posts-link';

describe('posts-link', () => {
  it('addresses the post library', () => {
    expect(POSTS_PATH).toBe('/app/posts');
  });

  describe('newPostParams', () => {
    it('opens the editor on a new post, in a collection when one is named', () => {
      expect(newPostParams('c1')).toEqual({ new: 1, collection: 'c1' });
    });

    it('is just "a new post" without a collection (the draft in progress continues)', () => {
      expect(newPostParams()).toEqual({ new: 1 });
      expect(newPostParams(null)).toEqual({ new: 1 });
      expect(newPostParams('')).toEqual({ new: 1 });
    });
  });

  it('editPostParams opens a post of the library', () => {
    expect(editPostParams('p9')).toEqual({ post: 'p9' });
  });

  describe('composerRedirect (the old /app/composer address)', () => {
    const go = (queryParams: Record<string, unknown>) =>
      TestBed.runInInjectionContext(() => composerRedirect({ queryParams } as never)) as UrlTree;

    beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

    it('answers an address of the post library, built by the router', () => {
      const tree = go({});
      expect(tree).toBeInstanceOf(UrlTree);
      expect(TestBed.inject(Router).serializeUrl(tree)).toBe('/app/posts?new=1');
    });

    it('maps ?post= to the post to edit, whatever collection it names', () => {
      expect(go({ post: 'p1' }).toString()).toBe('/app/posts?post=p1');
      expect(go({ collection: 'c1', post: 'p1' }).toString()).toBe('/app/posts?post=p1');
    });

    it('maps ?collection= to a new post in that collection', () => {
      expect(go({ collection: 'c1' }).toString()).toBe('/app/posts?new=1&collection=c1');
    });

    it('treats a missing or empty post as a new one', () => {
      expect(go({ post: '' }).toString()).toBe('/app/posts?new=1');
      expect(go({}).toString()).toBe('/app/posts?new=1');
    });

    it('drops the parameters it does not know', () => {
      expect(go({ foo: 'bar' }).toString()).toBe('/app/posts?new=1');
    });
  });
});

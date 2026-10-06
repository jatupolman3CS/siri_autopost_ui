import { inject } from '@angular/core';
import { Params, RedirectFunction, Router } from '@angular/router';

/** The post library page, which holds the post editor (a panel above the list). */
export const POSTS_PATH = '/app/posts';

/**
 * The query parameters that open the editor panel on an empty post: `new=1`, and `collection=` to start the post
 * in that collection (without one, the draft of the post in progress is continued as it is).
 */
export function newPostParams(collectionId?: string | null): Params {
  return collectionId ? { new: 1, collection: collectionId } : { new: 1 };
}

/** The query parameters that open the editor panel on a post of the library. */
export function editPostParams(postId: string): Params {
  return { post: postId };
}

/**
 * `/app/composer` used to be the page that wrote a post. It is the post library's editor now, but old bookmarks
 * and links still work: `?post=` opens that post, `?collection=` starts a new post in that collection, nothing
 * continues the post in progress.
 */
export const composerRedirect: RedirectFunction = (route) => {
  const query = route.queryParams;
  const post = query['post'];
  const collection = query['collection'];
  const params = post
    ? editPostParams(String(post))
    : newPostParams(collection ? String(collection) : null);
  return inject(Router).createUrlTree([POSTS_PATH], { queryParams: params });
};

import { Params } from '@angular/router';
import { Draft } from '../../core/data/draft.store';

/** The composer's route. */
export const COMPOSER_PATH = '/app/composer';

/**
 * The query parameters that address a draft: the collection, and the post when an existing one is being edited
 * (a new post carries only its collection; neither gives a plain address that continues the draft).
 */
export function composerParams(draft: Pick<Draft, 'collectionId' | 'postId'>): Params {
  const params: Params = {};
  if (draft.collectionId) params['collection'] = draft.collectionId;
  if (draft.postId) params['post'] = draft.postId;
  return params;
}

import { Injectable, computed, inject, signal } from '@angular/core';
import { hasCodeTag } from '../flow';
import { ApiCollection, ApiCollectionPost } from '../http/api.service';
import { INPUT_LIMITS } from '../http/input-limits';
import { CollectionsStore } from './collections.store';
import { whenWorkspaceChanges } from './workspace.store';

/** The collection post being written or edited in the composer. */
export interface Draft {
  text: string;
  /** Library media ids. */
  media: string[];
  /** The collection the post is saved to ('' until one is chosen). */
  collectionId: string;
  /** The collection post being edited; null for a new post. */
  postId: string | null;
  errText: string;
  errCol: string;
}

export function blankDraft(collectionId = ''): Draft {
  return { text: '', media: [], collectionId, postId: null, errText: '', errCol: '' };
}

/** What `DraftStore.open` found for the post a link asked for. */
export type OpenResult = 'kept' | 'started' | 'loaded' | 'missing';

// The composer's draft: one collection post, new or being edited. It lives in memory only, so it survives a
// trip to the library and back (the library's "use" fills it, its draft bar leads back) but not a reload, and
// it is dropped when the workspace changes: its media and collection mean nothing in another one.
@Injectable({ providedIn: 'root' })
export class DraftStore {
  private readonly collections = inject(CollectionsStore);

  readonly draft = signal<Draft>(blankDraft());
  /** The composer's "more tools" row was opened (true) or closed (false) by hand; null follows simple mode. */
  readonly toolsOverride = signal<boolean | null>(null);

  /** There is something written: the library says "post in progress" then. */
  readonly hasDraft = computed(() => {
    const d = this.draft();
    return !!(d.text.trim() || d.media.length);
  });

  constructor() {
    whenWorkspaceChanges(() => this.draft.set(blankDraft()));
  }

  patch(patch: Partial<Draft>): void {
    this.draft.update((d) => ({ ...d, ...patch }));
  }

  /** Throws the draft away; `patch` starts the next one with some values. */
  reset(patch: Partial<Draft> = {}): void {
    this.draft.set({ ...blankDraft(), ...patch });
  }

  /** The collection a new post goes to unless the person picks one: the last one saved to, else the open one. */
  defaultCollectionId(): string {
    const known = (id: string | null) => (id && this.collections.byId(id) ? id : '');
    return known(this.collections.lastId()) || known(this.collections.openId());
  }

  /** A blank post for a collection (the default one without an argument). */
  startNew(collectionId?: string | null): void {
    this.draft.set(blankDraft(collectionId ?? this.defaultCollectionId()));
  }

  /** Loads a saved post into the draft to edit it. */
  edit(collection: Pick<ApiCollection, 'id'>, post: ApiCollectionPost): void {
    this.draft.set({
      ...blankDraft(collection.id),
      text: post.text,
      media: [...post.mediaIds],
      postId: post.id,
    });
  }

  /**
   * Sets the draft up for what the address of the composer asks for (`?collection=&post=`), keeping what is
   * written when it already is that post, so a trip to the library and back does not throw it away:
   *  - a post: the draft already editing it is kept; otherwise it is loaded ('missing' when it is gone, and a
   *    blank post in the asked collection, or the default one, starts instead);
   *  - only a collection: the text stays (a draft of another post starts blank), the collection is set;
   *  - neither: the draft stays, and a draft without a collection gets the default one.
   * Call it once the collections have loaded.
   */
  open(collectionId: string | null | undefined, postId: string | null | undefined): OpenResult {
    const d = this.draft();
    if (postId) {
      if (d.postId === postId) return 'kept';
      const found = this.collections.postById(postId);
      if (found) {
        this.edit(found.collection, found.post);
        return 'loaded';
      }
      this.startNew(collectionId);
      return 'missing';
    }
    if (collectionId) {
      if (d.postId === null && d.collectionId === collectionId) return 'kept';
      if (d.postId === null) this.patch({ collectionId, errCol: '' });
      else this.startNew(collectionId);
      return 'started';
    }
    if (!d.collectionId && d.postId === null) {
      const fallback = this.defaultCollectionId();
      if (fallback) this.patch({ collectionId: fallback });
    }
    return 'kept';
  }

  /** Adds text after what is there, cut at the most the API takes. */
  appendText(text: string): void {
    this.draft.update((d) => ({
      ...d,
      text: ((d.text ? d.text + '\n' : '') + text).slice(0, INPUT_LIMITS.postText),
      errText: '',
    }));
  }

  /** Puts `{{code}}` on the first line; false (and nothing changes) when the text already has it. */
  insertCode(): boolean {
    if (hasCodeTag(this.draft().text)) return false;
    this.draft.update((d) => ({
      ...d,
      text: ('{{code}}\n' + d.text).slice(0, INPUT_LIMITS.postText),
      errText: '',
    }));
    return true;
  }

  /** Puts a sample spintax group in front of the text, for the person to rewrite. */
  insertSpin(sample: string): void {
    this.draft.update((d) => ({
      ...d,
      text: (sample + d.text).slice(0, INPUT_LIMITS.postText),
      errText: '',
    }));
  }

  /** Attaches a library file; false when the post already has the most the API takes. */
  addMedia(id: string): boolean {
    if (this.draft().media.includes(id)) return true;
    if (this.draft().media.length >= INPUT_LIMITS.postMedia) return false;
    this.draft.update((d) => ({ ...d, media: [...d.media, id] }));
    return true;
  }

  /** Takes library files that were deleted off the draft. */
  dropMedia(ids: readonly string[]): void {
    const gone = new Set(ids);
    if (!this.draft().media.some((m) => gone.has(m))) return;
    this.draft.update((d) => ({ ...d, media: d.media.filter((m) => !gone.has(m)) }));
  }

  /** Attaches the file, or takes it off when it is attached; false when it could not be attached (the limit). */
  toggleMedia(id: string): boolean {
    if (this.draft().media.includes(id)) {
      this.draft.update((d) => ({ ...d, media: d.media.filter((m) => m !== id) }));
      return true;
    }
    return this.addMedia(id);
  }
}

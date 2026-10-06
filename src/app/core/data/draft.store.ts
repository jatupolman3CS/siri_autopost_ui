import { Injectable, computed, signal } from '@angular/core';
import { INPUT_LIMITS } from '../http/input-limits';
import { whenWorkspaceChanges } from './workspace.store';

/** The NEW post being written in the post editor (a post that already exists is edited on its own, not here). */
export interface Draft {
  text: string;
  /** Library media ids. */
  media: string[];
  /** The collections the post will sit in (none = it waits in the library). */
  collectionIds: string[];
}

export function blankDraft(collectionIds: readonly string[] = []): Draft {
  return { text: '', media: [], collectionIds: [...collectionIds] };
}

/** What `DraftStore.open` did for the address of the editor (`?new=1&collection=`). */
export type OpenResult = 'kept' | 'started';

// The draft of a NEW post: what the post editor holds while a post is being written. It lives in memory only, so
// it survives a trip to the media library and back (the library's "use" buttons fill it, its draft bar leads
// back to `/app/posts?new=1`) but not a reload, and it is dropped when the workspace changes: its media and
// collections mean nothing in another one. A post that already exists is edited with the editor's own state, so
// leaving it throws the changes away.
@Injectable({ providedIn: 'root' })
export class DraftStore {
  readonly draft = signal<Draft>(blankDraft());

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

  /** A blank post that will sit in these collections. */
  startNew(collectionIds: readonly string[] = []): void {
    this.draft.set(blankDraft(collectionIds));
  }

  /**
   * Sets the draft up for the address of the editor (`?new=1&collection=`) and keeps what is written, so a trip
   * to the media library and back does not throw it away: a collection in the address becomes THE collection of
   * the draft (the person asked for a post in it), and without one the draft stays as it is.
   */
  open(collectionId: string | null | undefined): OpenResult {
    if (!collectionId) return 'kept';
    const ids = this.draft().collectionIds;
    if (ids.length === 1 && ids[0] === collectionId) return 'kept';
    this.patch({ collectionIds: [collectionId] });
    return 'started';
  }

  /** Adds text after what is there, cut at the most the API takes. */
  appendText(text: string): void {
    this.draft.update((d) => ({
      ...d,
      text: ((d.text ? d.text + '\n' : '') + text).slice(0, INPUT_LIMITS.postText),
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

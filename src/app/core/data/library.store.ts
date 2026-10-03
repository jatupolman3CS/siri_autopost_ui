import { Injectable, signal } from '@angular/core';
import { MediaItem, Snippet } from './models';
import { SEED } from './seed.data';

// Reusable media and text snippets of the workspace.
@Injectable({ providedIn: 'root' })
export class LibraryStore {
  readonly media = signal<MediaItem[]>(SEED.media.map((m) => ({ ...m })));
  readonly snippets = signal<Snippet[]>(SEED.snippets.map((s) => ({ ...s })));

  addSnippet(title: string, text: string): void {
    this.snippets.update((list) => [
      { id: 's' + Date.now(), title: [title, title], text: [text, text], used: 0 },
      ...list,
    ]);
  }

  /** Upload placeholder: real file uploads arrive with the media API. */
  addSampleMedia(label: readonly [string, string]): void {
    this.media.update((list) => [
      { id: 'm' + Date.now(), label, meta: '1080×1080 · 900 KB', kind: 'image', used: 0 },
      ...list,
    ]);
  }
}

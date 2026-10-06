import { Injectable, computed, inject } from '@angular/core';
import { LinkSetsStore } from './link-sets.store';

/** What the post editor's preview needs of one link of a set. */
export interface PreviewLink {
  name: string;
  url: string;
  code: string;
  enabled: boolean;
  valid: boolean;
}

/** What the post editor's preview needs of a link set. */
export interface PreviewSet {
  id: string;
  name: string;
  links: readonly PreviewLink[];
}

// The link sets as the post editor's preview reads them: the sets and their links (name, address, code, whether
// they are on and valid), nothing else, read from the link sets store (the link sets page edits the same data).
@Injectable({ providedIn: 'root' })
export class PreviewSetsService {
  private readonly store = inject(LinkSetsStore);

  readonly sets = computed<PreviewSet[]>(() =>
    this.store.sets().map((s) => ({
      id: s.id,
      name: s.name,
      links: s.links.map((l) => ({
        name: l.name,
        url: l.url,
        code: l.code,
        enabled: l.enabled,
        valid: l.valid,
      })),
    })),
  );
  readonly loaded = this.store.loaded;

  /** Reads the sets again in the background (they are edited on another page); never rejects. */
  refresh(): Promise<void> {
    return this.store.refresh();
  }
}

import { Injectable } from '@angular/core';

// A post is one record that sits in the post library (`MasterPostsStore`) and, through its collections, in the
// lists of `CollectionsStore`. Each store registers its quiet re-read here, and a store that changed something
// the other one shows asks for it through this service. Nothing is created that is not there already: a store
// that has not been used yet (so has nothing on screen) is simply not asked, which keeps the pages that need
// only one of them from loading the other.
@Injectable({ providedIn: 'root' })
export class PostsSync {
  private master: (() => Promise<void>) | null = null;
  private collections: (() => Promise<void>) | null = null;

  registerMaster(refresh: () => Promise<void>): void {
    this.master = refresh;
  }

  registerCollections(refresh: () => Promise<void>): void {
    this.collections = refresh;
  }

  /** The post library changed (a post edited, moved between collections, switched off or deleted). */
  afterMasterChange(): Promise<void> {
    return this.collections?.() ?? Promise.resolve();
  }

  /** A collection changed what it holds (a post added, taken out, edited there, or the collection deleted). */
  afterCollectionChange(): Promise<void> {
    return this.master?.() ?? Promise.resolve();
  }

  /** Media was deleted: the server took it off the posts that used it, in both lists. */
  afterMediaDeleted(): Promise<void> {
    return Promise.all([this.collections?.(), this.master?.()]).then(() => undefined);
  }
}

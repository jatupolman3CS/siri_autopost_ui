import { Injectable, computed, inject, signal } from '@angular/core';
import {
  ApiApprovalAction,
  ApiBulkPostAction,
  ApiCollectionPost,
  ApiCreateMasterPost,
  ApiPostActivity,
  ApiService,
  ApiUpdateMasterPost,
} from '../http/api.service';
import { loadWithRetry } from './loading';
import { PostsSync } from './posts-sync';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

/** The server takes at most this many posts in one bulk request. */
export const BULK_MAX = 500;

/** What the server turns an approval request into, so the page can show it before the answer comes. */
function approvalAfter(action: ApiApprovalAction): ApiCollectionPost['approval'] {
  return action === 'request' ? 'pending' : action === 'approve' ? 'approved' : 'draft';
}

// The workspace's post library ("คลังโพสต์"): every post, oldest first, whatever collections it sits in, from
// /master-posts. A post manages itself here (text, media, its own message and schedule settings, on/off,
// approval, results); collections only include it. Switching on/off, approval and delete are optimistic (the
// page shows them at once, a refusal puts the post back and the call answers false); create, edit and bulk
// changes wait for the server and reject when it refuses (the page keeps its form open). Every change that
// reaches a collection's list asks `CollectionsStore` to read again through `PostsSync`, so both lists agree.
@Injectable({ providedIn: 'root' })
export class MasterPostsStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);
  private readonly sync = inject(PostsSync);

  readonly posts = signal<ApiCollectionPost[]>([]);
  /** The workspace's posts have arrived (the page shows "—" until then). */
  readonly loaded = signal(false);

  /** How many posts are on, off and waiting for approval (for the page's filters). */
  readonly counts = computed(() => {
    const list = this.posts();
    return {
      all: list.length,
      on: list.filter((p) => p.active).length,
      off: list.filter((p) => !p.active).length,
      pending: list.filter((p) => p.approval === 'pending').length,
      loose: list.filter((p) => !p.collectionIds.length).length,
    };
  });

  constructor() {
    this.sync.registerMaster(() => this.refresh());
    whenWorkspaceChanges((wsId) => {
      this.posts.set([]);
      this.loaded.set(false);
      if (wsId) void this.load(wsId);
    });
  }

  // ---------- reading ----------

  /** Loads the posts (transient failures are retried); an answer for a workspace left meanwhile is dropped. */
  async load(wsId: string): Promise<void> {
    const ok = await loadWithRetry(
      async () => {
        const list = await this.api.masterPosts(wsId);
        if (this.ws.id() === wsId) this.posts.set(list);
      },
      () => this.ws.id() === wsId,
    );
    if (ok && this.ws.id() === wsId) this.loaded.set(true);
  }

  /** Reads the posts again in the background (counts move when schedules run); never rejects. */
  async refresh(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId || !this.loaded()) return;
    try {
      const list = await this.api.masterPosts(wsId, true);
      if (this.ws.id() === wsId) this.posts.set(list);
    } catch {
      // What is shown stays; the next visit asks again.
    }
  }

  byId(id: string | null | undefined): ApiCollectionPost | undefined {
    return id ? this.posts().find((p) => p.id === id) : undefined;
  }

  // ---------- one post ----------

  /** Creates a post. Without `collectionIds` it waits in the library. Rejects when the API refuses. */
  async create(body: ApiCreateMasterPost): Promise<ApiCollectionPost> {
    const wsId = this.requireWs();
    const created = await this.api.createMasterPost(wsId, body);
    if (this.ws.id() === wsId) {
      this.posts.update((l) => [...l, created]);
      void this.sync.afterMasterChange();
    }
    return created;
  }

  /** Saves a post (a null `collectionIds` or `settings` keeps what it has). Rejects when the API refuses. */
  async update(id: string, body: ApiUpdateMasterPost): Promise<ApiCollectionPost> {
    const wsId = this.requireWs();
    const saved = await this.api.updateMasterPost(wsId, id, body);
    if (this.ws.id() === wsId) {
      this.patch(id, () => saved);
      void this.sync.afterMasterChange();
    }
    return saved;
  }

  /**
   * Switches a post on or off. The switch shows at once; the answer replaces the post and a refusal switches it
   * back. Off: the server removes the post's queued future posts and never draws it; on: it refills the schedules.
   * Answers whether the server took it.
   */
  async setActive(id: string, active: boolean): Promise<boolean> {
    const wsId = this.requireWs();
    const before = this.byId(id)?.active;
    this.patch(id, (p) => ({ ...p, active }));
    try {
      const saved = await this.api.setMasterPostActive(wsId, id, active);
      if (this.ws.id() === wsId) {
        this.patch(id, () => saved);
        void this.sync.afterMasterChange();
      }
      return true;
    } catch {
      if (this.ws.id() === wsId && before !== undefined)
        this.patch(id, (p) => ({ ...p, active: before }));
      return false;
    }
  }

  /**
   * Deletes a post for good: it leaves the page at once and every collection, and its queued future posts go. It
   * comes back when the API refuses. Answers whether it was deleted.
   */
  async remove(id: string): Promise<boolean> {
    const wsId = this.requireWs();
    const index = this.posts().findIndex((p) => p.id === id);
    const removed = index >= 0 ? this.posts()[index] : null;
    this.posts.update((l) => l.filter((p) => p.id !== id));
    try {
      await this.api.deleteMasterPost(wsId, id);
      if (this.ws.id() === wsId) void this.sync.afterMasterChange();
      return true;
    } catch {
      if (removed && this.ws.id() === wsId) {
        this.posts.update((l) => {
          if (l.some((p) => p.id === removed.id)) return l;
          const next = [...l];
          next.splice(Math.min(index, next.length), 0, removed);
          return next;
        });
      }
      return false;
    }
  }

  /**
   * Asks for approval, approves or sends a post back. The new state shows at once; the answer replaces it and a
   * refusal puts the old state back. Answers whether the server took it.
   */
  async approval(id: string, action: ApiApprovalAction): Promise<boolean> {
    const wsId = this.requireWs();
    const before = this.byId(id)?.approval;
    this.patch(id, (p) => ({ ...p, approval: approvalAfter(action) }));
    try {
      const saved = await this.api.masterPostApproval(wsId, id, action);
      if (this.ws.id() === wsId) {
        this.patch(id, () => saved);
        void this.sync.afterMasterChange();
      }
      return true;
    } catch {
      if (this.ws.id() === wsId && before !== undefined)
        this.patch(id, (p) => ({ ...p, approval: before }));
      return false;
    }
  }

  /** The results of one post: a row per group it was sent to, newest first. Rejects when the API refuses. */
  activity(id: string, take = 50): Promise<ApiPostActivity[]> {
    return this.api.masterPostActivity(this.requireWs(), id, take);
  }

  // ---------- many posts ----------

  /**
   * Changes many posts at once (at most 500 per request, so more are sent in turns). `collectionId` is the
   * collection of an add / remove. Waits for the server, then reads the library and the collections again, and
   * answers how many posts it changed. Rejects when the API refuses (what was done before it stays done).
   */
  async bulk(
    ids: readonly string[],
    action: ApiBulkPostAction,
    collectionId?: string,
  ): Promise<number> {
    const wsId = this.requireWs();
    let changed = 0;
    try {
      for (let i = 0; i < ids.length; i += BULK_MAX) {
        const result = await this.api.bulkMasterPosts(
          wsId,
          ids.slice(i, i + BULK_MAX),
          action,
          collectionId,
        );
        changed += result.changed;
      }
    } finally {
      if (this.ws.id() === wsId && ids.length) {
        await this.refresh();
        void this.sync.afterMasterChange();
      }
    }
    return changed;
  }

  private patch(id: string, fn: (p: ApiCollectionPost) => ApiCollectionPost): void {
    this.posts.update((l) => l.map((p) => (p.id === id ? fn(p) : p)));
  }

  private requireWs(): string {
    const id = this.ws.id();
    if (!id) throw new Error('No workspace selected');
    return id;
  }
}

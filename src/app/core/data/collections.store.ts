import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { EXPORT_FILES, downloadCsv, postsToCsv } from '../flow';
import {
  ApiApprovalAction,
  ApiCollection,
  ApiCollectionPost,
  ApiCollectionSettings,
  ApiService,
} from '../http/api.service';
import { loadWithRetry } from './loading';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

/** Edits of a collection's name, description, icon and settings wait this long after the last change. */
const SAVE_DELAY_MS = 800;

/** The part of a collection that `PUT collections/{id}` replaces (the body must be complete). */
interface Meta {
  name: string;
  description: string;
  icon: string;
  settings: ApiCollectionSettings;
}

/** What a page may change in one go; unset fields keep their value, `settings` is merged field by field. */
export interface CollectionEdit {
  name?: string;
  description?: string;
  icon?: string;
  settings?: Partial<ApiCollectionSettings>;
}

/** What a collection edit needs to remember until it has been saved. */
interface PendingSave {
  /** The workspace the edit was made in (the store may move on to another before it is sent). */
  ws: string;
  /** The latest values, the complete body of the next request. */
  meta: Meta;
  /** The last values the server confirmed: what a failed save goes back to. */
  confirmed: Meta;
  timer: ReturnType<typeof setTimeout> | null;
  /** A request is on its way. */
  inflight: boolean;
  /** Edited again after the request that is on its way was made. */
  dirty: boolean;
}

const metaOf = (c: ApiCollection | Meta): Meta => ({
  name: c.name,
  description: c.description,
  icon: c.icon,
  settings: { ...c.settings },
});

/**
 * What a collection shows after its save: the server's values, except text it only trimmed (the person may be
 * in the middle of a word and the space typed before the next one must stay).
 */
function shownAfterSave(sent: Meta, saved: Meta): Meta {
  const keep = (typed: string, got: string) => (typed.trim() === got ? typed : got);
  return {
    ...saved,
    name: keep(sent.name, saved.name),
    description: keep(sent.description, saved.description),
    settings: {
      ...saved.settings,
      hashtags: keep(sent.settings.hashtags, saved.settings.hashtags),
      pageTags: keep(sent.settings.pageTags, saved.settings.pageTags),
      footer: keep(sent.settings.footer, saved.settings.footer),
    },
  };
}

const sameMeta = (a: Meta, b: Meta): boolean =>
  a.name === b.name &&
  a.description === b.description &&
  a.icon === b.icon &&
  (Object.keys({ ...a.settings, ...b.settings }) as (keyof ApiCollectionSettings)[]).every(
    (k) => a.settings[k] === b.settings[k],
  );

/** A post is used by schedules when the collection does not ask for approval, or when it was approved. */
export function isUsable(collection: Pick<ApiCollection, 'settings'>, post: ApiCollectionPost) {
  return !collection.settings.requireApproval || post.approval === 'approved';
}

/** What the server turns an approval request into, so the page can show it before the answer comes. */
function approvalAfter(action: ApiApprovalAction): ApiCollectionPost['approval'] {
  return action === 'request' ? 'pending' : action === 'approve' ? 'approved' : 'draft';
}

// The workspace's post collections ("ชุดโพสต์") with their posts, from /collections. Settings edits are
// optimistic: the page shows them at once, they are sent in one complete PUT 800 ms after the last change,
// and a refusal puts the collection back to what the server last confirmed (the API's reason is toasted by
// the error interceptor); a 403 for the approval rule, which needs the admin role, takes back only that
// switch and sends the other edits again. Text the server only trimmed stays as it was typed. Posts are added and edited by the pages that wait for the server (the composer
// goes on only when the post is saved); deleting a post and the approval buttons are optimistic too.
// None of the optimistic methods rejects: they answer whether the server took the change.
@Injectable({ providedIn: 'root' })
export class CollectionsStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);

  readonly collections = signal<ApiCollection[]>([]);
  /** The workspace's collections have arrived (pages show "—" until then). */
  readonly loaded = signal(false);
  /** The collection whose posts are open on the collections page (also where the composer saves to next). */
  readonly openId = signal<string | null>(null);
  /** The collection a post was last saved to: where the next new post goes by default. */
  readonly lastId = signal<string | null>(null);

  private readonly pending = new Map<string, PendingSave>();

  constructor() {
    whenWorkspaceChanges((wsId) => {
      // Edits still waiting go out for the workspace they were made in (each carries its own workspace id).
      for (const id of [...this.pending.keys()]) void this.flushOne(id);
      this.collections.set([]);
      this.loaded.set(false);
      this.openId.set(null);
      this.lastId.set(null);
      if (wsId) void this.load(wsId);
    });
  }

  // ---------- reading ----------

  /** Loads the collections (transient failures are retried); an answer for a workspace left meanwhile is dropped. */
  async load(wsId: string): Promise<void> {
    const ok = await loadWithRetry(
      async () => {
        const list = await this.api.collections(wsId);
        if (this.ws.id() !== wsId) return;
        this.collections.set(this.withPending(list));
        // As in the design, the first collection starts open.
        if (!this.openId() && list.length) this.openId.set(list[0].id);
      },
      () => this.ws.id() === wsId,
    );
    if (ok && this.ws.id() === wsId) this.loaded.set(true);
  }

  /** Reads the collections again in the background (counts of schedules and posts move elsewhere); never rejects. */
  async refresh(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId || !this.loaded()) return;
    try {
      const list = await this.api.collections(wsId, true);
      if (this.ws.id() === wsId) this.collections.set(this.withPending(list));
    } catch {
      // What is shown stays; the next visit asks again.
    }
  }

  byId(id: string | null | undefined): ApiCollection | undefined {
    return id ? this.collections().find((c) => c.id === id) : undefined;
  }

  /** A post and the collection it is in. */
  postById(
    id: string | null | undefined,
  ): { collection: ApiCollection; post: ApiCollectionPost } | undefined {
    if (!id) return undefined;
    for (const collection of this.collections()) {
      const post = collection.posts.find((p) => p.id === id);
      if (post) return { collection, post };
    }
    return undefined;
  }

  /** The posts a schedule may use (all of them, or the approved ones when the collection needs approval). */
  usablePosts(collection: ApiCollection): ApiCollectionPost[] {
    return collection.posts.filter((p) => isUsable(collection, p));
  }

  // ---------- collections ----------

  /** Creates a collection and opens it on the collections page. Rejects when the API refuses. */
  async create(name: string, description = ''): Promise<ApiCollection> {
    const wsId = this.requireWs();
    const created = await this.api.createCollection(wsId, name.trim(), description.trim());
    if (this.ws.id() === wsId) {
      this.collections.update((l) => [...l, created]);
      this.openId.set(created.id);
    }
    return created;
  }

  /**
   * Switches a collection on or off (waits for the server). Off: the schedules that use it queue nothing from it,
   * so the caller reads the schedules again afterwards.
   */
  async setActive(id: string, active: boolean): Promise<void> {
    const wsId = this.requireWs();
    const saved = await this.api.setCollectionActive(wsId, id, active);
    if (this.ws.id() !== wsId) return;
    this.collections.update((l) =>
      l.map((c) => (c.id === id ? { ...c, active: saved.active } : c)),
    );
  }

  /** Deletes a collection and its posts. The API refuses (422, naming the schedules) while a schedule uses it. */
  async remove(id: string): Promise<void> {
    const wsId = this.requireWs();
    await this.api.deleteCollection(wsId, id);
    if (this.ws.id() !== wsId) return;
    const pending = this.pending.get(id);
    if (pending?.timer) clearTimeout(pending.timer);
    this.pending.delete(id);
    this.collections.update((l) => l.filter((c) => c.id !== id));
    if (this.openId() === id) this.openId.set(null);
    if (this.lastId() === id) this.lastId.set(null);
  }

  /** Renames a collection. */
  rename(id: string, name: string, description?: string): void {
    this.edit(id, { name, ...(description === undefined ? {} : { description }) });
  }

  /** Changes some settings of a collection (the others keep their values). */
  updateSettings(id: string, settings: Partial<ApiCollectionSettings>): void {
    this.edit(id, { settings });
  }

  /**
   * Applies an edit to the shown collection at once and schedules the save. The request carries every field
   * of the collection's name and settings, built from what is on screen, so edits made one after another
   * (or while a save is on its way) are never lost to a partial body.
   */
  edit(id: string, edit: CollectionEdit): void {
    const current = this.byId(id);
    if (!current) return;
    const wsId = this.requireWs();
    const entry: PendingSave = this.pending.get(id) ?? {
      ws: wsId,
      meta: metaOf(current),
      confirmed: metaOf(current),
      timer: null,
      inflight: false,
      dirty: false,
    };
    entry.meta = {
      name: edit.name ?? entry.meta.name,
      description: edit.description ?? entry.meta.description,
      icon: edit.icon ?? entry.meta.icon,
      settings: { ...entry.meta.settings, ...edit.settings },
    };
    this.pending.set(id, entry);
    this.show(id, entry.meta);
    entry.dirty = true;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => void this.flushOne(id), SAVE_DELAY_MS);
  }

  /** Sends every edit that is still waiting (e.g. before leaving the page) and waits for the answers. */
  async flush(): Promise<void> {
    await Promise.all([...this.pending.keys()].map((id) => this.flushOne(id)));
  }

  private async flushOne(id: string): Promise<void> {
    const entry = this.pending.get(id);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = null;
    // A request is already on its way: it finds the newer edit when it comes back.
    if (entry.inflight || !entry.dirty) return;
    entry.dirty = false;
    entry.inflight = true;
    try {
      const saved = await this.api.updateCollection(entry.ws, id, entry.meta);
      entry.confirmed = metaOf(saved);
      if (entry.ws === this.ws.id()) {
        // The server's values replace what is shown, unless the person went on editing; text it only trimmed
        // stays as typed.
        if (!entry.dirty) this.show(id, shownAfterSave(entry.meta, entry.confirmed));
        this.patchCollection(id, (c) => ({ ...c, scheduleCount: saved.scheduleCount }));
      }
    } catch (e) {
      // The interceptor has toasted the reason. Edits made meanwhile are sent with the next request; with
      // none, the collection goes back to what the server last confirmed.
      const approval = entry.meta.settings.requireApproval;
      if (
        e instanceof HttpErrorResponse &&
        e.status === 403 &&
        approval !== entry.confirmed.settings.requireApproval
      ) {
        // The approval rule is the one setting that needs a higher role (admin): take back only that change
        // and send the others again, so a refused switch does not cost the rest of the edits.
        entry.meta = {
          ...entry.meta,
          settings: {
            ...entry.meta.settings,
            requireApproval: entry.confirmed.settings.requireApproval,
          },
        };
        if (entry.ws === this.ws.id()) this.show(id, entry.meta);
        if (!sameMeta(entry.meta, entry.confirmed)) entry.dirty = true;
      }
      if (!entry.dirty) {
        entry.meta = entry.confirmed;
        if (entry.ws === this.ws.id()) this.show(id, entry.confirmed);
      }
    } finally {
      entry.inflight = false;
    }
    if (entry.dirty) await this.flushOne(id);
    else this.pending.delete(id);
  }

  private show(id: string, meta: Meta): void {
    this.patchCollection(id, (c) => ({ ...c, ...meta, settings: { ...meta.settings } }));
  }

  private patchCollection(id: string, fn: (c: ApiCollection) => ApiCollection): void {
    this.collections.update((l) => l.map((c) => (c.id === id ? fn(c) : c)));
  }

  /** A fresh list with the edits that have not been saved yet laid over it. */
  private withPending(list: ApiCollection[]): ApiCollection[] {
    if (!this.pending.size) return list;
    return list.map((c) => {
      const entry = this.pending.get(c.id);
      return entry && entry.ws === this.ws.id()
        ? { ...c, ...entry.meta, settings: { ...entry.meta.settings } }
        : c;
    });
  }

  // ---------- posts ----------

  /** Adds a post to a collection. Rejects when the API refuses (the page keeps the text then). */
  async addPost(collectionId: string, text: string, mediaIds: string[] = []) {
    const wsId = this.requireWs();
    const post = await this.api.createCollectionPost(wsId, collectionId, text, mediaIds);
    if (this.ws.id() === wsId) this.insertPosts(collectionId, [post]);
    return post;
  }

  /** Adds up to 20 posts at once (the AI writer). Rejects when the API refuses. */
  async addPosts(collectionId: string, items: { text: string; mediaIds?: string[] }[]) {
    const wsId = this.requireWs();
    const posts = await this.api.createCollectionPosts(wsId, collectionId, items);
    if (this.ws.id() === wsId) this.insertPosts(collectionId, posts);
    return posts;
  }

  /**
   * Saves the text and media of a post; `toCollectionId` moves it to another collection. The post comes back
   * in its place (an approved post of a collection that needs approval is a draft again). Rejects when refused.
   */
  async updatePost(
    post: Pick<ApiCollectionPost, 'id' | 'collectionId'>,
    change: { text: string; mediaIds: string[]; toCollectionId?: string },
  ) {
    const wsId = this.requireWs();
    const moves = !!change.toCollectionId && change.toCollectionId !== post.collectionId;
    const saved = await this.api.updateCollectionPost(wsId, post.collectionId, post.id, {
      text: change.text,
      mediaIds: change.mediaIds,
      collectionId: moves ? change.toCollectionId! : null,
    });
    if (this.ws.id() === wsId) {
      this.collections.update((list) =>
        list.map((c) => {
          if (c.id === post.collectionId && c.id !== saved.collectionId)
            return { ...c, posts: c.posts.filter((p) => p.id !== post.id) };
          if (c.id === saved.collectionId) {
            const there = c.posts.some((p) => p.id === saved.id);
            return {
              ...c,
              posts: there
                ? c.posts.map((p) => (p.id === saved.id ? saved : p))
                : [...c.posts, saved],
            };
          }
          return c;
        }),
      );
    }
    return saved;
  }

  /** Deletes a post: it goes from the page at once and comes back when the API refuses. Answers whether it was deleted. */
  async deletePost(post: Pick<ApiCollectionPost, 'id' | 'collectionId'>): Promise<boolean> {
    const wsId = this.requireWs();
    const home = this.byId(post.collectionId);
    const index = home ? home.posts.findIndex((p) => p.id === post.id) : -1;
    const removed = index >= 0 ? home!.posts[index] : null;
    this.collections.update((l) =>
      l.map((c) =>
        c.id === post.collectionId ? { ...c, posts: c.posts.filter((p) => p.id !== post.id) } : c,
      ),
    );
    try {
      await this.api.deleteCollectionPost(wsId, post.collectionId, post.id);
      return true;
    } catch {
      if (removed && this.ws.id() === wsId) {
        this.collections.update((l) =>
          l.map((c) => {
            if (c.id !== post.collectionId || c.posts.some((p) => p.id === removed.id)) return c;
            const posts = [...c.posts];
            posts.splice(Math.min(index, posts.length), 0, removed);
            return { ...c, posts };
          }),
        );
      }
      return false;
    }
  }

  /**
   * Asks for approval, approves or sends a post back (the buttons of a collection that needs approval). The
   * new state shows at once; the answer replaces it, and a refusal puts the old state back. Answers whether
   * the server took it.
   */
  async setApproval(
    post: Pick<ApiCollectionPost, 'id' | 'collectionId' | 'approval'>,
    action: ApiApprovalAction,
  ): Promise<boolean> {
    const wsId = this.requireWs();
    const before = post.approval;
    this.patchPost(post.collectionId, post.id, (p) => ({ ...p, approval: approvalAfter(action) }));
    try {
      const saved = await this.api.collectionPostApproval(wsId, post.collectionId, post.id, action);
      if (this.ws.id() === wsId) this.patchPost(post.collectionId, post.id, () => saved);
      return true;
    } catch {
      if (this.ws.id() === wsId)
        this.patchPost(post.collectionId, post.id, (p) => ({ ...p, approval: before }));
      return false;
    }
  }

  /** Saves every post of every collection as a CSV file (collection, text, media, status). */
  exportCsv(): boolean {
    return downloadCsv(EXPORT_FILES.posts, postsToCsv(this.collections()));
  }

  private insertPosts(collectionId: string, posts: ApiCollectionPost[]): void {
    this.collections.update((l) =>
      l.map((c) => (c.id === collectionId ? { ...c, posts: [...c.posts, ...posts] } : c)),
    );
  }

  private patchPost(
    collectionId: string,
    id: string,
    fn: (p: ApiCollectionPost) => ApiCollectionPost,
  ): void {
    this.collections.update((l) =>
      l.map((c) =>
        c.id === collectionId ? { ...c, posts: c.posts.map((p) => (p.id === id ? fn(p) : p)) } : c,
      ),
    );
  }

  private requireWs(): string {
    const id = this.ws.id();
    if (!id) throw new Error('No workspace selected');
    return id;
  }
}

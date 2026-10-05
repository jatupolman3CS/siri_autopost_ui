import { Injectable, Injector, inject, signal } from '@angular/core';
import { ApiMedia, ApiMediaFolder, ApiService, ApiSnippet } from '../http/api.service';
import { CollectionsStore } from './collections.store';
import { DraftStore } from './draft.store';
import { loadWithRetry } from './loading';
import { MediaFolder, MediaItem, Snippet } from './models';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

function toMedia(m: ApiMedia): MediaItem {
  return {
    id: m.id,
    name: m.name,
    meta: `${m.contentType} · ${fileSize(m.size)}`,
    kind: m.kind,
    used: m.usedCount,
    folderId: m.folderId ?? null,
    active: m.active,
  };
}

function toFolder(f: ApiMediaFolder): MediaFolder {
  return { id: f.id, name: f.name };
}

function toSnippet(s: ApiSnippet): Snippet {
  return { id: s.id, title: s.title, text: s.text, used: s.usedCount, active: s.active };
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function without<T>(map: Record<string, T>, gone: ReadonlySet<string>): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [k, v] of Object.entries(map)) if (!gone.has(k)) next[k] = v;
  return next;
}

// Uploaded media and text snippets of the current workspace. Image thumbnails are fetched
// with the bearer token and shown through object URLs (an <img src> cannot send the token).
@Injectable({ providedIn: 'root' })
export class LibraryStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);
  // Looked up when files are deleted, so reading the library never starts these stores.
  private readonly injector = inject(Injector);

  readonly media = signal<MediaItem[]>([]);
  readonly snippets = signal<Snippet[]>([]);
  /** Folders of the media library (one level), by name. */
  readonly folders = signal<MediaFolder[]>([]);
  /** Media and snippets of the current workspace have arrived. */
  readonly loaded = signal(false);
  /** mediaId -> object URL of the image. */
  readonly thumbs = signal<Record<string, string>>({});
  /** mediaId -> object URL of a video the user chose to play (fetched on demand: videos are large). */
  readonly videos = signal<Record<string, string>>({});
  /** Videos being fetched right now. */
  readonly videoLoading = signal<Record<string, boolean>>({});
  /** Thumbnails asked for already (fetched or in flight), so a page turn never asks twice. */
  private readonly thumbAsked = new Set<string>();

  constructor() {
    whenWorkspaceChanges((id) => {
      for (const url of Object.values(this.thumbs())) URL.revokeObjectURL(url);
      for (const url of Object.values(this.videos())) URL.revokeObjectURL(url);
      this.thumbs.set({});
      this.thumbAsked.clear();
      this.videos.set({});
      this.videoLoading.set({});
      this.media.set([]);
      this.snippets.set([]);
      this.folders.set([]);
      this.loaded.set(false);
      if (id) void this.load(id);
    });
  }

  /** Loads the library (transient failures are retried); an answer for a workspace left meanwhile is dropped. */
  async load(wsId: string): Promise<void> {
    const ok = await loadWithRetry(
      async () => {
        const [media, snippets, folders] = await Promise.all([
          this.api.media(wsId),
          this.api.snippets(wsId),
          this.api.mediaFolders(wsId),
        ]);
        if (this.ws.id() !== wsId) return;
        this.media.set(media.map(toMedia));
        this.snippets.set(snippets.map(toSnippet));
        this.folders.set(folders.map(toFolder));
      },
      () => this.ws.id() === wsId,
    );
    if (ok && this.ws.id() === wsId) this.loaded.set(true);
  }

  async addSnippet(title: string, text: string): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    const s = await this.api.createSnippet(wsId, title, text);
    this.snippets.update((list) => [toSnippet(s), ...list]);
  }

  /** Changes a snippet's title and text (waits for the server). */
  async updateSnippet(id: string, title: string, text: string): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    const s = toSnippet(await this.api.updateSnippet(wsId, id, title, text));
    this.snippets.update((list) => list.map((x) => (x.id === id ? s : x)));
  }

  async setSnippetActive(id: string, active: boolean): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    const s = toSnippet(await this.api.setSnippetActive(wsId, id, active));
    this.snippets.update((list) => list.map((x) => (x.id === id ? s : x)));
  }

  async deleteSnippet(id: string): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    await this.api.deleteSnippet(wsId, id);
    this.snippets.update((list) => list.filter((x) => x.id !== id));
  }

  /** Renames a file (the display name only). */
  async renameMedia(id: string, name: string): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    const m = toMedia(await this.api.renameMedia(wsId, id, name));
    this.media.update((list) => list.map((x) => (x.id === id ? m : x)));
  }

  /** Switches files on or off, a request at a time of at most 500. */
  async setMediaActive(ids: readonly string[], active: boolean): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId || !ids.length) return;
    for (let i = 0; i < ids.length; i += 500) {
      const changed = await this.api.setMediaActive(wsId, ids.slice(i, i + 500), active);
      const done = new Set(changed.map((m) => m.id));
      this.media.update((list) => list.map((m) => (done.has(m.id) ? { ...m, active } : m)));
    }
  }

  /**
   * Deletes files from the library, a request at a time of at most 500. The server takes them off the collection
   * posts that used them, so those collections (and the composer's draft, via `removed`) are told afterwards.
   */
  async deleteMedia(ids: readonly string[]): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId || !ids.length) return;
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      await this.api.deleteMedia(wsId, chunk);
      const gone = new Set(chunk);
      for (const id of chunk) {
        const t = this.thumbs()[id];
        if (t) URL.revokeObjectURL(t);
        const v = this.videos()[id];
        if (v) URL.revokeObjectURL(v);
        this.thumbAsked.delete(id);
      }
      this.thumbs.update((t) => without(t, gone));
      this.videos.update((v) => without(v, gone));
      this.media.update((list) => list.filter((m) => !gone.has(m.id)));
    }
    this.injector.get(DraftStore).dropMedia(ids);
    void this.injector.get(CollectionsStore).refresh();
  }

  /** Uploads files one by one; returns the ids of the ones the server accepted (the composer attaches them). */
  async upload(files: File[], folderId: string | null = null): Promise<string[]> {
    const wsId = this.ws.id();
    if (!wsId) return [];
    const ids: string[] = [];
    for (const f of files) {
      try {
        const m = await this.api.upload(wsId, f, folderId);
        this.media.update((list) => [toMedia(m), ...list]);
        if (m.kind === 'image') this.askThumb(wsId, m.id);
        ids.push(m.id);
      } catch {
        // Counted as failed; the interceptor or the caller tells the user.
      }
    }
    return ids;
  }

  async createFolder(name: string): Promise<MediaFolder | null> {
    const wsId = this.ws.id();
    if (!wsId) return null;
    const f = toFolder(await this.api.createMediaFolder(wsId, name));
    this.folders.update((list) => [...list, f].sort((a, b) => a.name.localeCompare(b.name)));
    return f;
  }

  async renameFolder(id: string, name: string): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    const f = toFolder(await this.api.renameMediaFolder(wsId, id, name));
    this.folders.update((list) =>
      list.map((x) => (x.id === id ? f : x)).sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  /** Deletes the folder; its files stay in the library without a folder. */
  async deleteFolder(id: string): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    await this.api.deleteMediaFolder(wsId, id);
    this.folders.update((list) => list.filter((x) => x.id !== id));
    this.media.update((list) =>
      list.map((m) => (m.folderId === id ? { ...m, folderId: null } : m)),
    );
  }

  /** Puts files into a folder (null = out of every folder), a request at a time of at most 500. */
  async moveMedia(ids: readonly string[], folderId: string | null): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId || !ids.length) return;
    for (let i = 0; i < ids.length; i += 500) {
      const moved = await this.api.moveMedia(wsId, ids.slice(i, i + 500), folderId);
      const done = new Set(moved.map((m) => m.id));
      this.media.update((list) => list.map((m) => (done.has(m.id) ? { ...m, folderId } : m)));
    }
  }

  /** Fetches the thumbnails of the images among `ids` that are not loaded yet (the library can hold thousands). */
  ensureThumbs(ids: readonly string[]): void {
    const wsId = this.ws.id();
    if (!wsId || !ids.length) return;
    const images = new Set(
      this.media()
        .filter((m) => m.kind === 'image')
        .map((m) => m.id),
    );
    for (const id of ids) if (images.has(id)) this.askThumb(wsId, id);
  }

  private askThumb(wsId: string, id: string): void {
    if (this.thumbAsked.has(id)) return;
    this.thumbAsked.add(id);
    void this.loadThumb(wsId, id);
  }

  /** Fetches a video with the bearer token (a <video src> cannot send it) so it can be played. */
  async loadVideo(id: string): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId || this.videos()[id] || this.videoLoading()[id]) return;
    this.videoLoading.update((l) => ({ ...l, [id]: true }));
    try {
      const blob = await this.api.mediaContent(wsId, id);
      if (this.ws.id() !== wsId) return;
      this.videos.update((v) => ({ ...v, [id]: URL.createObjectURL(blob) }));
    } catch {
      // The video stays a play button; the interceptor tells the user.
    } finally {
      this.videoLoading.update((l) => ({ ...l, [id]: false }));
    }
  }

  private async loadThumb(wsId: string, id: string): Promise<void> {
    try {
      const blob = await this.api.mediaContent(wsId, id);
      if (this.ws.id() !== wsId) return;
      this.thumbs.update((t) => ({ ...t, [id]: URL.createObjectURL(blob) }));
    } catch {
      // Keeps the icon placeholder; a later page turn may ask again.
      this.thumbAsked.delete(id);
    }
  }
}

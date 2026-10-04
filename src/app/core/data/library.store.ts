import { Injectable, inject, signal } from '@angular/core';
import { ApiMedia, ApiMediaFolder, ApiService, ApiSnippet } from '../http/api.service';
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
  };
}

function toFolder(f: ApiMediaFolder): MediaFolder {
  return { id: f.id, name: f.name };
}

function toSnippet(s: ApiSnippet): Snippet {
  return { id: s.id, title: s.title, text: s.text, used: s.usedCount };
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Uploaded media and text snippets of the current workspace. Image thumbnails are fetched
// with the bearer token and shown through object URLs (an <img src> cannot send the token).
@Injectable({ providedIn: 'root' })
export class LibraryStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);

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

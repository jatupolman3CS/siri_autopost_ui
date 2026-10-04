import { Injectable, inject, signal } from '@angular/core';
import { ApiMedia, ApiService, ApiSnippet } from '../http/api.service';
import { loadWithRetry } from './loading';
import { MediaItem, Snippet } from './models';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

function toMedia(m: ApiMedia): MediaItem {
  return {
    id: m.id,
    name: m.name,
    meta: `${m.contentType} · ${fileSize(m.size)}`,
    kind: m.kind,
    used: m.usedCount,
  };
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
  /** Media and snippets of the current workspace have arrived. */
  readonly loaded = signal(false);
  /** mediaId -> object URL of the image. */
  readonly thumbs = signal<Record<string, string>>({});
  /** mediaId -> object URL of a video the user chose to play (fetched on demand: videos are large). */
  readonly videos = signal<Record<string, string>>({});
  /** Videos being fetched right now. */
  readonly videoLoading = signal<Record<string, boolean>>({});

  constructor() {
    whenWorkspaceChanges((id) => {
      for (const url of Object.values(this.thumbs())) URL.revokeObjectURL(url);
      for (const url of Object.values(this.videos())) URL.revokeObjectURL(url);
      this.thumbs.set({});
      this.videos.set({});
      this.videoLoading.set({});
      this.media.set([]);
      this.snippets.set([]);
      this.loaded.set(false);
      if (id) void this.load(id);
    });
  }

  /** Loads the library (transient failures are retried); an answer for a workspace left meanwhile is dropped. */
  async load(wsId: string): Promise<void> {
    const ok = await loadWithRetry(
      async () => {
        const [media, snippets] = await Promise.all([
          this.api.media(wsId),
          this.api.snippets(wsId),
        ]);
        if (this.ws.id() !== wsId) return;
        this.media.set(media.map(toMedia));
        this.snippets.set(snippets.map(toSnippet));
        for (const m of media) if (m.kind === 'image') void this.loadThumb(wsId, m.id);
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
  async upload(files: File[]): Promise<string[]> {
    const wsId = this.ws.id();
    if (!wsId) return [];
    const ids: string[] = [];
    for (const f of files) {
      try {
        const m = await this.api.upload(wsId, f);
        this.media.update((list) => [toMedia(m), ...list]);
        if (m.kind === 'image') void this.loadThumb(wsId, m.id);
        ids.push(m.id);
      } catch {
        // Counted as failed; the interceptor or the caller tells the user.
      }
    }
    return ids;
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
      // Keeps the icon placeholder.
    }
  }
}

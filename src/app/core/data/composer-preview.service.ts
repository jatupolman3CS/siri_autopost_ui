import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../http/api.service';
import { loadWithRetry } from './loading';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

/** What the composer's preview needs of one link of a set. */
export interface PreviewLink {
  name: string;
  url: string;
  code: string;
  enabled: boolean;
  valid: boolean;
}

/** What the composer's preview needs of a link set. */
export interface PreviewSet {
  id: string;
  name: string;
  links: readonly PreviewLink[];
}

// The link sets as the composer's preview reads them: the sets and their links (name, address, code, whether
// they are on and valid), nothing else. The link sets page has its own store; this service keeps the
// composer behind a two-signal interface (`sets`, `loaded`) and `refresh()`, so it can be pointed at that
// store without touching the page.
@Injectable({ providedIn: 'root' })
export class ComposerPreviewService {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);

  readonly sets = signal<PreviewSet[]>([]);
  readonly loaded = signal(false);

  constructor() {
    whenWorkspaceChanges((wsId) => {
      this.sets.set([]);
      this.loaded.set(false);
      if (wsId) void this.load(wsId);
    });
  }

  /** Reads the sets again in the background (they are edited on another page); never rejects. */
  async refresh(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId || !this.loaded()) return;
    try {
      const list = await this.api.linkSets(wsId, true);
      if (this.ws.id() === wsId) this.sets.set(toPreview(list));
    } catch {
      // The sets on screen stay; the next visit asks again.
    }
  }

  private async load(wsId: string): Promise<void> {
    const ok = await loadWithRetry(
      async () => {
        const list = await this.api.linkSets(wsId, true);
        if (this.ws.id() === wsId) this.sets.set(toPreview(list));
      },
      () => this.ws.id() === wsId,
    );
    if (ok && this.ws.id() === wsId) this.loaded.set(true);
  }
}

function toPreview(list: Awaited<ReturnType<ApiService['linkSets']>>): PreviewSet[] {
  return list.map((s) => ({
    id: s.id,
    name: s.name,
    links: s.links.map((l) => ({
      name: l.name,
      url: l.url,
      code: l.code,
      enabled: l.enabled,
      valid: l.valid,
    })),
  }));
}

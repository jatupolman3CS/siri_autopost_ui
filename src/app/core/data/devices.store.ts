import { Injectable, inject, signal } from '@angular/core';
import { ApiDevice, ApiPairingCode, ApiService } from '../http/api.service';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

// Browsers with the extension paired to the current workspace, and the pairing code flow.
@Injectable({ providedIn: 'root' })
export class DevicesStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);

  readonly list = signal<ApiDevice[]>([]);
  readonly loaded = signal(false);

  constructor() {
    whenWorkspaceChanges((id) => {
      this.list.set([]);
      this.loaded.set(false);
      if (id) void this.load(id);
    });
  }

  async load(wsId = this.ws.id()): Promise<void> {
    if (!wsId) return;
    const list = await this.api.devices(wsId);
    if (this.ws.id() !== wsId) return;
    this.list.set(list);
    this.loaded.set(true);
  }

  /** A 10-minute code to type into the extension (fails when the plan has no device left). */
  async createPairingCode(): Promise<ApiPairingCode | null> {
    const wsId = this.ws.id();
    return wsId ? this.api.createPairingCode(wsId) : null;
  }

  /** Renames a browser (its Facebook account follows) or pauses the posts it takes from the web. */
  async update(id: string, patch: { name?: string; jobsPaused?: boolean }): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    const d = await this.api.updateDevice(wsId, id, patch);
    this.list.update((l) => l.map((x) => (x.id === id ? d : x)));
  }

  async revoke(id: string): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    await this.api.revokeDevice(wsId, id);
    this.list.update((l) => l.filter((d) => d.id !== id));
  }
}

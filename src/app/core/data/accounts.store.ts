import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '../http/api.service';
import { Health, SocialAccount } from './models';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

// Social accounts connected to the current workspace.
@Injectable({ providedIn: 'root' })
export class AccountsStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);

  readonly list = signal<SocialAccount[]>([]);
  /** Every Facebook group any account posts to, in account order. */
  readonly allGroups = computed(() => [...new Set(this.list().flatMap((a) => a.groups))]);

  constructor() {
    whenWorkspaceChanges((id) => {
      this.list.set([]);
      if (id) void this.load(id);
    });
  }

  async load(wsId = this.ws.id()): Promise<void> {
    if (wsId) this.list.set(await this.api.accounts(wsId));
  }

  byId(id: string): SocialAccount | undefined {
    return this.list().find((a) => a.id === id);
  }

  health(id: string): Health {
    return this.byId(id)?.health ?? 'ok';
  }

  /** Marks the account signed in again (the extension refreshes the session). */
  async reconnect(id: string): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    const updated = await this.api.reconnect(wsId, id);
    this.list.update((l) => l.map((a) => (a.id === id ? updated : a)));
  }
}

import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ApiService } from '../http/api.service';
import { loadWithRetry } from './loading';
import { Workspace } from './models';
import { SessionStore } from './session.store';

const STORAGE_KEY = 'ap-ws';

// The signed-in user's workspaces and the one being worked in. Every workspace-scoped
// store reloads through whenWorkspaceChanges() when the current workspace changes.
@Injectable({ providedIn: 'root' })
export class WorkspaceStore {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);

  readonly list = signal<Workspace[]>([]);
  readonly id = signal<string | null>(null);
  /** The list for the current user has arrived (pages show "—" instead of zeros until it has). */
  readonly loaded = signal(false);
  readonly current = computed(() => this.list().find((w) => w.id === this.id()) ?? null);
  private readonly userId = computed(() => this.session.user()?.id ?? null);
  private lastUser: string | null = null;
  private lastPlan: string | null = null;

  constructor() {
    // Keyed on the user, not just "signed in": an admin's assist session switches users. A new plan of the
    // same user moves the limits the list carries, so it is read again without emptying the stores.
    effect(() => {
      const user = this.session.user();
      const id = user?.id ?? null;
      const plan = user?.plan ?? null;
      untracked(() => {
        if (id !== this.lastUser) {
          this.lastUser = id;
          this.lastPlan = plan;
          this.clear();
          if (id) void this.load();
        } else if (plan !== this.lastPlan) {
          this.lastPlan = plan;
          if (id) void this.load();
        }
      });
    });
  }

  /** (Re)reads the list; transient failures are retried, and it never throws (`loaded` tells). */
  async load(): Promise<void> {
    const user = this.userId();
    const ok = await loadWithRetry(
      async () => {
        const list = await this.api.workspaces();
        if (this.userId() !== user) return;
        this.list.set(list);
        const keep = this.id() ?? readStored();
        this.select(list.find((w) => w.id === keep)?.id ?? list[0]?.id ?? null);
      },
      () => this.userId() === user,
    );
    if (ok && this.userId() === user) this.loaded.set(true);
  }

  switchTo(id: string): Workspace | undefined {
    const ws = this.list().find((w) => w.id === id);
    if (ws) this.select(id);
    return ws;
  }

  async create(name: string): Promise<Workspace> {
    const ws = await this.api.createWorkspace(name);
    this.list.update((l) => [...l, ws]);
    this.select(ws.id);
    return ws;
  }

  private clear(): void {
    this.list.set([]);
    this.id.set(null);
    this.loaded.set(false);
  }

  private select(id: string | null): void {
    this.id.set(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Remembered for this visit only.
    }
  }
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Runs `load` now and whenever the current workspace changes (null after sign-out).
 * Call it from a store's constructor.
 */
export function whenWorkspaceChanges(load: (wsId: string | null) => void): void {
  const ws = inject(WorkspaceStore);
  effect(() => {
    const id = ws.id();
    untracked(() => load(id));
  });
}

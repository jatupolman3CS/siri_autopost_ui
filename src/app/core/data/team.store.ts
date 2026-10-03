import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiMember, ApiRole, ApiService } from '../http/api.service';
import { loadWithRetry } from './loading';
import { PermissionsService } from './permissions.service';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

// The current workspace's people: the owner, members and pending invitations
// (/api/workspaces/{ws}/members). Paired browsers are in DevicesStore.
@Injectable({ providedIn: 'root' })
export class TeamStore {
  private readonly api = inject(ApiService);
  private readonly workspaces = inject(WorkspaceStore);
  private readonly permissions = inject(PermissionsService);
  private wsId: string | null = null;

  readonly members = signal<ApiMember[]>([]);
  readonly loaded = signal(false);
  /** The signed-in user's role in the current workspace. */
  readonly role = this.permissions.role;
  /** Owners and admins invite, change roles and remove people (never in assist mode). */
  readonly canManage = this.permissions.canAdmin;
  /** Seats (owner included, invitations too) the owner's plan allows; null = unlimited. */
  readonly seatLimit = computed(() => this.workspaces.current()?.limits.seats ?? null);
  /** Every seat is taken: the API would refuse another invitation. */
  readonly seatsFull = computed(() => {
    const max = this.seatLimit();
    return max !== null && this.members().length >= max;
  });

  constructor() {
    whenWorkspaceChanges((id) => {
      this.wsId = id;
      this.members.set([]);
      this.loaded.set(false);
      if (id) void this.load();
    });
  }

  async load(): Promise<void> {
    const ws = this.wsId;
    if (!ws) return;
    const ok = await loadWithRetry(
      async () => {
        const list = await this.api.members(ws);
        if (ws !== this.wsId) return;
        this.members.set(list);
      },
      () => ws === this.wsId,
    );
    if (ok && ws === this.wsId) this.loaded.set(true);
  }

  /** Throws the server's refusal (team full, already a member) for the form to show. */
  async invite(email: string, role: ApiRole): Promise<void> {
    await this.api.inviteMember(this.wsId!, email, role);
    await this.afterChange();
  }

  async changeRole(id: string, role: ApiRole): Promise<void> {
    await this.api.changeMemberRole(this.wsId!, id, role);
    await this.load();
  }

  /** Removes a member, or leaves the workspace when it is the signed-in user's own row. */
  async remove(m: ApiMember): Promise<void> {
    await this.api.removeMember(this.wsId!, m.id!);
    if (m.you) await this.workspaces.load();
    else await this.afterChange();
  }

  /** The member count on the workspace list changes too. */
  private async afterChange(): Promise<void> {
    await Promise.all([this.load(), this.workspaces.load()]);
  }
}

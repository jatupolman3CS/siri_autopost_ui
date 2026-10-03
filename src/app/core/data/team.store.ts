import { Injectable, computed, signal } from '@angular/core';
import { Device, Member, MemberRole, Workspace } from './models';
import { SEED } from './seed.data';

@Injectable({ providedIn: 'root' })
export class TeamStore {
  readonly members = signal<Member[]>(SEED.members.map((m) => ({ ...m })));
  readonly devices = signal<Device[]>(SEED.devices.map((d) => ({ ...d })));
  readonly workspaces = signal<Workspace[]>(SEED.workspaces.map((w) => ({ ...w })));
  readonly wsId = signal('w1');
  readonly current = computed(
    () => this.workspaces().find((w) => w.id === this.wsId()) ?? this.workspaces()[0],
  );

  switchTo(id: string): Workspace | undefined {
    const ws = this.workspaces().find((w) => w.id === id);
    if (ws) this.wsId.set(id);
    return ws;
  }

  invite(email: string, role: MemberRole): void {
    this.members.update((list) => [
      ...list,
      { id: 'u' + Date.now(), name: email.split('@')[0], email, role, active: 'aInvited' },
    ]);
  }

  createWorkspace(name: string): void {
    const id = 'w' + Date.now();
    this.workspaces.update((list) => [...list, { id, name, posts7: 0, members: 1 }]);
    this.wsId.set(id);
  }

  revokeDevice(id: string): void {
    this.devices.update((list) => list.filter((d) => d.id !== id));
  }
}

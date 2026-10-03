import { Injectable, signal } from '@angular/core';
import { Device, Member, MemberRole } from './models';
import { SEED } from './seed.data';

// Team members and signed-in devices. Sample data: there is no team or device API yet
// (workspaces moved to WorkspaceStore).
@Injectable({ providedIn: 'root' })
export class TeamStore {
  readonly members = signal<Member[]>(SEED.members.map((m) => ({ ...m })));
  readonly devices = signal<Device[]>(SEED.devices.map((d) => ({ ...d })));

  invite(email: string, role: MemberRole): void {
    this.members.update((list) => [
      ...list,
      { id: 'u' + Date.now(), name: email.split('@')[0], email, role, active: 'aInvited' },
    ]);
  }

  revokeDevice(id: string): void {
    this.devices.update((list) => list.filter((d) => d.id !== id));
  }
}

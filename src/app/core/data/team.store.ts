import { Injectable, signal } from '@angular/core';
import { Member, MemberRole } from './models';
import { SEED } from './seed.data';

// Team members. Sample data: there is no team API yet (workspaces are in WorkspaceStore,
// paired devices in DevicesStore).
@Injectable({ providedIn: 'root' })
export class TeamStore {
  readonly members = signal<Member[]>(SEED.members.map((m) => ({ ...m })));

  invite(email: string, role: MemberRole): void {
    this.members.update((list) => [
      ...list,
      { id: 'u' + Date.now(), name: email.split('@')[0], email, role, active: 'aInvited' },
    ]);
  }
}

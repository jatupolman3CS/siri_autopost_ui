import { Injectable, computed, signal } from '@angular/core';
import { PlanKey, Role } from './models';
import { SEED } from './seed.data';

const STORAGE_KEY = 'ap-session';

interface Persisted {
  role: Role;
  plan: PlanKey;
}

// Who is signed in and on which plan. There is no backend auth yet: like the design
// prototype, any valid email signs in and the role is picked on the login form.
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly stored = readStored();

  readonly role = signal<Role>(this.stored.role);
  readonly plan = signal<PlanKey>(this.stored.plan);
  readonly user = SEED.user;
  readonly isGuest = computed(() => this.role() === 'guest');
  readonly isAdmin = computed(() => this.role() === 'admin');

  signIn(role: Role, plan?: PlanKey): void {
    this.role.set(role);
    if (plan) this.plan.set(plan);
    this.persist();
  }

  signOut(): void {
    this.role.set('guest');
    this.persist();
  }

  setPlan(plan: PlanKey): void {
    this.plan.set(plan);
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ role: this.role(), plan: this.plan() }));
    } catch {
      // Session lasts for this visit only.
    }
  }
}

function readStored(): Persisted {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Persisted> | null;
    if (v && ['guest', 'user', 'admin'].includes(v.role ?? '') && v.plan)
      return { role: v.role as Role, plan: v.plan };
  } catch {
    // Fall through to the defaults.
  }
  return { role: 'guest', plan: 'free' };
}

import { Injectable, computed, inject, signal } from '@angular/core';
import { tokenStorage } from '../auth/token';
import { ApiAuthResult, ApiService, ApiUser } from '../http/api.service';
import { PlanKey, Role } from './models';

// Who is signed in, from the API's JWT login. The token persists in localStorage and is
// checked against /api/auth/me when the app starts (see restore()).
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly api = inject(ApiService);
  private readonly _user = signal<ApiUser | null>(null);

  readonly user = this._user.asReadonly();
  readonly role = computed<Role>(() => this._user()?.role ?? 'guest');
  readonly plan = computed<PlanKey>(() => this._user()?.plan ?? 'free');
  readonly isGuest = computed(() => !this._user());
  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly name = computed(() => this._user()?.name ?? '');
  readonly email = computed(() => this._user()?.email ?? '');
  readonly initials = computed(() => initialsOf(this.name() || this.email()));

  /** Called once by the app initializer: a stored token that no longer works is dropped. */
  async restore(): Promise<void> {
    if (!tokenStorage.get()) return;
    try {
      this._user.set(await this.api.me());
    } catch {
      tokenStorage.set(null);
    }
  }

  async logIn(email: string, password: string): Promise<ApiUser> {
    return this.accept(await this.api.logIn({ email, password }));
  }

  async signUp(email: string, password: string, plan: PlanKey | null): Promise<ApiUser> {
    return this.accept(await this.api.signUp({ email, password, name: null, plan }));
  }

  /** Forgets the token; the workspace stores empty themselves when the user goes away. */
  signOut(): void {
    tokenStorage.set(null);
    this._user.set(null);
  }

  async setPlan(plan: PlanKey): Promise<void> {
    this._user.set(await this.api.changePlan(plan));
  }

  private accept(r: ApiAuthResult): ApiUser {
    tokenStorage.set(r.token);
    this._user.set(r.user);
    return r.user;
  }
}

function initialsOf(name: string): string {
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

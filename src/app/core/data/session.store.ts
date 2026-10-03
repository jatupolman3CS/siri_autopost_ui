import { Injectable, computed, inject, signal } from '@angular/core';
import { AssistSession, assistStorage, tokenStorage } from '../auth/token';
import { ApiAuthResult, ApiService, ApiUser } from '../http/api.service';
import { PlanKey, Role } from './models';

// Who is signed in, from the API's JWT login. The token persists in localStorage and is
// checked against /api/auth/me when the app starts (see restore()).
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly api = inject(ApiService);
  private readonly _user = signal<ApiUser | null>(null);
  private readonly _assist = signal<AssistSession | null>(assistStorage.get());

  readonly user = this._user.asReadonly();
  readonly role = computed<Role>(() => this._user()?.role ?? 'guest');
  readonly plan = computed<PlanKey>(() => this._user()?.plan ?? 'free');
  readonly isGuest = computed(() => !this._user());
  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly name = computed(() => this._user()?.name ?? '');
  readonly email = computed(() => this._user()?.email ?? '');
  readonly initials = computed(() => initialsOf(this.name() || this.email()));
  /** Set while a platform admin sees the app as a customer (read-only, see the API). */
  readonly assist = this._assist.asReadonly();

  /** Called once by the app initializer: a stored token that no longer works is dropped. */
  async restore(): Promise<void> {
    if (!tokenStorage.get()) return;
    try {
      this._user.set(await this.api.me());
    } catch {
      // An expired assist session falls back to the admin's own sign-in.
      if (this._assist()) await this.endAssist();
      else tokenStorage.set(null);
    }
  }

  async logIn(email: string, password: string): Promise<ApiUser> {
    return this.accept(await this.api.logIn({ email, password }));
  }

  async signUp(email: string, password: string, plan: PlanKey | null): Promise<ApiUser> {
    return this.accept(await this.api.signUp({ email, password, name: null, plan }));
  }

  async googleLogIn(idToken: string, plan: PlanKey | null): Promise<ApiUser> {
    return this.accept(await this.api.googleLogIn(idToken, plan));
  }

  /** Forgets the token; the workspace stores empty themselves when the user goes away. */
  signOut(): void {
    tokenStorage.set(null);
    assistStorage.set(null);
    this._assist.set(null);
    this._user.set(null);
  }

  /** The admin sees the app as this customer for an hour; their own token is kept to come back. */
  async startAssist(customerId: string): Promise<void> {
    const adminToken = tokenStorage.get();
    if (!adminToken) return;
    const r = await this.api.adminImpersonate(customerId);
    const session = { adminToken, customerId, email: r.user.email, expiresAt: r.expiresAt };
    assistStorage.set(session);
    this._assist.set(session);
    this.accept(r);
  }

  /** Back to the admin's own sign-in. Returns the customer that was being assisted. */
  async endAssist(): Promise<string | null> {
    const session = this._assist();
    if (!session) return null;
    assistStorage.set(null);
    this._assist.set(null);
    tokenStorage.set(session.adminToken);
    try {
      this._user.set(await this.api.me());
    } catch {
      this.signOut();
    }
    return session.customerId;
  }

  /** A paid plan records a charge (yearly = 12 months at 80%); see /api/billing/invoices. */
  async setPlan(plan: PlanKey, cycle?: 'month' | 'year', promoCode?: string): Promise<void> {
    this._user.set(await this.api.changePlan(plan, cycle, promoCode));
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

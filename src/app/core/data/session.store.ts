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

  /** A new account always starts on Free; a paid plan is bought afterwards at Stripe Checkout. */
  async signUp(email: string, password: string): Promise<ApiUser> {
    return this.accept(await this.api.signUp({ email, password, name: null }));
  }

  async googleLogIn(idToken: string): Promise<ApiUser> {
    return this.accept(await this.api.googleLogIn(idToken));
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

  /**
   * Chooses a plan. Resolves to the Stripe Checkout address when the customer has to pay first (the plan
   * only changes once Stripe confirms the payment), otherwise null: the plan changed, or for Free it will
   * at the end of the paid period.
   */
  async setPlan(
    plan: PlanKey,
    cycle?: 'month' | 'year',
    promoCode?: string,
  ): Promise<string | null> {
    const r = await this.api.changePlan(plan, cycle, promoCode);
    this._user.set(r.user);
    return r.checkoutUrl;
  }

  /** The customer is back from Stripe Checkout: the server applies the paid session, and so do we. */
  async confirmCheckout(sessionId: string): Promise<void> {
    this._user.set(await this.api.confirmCheckout(sessionId));
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

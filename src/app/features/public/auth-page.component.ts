import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PLAN_ORDER, PlanKey } from '../../core/data/models';
import { SessionStore } from '../../core/data/session.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Log in / create account against /api/auth. The account's role (shop user or platform admin)
// comes from the server; signing up always creates a shop user on the chosen plan.
@Component({
  selector: 'app-auth-page',
  imports: [RouterLink, InputFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="auth">
      <form class="card" (submit)="$event.preventDefault(); submit()" novalidate>
        <div>
          <h1>{{ isLogin() ? t().auth.title : t().auth.signupTitle }}</h1>
          <p class="sub">{{ isLogin() ? t().auth.sub : t().auth.signupSub }}</p>
        </div>
        @if (pendingPlan(); as p) {
          <div class="callout">
            <i class="ph ph-tag" style="color: var(--color-primary)"></i>
            <span
              >{{ t().auth.selectedPlan }}: <span class="fw6">{{ t().plans[p].name }}</span></span
            >
          </div>
        }
        <app-input-field
          type="email"
          [label]="t().auth.email"
          placeholder="name@shop.co"
          autocomplete="email"
          [(value)]="email"
          [error]="errEmail()"
        />
        <app-input-field
          type="password"
          [label]="t().auth.password"
          placeholder="••••••••"
          [autocomplete]="isLogin() ? 'current-password' : 'new-password'"
          [(value)]="pass"
          [error]="errPass()"
        />
        <button
          type="submit"
          class="su-btn su-btn-md su-btn-primary su-btn-full"
          [disabled]="busy()"
          [attr.aria-busy]="busy()"
        >
          @if (busy()) {
            {{ t().api.loading }}
          } @else {
            {{ isLogin() ? t().auth.submit : t().auth.create }}<i class="ph ph-arrow-right"></i>
          }
        </button>
        <div class="switch">
          <span>{{ isLogin() ? t().auth.noAccount : t().auth.haveAccount }}</span>
          @if (isLogin()) {
            <a routerLink="/signup" [queryParams]="{ plan: 'free' }">{{ t().auth.signup }}</a>
          } @else {
            <a routerLink="/login">{{ t().auth.title }}</a>
          }
        </div>
      </form>
    </main>
  `,
  styles: `
    .auth {
      min-height: calc(100vh - 64px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 16px;
      animation: ap-rise 0.25s ease-out;
    }
    .card {
      width: 100%;
      max-width: 28rem;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: var(--shadow-md);
    }
    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
    }
    .callout {
      background: var(--color-surface);
    }
    .switch {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 14px;
      color: var(--color-text-muted);
      flex-wrap: wrap;
      a {
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        font-weight: 500;
        text-decoration: none;
      }
    }
  `,
})
export class AuthPageComponent {
  /** From the route data. */
  readonly mode = input<'login' | 'signup'>('login');
  /** ?plan= chosen on the landing page. */
  readonly plan = input<string>();

  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly notify = inject(NotificationService);
  protected readonly t = inject(I18nService).t;

  protected readonly email = signal('');
  protected readonly pass = signal('');
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  /** Server answer for the last attempt, shown under its field until the input changes. */
  private readonly serverErr = signal<{
    field: 'email' | 'pass';
    msg: string;
    email: string;
    pass: string;
  } | null>(null);
  private readonly server = computed(() => {
    const s = this.serverErr();
    return s && s.email === this.email() && s.pass === this.pass() ? s : null;
  });

  protected readonly isLogin = computed(() => this.mode() === 'login');
  protected readonly pendingPlan = computed<PlanKey | null>(() => {
    if (this.isLogin()) return null;
    const p = this.plan() as PlanKey | undefined;
    return p && PLAN_ORDER.includes(p) ? p : 'free';
  });
  protected readonly errEmail = computed(() => {
    if (!this.submitted()) return '';
    if (!EMAIL_RE.test(this.email().trim())) return this.t().auth.errEmail;
    const s = this.server();
    return s?.field === 'email' ? s.msg : '';
  });
  protected readonly errPass = computed(() => {
    if (!this.submitted()) return '';
    if (!this.pass()) return this.t().auth.errPass;
    if (!this.isLogin() && this.pass().length < 8) return this.t().api.passwordMin;
    const s = this.server();
    return s?.field === 'pass' ? s.msg : '';
  });

  protected async submit(): Promise<void> {
    this.serverErr.set(null);
    this.submitted.set(true);
    if (this.errEmail() || this.errPass() || this.busy()) return;
    this.busy.set(true);
    const email = this.email().trim();
    try {
      const user = this.isLogin()
        ? await this.session.logIn(email, this.pass())
        : await this.session.signUp(email, this.pass(), this.pendingPlan());
      const t = this.t().auth;
      const admin = user.role === 'admin';
      this.notify.success(admin ? t.welcomeAdmin : t.welcomeUser);
      void this.router.navigateByUrl(admin ? '/app/admin' : '/app/overview');
    } catch (e) {
      const a = this.t().api;
      const status = e instanceof HttpErrorResponse ? e.status : 0;
      const [field, msg]: ['email' | 'pass', string] =
        status === 401
          ? ['pass', a.authInvalid]
          : status === 409
            ? ['email', a.emailTaken]
            : status === 400
              ? ['pass', a.passwordMin]
              : ['pass', a.serverDown];
      this.serverErr.set({ field, msg, email: this.email(), pass: this.pass() });
    } finally {
      this.busy.set(false);
    }
  }
}

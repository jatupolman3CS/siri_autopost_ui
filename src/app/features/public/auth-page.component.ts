import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PLAN_ORDER, PlanKey, Role } from '../../core/data/models';
import { SessionStore } from '../../core/data/session.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';
import { SelectFieldComponent } from '../../shared/components/select-field/select-field.component';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Log in / create account. No backend auth yet: any valid email signs in, and the role picker
// (labelled as a prototype option, as in the design) decides between shop user and platform admin.
@Component({
  selector: 'app-auth-page',
  imports: [RouterLink, InputFieldComponent, SelectFieldComponent],
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
        @if (isLogin()) {
          <app-select-field
            [label]="t().auth.roleLabel"
            [options]="roleOptions()"
            [(value)]="role"
          />
        }
        <button type="submit" class="su-btn su-btn-md su-btn-primary su-btn-full">
          {{ isLogin() ? t().auth.submit : t().auth.create }}<i class="ph ph-arrow-right"></i>
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
  protected readonly role = signal<string>('user');
  protected readonly submitted = signal(false);

  protected readonly isLogin = computed(() => this.mode() === 'login');
  protected readonly pendingPlan = computed<PlanKey | null>(() => {
    if (this.isLogin()) return null;
    const p = this.plan() as PlanKey | undefined;
    return p && PLAN_ORDER.includes(p) ? p : 'free';
  });
  protected readonly roleOptions = computed(() => [
    { value: 'user', label: this.t().auth.roleUser },
    { value: 'admin', label: this.t().auth.roleAdmin },
  ]);
  protected readonly errEmail = computed(() =>
    this.submitted() && !EMAIL_RE.test(this.email().trim()) ? this.t().auth.errEmail : '',
  );
  protected readonly errPass = computed(() =>
    this.submitted() && !this.pass() ? this.t().auth.errPass : '',
  );

  protected submit(): void {
    this.submitted.set(true);
    if (this.errEmail() || this.errPass()) return;
    const role: Role = this.isLogin() ? (this.role() as Role) : 'user';
    this.session.signIn(role, this.pendingPlan() ?? undefined);
    const t = this.t().auth;
    this.notify.success(role === 'admin' ? t.welcomeAdmin : t.welcomeUser);
    void this.router.navigateByUrl(role === 'admin' ? '/app/admin' : '/app/overview');
  }
}

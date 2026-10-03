import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PLAN_ORDER, PlanKey } from '../../core/data/models';
import { ApiService } from '../../core/http/api.service';
import { SessionStore } from '../../core/data/session.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { InputFieldComponent } from '../../shared/components/input-field/input-field.component';

// Google Identity Services, loaded on demand when the server has a client id.
interface GoogleId {
  initialize(o: {
    client_id: string;
    callback: (r: { credential: string }) => void;
    use_fedcm_for_button?: boolean;
  }): void;
  renderButton(el: HTMLElement, o: Record<string, unknown>): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}
const GSI_SRC = 'https://accounts.google.com/gsi/client';

function loadGsi(): Promise<GoogleId> {
  return new Promise((resolve, reject) => {
    if (window.google) return resolve(window.google.accounts.id);
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.onload = () =>
      window.google ? resolve(window.google.accounts.id) : reject(new Error('gsi'));
    s.onerror = () => reject(new Error('gsi'));
    document.head.appendChild(s);
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Log in / create account against /api/auth. The account's role (shop user or platform admin)
// comes from the server; signing up always creates a shop user on the chosen plan.
@Component({
  selector: 'app-auth-page',
  imports: [RouterLink, InputFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.scss',
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

  private readonly api = inject(ApiService);
  private readonly googleHost = viewChild<ElementRef<HTMLElement>>('google');
  private readonly googleId = signal<string | null>(null);
  protected readonly googleReady = computed(() => this.googleId() !== null);
  private googleDrawn: string | null = null;

  constructor() {
    afterNextRender(async () => {
      try {
        this.googleId.set((await this.api.authConfig()).googleClientId);
      } catch {
        /* no Google button when the config cannot be read */
      }
    });
    effect(() => {
      const host = this.googleHost()?.nativeElement;
      const clientId = this.googleId();
      if (!host || !clientId || this.googleDrawn === clientId + this.mode()) return;
      this.googleDrawn = clientId + this.mode();
      loadGsi()
        .then((gsi) => {
          gsi.initialize({
            client_id: clientId,
            callback: (r) => void this.googleSignIn(r.credential),
            use_fedcm_for_button: true, // personalized "Continue as <name>" button for the Chrome-signed-in account
          });
          host.replaceChildren();
          gsi.renderButton(host, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            logo_alignment: 'right',
            text: this.isLogin() ? 'signin_with' : 'signup_with',
            width: 320,
          });
        })
        .catch(() => (this.googleDrawn = null));
    });
  }

  /** The server has no Google client id (or could not be reached): say so instead of hiding the button. */
  protected googleOff(): void {
    this.notify.error(this.t().auth.googleOff);
  }

  private async googleSignIn(idToken: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const user = await this.session.googleLogIn(idToken, this.pendingPlan());
      const t = this.t().auth;
      const admin = user.role === 'admin';
      this.notify.success(admin ? t.welcomeAdmin : t.welcomeUser);
      void this.router.navigateByUrl(admin ? '/app/admin' : '/app/overview');
    } catch (e) {
      const a = this.t().api;
      this.notify.error(
        e instanceof HttpErrorResponse && e.status === 403 ? a.blocked : this.t().auth.googleFailed,
      );
    } finally {
      this.busy.set(false);
    }
  }

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
          : status === 403
            ? ['email', a.blocked]
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

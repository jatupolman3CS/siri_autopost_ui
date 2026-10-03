import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStore } from '../../../../core/auth/auth.store';
import { AutofocusDirective } from '../../../../shared/directives/autofocus.directive';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, AutofocusDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="form" [formGroup]="form" (ngSubmit)="submit()">
      <div class="field">
        <label for="username">ชื่อผู้ใช้</label>
        <input id="username" formControlName="username" autocomplete="username" appAutofocus />
      </div>
      <div class="field">
        <label for="password">รหัสผ่าน</label>
        <input
          id="password"
          type="password"
          formControlName="password"
          autocomplete="current-password"
        />
      </div>
      <button type="submit" class="btn btn-primary" [disabled]="busy() || form.invalid">
        {{ busy() ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}
      </button>
    </form>
  `,
  styles: `
    .form {
      display: grid;
      gap: var(--space-md);
    }
  `,
})
export class LoginPageComponent {
  // Bound from ?next= by withComponentInputBinding().
  readonly next = input<string>();

  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    this.busy.set(true);
    try {
      await this.auth.login(this.form.getRawValue());
      const next = this.next();
      await this.router.navigateByUrl(next?.startsWith('/') && !next.startsWith('//') ? next : '/');
    } catch {
      // errorInterceptor already showed the reason.
    } finally {
      this.busy.set(false);
    }
  }
}

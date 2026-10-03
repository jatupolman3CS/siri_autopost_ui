import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// Plain centered page for sign-in screens: no sidebar, no header.
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="auth">
      <div class="card">
        <h1>SIRI.AUTOPOST</h1>
        <router-outlet />
      </div>
    </main>
  `,
  styles: `
    .auth {
      display: grid;
      place-items: center;
      min-height: 100vh;
      padding: var(--space-md);
    }
    .card {
      width: min(400px, 100%);
      padding: var(--space-lg);
    }
    h1 {
      margin: 0 0 var(--space-lg);
      font-size: var(--text-2xl);
      color: var(--color-primary);
    }
  `,
})
export class AuthLayoutComponent {}

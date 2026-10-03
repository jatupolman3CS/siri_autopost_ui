import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { LangThemeSwitchComponent } from '../lang-theme-switch.component';

// Sticky header for the landing, login and signup pages.
@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, RouterLink, LangThemeSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <div class="inner">
        <a class="brand" routerLink="/">
          <i class="ph-fill ph-paper-plane-tilt"></i><span>AutoPost</span>
        </a>
        <nav>
          @if (isLanding()) {
            <button type="button" class="navlink" (click)="scrollTo('ap-features')">
              {{ t().land.navFeatures }}
            </button>
            <button type="button" class="navlink" (click)="scrollTo('ap-pricing')">
              {{ t().land.navPricing }}
            </button>
          }
          <div class="switch"><app-lang-theme-switch /></div>
          <a class="su-btn su-btn-sm su-btn-ghost" routerLink="/login">{{ t().land.login }}</a>
          <a
            class="su-btn su-btn-sm su-btn-primary"
            routerLink="/signup"
            [queryParams]="{ plan: 'free' }"
            >{{ t().land.trial }}</a
          >
        </nav>
      </div>
    </header>
    <router-outlet />
  `,
  styles: `
    .header {
      position: sticky;
      top: 0;
      z-index: 30;
      height: 64px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-bg);
    }
    .inner {
      margin: 0 auto;
      max-width: 72rem;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 0 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      color: var(--color-primary);
      i {
        font-size: 22px;
      }
      span {
        font-size: 18px;
        font-weight: 700;
      }
    }
    nav {
      display: flex;
      align-items: center;
      gap: 4px;
      justify-content: flex-end;
    }
    .navlink {
      height: 44px;
      padding: 0 12px;
      border: none;
      background: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text);
      transition: color 0.2s ease-out;
      &:hover {
        color: var(--color-primary);
      }
    }
    .switch {
      display: flex;
      align-items: center;
      margin-left: 8px;
    }
    @media (max-width: 1023px) {
      .navlink {
        display: none;
      }
    }
    @media (max-width: 560px) {
      .switch,
      .su-btn-ghost {
        display: none;
      }
    }
  `,
})
export class PublicLayoutComponent {
  private readonly router = inject(Router);
  protected readonly t = inject(I18nService).t;
  protected readonly isLanding = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url.split('?')[0] === '/'),
    ),
    { initialValue: this.router.url.split('?')[0] === '/' },
  );

  protected scrollTo(id: string): void {
    const el = document.getElementById(id);
    if (el)
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 72,
        behavior: 'smooth',
      });
  }
}

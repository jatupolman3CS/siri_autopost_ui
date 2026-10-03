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
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss',
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

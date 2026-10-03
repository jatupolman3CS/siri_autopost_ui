import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ExtensionStore } from '../../core/data/extension.store';
import { PostsStore } from '../../core/data/posts.store';
import { SessionStore } from '../../core/data/session.store';
import { SettingsStore } from '../../core/data/settings.store';
import { TeamStore } from '../../core/data/team.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { LangThemeSwitchComponent } from '../lang-theme-switch.component';

interface NavItem {
  path: string;
  key: string;
  icon: string;
  exact: boolean;
  badge?: number;
}

// Signed-in shell: collapsible sidebar, top bar (workspace, extension status, language, theme,
// account) and the offline banner shown above every page while the extension is disconnected.
@Component({
  selector: 'app-app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LangThemeSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss',
})
export class AppLayoutComponent {
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  protected readonly session = inject(SessionStore);
  protected readonly team = inject(TeamStore);
  protected readonly ext = inject(ExtensionStore);
  private readonly posts = inject(PostsStore);
  private readonly settings = inject(SettingsStore);

  protected readonly wsMenu = signal(false);

  protected readonly navGroups = computed(() => {
    const t = this.t().nav;
    const item = (
      path: string,
      key: keyof typeof t,
      icon: string,
      badge?: number,
      exact = true,
    ): NavItem => ({
      path: '/app/' + path,
      key,
      icon,
      exact,
      badge,
    });
    const groups = [
      {
        label: t.gWorkspace,
        items: [
          item('overview', 'overview', 'ph-squares-four'),
          item('calendar', 'calendar', 'ph-calendar-blank'),
          item('composer', 'composer', 'ph-pencil-simple-line'),
          item('library', 'library', 'ph-images'),
        ],
      },
      {
        label: t.gEngine,
        items: [
          item('antiban', 'antiban', 'ph-shield-check'),
          item('offline', 'offline', 'ph-wifi-slash'),
          item('errors', 'errors', 'ph-warning-circle', this.posts.openErrors().length),
        ],
      },
      {
        label: t.gAccount,
        items: [
          item('billing', 'billing', 'ph-credit-card'),
          item('team', 'team', 'ph-users-three'),
        ],
      },
    ];
    if (this.session.isAdmin()) {
      groups.push({
        label: t.gOwner,
        items: [
          item('admin', 'admin', 'ph-chart-line-up'),
          item('admin/customers', 'adminCustomers', 'ph-users', undefined, false),
          item('admin/finance', 'adminFinance', 'ph-coins'),
          item('admin/plans', 'adminPlans', 'ph-tag'),
          item('admin/jobs', 'adminJobs', 'ph-pulse'),
        ],
      });
    }
    groups.push({ label: t.gPreview, items: [item('extension', 'extension', 'ph-puzzle-piece')] });
    return groups;
  });

  protected readonly planName = computed(() => this.t().plans[this.session.plan()].name);
  protected readonly bannerBody = computed(() =>
    fmt(this.t().top.bannerBody, {
      n: this.posts.waiting().length,
      policy: this.t().off[this.settings.off().policy],
    }),
  );

  protected label(key: string): string {
    return (this.t().nav as Record<string, string>)[key];
  }

  protected switchWs(id: string): void {
    const ws = this.team.switchTo(id);
    this.wsMenu.set(false);
    if (ws) this.notify.info(fmt(this.t().team.switched, { ws: ws.name }));
  }

  protected logout(): void {
    this.session.signOut();
    this.notify.info(this.t().auth.loggedOut);
    void this.router.navigateByUrl('/');
  }
}

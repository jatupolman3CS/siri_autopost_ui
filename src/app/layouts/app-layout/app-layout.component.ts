import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { ExtensionStore } from '../../core/data/extension.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { PostsStore } from '../../core/data/posts.store';
import { SessionStore } from '../../core/data/session.store';
import { SettingsStore } from '../../core/data/settings.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { hm } from '../../core/i18n/format';
import { Dict, I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { UiPrefsService } from '../../core/services/ui-prefs.service';
import { LangThemeSwitchComponent } from '../lang-theme-switch.component';

interface NavItem {
  path: string;
  icon: string;
  label: string;
  /** Active on this path only (false: also on the pages below it, like a customer's detail page). */
  exact: boolean;
  /** Further paths (and the pages below them) on which the item also shows as the current one. */
  also?: readonly string[];
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/** True when `path` is `base` or a page below it. */
const under = (path: string, base: string) => path === base || path.startsWith(base + '/');

// Signed-in shell: collapsible sidebar, top bar (workspace, extension status, language, theme,
// account), the assist banner while a platform admin sees the app as a customer, and the offline
// banner shown above every page while the extension is disconnected. The sidebar has two forms: the
// full menu, and "simple mode" (default, see UiPrefsService), which keeps only the three-step flow.
@Component({
  selector: 'app-app-layout',
  imports: [RouterOutlet, RouterLink, LangThemeSwitchComponent],
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
  protected readonly workspaces = inject(WorkspaceStore);
  protected readonly ext = inject(ExtensionStore);
  protected readonly perm = inject(PermissionsService);
  private readonly posts = inject(PostsStore);
  private readonly settings = inject(SettingsStore);
  protected readonly prefs = inject(UiPrefsService);

  protected readonly wsMenu = signal(false);

  /** The page path being shown (no query or fragment), to mark the sidebar item of the current page. */
  private readonly path = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split(/[?#]/)[0]),
    ),
    { initialValue: this.router.url.split(/[?#]/)[0] },
  );

  protected readonly navGroups = computed((): NavGroup[] => {
    const t = this.t().nav;
    const simple = this.prefs.simple();
    const item = (
      path: string,
      key: keyof Dict['nav'],
      icon: string,
      opts: Partial<Pick<NavItem, 'label' | 'badge' | 'exact' | 'also'>> = {},
    ): NavItem => ({
      path: '/app/' + path,
      icon,
      label: opts.label ?? t[key],
      exact: opts.exact ?? true,
      also: opts.also,
      badge: opts.badge,
    });
    const errors = item('errors', 'errors', 'ph-warning-circle', {
      badge: this.posts.openErrors().length,
    });
    const account: NavGroup = {
      label: t.gAccount,
      items: [item('billing', 'billing', 'ph-credit-card'), item('team', 'team', 'ph-users-three')],
    };
    const owner: NavGroup[] = this.session.isAdmin()
      ? [
          {
            label: t.gOwner,
            items: [
              item('admin', 'admin', 'ph-chart-line-up'),
              item('admin/customers', 'adminCustomers', 'ph-users', { exact: false }),
              item('admin/finance', 'adminFinance', 'ph-coins'),
              item('admin/plans', 'adminPlans', 'ph-tag'),
              item('admin/jobs', 'adminJobs', 'ph-pulse'),
              item('admin/payment-test', 'adminJobs', 'ph-flask', { label: this.t().api.ptestNav }),
            ],
          },
        ]
      : [];
    // The post library comes first and holds the post editor (a panel above its list), so writing a post is
    // not a menu item of its own (`/app/composer` redirects here).
    const posts = item('posts', 'composer', 'ph-note-pencil', { label: this.t().api.postsNav });
    // Every post of the day on one board, by the minute (the label comes from the api texts like the library's).
    const timeline = item('timeline', 'calendar', 'ph-chart-line', { label: this.t().api.tlNav });
    if (simple)
      return [
        {
          label: t.gWorkspace,
          items: [
            item('overview', 'overview', 'ph-squares-four'),
            posts,
            item('collections', 'collections', 'ph-folders'),
            item('targets', 'targets', 'ph-users-four'),
            item('schedules', 'schedules', 'ph-calendar-check'),
            item('calendar', 'calendar', 'ph-calendar-blank'),
            timeline,
            errors,
          ],
        },
        account,
        ...owner,
      ];
    return [
      {
        label: t.gWorkspace,
        items: [
          item('overview', 'overview', 'ph-squares-four'),
          posts,
          item('collections', 'collections', 'ph-folders'),
          item('targets', 'targets', 'ph-users-four'),
          item('schedules', 'schedules', 'ph-calendar-check'),
          item('calendar', 'calendar', 'ph-calendar-blank'),
          timeline,
          item('library', 'library', 'ph-images'),
          item('reports', 'reports', 'ph-chart-bar'),
        ],
      },
      {
        label: t.gEngine,
        items: [
          item('test', 'test', 'ph-flask'),
          item('antiban', 'antiban', 'ph-shield-check'),
          item('notify', 'notify', 'ph-bell'),
          item('engage', 'engage', 'ph-chats-circle'),
          item('offline', 'offline', 'ph-wifi-slash'),
          errors,
        ],
      },
      account,
      ...owner,
    ];
  });

  /**
   * What the top bar says about the browsers: one dot and label for a single extension, "n/m extensions online" with
   * several (green: all of them, amber: some, red: none). A simulated outage always reads as offline.
   */
  protected readonly extStatus = computed(() => {
    const t = this.t();
    const total = this.settings.devices();
    const online = this.settings.devicesOnline();
    const many = total > 1 && !this.ext.simulated();
    const color = !this.ext.online()
      ? 'var(--color-danger)'
      : many && online < total
        ? 'var(--color-warning)'
        : 'var(--color-success)';
    const label = many
      ? fmt(t.api.extCount, { n: online, m: total })
      : this.ext.online()
        ? t.top.extOnline
        : t.top.extOffline;
    return { color, label, title: many ? t.api.extCountHint : label };
  });

  protected readonly simpleLabel = computed(() =>
    this.prefs.simple() ? this.t().nav.moreMenu : this.t().nav.lessMenu,
  );

  /** The sidebar item of the page being shown. */
  protected isOn(it: NavItem): boolean {
    const path = this.path();
    return (
      (it.exact ? path === it.path : under(path, it.path)) ||
      (it.also ?? []).some((p) => under(path, p))
    );
  }

  protected readonly planName = computed(() => this.t().plans[this.session.plan()].name);
  protected readonly bannerTitle = computed(() => {
    const since = this.ext.offlineSince();
    return since ? fmt(this.t().api.offlineSince, { t: hm(since) }) : this.t().top.extOffline;
  });
  protected readonly bannerBody = computed(() =>
    fmt(this.t().top.bannerBody, {
      n: this.posts.waiting().length,
      policy: this.t().off[this.settings.off().policy],
    }),
  );

  protected switchWs(id: string): void {
    const ws = this.workspaces.switchTo(id);
    this.wsMenu.set(false);
    if (ws) this.notify.info(fmt(this.t().team.switched, { ws: ws.name }));
  }

  protected readonly assistTitle = computed(() => {
    const a = this.session.assist();
    return a ? fmt(this.t().api.assistTitle, { e: a.email, t: hm(new Date(a.expiresAt)) }) : '';
  });

  /** Ends an admin's assist session and goes back to that customer's admin page. */
  protected async endAssist(): Promise<void> {
    const id = await this.session.endAssist();
    void this.router.navigateByUrl(id ? `/app/admin/customers/${id}` : '/app/admin');
  }

  protected logout(): void {
    this.session.signOut();
    this.notify.info(this.t().auth.loggedOut);
    void this.router.navigateByUrl('/');
  }
}

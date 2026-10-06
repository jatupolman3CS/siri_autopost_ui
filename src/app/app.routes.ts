import { Routes } from '@angular/router';
import { adminGuard, guestGuard, signedInGuard } from './core/auth/guards';
import { composerRedirect } from './features/posts/posts-link';
import { AppLayoutComponent } from './layouts/app-layout/app-layout.component';
import { PublicLayoutComponent } from './layouts/public-layout/public-layout.component';

// A route's `title` is the dotted path of its text in the dictionary (see DictionaryTitleStrategy).
// Public pages for guests; everything under /app needs a signed-in user,
// and /app/admin the platform-admin role. Every page is lazy loaded.
export const routes: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    canActivate: [guestGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/public/landing-page.component').then((m) => m.LandingPageComponent),
      },
      {
        path: 'login',
        title: 'auth.title',
        data: { mode: 'login' },
        loadComponent: () =>
          import('./features/public/auth-page.component').then((m) => m.AuthPageComponent),
      },
      {
        path: 'signup',
        title: 'auth.signupTitle',
        data: { mode: 'signup' },
        loadComponent: () =>
          import('./features/public/auth-page.component').then((m) => m.AuthPageComponent),
      },
    ],
  },
  {
    path: 'app',
    component: AppLayoutComponent,
    canActivate: [signedInGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        title: 'nav.overview',
        loadComponent: () =>
          import('./features/overview/overview-page.component').then(
            (m) => m.OverviewPageComponent,
          ),
      },
      {
        path: 'calendar',
        title: 'nav.calendar',
        loadComponent: () =>
          import('./features/calendar/calendar-page.component').then(
            (m) => m.CalendarPageComponent,
          ),
      },
      // The post editor is a panel of the post library now; old links to the composer still work.
      { path: 'composer', redirectTo: composerRedirect },
      {
        path: 'posts',
        title: 'api.postsNav',
        loadComponent: () =>
          import('./features/posts/posts-page.component').then((m) => m.PostsPageComponent),
      },
      {
        path: 'collections',
        title: 'nav.collections',
        loadComponent: () =>
          import('./features/collections/collections-page.component').then(
            (m) => m.CollectionsPageComponent,
          ),
      },
      {
        path: 'targets',
        title: 'nav.targets',
        loadComponent: () =>
          import('./features/targets/targets-page.component').then((m) => m.TargetsPageComponent),
      },
      {
        path: 'schedules',
        title: 'nav.schedules',
        loadComponent: () =>
          import('./features/schedules/schedules-page.component').then(
            (m) => m.SchedulesPageComponent,
          ),
      },
      {
        path: 'library',
        title: 'nav.library',
        loadComponent: () =>
          import('./features/library/library-page.component').then((m) => m.LibraryPageComponent),
      },
      {
        path: 'reports',
        title: 'nav.reports',
        loadComponent: () =>
          import('./features/reports/reports-page.component').then((m) => m.ReportsPageComponent),
      },
      {
        path: 'test',
        title: 'nav.test',
        loadComponent: () =>
          import('./features/test/test-page.component').then((m) => m.TestPageComponent),
      },
      {
        path: 'notify',
        title: 'nav.notify',
        loadComponent: () =>
          import('./features/notify/notify-page.component').then((m) => m.NotifyPageComponent),
      },
      {
        path: 'engage',
        title: 'nav.engage',
        loadComponent: () =>
          import('./features/engage/engage-page.component').then((m) => m.EngagePageComponent),
      },
      // The extension's own settings page is gone (its useful settings live on the anti-ban page). Extensions of
      // older versions still open this address after pairing, so it goes to the anti-ban page.
      { path: 'campaigns', redirectTo: 'antiban' },
      { path: 'extension', redirectTo: 'team' },
      {
        path: 'antiban',
        title: 'nav.antiban',
        loadComponent: () =>
          import('./features/antiban/antiban-page.component').then((m) => m.AntibanPageComponent),
      },
      {
        path: 'offline',
        title: 'nav.offline',
        loadComponent: () =>
          import('./features/offline/offline-page.component').then((m) => m.OfflinePageComponent),
      },
      {
        path: 'errors',
        title: 'nav.errors',
        loadComponent: () =>
          import('./features/errors/errors-page.component').then((m) => m.ErrorsPageComponent),
      },
      {
        path: 'billing',
        title: 'nav.billing',
        loadComponent: () =>
          import('./features/billing/billing-page.component').then((m) => m.BillingPageComponent),
      },
      {
        path: 'team',
        title: 'nav.team',
        loadComponent: () =>
          import('./features/team/team-page.component').then((m) => m.TeamPageComponent),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
    ],
  },
  {
    // Opened by "Connect this Chrome"; the extension takes the tab over (no guard: it never needs one).
    path: 'connect-extension',
    title: 'api.pairTitle',
    loadComponent: () =>
      import('./features/public/connect-extension-page.component').then(
        (m) => m.ConnectExtensionPageComponent,
      ),
  },
  {
    // A client report shared by link (Agency plan): no layout and no guard, the token is the key.
    path: 'report/:token',
    title: 'api.reportTitle',
    loadComponent: () =>
      import('./features/public/shared-report-page.component').then(
        (m) => m.SharedReportPageComponent,
      ),
  },
  { path: '**', redirectTo: '' },
];

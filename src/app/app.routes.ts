import { Routes } from '@angular/router';
import { adminGuard, guestGuard, signedInGuard } from './core/auth/guards';
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
      {
        path: 'composer',
        title: 'nav.composer',
        loadComponent: () =>
          import('./features/composer/composer-page.component').then(
            (m) => m.ComposerPageComponent,
          ),
      },
      {
        path: 'library',
        title: 'nav.library',
        loadComponent: () =>
          import('./features/library/library-page.component').then((m) => m.LibraryPageComponent),
      },
      {
        path: 'campaigns',
        title: 'api.extNav',
        loadComponent: () =>
          import('./features/campaigns/campaigns-page.component').then(
            (m) => m.CampaignsPageComponent,
          ),
      },
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
        path: 'extension',
        title: 'nav.extension',
        loadComponent: () =>
          import('./features/extension/extension-page.component').then(
            (m) => m.ExtensionPageComponent,
          ),
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
  { path: '**', redirectTo: '' },
];

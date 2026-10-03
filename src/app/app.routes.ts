import { Routes } from '@angular/router';
import { adminGuard, guestGuard, signedInGuard } from './core/auth/guards';
import { AppLayoutComponent } from './layouts/app-layout/app-layout.component';
import { PublicLayoutComponent } from './layouts/public-layout/public-layout.component';

const page = (title: string) => `${title} · AutoPost`;

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
        title: 'AutoPost',
        loadComponent: () =>
          import('./features/public/landing-page.component').then((m) => m.LandingPageComponent),
      },
      {
        path: 'login',
        title: page('Log in'),
        data: { mode: 'login' },
        loadComponent: () =>
          import('./features/public/auth-page.component').then((m) => m.AuthPageComponent),
      },
      {
        path: 'signup',
        title: page('Sign up'),
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
        title: page('Overview'),
        loadComponent: () =>
          import('./features/overview/overview-page.component').then(
            (m) => m.OverviewPageComponent,
          ),
      },
      {
        path: 'calendar',
        title: page('Calendar'),
        loadComponent: () =>
          import('./features/calendar/calendar-page.component').then(
            (m) => m.CalendarPageComponent,
          ),
      },
      {
        path: 'composer',
        title: page('Write post'),
        loadComponent: () =>
          import('./features/composer/composer-page.component').then(
            (m) => m.ComposerPageComponent,
          ),
      },
      {
        path: 'library',
        title: page('Library'),
        loadComponent: () =>
          import('./features/library/library-page.component').then((m) => m.LibraryPageComponent),
      },
      {
        path: 'campaigns',
        title: page('Campaigns'),
        loadComponent: () =>
          import('./features/campaigns/campaigns-page.component').then(
            (m) => m.CampaignsPageComponent,
          ),
      },
      {
        path: 'antiban',
        title: page('Account safety'),
        loadComponent: () =>
          import('./features/antiban/antiban-page.component').then((m) => m.AntibanPageComponent),
      },
      {
        path: 'offline',
        title: page('Offline handling'),
        loadComponent: () =>
          import('./features/offline/offline-page.component').then((m) => m.OfflinePageComponent),
      },
      {
        path: 'errors',
        title: page('Error reports'),
        loadComponent: () =>
          import('./features/errors/errors-page.component').then((m) => m.ErrorsPageComponent),
      },
      {
        path: 'billing',
        title: page('Plans & billing'),
        loadComponent: () =>
          import('./features/billing/billing-page.component').then((m) => m.BillingPageComponent),
      },
      {
        path: 'team',
        title: page('Team & workspaces'),
        loadComponent: () =>
          import('./features/team/team-page.component').then((m) => m.TeamPageComponent),
      },
      {
        path: 'extension',
        title: page('Extension popup'),
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
    title: page('Connect'),
    loadComponent: () =>
      import('./features/public/connect-extension-page.component').then(
        (m) => m.ConnectExtensionPageComponent,
      ),
  },
  { path: '**', redirectTo: '' },
];

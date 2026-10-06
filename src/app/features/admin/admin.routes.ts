import { inject } from '@angular/core';
import { CanActivateChildFn, Routes } from '@angular/router';
import { AdminStore } from '../../core/data/admin.store';
import { AdminViewService } from './admin-view.service';

/**
 * Every admin page that is entered reads the data again (an environment initializer would run once per
 * page load). The route does not wait for it: the pages show "—" until `AdminStore.loaded` and then fill in.
 */
export const loadAdminData: CanActivateChildFn = () => {
  void inject(AdminStore).load();
  return true;
};

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    providers: [AdminViewService],
    canActivateChild: [loadAdminData],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'nav.admin',
        loadComponent: () =>
          import('./admin-overview-page.component').then((m) => m.AdminOverviewPageComponent),
      },
      {
        path: 'customers',
        title: 'nav.adminCustomers',
        loadComponent: () =>
          import('./customers-page.component').then((m) => m.CustomersPageComponent),
      },
      {
        path: 'customers/:id',
        title: 'adm.customer',
        loadComponent: () =>
          import('./customer-detail-page.component').then((m) => m.CustomerDetailPageComponent),
      },
      {
        path: 'finance',
        title: 'nav.adminFinance',
        loadComponent: () => import('./finance-page.component').then((m) => m.FinancePageComponent),
      },
      {
        path: 'plans',
        title: 'nav.adminPlans',
        loadComponent: () => import('./plans-page.component').then((m) => m.PlansPageComponent),
      },
      {
        path: 'jobs',
        title: 'nav.adminJobs',
        loadComponent: () => import('./jobs-page.component').then((m) => m.JobsPageComponent),
      },
      {
        path: 'payment-test',
        title: 'api.ptestNav',
        loadComponent: () =>
          import('./payment-test-page.component').then((m) => m.PaymentTestPageComponent),
      },
    ],
  },
];

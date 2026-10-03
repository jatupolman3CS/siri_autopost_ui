import { inject, provideEnvironmentInitializer } from '@angular/core';
import { Routes } from '@angular/router';
import { AdminStore } from '../../core/data/admin.store';
import { AdminViewService } from './admin-view.service';

const page = (title: string) => `${title} · AutoPost`;

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    providers: [
      AdminViewService,
      // Entering the admin area (any page) loads its data.
      provideEnvironmentInitializer(() => void inject(AdminStore).load()),
    ],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: page('Platform overview'),
        loadComponent: () =>
          import('./admin-overview-page.component').then((m) => m.AdminOverviewPageComponent),
      },
      {
        path: 'customers',
        title: page('Customers'),
        loadComponent: () =>
          import('./customers-page.component').then((m) => m.CustomersPageComponent),
      },
      {
        path: 'customers/:id',
        title: page('Customer'),
        loadComponent: () =>
          import('./customer-detail-page.component').then((m) => m.CustomerDetailPageComponent),
      },
      {
        path: 'finance',
        title: page('Finance'),
        loadComponent: () => import('./finance-page.component').then((m) => m.FinancePageComponent),
      },
      {
        path: 'plans',
        title: page('Plans & promo codes'),
        loadComponent: () => import('./plans-page.component').then((m) => m.PlansPageComponent),
      },
      {
        path: 'jobs',
        title: page('Running jobs'),
        loadComponent: () => import('./jobs-page.component').then((m) => m.JobsPageComponent),
      },
    ],
  },
];

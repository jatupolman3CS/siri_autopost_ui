import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AdminStore } from './core/data/admin.store';
import { SessionStore } from './core/data/session.store';
import { errorInterceptor } from './core/http/error.interceptor';

// Zoneless: Angular 22 apps run without zone.js by default (no zone.js in package.json),
// so change detection is driven by signals, events and the async pipe.
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
    // The guards need to know who is signed in before the first navigation.
    provideAppInitializer(async () => {
      // Plan prices and limits come from the server: nothing renders with placeholder values.
      await Promise.all([inject(AdminStore).loadPlans(), inject(SessionStore).restore()]);
    }),
  ],
};

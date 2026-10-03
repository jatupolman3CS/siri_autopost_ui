import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AdminStore } from './core/data/admin.store';
import { SessionStore } from './core/data/session.store';
import { errorInterceptor } from './core/http/error.interceptor';
import { DictionaryTitleStrategy } from './core/services/title.strategy';

// Zoneless: Angular 22 apps run without zone.js by default (no zone.js in package.json),
// so change detection is driven by signals, events and the async pipe.
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: TitleStrategy, useClass: DictionaryTitleStrategy },
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
    // The guards need to know who is signed in before the first navigation.
    provideAppInitializer(() => {
      // Plan prices and limits from the server; the pages show the design's values until then.
      void inject(AdminStore).loadPlans();
      return inject(SessionStore).restore();
    }),
  ],
};

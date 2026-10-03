import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { authTokenInterceptor } from './core/http/auth-token.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';

// Zoneless: Angular 22 apps run without zone.js by default (no zone.js in package.json),
// so change detection is driven by signals, events and the async pipe.
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authTokenInterceptor, errorInterceptor])),
  ],
};

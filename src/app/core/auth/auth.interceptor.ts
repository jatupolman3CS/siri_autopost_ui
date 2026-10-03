import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionStore } from '../data/session.store';
import { tokenStorage } from './token';

// Sends the bearer token with every API call. A 401 means the token expired or was revoked,
// so the user goes back to the login page (or, after an admin's assist session, to the admin pages). Login, signup and the start-up session check
// (/api/auth/me, see SessionStore.restore) handle their own 401s.
const SELF_HANDLED = ['/api/auth/login', '/api/auth/signup', '/api/auth/me'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const injector = inject(Injector);
  const token = tokenStorage.get();
  const authed =
    token && req.url.startsWith('/api/')
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;
  return next(authed).pipe(
    catchError((err: unknown) => {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        token &&
        !SELF_HANDLED.includes(req.url)
      ) {
        const session = injector.get(SessionStore);
        // An assist token ran out: go back to being the admin.
        if (session.assist())
          void session
            .endAssist()
            .then((id) => router.navigateByUrl(id ? `/app/admin/customers/${id}` : '/login'));
        else {
          session.signOut();
          void router.navigateByUrl('/login');
        }
      }
      return throwError(() => err);
    }),
  );
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from '../data/session.store';

/**
 * App pages need a signed-in user. A guest is sent to the login page with the address they wanted
 * (`returnUrl`), so a link into the app (a deep link, the return from Stripe Checkout) survives signing in.
 */
export const signedInGuard: CanActivateFn = (_route, state) =>
  !inject(SessionStore).isGuest() ||
  inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

/** Where to go after signing in: the address that was asked for, if it is a page of the app (never another site). */
export function safeReturnUrl(url: string | null | undefined): string | null {
  return url && /^\/app(\/|\?|#|$)/.test(url) ? url : null;
}

/** Platform-owner pages need the admin role. */
export const adminGuard: CanActivateFn = () =>
  inject(SessionStore).isAdmin() || inject(Router).createUrlTree(['/app/overview']);

/** The landing and login pages are for guests; signed-in users go to their home screen. */
export const guestGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  if (session.isGuest()) return true;
  return inject(Router).createUrlTree([session.isAdmin() ? '/app/admin' : '/app/overview']);
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from '../data/session.store';

/** App pages need a signed-in user. */
export const signedInGuard: CanActivateFn = () =>
  !inject(SessionStore).isGuest() || inject(Router).createUrlTree(['/login']);

/** Platform-owner pages need the admin role. */
export const adminGuard: CanActivateFn = () =>
  inject(SessionStore).isAdmin() || inject(Router).createUrlTree(['/app/overview']);

/** The landing and login pages are for guests; signed-in users go to their home screen. */
export const guestGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  if (session.isGuest()) return true;
  return inject(Router).createUrlTree([session.isAdmin() ? '/app/admin' : '/app/overview']);
};

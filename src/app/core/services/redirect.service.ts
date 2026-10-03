import { Injectable } from '@angular/core';

/** Leaves the app for another address (Stripe Checkout, the billing portal). A service so specs can replace it. */
@Injectable({ providedIn: 'root' })
export class RedirectService {
  go(url: string): void {
    window.location.assign(url);
  }
}

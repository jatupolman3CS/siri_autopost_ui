import { Injectable } from '@angular/core';

const KEY = 'siri-autopost.token';

// Keeps the access token between visits. Swap for an HttpOnly cookie if the API moves to cookie auth.
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  get(): string | null {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  }

  set(token: string): void {
    try {
      localStorage.setItem(KEY, token);
    } catch {
      // Ignore: the session just won't survive a reload.
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Ignore.
    }
  }
}

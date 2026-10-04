import { Injectable, signal } from '@angular/core';

export const SIMPLE_KEY = 'ap-simple';

// Per-browser interface preferences. `simple` is "simple mode": on by default, it keeps the sidebar to the
// three-step flow (posts, groups, schedules, calendar) and hides the advanced controls of the pages behind
// their "more options" toggles. The choice lives in this browser only (localStorage `ap-simple`), not in
// the account, so a shared workspace can be seen simply by one person and fully by another.
@Injectable({ providedIn: 'root' })
export class UiPrefsService {
  /** Simple mode: true until the person turns it off. */
  readonly simple = signal(readSimple());

  set(simple: boolean): void {
    this.simple.set(simple);
    try {
      localStorage.setItem(SIMPLE_KEY, simple ? '1' : '0');
    } catch {
      // Storage blocked: the choice lasts for this visit only.
    }
  }

  toggleSimple(): void {
    this.set(!this.simple());
  }
}

function readSimple(): boolean {
  try {
    return localStorage.getItem(SIMPLE_KEY) !== '0';
  } catch {
    return true;
  }
}

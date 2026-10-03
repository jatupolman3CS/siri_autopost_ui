import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'siri-autopost.theme';

// Light/dark theme. 'system' follows the OS; the others set <html data-theme> (see styles/_tokens.scss).
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly mode = signal<ThemeMode>(readStored());

  constructor() {
    effect(() => {
      const mode = this.mode();
      const root = this.document.documentElement;
      if (mode === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', mode);
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // Storage can be blocked (private mode); the theme still applies for this visit.
      }
    });
  }

  toggle(): void {
    const dark =
      this.mode() === 'dark' ||
      (this.mode() === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    this.mode.set(dark ? 'light' : 'dark');
  }
}

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

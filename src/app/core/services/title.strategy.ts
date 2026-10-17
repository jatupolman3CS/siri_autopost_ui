import { Injectable, effect, inject, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { I18nService } from '../i18n/i18n.service';
import { SeoService } from './seo.service';

const BRAND = 'AutoPost';

/** The text at a dotted path of the dictionary ("nav.overview"), or null. */
export function lookup(dict: unknown, path: string): string | null {
  let node = dict;
  for (const key of path.split('.')) {
    if (typeof node !== 'object' || node === null) return null;
    node = (node as Record<string, unknown>)[key];
  }
  return typeof node === 'string' ? node : null;
}

// Page titles come from the dictionary: a route's `title` is the dotted path of its text ("nav.overview"),
// so the tab follows the language switch like the rest of the app. A route without one gets an optimized SEO title.
@Injectable({ providedIn: 'root' })
export class DictionaryTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);
  private readonly seo = inject(SeoService);
  private path: string | undefined;
  private lastUrl = '/';

  constructor() {
    super();
    effect(() => {
      this.i18n.t();
      untracked(() => this.apply());
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.path = this.buildTitle(snapshot);
    this.lastUrl = snapshot.url;
    this.apply();
  }

  private apply(): void {
    const text = this.path ? lookup(this.i18n.t(), this.path) : null;
    const pageTitle = text ? `${text} · ${BRAND}` : this.seo.getDefaultTitle(this.i18n.lang());
    this.title.setTitle(pageTitle);
    this.seo.updateMeta(pageTitle, text, this.lastUrl);
  }
}

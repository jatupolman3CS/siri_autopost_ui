import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { I18nService, Lang } from '../i18n/i18n.service';

export const SITE_URL = 'https://siriautopost.siristudiophoto.com';
export const BRAND = 'AutoPost';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly i18n = inject(I18nService);

  /** Returns optimized title for the landing/root page according to language. */
  getDefaultTitle(lang: Lang): string {
    const t = this.i18n.t();
    return `${BRAND} - ${t.land.heroTitle}`;
  }

  /** Updates metadata (meta description, Open Graph, Twitter cards, canonical) according to page and language. */
  updateMeta(pageTitle: string, routeText: string | null, currentUrl = '/'): void {
    const t = this.i18n.t();
    const isThai = this.i18n.lang() === 'th';
    const cleanUrl = currentUrl.split('?')[0].split('#')[0] || '/';

    const description =
      cleanUrl === '/' || !routeText
        ? `${BRAND} ${t.land.heroBody}`
        : `${pageTitle} · ${t.land.platforms}`;

    // Meta Description
    this.meta.updateTag({ name: 'description', content: description });

    // Open Graph
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({
      property: 'og:url',
      content: `${SITE_URL}${cleanUrl === '/' ? '/' : cleanUrl}`,
    });
    this.meta.updateTag({ property: 'og:locale', content: isThai ? 'th_TH' : 'en_US' });

    // Twitter Card
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });

    // Canonical link
    this.setCanonicalUrl(`${SITE_URL}${cleanUrl === '/' ? '/' : cleanUrl}`);
  }

  private setCanonicalUrl(url: string): void {
    try {
      let link: HTMLLinkElement | null = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', url);
    } catch {
      // In non-DOM or test environment, ignore
    }
  }
}

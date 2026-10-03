import { Injectable, computed, signal } from '@angular/core';
import { AP_I18N } from './i18n.data';

export type Lang = 'th' | 'en';

// Turns the [th, en] leaves of AP_I18N into plain strings for one language.
type Picked<T> = T extends readonly [string, string]
  ? string
  : T extends readonly (infer U)[]
    ? readonly Picked<U>[]
    : { readonly [K in keyof T]: Picked<T[K]> };

export type Dict = Picked<typeof AP_I18N>;

const STORAGE_KEY = 'ap-lang';

function pick(node: unknown, i: number): unknown {
  if (Array.isArray(node))
    return typeof node[0] === 'string' ? node[i] : node.map((n) => pick(n, i));
  return Object.fromEntries(
    Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, pick(v, i)]),
  );
}

// Runtime TH/EN switch. Templates read i18n.t().section.key.
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly cache = new Map<Lang, Dict>();
  readonly lang = signal<Lang>(readStored());
  /** 0 = Thai, 1 = English: the index into [th, en] pairs. */
  readonly li = computed(() => (this.lang() === 'th' ? 0 : 1));
  readonly t = computed(() => this.dict(this.lang()));

  setLang(lang: Lang): void {
    this.lang.set(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Storage blocked: the choice lasts for this visit only.
    }
    document.documentElement.lang = lang;
  }

  /** Picks the current language from a [th, en] pair. */
  l(pair: readonly [string, string]): string {
    return pair[this.li()];
  }

  private dict(lang: Lang): Dict {
    let d = this.cache.get(lang);
    if (!d) {
      d = pick(AP_I18N, lang === 'th' ? 0 : 1) as Dict;
      this.cache.set(lang, d);
    }
    return d;
  }
}

/** "{n} posts" + { n: 3 } -> "3 posts". Unknown keys stay as they are. */
export function fmt(str: string, vars: Record<string, string | number>): string {
  return str.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] !== undefined ? String(vars[k]) : m));
}

function readStored(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'th';
  } catch {
    return 'th';
  }
}

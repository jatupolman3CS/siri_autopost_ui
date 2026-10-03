import { Injectable, computed, signal } from '@angular/core';
import { AP_I18N } from './i18n.data';
import { AP_I18N_EXTRA } from './i18n.extra';
import { AP_I18N_FIXES, Fixes } from './i18n.fixes';

const isNode = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * `base` with `fixes` laid over it: branches merge key by key, and a leaf (a [th, en] pair) or a list in
 * `fixes` replaces the original whole. The result keeps the type of `base`, so the dictionary stays typed.
 */
export function applyFixes<T>(base: T, fixes: Fixes<T>): T {
  if (!isNode(base) || !isNode(fixes)) return fixes as unknown as T;
  const out: Record<string, unknown> = { ...base };
  for (const [key, fix] of Object.entries(fixes))
    out[key] = fix === undefined ? out[key] : applyFixes(out[key], fix as never);
  return out as T;
}

// The generated design dictionary with the corrections of i18n.fixes.ts over it, and the API's own strings.
const SOURCE = { ...applyFixes(AP_I18N, AP_I18N_FIXES), api: AP_I18N_EXTRA };

export type Lang = 'th' | 'en';

// Turns the [th, en] leaves of AP_I18N into plain strings for one language.
type Picked<T> = T extends readonly [string, string]
  ? string
  : T extends readonly (infer U)[]
    ? readonly Picked<U>[]
    : { readonly [K in keyof T]: Picked<T[K]> };

export type Dict = Picked<typeof SOURCE>;

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
      d = pick(SOURCE, lang === 'th' ? 0 : 1) as Dict;
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

/** "5 min ago" style text for a last-seen time; null = never. */
export function ago(t: Dict, d: Date | null, now = Date.now()): string {
  if (!d) return t.api.never;
  const min = Math.max(0, Math.round((now - d.getTime()) / 60000));
  if (min < 5) return t.adm.ago.now;
  if (min < 60) return fmt(t.api.minutesAgo, { n: min });
  if (min < 48 * 60) return fmt(t.api.hoursAgo, { n: Math.round(min / 60) });
  return fmt(t.api.daysAgo, { n: Math.round(min / 1440) });
}

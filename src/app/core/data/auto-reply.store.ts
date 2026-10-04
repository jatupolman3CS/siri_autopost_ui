import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiAutoReply, ApiAutoReplyRule, ApiService } from '../http/api.service';
import { CollectionsStore } from './collections.store';
import { loadWithRetry } from './loading';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

/** How much the API accepts (Domain `AutoReplySettings`/`AutoReplyRule`): inputs stop here. */
export const AUTO_REPLY_LIMITS = { keywords: 300, reply: 500, inbox: 500, rules: 50 } as const;
/** The scope of a rule that applies to every collection; any other scope is a collection id. */
export const SCOPE_ALL = 'all';

/** What the "new rule" dialog collects. */
export interface RuleDraft {
  keywords: string;
  reply: string;
  inbox: string;
  scope: string;
}

/** The collections a rule can be limited to (the id and name are all the page needs). */
export interface ScopeCollection {
  id: string;
  name: string;
}

/** The keywords of a rule: the comma separated text, trimmed, without empty entries. */
export function keywordsOf(csv: string): string[] {
  return csv
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * The first rule that is on and has a keyword contained in the text (compared in lower case): the prototype's
 * `matchRule`, and the matching the "try it" box shows. Only used on screen: nothing reads comments yet.
 */
export function matchRule<R extends Pick<ApiAutoReplyRule, 'keywords' | 'on'>>(
  rules: readonly R[],
  text: string,
): R | null {
  const low = text.toLowerCase();
  return (
    rules.find((r) => r.on && keywordsOf(r.keywords).some((k) => low.includes(k.toLowerCase()))) ??
    null
  );
}

/** A new rule's id: the API takes any unused one (an empty id would make it pick one). */
function newRuleId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const hex = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, '0');
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-a${hex().slice(1)}-${hex()}${hex()}${hex()}`;
}

// Auto-reply rules of the current workspace. The rules are only stored: nothing reads comments yet, so nothing
// executes them (the page says so). Reading is for every role and plan; every change needs the admin role and an
// owner on Pro or above (`locked` says when the plan is missing).
//
// Changes show at once and are sent as the whole list (`PUT auto-reply`). Saves go one after the other, each
// sending the list as it is when its turn comes, so quick clicks cannot overwrite each other. A refused save
// puts the list back to what the server last accepted (the error interceptor has shown why).
@Injectable({ providedIn: 'root' })
export class AutoReplyStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);

  readonly on = signal(false);
  readonly rules = signal<ApiAutoReplyRule[]>([]);
  readonly loaded = signal(false);
  private readonly collectionsStore = inject(CollectionsStore);
  /** The collections a rule can be limited to (the id and name are all the page needs). */
  readonly collections = computed<ScopeCollection[]>(() =>
    this.collectionsStore.collections().map((c) => ({ id: c.id, name: c.name })),
  );

  /** The owner's plan does not include auto-reply. */
  readonly locked = computed(() => !this.ws.current()?.autoReply);
  readonly ruleCount = computed(() => this.rules().length);
  readonly onCount = computed(() => this.rules().filter((r) => r.on).length);
  /** No room for another rule. */
  readonly full = computed(() => this.rules().length >= AUTO_REPLY_LIMITS.rules);

  /** The last list the server accepted: what a refused save goes back to. */
  private confirmed: ApiAutoReply = { on: false, rules: [] };
  private queued = 0;
  private chain: Promise<unknown> = Promise.resolve();
  /** Counts workspace changes: a save that outlives its workspace leaves the counters alone. */
  private generation = 0;

  constructor() {
    whenWorkspaceChanges((id) => {
      this.confirmed = { on: false, rules: [] };
      this.generation++;
      this.queued = 0;
      this.chain = Promise.resolve();
      this.on.set(false);
      this.rules.set([]);
      this.loaded.set(false);
      if (id) void this.load(id);
    });
  }

  /** Loads the rules (transient failures are retried); an answer for a workspace left meanwhile is dropped. */
  async load(wsId = this.ws.id()): Promise<void> {
    if (!wsId) return;
    const ok = await loadWithRetry(
      async () => {
        const a = await this.api.autoReply(wsId);
        if (this.ws.id() !== wsId) return;
        this.confirmed = a;
        this.on.set(a.on);
        this.rules.set(a.rules);
      },
      () => this.ws.id() === wsId,
    );
    if (ok && this.ws.id() === wsId) this.loaded.set(true);
  }

  /** Reads the collection names again (the dialog asks when it opens: one may have been added meanwhile). */
  loadCollections(): Promise<void> {
    return this.collectionsStore.refresh();
  }

  /** The master switch. */
  setOn(on: boolean): Promise<boolean> {
    return this.change(on, this.rules());
  }

  /** Adds a rule (on). The dialog has checked that it has keywords and a reply or a chat message. */
  addRule(draft: RuleDraft): Promise<boolean> {
    const rule: ApiAutoReplyRule = {
      id: newRuleId(),
      keywords: draft.keywords.trim(),
      reply: draft.reply.trim(),
      inbox: draft.inbox.trim(),
      scope: draft.scope || SCOPE_ALL,
      on: true,
    };
    return this.change(this.on(), [...this.rules(), rule]);
  }

  setRuleOn(id: string, on: boolean): Promise<boolean> {
    return this.change(
      this.on(),
      this.rules().map((r) => (r.id === id ? { ...r, on } : r)),
    );
  }

  removeRule(id: string): Promise<boolean> {
    return this.change(
      this.on(),
      this.rules().filter((r) => r.id !== id),
    );
  }

  /** The first rule that is on and matches the text (see `matchRule`). */
  match(text: string): ApiAutoReplyRule | null {
    return matchRule(this.rules(), text);
  }

  /** The name of the collection a scope names ('' when it is "all", null when the collection is gone). */
  scopeName(scope: string): string | null {
    if (scope === SCOPE_ALL) return '';
    return this.collections().find((c) => c.id === scope)?.name ?? null;
  }

  private change(on: boolean, rules: ApiAutoReplyRule[]): Promise<boolean> {
    const wsId = this.ws.id();
    if (!wsId) return Promise.resolve(false);
    this.on.set(on);
    this.rules.set(rules);
    this.queued++;
    const gen = this.generation;
    const run = async (): Promise<boolean> => {
      try {
        if (this.ws.id() !== wsId) return false;
        const out = await this.api.saveAutoReply(wsId, { on: this.on(), rules: this.rules() });
        if (this.ws.id() !== wsId) return false;
        this.confirmed = out;
        // The answer is what is stored (ids, trimmed text); it replaces the list unless more changes are waiting.
        if (this.queued === 1) {
          this.on.set(out.on);
          this.rules.set(out.rules);
        }
        return true;
      } catch {
        if (this.ws.id() === wsId) {
          this.on.set(this.confirmed.on);
          this.rules.set(this.confirmed.rules);
        }
        return false;
      } finally {
        if (gen === this.generation) this.queued--;
      }
    };
    const result = this.chain.then(run, run);
    this.chain = result;
    return result;
  }
}

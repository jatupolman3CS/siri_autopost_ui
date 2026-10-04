import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import {
  ApiBulkLinksResult,
  ApiCsvImportResult,
  ApiCsvLinkRow,
  ApiGroupLink,
  ApiLinkSet,
  ApiService,
  ApiSetLink,
} from '../http/api.service';
import { ComposeSettings } from '../flow/compose';
import { EXPORT_FILES, downloadCsv } from '../flow/download';
import { duplicateUrlFlags, linksToCsv, normalizeGroupUrl } from '../flow/group-links';
import { DeviceEventsService } from './device-events.service';
import { loadWithRetry } from './loading';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

/** How long an edit waits for the next keystroke before the whole link row is saved. */
export const EDIT_DEBOUNCE_MS = 600;
/** Events that move a link's health (the engine switched it off, it went pending, it was enabled again). */
const LINK_EVENTS = ['links.changed', 'post'];
/** A burst of events (several posts settling together) is answered by one read. */
const EVENT_REFRESH_MS = 1500;
/** The event stream keeps the sets fresh; this poll only runs while the stream is down. */
const FALLBACK_POLL_MS = 60_000;

/** The fields of a link row the page edits; the server takes the complete row every time. */
export type LinkEdit = Partial<Pick<ApiSetLink, 'name' | 'url' | 'code' | 'dailyMax' | 'enabled'>>;
/** What the set's header line counts: all links, enabled valid ones, those with a code, other accounts. */
export interface SetStats {
  links: number;
  on: number;
  codes: number;
  accounts: number;
}
/** The fields of a set that can be changed after it was created. */
export interface SetEdit {
  name?: string;
  /** null = the workspace's first connected Facebook account. */
  postAsAccountId?: string | null;
  accountIds?: string[];
}

/** A link the engine would post to: switched on and a real group address. */
export const isActiveLink = (l: Pick<ApiSetLink, 'enabled' | 'valid'>): boolean =>
  l.enabled && l.valid;

export function statsOf(set: ApiLinkSet): SetStats {
  const on = set.links.filter(isActiveLink);
  return {
    links: set.links.length,
    on: on.length,
    codes: on.filter((l) => l.code.trim() !== '').length,
    accounts: set.accountIds.length,
  };
}

/** The first link that would be posted to with a group code: what the "example" of a set is written for. */
export function firstCodedLink(set: ApiLinkSet): ApiSetLink | undefined {
  return set.links.find((l) => isActiveLink(l) && l.code.trim() !== '');
}

/**
 * The address checks the server answers with (`valid`, `duplicate`) worked out again from the addresses, so a
 * row edited here is flagged before its save comes back. Rows that did not change keep their identity.
 */
function withFlags(links: ApiSetLink[]): ApiSetLink[] {
  const dup = duplicateUrlFlags(links);
  return links.map((l, i) => {
    const valid = normalizeGroupUrl(l.url) !== '';
    return l.valid === valid && l.duplicate === dup[i] ? l : { ...l, valid, duplicate: dup[i] };
  });
}

interface PendingEdit {
  timer: ReturnType<typeof setTimeout> | null;
  inflight: boolean;
  /** An edit arrived that no request carries yet. */
  dirty: boolean;
  /** The last row the server confirmed: what a refused save goes back to. */
  confirmed: ApiSetLink;
}

// Link sets ("ชุดลิงก์กลุ่ม") of the current workspace: Facebook group addresses with a group code and a daily
// cap, and the accounts that post them. Reading is for every role; every change is an editor's.
//
// Link rows are edited inline: `editLink` changes the row at once and saves the complete row 600 ms after the
// last change (a toggle saves at once), one request per row at a time. A refused save puts the row back to what
// the server last confirmed (the error interceptor has already toasted the reason). The server checks the
// address (`valid`, `duplicate`) and keeps it normalised; an answer for a row edited again meanwhile is not
// applied over the newer text. Rows being edited are also kept when a live read brings the sets again.
@Injectable({ providedIn: 'root' })
export class LinkSetsStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);

  readonly sets = signal<ApiLinkSet[]>([]);
  /** The sets of the current workspace have arrived (the page shows "—" until then). */
  readonly loaded = signal(false);
  /** The composing settings of the first collection, for the "example" of a coded group (null: none, no footer). */
  readonly exampleSettings = signal<ComposeSettings | null>(null);

  readonly setCount = computed(() => this.sets().length);
  /** Links the engine would post to, in every set: switched on and a real group address. */
  readonly linkCount = computed(() =>
    this.sets().reduce((n, s) => n + s.links.filter(isActiveLink).length, 0),
  );
  /** Counts per set id for the header line of each card. */
  readonly stats = computed(() => {
    const out: Record<string, SetStats> = {};
    for (const s of this.sets()) out[s.id] = statsOf(s);
    return out;
  });

  private readonly pending = new Map<string, PendingEdit>();
  /** Set updates (post-as, other accounts) sent or waiting, per set: they go one after the other. */
  private readonly setOps = new Map<string, Promise<void>>();
  private readonly setOpCount = new Map<string, number>();
  private exampleRequested = false;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    whenWorkspaceChanges((id) => {
      this.dropAll();
      this.sets.set([]);
      this.loaded.set(false);
      this.exampleSettings.set(null);
      this.exampleRequested = false;
      if (id) void this.load(id);
    });
    // Live: the engine switching a group off (or on) shows without a reload.
    const events = inject(DeviceEventsService);
    events.subscribe((e) => {
      if (LINK_EVENTS.includes(e.type)) this.scheduleRefresh();
    });
    events.onResume(() => void this.refresh());
    const destroy = inject(DestroyRef);
    destroy.onDestroy(() => this.dropAll());
    if (typeof window !== 'undefined') {
      const timer = setInterval(() => {
        if (!events.connected()) void this.refresh();
      }, FALLBACK_POLL_MS);
      destroy.onDestroy(() => clearInterval(timer));
    }
  }

  byId(id: string): ApiLinkSet | undefined {
    return this.sets().find((s) => s.id === id);
  }

  /** Loads the sets (transient failures are retried); an answer for a workspace left meanwhile is dropped. */
  async load(wsId = this.ws.id()): Promise<void> {
    if (!wsId) return;
    const ok = await loadWithRetry(
      async () => {
        const list = await this.api.linkSets(wsId);
        if (this.ws.id() === wsId) this.applyList(list);
      },
      () => this.ws.id() === wsId,
    );
    if (ok && this.ws.id() === wsId) this.loaded.set(true);
  }

  /** A quiet re-read for live updates: a failure leaves the sets as they are. */
  async refresh(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    try {
      const list = await this.api.linkSets(wsId, true);
      if (this.ws.id() === wsId) {
        this.applyList(list);
        this.loaded.set(true);
      }
    } catch {
      // The next event or poll tries again.
    }
  }

  /**
   * Reads the first collection's composing settings once (the example of a group code shows its footer and
   * hashtags). The collections come with all their posts, so nothing asks for them until a page needs them.
   */
  async ensureExampleSettings(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId || this.exampleRequested) return;
    this.exampleRequested = true;
    try {
      const list = await this.api.collections(wsId, true);
      if (this.ws.id() === wsId) this.exampleSettings.set(list[0]?.settings ?? null);
    } catch {
      // No footer in the example; the next visit asks again.
      if (this.ws.id() === wsId) this.exampleRequested = false;
    }
  }

  // ---- sets -------------------------------------------------------------------------------------------------

  async createSet(name: string, postAsAccountId?: string | null): Promise<ApiLinkSet> {
    const wsId = this.requireWs();
    const set = await this.api.createLinkSet(wsId, name, postAsAccountId);
    if (this.ws.id() === wsId) this.sets.update((l) => [...l, set]);
    return set;
  }

  /** Deletes a set. The API refuses (422, naming the schedules) while a schedule uses it: the set stays and this throws. */
  async deleteSet(id: string): Promise<void> {
    const wsId = this.requireWs();
    await this.api.deleteLinkSet(wsId, id);
    if (this.ws.id() !== wsId) return;
    for (const l of this.byId(id)?.links ?? []) this.dropPending(id, l.id);
    this.sets.update((list) => list.filter((s) => s.id !== id));
  }

  /** The Facebook account whose browser posts the set (null = the first connected one). */
  setPostAs(id: string, accountId: string | null): Promise<boolean> {
    return this.updateSet(id, { postAsAccountId: accountId });
  }

  addAccount(id: string, accountId: string): Promise<boolean> {
    const set = this.byId(id);
    if (!set || set.accountIds.includes(accountId)) return Promise.resolve(false);
    return this.updateSet(id, { accountIds: [...set.accountIds, accountId] });
  }

  removeAccount(id: string, accountId: string): Promise<boolean> {
    const set = this.byId(id);
    if (!set || !set.accountIds.includes(accountId)) return Promise.resolve(false);
    return this.updateSet(id, { accountIds: set.accountIds.filter((a) => a !== accountId) });
  }

  /**
   * Changes the set's own fields at once and saves them; a refused save puts the old values back. Updates of one
   * set go one after the other, each sending the set as it is then, so quick clicks cannot overwrite each other.
   * Resolves to whether the server accepted it.
   */
  updateSet(id: string, patch: SetEdit): Promise<boolean> {
    const wsId = this.ws.id();
    const before = this.byId(id);
    if (!wsId || !before) return Promise.resolve(false);
    const previous: SetEdit = {};
    if (patch.name !== undefined) previous.name = before.name;
    if (patch.postAsAccountId !== undefined) previous.postAsAccountId = before.postAsAccountId;
    if (patch.accountIds !== undefined) previous.accountIds = before.accountIds;
    this.patchSet(id, patch);
    this.setOpCount.set(id, (this.setOpCount.get(id) ?? 0) + 1);
    const run = async (): Promise<boolean> => {
      const set = this.byId(id);
      if (this.ws.id() !== wsId || !set) return false;
      try {
        const saved = await this.api.updateLinkSet(wsId, id, {
          name: set.name,
          postAsAccountId: set.postAsAccountId,
          accountIds: set.accountIds,
        });
        if (this.ws.id() === wsId && (this.setOpCount.get(id) ?? 0) <= 1) this.mergeSet(saved);
        return true;
      } catch {
        if (this.ws.id() === wsId) this.patchSet(id, previous);
        return false;
      }
    };
    const queued = this.setOps.get(id);
    const result = queued ? queued.then(run) : run();
    const tail = result.then(() => {
      const left = (this.setOpCount.get(id) ?? 1) - 1;
      if (left <= 0) {
        this.setOpCount.delete(id);
        this.setOps.delete(id);
      } else this.setOpCount.set(id, left);
    });
    this.setOps.set(id, tail);
    return result;
  }

  // ---- links ------------------------------------------------------------------------------------------------

  /** Adds an empty row (the server accepts a blank address: the row is flagged until it is filled in). */
  async addLinkRow(setId: string): Promise<ApiSetLink | null> {
    const wsId = this.requireWs();
    const link = await this.api.addLink(wsId, setId);
    if (this.ws.id() !== wsId) return null;
    this.sets.update((list) =>
      list.map((s) => (s.id === setId ? { ...s, links: withFlags([...s.links, link]) } : s)),
    );
    return link;
  }

  /**
   * Changes one row at once and saves the complete row `EDIT_DEBOUNCE_MS` after the last change, or right
   * away with `immediate` (a switch). Nothing is thrown: a refused save puts the row back.
   */
  editLink(setId: string, linkId: string, patch: LinkEdit, immediate = false): void {
    const wsId = this.ws.id();
    const row = this.byId(setId)?.links.find((l) => l.id === linkId);
    if (!wsId || !row) return;
    const key = pendingKey(setId, linkId);
    let p = this.pending.get(key);
    if (!p) {
      p = { timer: null, inflight: false, dirty: false, confirmed: row };
      this.pending.set(key, p);
    }
    p.dirty = true;
    if (p.timer) clearTimeout(p.timer);
    p.timer = null;
    this.patchLink(setId, linkId, patch);
    if (immediate) void this.flush(wsId, setId, linkId);
    else p.timer = setTimeout(() => void this.flush(wsId, setId, linkId), EDIT_DEBOUNCE_MS);
  }

  /** Removes a row at once; a refused delete puts it back where it was. Resolves to whether it is gone. */
  async removeLink(setId: string, linkId: string): Promise<boolean> {
    const wsId = this.requireWs();
    const set = this.byId(setId);
    const index = set?.links.findIndex((l) => l.id === linkId) ?? -1;
    if (!set || index < 0) return false;
    const row = set.links[index];
    this.dropPending(setId, linkId);
    this.setLinks(setId, (links) => links.filter((l) => l.id !== linkId));
    try {
      await this.api.deleteLink(wsId, setId, linkId);
      return true;
    } catch {
      if (this.ws.id() === wsId)
        this.setLinks(setId, (links) => {
          const next = [...links];
          next.splice(Math.min(index, next.length), 0, row);
          return next;
        });
      return false;
    }
  }

  /** Turns a link the engine switched off back on. */
  async reenable(setId: string, linkId: string): Promise<ApiSetLink> {
    const wsId = this.requireWs();
    this.dropPending(setId, linkId);
    const link = await this.api.enableLink(wsId, setId, linkId);
    if (this.ws.id() === wsId)
      this.setLinks(setId, (links) => links.map((l) => (l.id === linkId ? link : l)));
    return link;
  }

  /** Lines of `url | code` pasted into a set; answers how many were added, repeated, re-coded and invalid. */
  async bulkAdd(setId: string, text: string): Promise<ApiBulkLinksResult> {
    const wsId = this.requireWs();
    const result = await this.api.bulkLinks(wsId, setId, text);
    if (this.ws.id() === wsId) this.mergeSet(result.set);
    return result;
  }

  /** The groups of a connected account (name + address) as its browser last synced them. */
  accountGroups(accountId: string): Promise<ApiGroupLink[]> {
    return this.api.accountGroups(this.requireWs(), accountId);
  }

  /** Adds groups of a connected account (by address) to a set; the ones it already has are skipped by the server. */
  async importGroups(setId: string, accountId: string, urls: string[]): Promise<ApiLinkSet> {
    const wsId = this.requireWs();
    const set = await this.api.importGroups(wsId, setId, accountId, urls);
    if (this.ws.id() === wsId) this.mergeSet(set);
    return set;
  }

  /** CSV rows `set, name, url, code`: missing sets are created by name. Reads the sets again afterwards. */
  async importCsv(rows: ApiCsvLinkRow[]): Promise<ApiCsvImportResult> {
    const wsId = this.requireWs();
    const result = await this.api.importLinksCsv(wsId, rows);
    if (this.ws.id() === wsId) await this.refresh();
    return result;
  }

  /** Saves every link of every set as `autopost-links.csv`; false when the browser could not start the download. */
  exportCsv(): boolean {
    return downloadCsv(EXPORT_FILES.links, linksToCsv(this.sets()));
  }

  // ---- internals --------------------------------------------------------------------------------------------

  private requireWs(): string {
    const id = this.ws.id();
    if (!id) throw new Error('no workspace');
    return id;
  }

  private link(setId: string, linkId: string): ApiSetLink | undefined {
    return this.byId(setId)?.links.find((l) => l.id === linkId);
  }

  private setLinks(setId: string, change: (links: ApiSetLink[]) => ApiSetLink[]): void {
    this.sets.update((list) =>
      list.map((s) => (s.id === setId ? { ...s, links: withFlags(change(s.links)) } : s)),
    );
  }

  private patchLink(setId: string, linkId: string, patch: LinkEdit): void {
    this.setLinks(setId, (links) => links.map((l) => (l.id === linkId ? { ...l, ...patch } : l)));
  }

  private patchSet(id: string, patch: SetEdit): void {
    this.sets.update((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  /** Sends the complete row as it is now. A second edit during the request is sent when it answers. */
  private async flush(wsId: string, setId: string, linkId: string): Promise<void> {
    const key = pendingKey(setId, linkId);
    const p = this.pending.get(key);
    if (!p || p.inflight) return;
    if (p.timer) clearTimeout(p.timer);
    p.timer = null;
    const row = this.link(setId, linkId);
    if (!row) {
      this.pending.delete(key);
      return;
    }
    p.dirty = false;
    p.inflight = true;
    let ok = true;
    try {
      const saved = await this.api.updateLink(wsId, setId, linkId, {
        name: row.name,
        url: row.url,
        code: row.code,
        dailyMax: row.dailyMax,
        enabled: row.enabled,
      });
      if (this.pending.get(key) !== p || this.ws.id() !== wsId) return;
      p.confirmed = saved;
      // Nothing newer was typed: show what the server stored (the normalised address).
      if (!p.dirty)
        this.setLinks(setId, (links) => links.map((l) => (l.id === linkId ? saved : l)));
    } catch {
      ok = false;
      if (this.pending.get(key) === p && this.ws.id() === wsId) {
        p.dirty = false;
        if (p.timer) clearTimeout(p.timer);
        p.timer = null;
        this.setLinks(setId, (links) => links.map((l) => (l.id === linkId ? p.confirmed : l)));
      }
    } finally {
      p.inflight = false;
      if (this.pending.get(key) === p) {
        if (ok && p.dirty && !p.timer) void this.flush(wsId, setId, linkId);
        else if (!p.dirty && !p.timer) this.pending.delete(key);
      }
    }
  }

  private dropPending(setId: string, linkId: string): void {
    const key = pendingKey(setId, linkId);
    const p = this.pending.get(key);
    if (p?.timer) clearTimeout(p.timer);
    this.pending.delete(key);
  }

  private dropAll(): void {
    for (const p of this.pending.values()) if (p.timer) clearTimeout(p.timer);
    this.pending.clear();
    this.setOps.clear();
    this.setOpCount.clear();
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      void this.refresh();
    }, EVENT_REFRESH_MS);
  }

  private applyList(list: ApiLinkSet[]): void {
    const local = new Map(this.sets().map((s) => [s.id, s]));
    this.sets.set(list.map((s) => this.merged(local.get(s.id), s)));
  }

  private mergeSet(server: ApiLinkSet): void {
    this.sets.update((list) => list.map((s) => (s.id === server.id ? this.merged(s, server) : s)));
  }

  /** The server's set, except rows being edited and set fields being saved, which keep what is on screen. */
  private merged(local: ApiLinkSet | undefined, server: ApiLinkSet): ApiLinkSet {
    const rows = new Map((local?.links ?? []).map((l) => [l.id, l]));
    const links = server.links.map((l) =>
      this.pending.has(pendingKey(server.id, l.id)) ? (rows.get(l.id) ?? l) : l,
    );
    const own = local && (this.setOpCount.get(server.id) ?? 0) > 0 ? local : server;
    // The server's flags stand, unless a row on screen differs from the server's (then they are worked out again).
    const edited = links.some((l, i) => l !== server.links[i]);
    return {
      ...server,
      name: own.name,
      postAsAccountId: own.postAsAccountId,
      accountIds: own.accountIds,
      links: edited ? withFlags(links) : links,
    };
  }
}

const pendingKey = (setId: string, linkId: string) => `${setId}/${linkId}`;

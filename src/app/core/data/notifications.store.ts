import { Injectable, computed, inject, signal } from '@angular/core';
import {
  ApiLinkSet,
  ApiNotifications,
  ApiNotifyChannel,
  ApiNotifyEvents,
  ApiService,
  ApiSetLink,
  ApiTelegramChat,
} from '../http/api.service';
import { problemMessage } from '../http/problem-details';
import { LinkSetsStore, isActiveLink } from './link-sets.store';
import { CollectionsStore } from './collections.store';
import { loadWithRetry } from './loading';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

/** The events of the design, in its order. */
export const NOTIFY_EVENTS = [
  'success',
  'fail',
  'shot',
  'round',
  'startStop',
  'block',
  'offline',
  'quota',
] as const satisfies readonly (keyof ApiNotifyEvents)[];
export type NotifyEventKey = (typeof NOTIFY_EVENTS)[number];
/** Saved, but nothing sends them yet (the extension reports no screenshots and no "offline" signal). */
export const UNSENT_EVENTS: readonly NotifyEventKey[] = ['shot', 'offline'];
/** The events something sends today: what the "x/y events" counts are about. */
export const SENT_EVENTS = NOTIFY_EVENTS.filter((k) => !UNSENT_EVENTS.includes(k));

/** How much the API accepts per field (Domain `TelegramChannel`/`NotificationSettings`): inputs stop here. */
export const NOTIFY_LIMITS = { token: 200, target: 100, users: 300 } as const;

export type NotifyChannelKey = 'tg' | 'line';
/** A concrete channel: what a group or a set resolves to (`default` only means "follow the parent"). */
export type ResolvedChannel = Exclude<ApiNotifyChannel, 'default'>;
/** What the person typed for a token: null = nothing typed (the stored one stays), '' = remove it, text = replace it. */
export interface TokenEdits {
  tg: string | null;
  line: string | null;
}
/** Where a token field stands: nothing stored, one stored, a new one typed, or the stored one to be removed. */
export type TokenState = 'none' | 'saved' | 'new' | 'clear';

export type NotifyTestOutcome =
  | { status: 'ok' }
  /** The platform or the API said no, with its reason. */
  | { status: 'failed'; message: string }
  /** The channel has no token or no recipient yet: nothing was sent. */
  | { status: 'incomplete' }
  /** The save that comes first was refused (the error interceptor has shown why). */
  | { status: 'saveFailed' }
  /** No answer from the API. */
  | { status: 'unreachable' };
export type FindChatsOutcome =
  | { status: 'ok'; chats: ApiTelegramChat[] }
  | { status: 'failed'; message: string }
  | { status: 'incomplete' }
  | { status: 'unreachable' };

/** What the summary line counts: active groups, those that get an alert, and through which channel. */
export interface NotifySummary {
  n: number;
  on: number;
  tg: number;
  ln: number;
}

interface RulePatch {
  channel?: ApiNotifyChannel;
  events?: ApiNotifyEvents | null;
}

const EMPTY_TOKENS: TokenEdits = { tg: null, line: null };

// ---- pure helpers: the server's resolution order (NotificationSettings.Resolve) ------------------------------

const setRule = (s: ApiNotifications, setId: string) => s.sets.find((r) => r.linkSetId === setId);

/** A group's channel, else its set's, else the workspace's (a rule saying `default` follows its parent). */
export function channelOf(s: ApiNotifications, setId: string, linkId?: string): ResolvedChannel {
  const set = setRule(s, setId);
  const group = linkId ? set?.groups[linkId] : undefined;
  if (group && group.channel !== 'default') return group.channel;
  if (set && set.channel !== 'default') return set.channel;
  return s.channel === 'default' ? 'tg' : s.channel;
}

/** The events of a group, else its set's, else the workspace's. */
export function eventsOf(s: ApiNotifications, setId: string, linkId?: string): ApiNotifyEvents {
  const set = setRule(s, setId);
  const group = linkId ? set?.groups[linkId] : undefined;
  return group?.events ?? set?.events ?? s.events;
}

/** How many of the events that are really sent are on. */
export const sentCount = (events: ApiNotifyEvents): number =>
  SENT_EVENTS.filter((k) => events[k]).length;

/** Whether a resolved channel sends through `which`. */
export const usesChannel = (channel: ResolvedChannel, which: NotifyChannelKey): boolean =>
  channel === 'both' || channel === which;

/** The links of a set an alert can be about: the ones that post (switched on, a real address). */
export const groupsOf = (set: ApiLinkSet): ApiSetLink[] => set.links.filter(isActiveLink);

/** Rules back at their defaults carry no information: they are left out of what is saved. */
function pruned(s: ApiNotifications): ApiNotifications {
  const sets = s.sets
    .map((r) => {
      const entries = Object.entries(r.groups);
      const keep = entries.filter(([, g]) => g.channel !== 'default' || g.events !== null);
      return keep.length === entries.length ? r : { ...r, groups: Object.fromEntries(keep) };
    })
    .filter(
      (r) => r.channel !== 'default' || r.events !== null || Object.keys(r.groups).length > 0,
    );
  return sets.length === s.sets.length && sets.every((r, i) => r === s.sets[i])
    ? s
    : { ...s, sets };
}

// Notification settings of the current workspace (Telegram and LINE OA alerts). Reading is for every role and
// every plan (below Pro the API answers the defaults); saving, testing and looking up chats need the admin role
// and an owner on Pro or above (`locked` says when the plan is missing).
//
// What is on screen is a local copy (`settings`) that the page edits and `save()` sends as a whole. The tokens
// are write-only: the API never returns one (only `hasToken`), so what the person types lives apart in `tokens`
// and is sent as null (keep), '' (remove) or the new text, and is never put back into the settings.
// Rules are keyed like the server's: sets by link-set id, groups by link id; the server drops rules about sets
// and links that no longer exist.
@Injectable({ providedIn: 'root' })
export class NotificationsStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);
  private readonly linkSets = inject(LinkSetsStore);

  /** What is on screen (null until it has arrived). */
  readonly settings = signal<ApiNotifications | null>(null);
  private readonly saved = signal<ApiNotifications | null>(null);
  readonly tokens = signal<TokenEdits>(EMPTY_TOKENS);
  readonly loaded = signal(false);
  readonly saving = signal(false);
  /** The start of the first post of any collection, for the sample alert (empty until known). */
  private readonly collectionsStore = inject(CollectionsStore);
  readonly samplePost = computed(
    () =>
      this.collectionsStore
        .collections()
        .flatMap((c) => c.posts)
        .find((p) => p.text.trim() !== '')
        ?.text.trim() ?? '',
  );

  /**
   * The owner's plan does not include notifications (the page keeps its content and turns it off). Only known
   * once the workspaces have arrived: before that nothing is locked, so the lock does not flash on a reload.
   */
  readonly locked = computed(() => this.ws.loaded() && !this.ws.current()?.notifications);
  /** The workspace's link sets (the per-set rules are about these). */
  readonly sets = this.linkSets.sets;
  readonly setsLoaded = this.linkSets.loaded;

  /** Something on screen differs from what is saved (a typed or removed token counts). */
  readonly dirty = computed(() => {
    const now = this.settings();
    const was = this.saved();
    if (!now || !was) return false;
    const t = this.tokens();
    return t.tg !== null || t.line !== null || JSON.stringify(now) !== JSON.stringify(was);
  });

  readonly telegramState = computed(() => this.tokenState('tg'));
  readonly lineState = computed(() => this.tokenState('line'));
  /** The server sends through a channel only when it is on and has both a token and a recipient. */
  readonly telegramReady = computed(() => {
    const s = this.settings();
    const state = this.telegramState();
    return (
      !!s &&
      s.telegram.on &&
      (state === 'saved' || state === 'new') &&
      s.telegram.chatId.trim() !== ''
    );
  });
  readonly lineReady = computed(() => {
    const s = this.settings();
    const state = this.lineState();
    return !!s && s.line.on && (state === 'saved' || state === 'new') && s.line.to.trim() !== '';
  });

  /** "{on} of {n} groups notified": the links that post, and those an alert can actually reach. */
  readonly summary = computed<NotifySummary>(() => {
    const s = this.settings();
    const out: NotifySummary = { n: 0, on: 0, tg: 0, ln: 0 };
    if (!s) return out;
    const tgReady = this.telegramReady();
    const lineReady = this.lineReady();
    for (const set of this.linkSets.sets())
      for (const link of groupsOf(set)) {
        out.n++;
        const ch = channelOf(s, set.id, link.id);
        const tg = tgReady && usesChannel(ch, 'tg');
        const ln = lineReady && usesChannel(ch, 'line');
        if (tg) out.tg++;
        if (ln) out.ln++;
        if (tg || ln) out.on++;
      }
    return out;
  });

  /** Channels some group is set to use that cannot send yet (off, or no token or recipient). */
  readonly notReady = computed<NotifyChannelKey[]>(() => {
    const s = this.settings();
    if (!s) return [];
    const missing = new Set<NotifyChannelKey>();
    for (const set of this.linkSets.sets())
      for (const link of groupsOf(set)) {
        const ch = channelOf(s, set.id, link.id);
        if (usesChannel(ch, 'tg') && !this.telegramReady()) missing.add('tg');
        if (usesChannel(ch, 'line') && !this.lineReady()) missing.add('line');
      }
    return [...missing];
  });

  constructor() {
    whenWorkspaceChanges((id) => {
      this.settings.set(null);
      this.saved.set(null);
      this.tokens.set(EMPTY_TOKENS);
      this.loaded.set(false);
      this.saving.set(false);
      if (id) void this.load(id);
    });
  }

  /** Loads the settings (transient failures are retried); an answer for a workspace left meanwhile is dropped. */
  async load(wsId = this.ws.id()): Promise<void> {
    if (!wsId) return;
    const ok = await loadWithRetry(
      async () => {
        const n = await this.api.notifications(wsId);
        if (this.ws.id() !== wsId) return;
        this.settings.set(n);
        this.saved.set(n);
        this.tokens.set(EMPTY_TOKENS);
      },
      () => this.ws.id() === wsId,
    );
    if (ok && this.ws.id() === wsId) this.loaded.set(true);
  }

  // ---- edits -------------------------------------------------------------------------------------------------

  private edit(fn: (s: ApiNotifications) => ApiNotifications): void {
    const s = this.settings();
    if (s) this.settings.set(pruned(fn(s)));
  }

  setChannelOn(channel: NotifyChannelKey, on: boolean): void {
    this.edit((s) =>
      channel === 'tg'
        ? { ...s, telegram: { ...s.telegram, on } }
        : { ...s, line: { ...s.line, on } },
    );
  }

  /** The Telegram chat id or the LINE recipient. */
  setTarget(channel: NotifyChannelKey, text: string): void {
    this.edit((s) =>
      channel === 'tg'
        ? { ...s, telegram: { ...s.telegram, chatId: text } }
        : { ...s, line: { ...s.line, to: text } },
    );
  }

  /** Typed token text ('' = nothing typed: the stored token stays). */
  setToken(channel: NotifyChannelKey, text: string): void {
    this.tokens.update((t) => ({ ...t, [channel]: text === '' ? null : text }));
  }

  /** Marks the stored token to be removed on the next save (or takes that back). */
  setTokenRemoved(channel: NotifyChannelKey, removed: boolean): void {
    this.tokens.update((t) => ({ ...t, [channel]: removed ? '' : null }));
  }

  setDefaultChannel(channel: ResolvedChannel): void {
    this.edit((s) => ({ ...s, channel }));
  }

  setDefaultEvent(key: NotifyEventKey, on: boolean): void {
    this.edit((s) => ({ ...s, events: { ...s.events, [key]: on } }));
  }

  /** A set's channel (`default` = the workspace's) or, with `linkId`, one group's (`default` = its set's). */
  setRuleChannel(setId: string, linkId: string | null, channel: ApiNotifyChannel): void {
    this.edit((s) => this.withRule(s, setId, linkId, { channel }));
  }

  /** Gives a set or group its own events (a copy of what it follows now) or takes them back. */
  setCustomEvents(setId: string, linkId: string | null, custom: boolean): void {
    this.edit((s) => {
      if (custom === (this.ownEvents(s, setId, linkId) !== null)) return s;
      const events = custom ? { ...this.followed(s, setId, linkId) } : null;
      return this.withRule(s, setId, linkId, { events });
    });
  }

  /** One event of a set's or group's own events. */
  setRuleEvent(setId: string, linkId: string | null, key: NotifyEventKey, on: boolean): void {
    this.edit((s) => {
      const own = this.ownEvents(s, setId, linkId) ?? this.followed(s, setId, linkId);
      return this.withRule(s, setId, linkId, { events: { ...own, [key]: on } });
    });
  }

  setCommands(patch: { on?: boolean; users?: string }): void {
    this.edit((s) => ({
      ...s,
      commandsOn: patch.on ?? s.commandsOn,
      commandsUsers: patch.users ?? s.commandsUsers,
    }));
  }

  /** The events a group or set follows when it has none of its own: its parent's. */
  private followed(s: ApiNotifications, setId: string, linkId: string | null): ApiNotifyEvents {
    return linkId ? eventsOf(s, setId) : s.events;
  }

  private ownEvents(
    s: ApiNotifications,
    setId: string,
    linkId: string | null,
  ): ApiNotifyEvents | null {
    const set = setRule(s, setId);
    return (linkId ? set?.groups[linkId]?.events : set?.events) ?? null;
  }

  /** The settings with a set's (or one of its groups') rule changed, in the rule's place in the list. */
  private withRule(
    s: ApiNotifications,
    setId: string,
    linkId: string | null,
    patch: RulePatch,
  ): ApiNotifications {
    const own = setRule(s, setId) ?? {
      linkSetId: setId,
      channel: 'default',
      events: null,
      groups: {},
    };
    const next = linkId
      ? {
          ...own,
          groups: {
            ...own.groups,
            [linkId]: { ...(own.groups[linkId] ?? { channel: 'default', events: null }), ...patch },
          },
        }
      : { ...own, ...patch };
    const sets = s.sets.some((r) => r.linkSetId === setId)
      ? s.sets.map((r) => (r.linkSetId === setId ? next : r))
      : [...s.sets, next];
    return { ...s, sets };
  }

  // ---- tokens ------------------------------------------------------------------------------------------------

  private tokenState(channel: NotifyChannelKey): TokenState {
    const typed = this.tokens()[channel];
    if (typed === '') return 'clear';
    if (typed !== null) return 'new';
    const s = this.settings();
    const stored = channel === 'tg' ? s?.telegram.hasToken : s?.line.hasToken;
    return stored ? 'saved' : 'none';
  }

  // ---- calls -------------------------------------------------------------------------------------------------

  /**
   * Sends the complete settings. Resolves to whether the server accepted them (the error interceptor has shown
   * why when it did not). Whatever was typed meanwhile stays on screen.
   */
  async save(): Promise<boolean> {
    const wsId = this.ws.id();
    const s = this.settings();
    if (!wsId || !s || this.saving()) return false;
    const sent = this.tokens();
    this.saving.set(true);
    try {
      const body: ApiNotifications = {
        ...s,
        telegram: { ...s.telegram, token: sent.tg },
        line: { ...s.line, token: sent.line },
      };
      const out = await this.api.saveNotifications(wsId, body);
      if (this.ws.id() !== wsId) return false;
      this.saved.set(out);
      if (this.settings() === s) this.settings.set(out);
      else
        this.settings.update(
          (cur) =>
            cur && {
              ...cur,
              telegram: { ...cur.telegram, hasToken: out.telegram.hasToken },
              line: { ...cur.line, hasToken: out.line.hasToken },
            },
        );
      if (this.tokens() === sent) this.tokens.set(EMPTY_TOKENS);
      return true;
    } catch {
      return false;
    } finally {
      if (this.ws.id() === wsId) this.saving.set(false);
    }
  }

  /**
   * Sends a test message through a channel. The API tests what is *saved*, so unsaved changes are saved first.
   * Nothing is sent when the channel has no token or no recipient yet.
   */
  async testChannel(channel: NotifyChannelKey): Promise<NotifyTestOutcome> {
    const wsId = this.ws.id();
    const s = this.settings();
    if (!wsId || !s) return { status: 'incomplete' };
    const target = channel === 'tg' ? s.telegram.chatId : s.line.to;
    const state = channel === 'tg' ? this.telegramState() : this.lineState();
    if ((state !== 'saved' && state !== 'new') || target.trim() === '')
      return { status: 'incomplete' };
    if (this.dirty() && !(await this.save())) return { status: 'saveFailed' };
    try {
      const result = await this.api.testNotification(wsId, channel);
      return result.ok ? { status: 'ok' } : { status: 'failed', message: result.message ?? '' };
    } catch (e) {
      const message = problemMessage(e);
      return message ? { status: 'failed', message } : { status: 'unreachable' };
    }
  }

  /** The chats the Telegram bot has seen: with the typed token, else the stored one. */
  async findChats(): Promise<FindChatsOutcome> {
    const wsId = this.ws.id();
    if (!wsId) return { status: 'incomplete' };
    const state = this.telegramState();
    if (state !== 'saved' && state !== 'new') return { status: 'incomplete' };
    try {
      const found = await this.api.telegramChats(wsId, this.tokens().tg ?? undefined);
      return { status: 'ok', chats: found.chats };
    } catch (e) {
      const message = problemMessage(e);
      return message ? { status: 'failed', message } : { status: 'unreachable' };
    }
  }
}

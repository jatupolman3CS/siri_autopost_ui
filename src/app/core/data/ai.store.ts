import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiAiStatus, ApiService } from '../http/api.service';
import { I18nService } from '../i18n/i18n.service';
import { loadWithRetry } from './loading';
import { PermissionsService } from './permissions.service';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';
import '../i18n/i18n.flow';

/** The tones the server writes in (`WriteAiPostsCommandHandler.Tones`). */
export const AI_TONES = ['friendly', 'formal', 'sales', 'short'] as const;
export type AiTone = (typeof AI_TONES)[number];
/** What the panel asks by default, and the most it offers (the server takes up to 5). */
export const AI_DEFAULT_COUNT = 2;
export const AI_MAX_COUNT = 3;

/** What the AI buttons may do right now, and why not. */
export type AiState =
  /** The person cannot edit (viewer role or assist mode). */
  | 'readonly'
  /** The status has not arrived yet. */
  | 'loading'
  /** The status could not be read (the server did not answer). */
  | 'failed'
  /** The server has no AI key: the admin has to set one up. */
  | 'noKey'
  /** The owner's plan does not include the writer. */
  | 'noPlan'
  /** Today's allowance is used up. */
  | 'noDrafts'
  | 'ready';

export interface AiRequest {
  topic: string;
  points: readonly string[];
  tone: AiTone;
  count: number;
}

// The AI post writer of the current workspace: whether it can be used (`GET ai/status`: the server holds an
// AI key, the owner's plan includes it, how many drafts are left today) and the call that writes drafts. The
// drafts are only returned: the editor puts them in its text and the person saves the post like any other.
// Nothing is enabled until the status has arrived. The store is created the first time an editor is opened,
// empties itself when the workspace changes and reads the status again.
@Injectable({ providedIn: 'root' })
export class AiStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);
  private readonly perm = inject(PermissionsService);
  private readonly i18n = inject(I18nService);

  readonly status = signal<ApiAiStatus | null>(null);
  /** The status of the current workspace has arrived. */
  readonly loaded = signal(false);
  /** The status could not be read even after trying again: the buttons stay off and say so. */
  readonly failed = signal(false);

  /** The server has an AI key. */
  readonly enabled = computed(() => this.status()?.enabled === true);
  /** The owner's plan includes the AI writer. */
  readonly allowed = computed(() => this.status()?.allowed === true);
  readonly model = computed(() => this.status()?.model ?? '');
  /** Drafts left today; null = no limit (or not known yet). */
  readonly remaining = computed(() => this.status()?.draftsLeftToday ?? null);

  readonly state = computed<AiState>(() => {
    if (!this.perm.canEdit()) return 'readonly';
    if (!this.loaded()) return this.failed() ? 'failed' : 'loading';
    if (!this.enabled()) return 'noKey';
    if (!this.allowed()) return 'noPlan';
    if (this.remaining() === 0) return 'noDrafts';
    return 'ready';
  });
  /** The panel may be opened (and says why it cannot write when today's drafts are used up). */
  readonly canOpen = computed(() => this.state() === 'ready' || this.state() === 'noDrafts');
  /** Drafts may be asked for. */
  readonly canWrite = computed(() => this.state() === 'ready');
  /** Why the AI buttons are off ('' when they are on); the text of the `title` and of the note beside them. */
  readonly reason = computed(() => {
    const a = this.i18n.t().api.flow;
    switch (this.state()) {
      case 'readonly':
        return this.perm.editHint();
      case 'loading':
        return a.edAiChecking;
      case 'failed':
        return a.edAiStatusFailed;
      case 'noKey':
        return a.edAiNoKey;
      case 'noPlan':
        return a.edAiNoPlan;
      case 'noDrafts':
        return a.edAiNoDrafts;
      default:
        return '';
    }
  });

  constructor() {
    whenWorkspaceChanges((id) => {
      this.status.set(null);
      this.loaded.set(false);
      this.failed.set(false);
      if (id) void this.load(id);
    });
  }

  /** Reads the status (transient failures are retried); an answer for a workspace left meanwhile is dropped. */
  async load(wsId: string): Promise<void> {
    const ok = await loadWithRetry(
      async () => {
        const status = await this.api.aiStatus(wsId);
        if (this.ws.id() === wsId) this.status.set(status);
      },
      () => this.ws.id() === wsId,
    );
    if (this.ws.id() !== wsId) return;
    this.loaded.set(ok);
    this.failed.set(!ok);
  }

  /** Reads the status again in the background (the day's count moved); never rejects. */
  async refresh(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId || !this.loaded()) return;
    try {
      const status = await this.api.aiStatus(wsId);
      if (this.ws.id() === wsId) this.status.set(status);
    } catch {
      // What is shown stays.
    }
  }

  /**
   * Writes drafts for a topic. Resolves to the texts (the server trims them and leaves out blank ones); rejects
   * when the server refuses (the caller shows the reason: no key, the plan, the day's allowance, the provider).
   * The count of drafts left shows at once, and the status is read again afterwards.
   */
  async write(request: AiRequest): Promise<string[]> {
    const wsId = this.ws.id();
    if (!wsId) throw new Error('No workspace selected');
    try {
      const done = await this.api.aiPosts(wsId, {
        topic: request.topic,
        points: [...request.points],
        tone: request.tone,
        count: request.count,
      });
      if (this.ws.id() === wsId) {
        this.status.update((s) =>
          s && s.draftsLeftToday !== null
            ? { ...s, draftsLeftToday: Math.max(0, s.draftsLeftToday - done.variants.length) }
            : s,
        );
      }
      return done.variants;
    } finally {
      void this.refresh();
    }
  }
}

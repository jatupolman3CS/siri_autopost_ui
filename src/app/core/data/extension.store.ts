import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '../http/api.service';
import { I18nService, fmt } from '../i18n/i18n.service';
import { NotificationService } from '../services/notification.service';
import { DevicesStore } from './devices.store';
import { PostsStore } from './posts.store';
import { SettingsStore } from './settings.store';
import { WorkspaceStore, whenWorkspaceChanges } from './workspace.store';

// Connection state of the browser extension and what happens to due posts while it is offline.
// "Simulate offline / reconnect" goes through the API (/engine/extension): going offline holds the next
// due posts as `waiting`, reconnecting releases them by the workspace's offline policy. Whether the
// browsers really are online comes from their heartbeats (SettingsStore).
@Injectable({ providedIn: 'root' })
export class ExtensionStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);
  private readonly posts = inject(PostsStore);
  private readonly settings = inject(SettingsStore);
  private readonly devices = inject(DevicesStore);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);

  readonly online = this.settings.extensionOnline.asReadonly();
  /** Offline because of "simulate offline" (the banner then offers to reconnect). */
  readonly simulated = this.settings.simulatedOffline.asReadonly();
  /** No browser is paired yet: the dashboard runs on its sample accounts. Unknown until /engine answers. */
  readonly unpaired = computed(() => this.settings.loaded() && this.settings.devices() === 0);
  /** Every paired browser has its web jobs paused. */
  readonly jobsPaused = computed(() => {
    const list = this.devices.list();
    return list.length > 0 && list.every((d) => d.jobsPaused);
  });
  readonly busy = signal(false);
  /** When this session saw the extension go offline (unknown after a reload). */
  readonly offlineSince = signal<Date | null>(null);

  constructor() {
    whenWorkspaceChanges(() => this.offlineSince.set(null));
  }

  /**
   * Starts or ends the offline simulation. It is keyed on the simulation flag, not on the real
   * presence: with every browser really offline, "reconnect" still only ends a simulation that is on.
   */
  async toggleSimulation(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId || this.busy()) return;
    const t = this.i18n.t();
    const goOnline = this.settings.simulatedOffline();
    this.busy.set(true);
    try {
      const r = await this.api.setExtensionOnline(wsId, goOnline);
      this.offlineSince.set(r.online ? null : new Date());
      await Promise.all([this.settings.refreshPresence(), this.posts.refresh()]);
      if (!goOnline) this.notify.error(t.off.toastOffline);
      else if (!this.online()) this.notify.info(t.api.simEndedOffline);
      else
        this.notify.success(
          this.settings.off().policy === 'skip' ? t.off.toastOnlineSkip : t.off.toastOnline,
        );
    } finally {
      this.busy.set(false);
    }
  }

  /** Gives up on the posts waiting for the extension (they become skipped). */
  async skipWaiting(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    const r = await this.api.skipWaiting(wsId);
    await this.posts.refresh();
    this.notify.info(fmt(this.i18n.t().off.toastSkipped, { n: r.affected }));
  }

  /** Pauses or resumes the posts every paired browser takes from the web (the API's `jobsPaused`). */
  async togglePause(): Promise<void> {
    const pause = !this.jobsPaused();
    const t = this.i18n.t();
    await Promise.all(
      this.devices
        .list()
        .filter((d) => d.jobsPaused !== pause)
        .map((d) => this.devices.update(d.id, { jobsPaused: pause })),
    );
    this.notify.info(pause ? t.api.jobsPausedNote : t.api.jobsResumedNote);
  }
}

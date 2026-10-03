import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '../http/api.service';
import { I18nService, fmt } from '../i18n/i18n.service';
import { NotificationService } from '../services/notification.service';
import { DeviceLiveStore } from './device-live.store';
import { DevicesStore } from './devices.store';
import { PostsStore } from './posts.store';
import { SettingsStore } from './settings.store';
import { WorkspaceStore } from './workspace.store';

// Connection state of the browser extension and what happens to due posts while it is offline.
// "Simulate offline / reconnect" goes through the API (/engine/extension) until devices report
// real heartbeats: going offline holds the next due posts as `waiting`, reconnecting releases
// them by the workspace's offline policy.
@Injectable({ providedIn: 'root' })
export class ExtensionStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);
  private readonly posts = inject(PostsStore);
  private readonly settings = inject(SettingsStore);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly devices = inject(DevicesStore);
  private readonly liveDevice = inject(DeviceLiveStore);

  readonly online = this.settings.extensionOnline.asReadonly();
  /** Offline because of "simulate offline" (the banner then offers to reconnect). */
  readonly simulated = this.settings.simulatedOffline.asReadonly();
  /** No browser is paired yet: nothing can post until one is (Team and workspaces, "Add device"). */
  readonly unpaired = computed(() => this.settings.devices() === 0);
  /** The shown browser takes no posts from the web (its `jobsPaused`, set here or on the Team page). */
  readonly paused = computed(() => this.liveDevice.device()?.jobsPaused ?? false);
  readonly busy = signal(false);
  /** When this session saw the extension go offline (unknown after a reload). */
  readonly offlineSince = signal<Date | null>(null);

  async toggleOnline(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId || this.busy()) return;
    const t = this.i18n.t();
    const goOnline = !this.online();
    this.busy.set(true);
    try {
      const r = await this.api.setExtensionOnline(wsId, goOnline);
      this.offlineSince.set(r.online ? null : new Date());
      await Promise.all([this.settings.refreshPresence(), this.posts.refresh()]);
      if (!goOnline) this.notify.error(t.off.toastOffline);
      else
        this.notify.success(
          this.settings.off().policy === 'skip' ? t.off.toastOnlineSkip : t.off.toastOnline,
        );
    } finally {
      this.busy.set(false);
    }
  }

  /** Drops the posts held while the extension was offline (the only banner action the API has). */
  async skipWaiting(): Promise<void> {
    const wsId = this.ws.id();
    if (!wsId) return;
    const r = await this.api.skipWaiting(wsId);
    await this.posts.refresh();
    this.notify.info(fmt(this.i18n.t().off.toastSkipped, { n: r.affected }));
  }

  /** Stops (or resumes) the shown browser taking posts from the web; the device sees it on its next sync. */
  async togglePause(): Promise<void> {
    const d = this.liveDevice.device();
    if (!d || this.busy()) return;
    const pause = !d.jobsPaused;
    this.busy.set(true);
    try {
      await this.devices.update(d.id, { jobsPaused: pause });
      const t = this.i18n.t();
      this.notify.info(pause ? t.api.extPausedToast : t.ext.resumedToast);
    } finally {
      this.busy.set(false);
    }
  }
}

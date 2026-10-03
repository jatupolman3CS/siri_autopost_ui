import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../http/api.service';
import { I18nService, fmt } from '../i18n/i18n.service';
import { NotificationService } from '../services/notification.service';
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

  readonly online = this.settings.extensionOnline.asReadonly();
  /** Pausing lives in the extension popup preview only. */
  readonly paused = signal(false);
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
      this.settings.extensionOnline.set(r.online);
      this.offlineSince.set(r.online ? null : new Date());
      await this.posts.refresh();
      if (!goOnline) this.notify.error(t.off.toastOffline);
      else
        this.notify.success(
          this.settings.off().policy === 'skip' ? t.off.toastOnlineSkip : t.off.toastOnline,
        );
    } finally {
      this.busy.set(false);
    }
  }

  async bannerAction(kind: 'skip' | 'queue' | 'notify'): Promise<void> {
    const t = this.i18n.t();
    const wsId = this.ws.id();
    if (kind === 'skip' && wsId) {
      const r = await this.api.skipWaiting(wsId);
      await this.posts.refresh();
      this.notify.info(fmt(t.off.toastSkipped, { n: r.affected }));
    } else if (kind === 'queue') {
      this.notify.info(fmt(t.off.toastQueued, { n: this.posts.waiting().length }));
    } else {
      this.notify.success(t.off.toastNotified);
    }
  }

  togglePause(): void {
    const p = !this.paused();
    this.paused.set(p);
    const t = this.i18n.t();
    this.notify.info(p ? t.ext.pausedToast : t.ext.resumedToast);
  }
}

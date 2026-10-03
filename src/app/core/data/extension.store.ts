import { Injectable, inject, signal } from '@angular/core';
import { dkey } from '../i18n/format';
import { I18nService, fmt } from '../i18n/i18n.service';
import { NotificationService } from '../services/notification.service';
import { PostsStore } from './posts.store';
import { SettingsStore } from './settings.store';

// Connection state of the browser extension and what happens to due posts while it is offline.
// "Simulate offline / reconnect" mirrors the design prototype until devices report real heartbeats.
@Injectable({ providedIn: 'root' })
export class ExtensionStore {
  private readonly posts = inject(PostsStore);
  private readonly settings = inject(SettingsStore);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);

  readonly online = signal(true);
  readonly paused = signal(false);

  toggleOnline(): void {
    const t = this.i18n.t();
    if (this.online()) {
      // The next few posts due today now wait for the extension.
      let n = 0;
      const now = this.posts.now;
      const today = this.posts.todayKey;
      this.posts.setStatuses((p) =>
        p.status === 'queued' && p.dt > now && dkey(p.dt) === today && n++ < 4
          ? 'waiting'
          : p.status,
      );
      this.online.set(false);
      this.notify.error(t.off.toastOffline);
    } else {
      const skip = this.settings.off().policy === 'skip';
      this.posts.setStatuses((p) =>
        p.status === 'waiting' ? (skip ? 'skipped' : 'success') : p.status,
      );
      this.online.set(true);
      this.notify.success(skip ? t.off.toastOnlineSkip : t.off.toastOnline);
    }
  }

  bannerAction(kind: 'skip' | 'queue' | 'notify'): void {
    const t = this.i18n.t();
    const n = this.posts.waiting().length;
    if (kind === 'skip') {
      this.posts.setStatuses((p) => (p.status === 'waiting' ? 'skipped' : p.status));
      this.notify.info(fmt(t.off.toastSkipped, { n }));
    } else if (kind === 'queue') {
      this.notify.info(fmt(t.off.toastQueued, { n }));
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

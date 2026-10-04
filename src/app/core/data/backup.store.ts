import { Injectable, inject, signal } from '@angular/core';
import { EXPORT_FILES, downloadJson } from '../flow';
import { ApiBackup, ApiRestoreResult, ApiService } from '../http/api.service';
import '../i18n/i18n.engine';
import { I18nService, fmt } from '../i18n/i18n.service';
import { NotificationService } from '../services/notification.service';
import { CollectionsStore } from './collections.store';
import { LinkSetsStore } from './link-sets.store';
import { PostsStore } from './posts.store';
import { SettingsStore } from './settings.store';
import { WorkspaceStore } from './workspace.store';

// Backup and restore of the workspace (the anti-ban page, Pro and above, admins): one JSON file with the
// collections, link sets, schedules, the advanced anti-ban rules and, when the plan allows, the notification
// rules and the auto-reply rules. It never holds a token. Restoring replaces those, so every store that shows
// them reads again afterwards.
@Injectable({ providedIn: 'root' })
export class BackupStore {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WorkspaceStore);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly collections = inject(CollectionsStore);
  private readonly linkSets = inject(LinkSetsStore);
  private readonly posts = inject(PostsStore);
  private readonly settings = inject(SettingsStore);

  /** A backup is being read or a restore is on its way. */
  readonly busy = signal(false);

  /**
   * Reads the backup and saves it as `autopost-backup.json`. Answers whether the file was saved: the API
   * refusal is toasted by the interceptor, a browser that will not download is toasted here.
   */
  async download(): Promise<boolean> {
    const wsId = this.ws.id();
    if (!wsId || this.busy()) return false;
    const t = this.i18n.t();
    this.busy.set(true);
    try {
      const backup = await this.api.backup(wsId);
      if (!downloadJson(EXPORT_FILES.backup, backup)) {
        this.notify.error(t.api.engine.backupFailed);
        return false;
      }
      this.notify.success(t.ab.backedUp);
      return true;
    } catch {
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Replaces the workspace's collections, link sets, schedules and settings with the file. Rejects with the
   * API's refusal (nothing changed then); on success it toasts the counts and reads everything again.
   */
  async restore(file: ApiBackup): Promise<ApiRestoreResult> {
    const wsId = this.ws.id();
    if (!wsId) throw new Error('No workspace selected');
    this.busy.set(true);
    let result: ApiRestoreResult;
    try {
      result = await this.api.restore(wsId, file);
    } finally {
      this.busy.set(false);
    }
    if (this.ws.id() === wsId) {
      this.notify.success(
        fmt(this.i18n.t().ab.restored, {
          c: result.collections,
          s: result.linkSets,
          h: result.schedules,
        }),
      );
      // In the background: the dialog need not wait for the lists (the reads never reject).
      void this.refreshAfterRestore();
    }
    return result;
  }

  /**
   * Reads again what a restore replaced: collections, link sets, the queued posts of the re-made schedules and
   * the advanced rules. Stores of the schedules, notification rules and auto-reply read their lists here once
   * they exist (add them to this list).
   */
  private async refreshAfterRestore(): Promise<void> {
    await Promise.allSettled([
      this.collections.refresh(),
      this.linkSets.refresh(),
      this.posts.refresh(),
      this.settings.load(),
    ]);
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CampaignsStore, SAVE_FAILED } from '../../core/data/campaigns.store';
import { buildBackup, imageIdsOf, parseBackup, summarize } from '../../core/ext/lib/backup.js';
import { fmtDateTime } from '../../core/ext/lib/shared.js';
import { convertSiriExport, nameFromFile } from '../../core/ext/lib/siri-import.js';
import { readZip } from '../../core/ext/lib/zip.js';
import { downloadBlob, fileStamp, safeFileName } from '../../core/ext/media';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { CampaignActions } from './campaign-actions.service';

/** Shown in the files the extension writes ("extensionVersion"). */
const WEB_VERSION = 'web';

// Backups in the extension's own file format: download everything or one campaign (with media and,
// on request, the Bot Token), the config file the extension loads from its folder on a new computer,
// and upload a backup or a SIRI export as a replacement or as new campaigns (client/dashboard.js "backup").
@Component({
  selector: 'app-camp-backup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './camp-backup.component.html',
  styleUrl: './camp-backup.component.scss',
})
export class CampBackupComponent {
  private readonly store = inject(CampaignsStore);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  protected readonly actions = inject(CampaignActions);
  protected readonly x = computed(() => this.i18n.t().api.ext);

  protected readonly scope = signal<'all' | 'current'>('all');
  protected readonly images = signal(true);
  protected readonly token = signal(false);
  protected readonly cfgToken = signal(true);
  protected readonly cfgAutoStart = signal(false);
  protected readonly mode = signal<'replace' | 'merge'>('replace');
  protected readonly busy = signal(false);

  protected async exportFile(): Promise<void> {
    const s = this.store.settings();
    const cur = this.store.campaign();
    const x = this.x();
    if (!s) return;
    const only = this.scope() === 'current';
    if (only && !cur) return;
    await this.withBusy(async () => {
      await this.store.flush();
      const campaignIds = only && cur ? [cur.id] : null;
      const camps = campaignIds
        ? s.campaigns.filter((c) => campaignIds.includes(c.id))
        : s.campaigns;
      const images = this.images() ? await this.store.mediaRecords(imageIdsOf(camps)) : {};
      const backup = buildBackup(s, images, {
        includeImages: this.images(),
        includeToken: this.token(),
        campaignIds,
        version: WEB_VERSION,
      });
      const name = `fb-autopost-${only && cur ? safeFileName(cur.name) + '-' : ''}${fileStamp()}.json`;
      downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), name);
      const sum = summarize(backup.settings, backup.images ?? {});
      this.notify.success(
        fmt(x.exported, { name, c: sum.campaigns, g: sum.groups, i: sum.images }),
      );
    });
  }

  /** autopost-config.json: the extension loads it by itself when a fresh browser has no data. */
  protected async configFile(): Promise<void> {
    const s = this.store.settings();
    if (!s) return;
    await this.withBusy(async () => {
      await this.store.flush();
      const images = await this.store.mediaRecords(imageIdsOf(s.campaigns));
      const backup = buildBackup(s, images, {
        includeImages: true,
        includeToken: this.cfgToken(),
        autoStart: this.cfgAutoStart(),
        version: WEB_VERSION,
      });
      downloadBlob(
        new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
        'autopost-config.json',
      );
      this.notify.success(this.x().configFileDone);
    });
  }

  protected async importJson(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    const x = this.x();
    if (!file || !this.canImport()) return;
    let parsed;
    try {
      parsed = parseBackup(await file.text());
    } catch (e) {
      this.notify.error(fmt(x.importFailed, { e: (e as Error)?.message ?? String(e) }));
      return;
    }
    const sum = summarize(parsed.settings, parsed.images);
    const when = parsed.meta.exportedAt ? fmtDateTime(Date.parse(parsed.meta.exportedAt)) : '-';
    const ask = fmt(x.confirmImport, {
      file: file.name,
      when,
      c: sum.campaigns,
      g: sum.groups,
      p: sum.posts,
      i: sum.images,
      action: this.mode() === 'replace' ? x.importReplaceAction : x.importMergeAction,
    });
    if (!confirm(ask)) return;
    await this.apply(parsed, [parsed.badImages ? fmt(x.badImages, { n: parsed.badImages }) : '']);
  }

  /** A SIRI export (.zip): posts, images and groups; global and Telegram settings stay as they are. */
  protected async importSiri(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    const x = this.x();
    const s = this.store.settings();
    if (!file || !s || !this.canImport()) return;
    this.notify.info(x.readingZip);
    let converted;
    try {
      const files = await readZip(await file.arrayBuffer());
      converted = await convertSiriExport(files, { name: nameFromFile(file.name) });
    } catch (e) {
      this.notify.error(fmt(x.importFailed, { e: (e as Error)?.message ?? String(e) }));
      return;
    }
    const { report } = converted;
    const camps = converted.settings.campaigns
      .map(
        (c) =>
          `• ${c.name}: ${fmt(x.siriCampaign, { g: c.groups.length, p: c.posts.length })}${c.enabled ? '' : ` ${x.siriOff}`}`,
      )
      .join('\n');
    const ask = fmt(x.confirmSiri, {
      file: file.name,
      camps,
      i: report.images,
      dup: report.duplicateImages ? fmt(x.siriDup, { n: report.duplicateImages }) : '',
      missing: report.missingImages ? '\n' + fmt(x.siriMissing, { n: report.missingImages }) : '',
      action: this.mode() === 'replace' ? x.importReplaceAction : x.importMergeAction,
    });
    if (!confirm(ask)) return;
    converted.settings.global = JSON.parse(JSON.stringify(s.global));
    await this.apply({ settings: converted.settings, images: converted.images }, [
      report.missingImages ? fmt(x.siriMissing, { n: report.missingImages }) : '',
      report.emptyPosts ? fmt(x.siriEmpty, { n: report.emptyPosts }) : '',
    ]);
  }

  /** Like the extension: no import while it runs or posts. */
  private canImport(): boolean {
    if (this.store.running() || this.store.busy()) {
      this.notify.error(this.x().importStopFirst);
      return false;
    }
    return true;
  }

  private async apply(
    parsed: Parameters<CampaignsStore['importParsed']>[0],
    notes: string[],
  ): Promise<void> {
    const x = this.x();
    await this.withBusy(async () => {
      const sum = summarize(parsed.settings, parsed.images);
      const r = await this.store.importParsed(parsed, this.mode());
      const all = [
        r.missingImages ? fmt(x.missingImages, { n: r.missingImages }) : '',
        ...notes,
      ].filter(Boolean);
      this.notify.success(
        fmt(x.imported, { c: sum.campaigns }) + (all.length ? ' · ' + all.join(' · ') : ''),
      );
    });
  }

  private async withBusy(fn: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await fn();
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      this.notify.error(
        msg === SAVE_FAILED ? this.x().saveFailed : fmt(this.x().importFailed, { e: msg }),
      );
    } finally {
      this.busy.set(false);
    }
  }
}

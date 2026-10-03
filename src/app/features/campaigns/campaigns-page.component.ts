import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CampaignsStore } from '../../core/data/campaigns.store';
import { DevicesStore } from '../../core/data/devices.store';
import { PermissionsService } from '../../core/data/permissions.service';
import { Campaign, fmtDateTime } from '../../core/ext/lib/shared.js';
import { campaignMeta, campaignView } from '../../core/ext/run-view';
import { I18nService, ago, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { CampaignActions } from './campaign-actions.service';
import { CampBackupComponent } from './camp-backup.component';
import { CampConfigComponent } from './camp-config.component';
import { CampGlobalComponent } from './camp-global.component';
import { CampGroupsComponent } from './camp-groups.component';
import { CampLogsComponent } from './camp-logs.component';
import { CampPostsComponent } from './camp-posts.component';
import { CampTestComponent } from './camp-test.component';

// The extension's settings page on the web: every campaign of one paired browser (groups, posts,
// media, timing, human-like behaviour), the global and Telegram settings, the run overview, a test
// post, backups and the log. Edits save on their own; the browser picks them up within ~30 s, and
// the buttons (start, stop, post now, test) run there on its next sync.
@Component({
  selector: 'app-campaigns-page',
  imports: [
    RouterLink,
    EmptyStateComponent,
    CampGroupsComponent,
    CampPostsComponent,
    CampConfigComponent,
    CampGlobalComponent,
    CampTestComponent,
    CampBackupComponent,
    CampLogsComponent,
  ],
  providers: [CampaignActions],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campaigns-page.component.html',
  styleUrl: './campaigns-page.component.scss',
})
export class CampaignsPageComponent {
  private readonly notify = inject(NotificationService);
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  protected readonly x = computed(() => this.t().api.ext);
  protected readonly store = inject(CampaignsStore);
  protected readonly devices = inject(DevicesStore);
  private readonly permissions = inject(PermissionsService);
  protected readonly actions = inject(CampaignActions);
  protected readonly readOnly = this.actions.readOnly;

  /** Ticks every second so "next in 3 min 20 s" counts down. */
  protected readonly now = signal(Date.now());

  constructor() {
    const stop = this.store.watch();
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => {
      stop();
      clearInterval(timer);
    });
    effect(() => {
      this.devices.list();
      untracked(() => this.store.ensureDevice());
    });
    // A save collided with newer settings from the browser: they were loaded instead.
    effect(() => {
      if (this.store.reloadedAt()) untracked(() => this.notify.info(this.x().reloaded));
    });
  }

  protected readonly state = this.store.state;

  protected readonly saveLabel = computed(() => {
    const x = this.x();
    switch (this.store.saveState()) {
      case 'dirty':
      case 'saving':
        return this.t().api.saving;
      case 'saved':
        return this.t().api.saved;
      case 'error':
        return this.store.saveError() ?? x.saveFailed;
      default:
        return '';
    }
  });

  protected readonly runBadge = computed(() => {
    const x = this.x();
    const s = this.state();
    if (s.current) return { cls: 'busy', label: x.badgePosting };
    if (s.running) return { cls: 'on', label: x.badgeRunning };
    return { cls: '', label: x.badgeStopped };
  });

  protected readonly deviceLine = computed(() => {
    const x = this.x();
    const d = this.store.device();
    const live = this.store.live();
    if (!d) return '';
    const online = live?.online ?? d.online;
    const seen = live?.lastSeenAt ?? d.lastSeenAt;
    const parts = [
      online
        ? this.t().api.deviceOnline
        : fmt(x.offlineSeen, { t: ago(this.t(), seen ? new Date(seen) : null) }),
    ];
    const version = live?.version || d.version;
    if (version) parts.push(fmt(x.version, { v: version }));
    return parts.join(' · ');
  });

  protected readonly revisionLine = computed(() => {
    const x = this.x();
    const rev = this.store.revision();
    if (!rev) return x.revNone;
    return fmt(this.store.updatedByDevice() ? x.revByDevice : x.revByWeb, { n: rev });
  });

  /** No state from the browser yet: its extension has not synced (or is too old to). */
  protected readonly neverSynced = computed(() => {
    const live = this.store.live();
    return !!live && !live.state && !this.store.revision();
  });

  protected readonly currentLine = computed(() => {
    const x = this.x();
    const s = this.state();
    this.now();
    if (s.current) {
      const c = this.store.campaigns().find((c) => c.id === s.current?.campaignId);
      const from = s.current.cloud ? x.fromWeb : c ? c.name + ' → ' : '';
      return `${s.testing ? x.testTag : ''}${fmt(x.postingNow, { from, url: s.current.url })}`;
    }
    if (s.running && s.pausedUntil && s.pausedUntil > Date.now()) {
      return fmt(x.pausedUntil, { at: fmtDateTime(s.pausedUntil), why: s.pauseReason || '' });
    }
    return '';
  });

  protected readonly overview = computed(() => {
    const x = this.x();
    const s = this.state();
    const now = this.now();
    return this.store.campaigns().map((c) => {
      const v = campaignView(x, c, s);
      return { c, v, meta: campaignMeta(x, c, v, s, now) };
    });
  });

  protected readonly current = computed(() => {
    const c = this.store.campaign();
    if (!c) return null;
    const x = this.x();
    const s = this.state();
    const v = campaignView(x, c, s);
    return { c, label: v.label, meta: campaignMeta(x, c, v, s, this.now()) };
  });

  protected selectDevice(id: string): void {
    void this.store.selectDevice(id);
  }

  /** Owners and admins control the paired browsers (the server checks it too). */
  protected readonly canManageDevices = this.permissions.canAdmin;
  protected readonly adminHint = this.permissions.adminHint;
  protected readonly editHint = this.permissions.editHint;

  protected async toggleJobs(id: string, paused: boolean): Promise<void> {
    await this.devices.update(id, { jobsPaused: !paused });
    this.notify.info(paused ? this.t().api.jobsResumedNote : this.t().api.jobsPausedNote);
  }

  protected rename(c: Campaign, name: string): void {
    this.store.change(() => (c.name = name));
  }

  protected setEnabled(c: Campaign, on: boolean): void {
    this.store.change(() => (c.enabled = on));
  }

  protected add(): void {
    this.store.addCampaign();
  }

  protected duplicate(c: Campaign): void {
    this.store.duplicateCampaign(c);
    this.notify.info(this.x().duplicated);
  }

  protected remove(c: Campaign): void {
    if (!confirm(fmt(this.x().confirmDeleteCampaign, { name: c.name }))) return;
    this.store.deleteCampaign(c);
  }

  protected start(): void {
    void this.actions.run('start', {}, this.x().started);
  }

  protected stop(): void {
    void this.actions.run('stop', {}, this.x().stopped);
  }

  protected runNow(c: Campaign): void {
    void this.actions.run('runNow', { campaignId: c.id }, this.x().queuedNow);
  }

  protected readonly fmtDateTime = fmtDateTime;
}

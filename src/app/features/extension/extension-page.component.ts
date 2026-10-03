import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminStore } from '../../core/data/admin.store';
import { AccountsStore } from '../../core/data/accounts.store';
import { DashboardStatsService } from '../../core/data/dashboard-stats.service';
import { DeviceLiveStore } from '../../core/data/device-live.store';
import { ExtensionStore } from '../../core/data/extension.store';
import { PlatformKey } from '../../core/data/models';
import { PostsStore } from '../../core/data/posts.store';
import { PLATFORMS } from '../../core/data/reference';
import { SessionStore } from '../../core/data/session.store';
import { SettingsStore } from '../../core/data/settings.store';
import { DevicesStore } from '../../core/data/devices.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { hm } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';

// The extension's status in the dashboard, from the workspace's real data: the next post, today's quota
// per platform, the pause switch (the device's `jobsPaused`) and the shown browser's own activity log.
@Component({
  selector: 'app-extension-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './extension-page.component.html',
  styleUrl: './extension-page.component.scss',
})
export class ExtensionPageComponent {
  private readonly i18n = inject(I18nService);
  private readonly posts = inject(PostsStore);
  private readonly settings = inject(SettingsStore);
  private readonly admin = inject(AdminStore);
  private readonly stats = inject(DashboardStatsService);
  protected readonly session = inject(SessionStore);
  protected readonly devices = inject(DevicesStore);
  private readonly accounts = inject(AccountsStore);
  protected readonly live = inject(DeviceLiveStore);
  protected readonly workspaces = inject(WorkspaceStore);
  protected readonly ext = inject(ExtensionStore);
  protected readonly t = this.i18n.t;

  constructor() {
    // Follow the shown browser (state and log) for as long as this page is open.
    const stop = this.live.watch();
    inject(DestroyRef).onDestroy(stop);
  }

  protected readonly why = computed(() => {
    const e = this.t().ext;
    return [
      ['ph-globe-simple', e.w1],
      ['ph-hand-pointing', e.w2],
      ['ph-shield-check', e.w3],
    ];
  });

  protected readonly short = computed(() => {
    const e = this.t().ext;
    const posting = this.posts.today().some((p) => p.status === 'posting');
    return !this.ext.online()
      ? e.offline
      : this.ext.paused()
        ? this.t().api.extPaused
        : posting
          ? e.live
          : e.idle;
  });

  /** The next queued post, or null when nothing is waiting. */
  protected readonly next = computed(() => {
    const p = this.posts.next();
    if (!p) return null;
    const m = this.stats.nextInMin();
    const platform = PLATFORMS[p.platform];
    return {
      inMin: fmt(this.t().ext.inMin, { m: m ?? 0 }),
      icon: platform.icon,
      time: p.time,
      target: `${platform.name} · ${p.target}`,
      text: p.text,
    };
  });

  /** Today's quota of the platforms this workspace has an account on (Facebook until it has one). */
  protected readonly quota = computed(() => {
    const limits = this.settings.ab().limits;
    const used = this.settings.usedToday();
    const have = new Set(this.accounts.list().map((a) => a.platform));
    const shown = (['fb', 'ig', 'x'] as PlatformKey[]).filter((k) => have.has(k) || k === 'fb');
    return shown.map((k) => ({
      icon: PLATFORMS[k].icon,
      name: PLATFORMS[k].name,
      pct: limits[k] ? Math.min(100, Math.round((used[k] / limits[k]) * 100)) : 0,
      label: `${used[k]}/${limits[k]}`,
    }));
  });

  /** The newest log lines the extension reported (errors and warnings coloured). */
  protected readonly log = computed(() => {
    const color: Record<string, string> = {
      error: 'var(--color-danger)',
      warn: 'var(--color-warning)',
      ok: 'var(--color-success)',
    };
    return this.live
      .logs()
      .slice(-6)
      .map((l) => ({
        time: hm(new Date(l.t)),
        text: l.msg,
        color: color[l.level] ?? 'var(--color-text)',
      }));
  });

  /** The shown browser's own name and version, as it reported them when it paired. */
  protected readonly browser = computed(() => {
    const d = this.live.device();
    return d ? [d.browser, d.version && `v${d.version}`].filter(Boolean).join(' · ') : '';
  });

  protected readonly bound = computed(() => {
    const max = this.admin.plans()[this.session.plan()].devices;
    return fmt(this.t().ext.bound, {
      e: this.session.email(),
      n: this.devices.list().length,
      max: max ?? '∞',
    });
  });
}

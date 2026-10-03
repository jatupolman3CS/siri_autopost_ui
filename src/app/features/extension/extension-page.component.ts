import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountsStore } from '../../core/data/accounts.store';
import { DashboardStatsService } from '../../core/data/dashboard-stats.service';
import { ExtensionStore } from '../../core/data/extension.store';
import { PlatformKey } from '../../core/data/models';
import { PermissionsService } from '../../core/data/permissions.service';
import { PostsStore } from '../../core/data/posts.store';
import { PLATFORMS } from '../../core/data/platforms';
import { SessionStore } from '../../core/data/session.store';
import { SettingsStore } from '../../core/data/settings.store';
import { DevicesStore } from '../../core/data/devices.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';

// Preview of what the browser extension's popup shows (the extension itself has only a status page
// since 2.2). The numbers come from the workspace; the activity list is a sample.
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
  private readonly accounts = inject(AccountsStore);
  private readonly stats = inject(DashboardStatsService);
  protected readonly session = inject(SessionStore);
  protected readonly perm = inject(PermissionsService);
  protected readonly devices = inject(DevicesStore);
  protected readonly workspaces = inject(WorkspaceStore);
  protected readonly ext = inject(ExtensionStore);
  protected readonly t = this.i18n.t;

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
      : this.ext.jobsPaused()
        ? e.paused
        : posting
          ? e.live
          : e.idle;
  });

  protected readonly next = computed(() => {
    const p = this.posts.next();
    const m = this.stats.nextInMin();
    if (!p) return { inMin: '', icon: 'ph-clock', time: '--:--', target: '', text: '' };
    const platform = PLATFORMS[p.platform];
    return {
      inMin: fmt(this.t().ext.inMin, { m: m ?? 0 }),
      icon: platform.icon,
      time: p.time,
      target: `${platform.name} · ${p.target}`,
      text: p.text,
    };
  });

  protected readonly quota = computed(() => {
    const limits = this.settings.ab().limits;
    const used = this.settings.used24h();
    const ready = this.posts.loaded() && this.accounts.loaded();
    return (['fb', 'ig', 'x'] as PlatformKey[]).map((k) => ({
      icon: PLATFORMS[k].icon,
      name: PLATFORMS[k].name,
      pct: ready ? Math.min(100, Math.round((used[k] / limits[k]) * 100)) : 0,
      label: `${ready ? used[k] : '—'}/${limits[k]}`,
    }));
  });

  protected readonly log = computed(() => {
    const e = this.t().ext;
    const rows: [string, string, string?][] = [
      ['10:19', e.log1],
      ['10:19', e.log2],
      ['10:20', e.log3],
      ['10:20', e.log4],
      ['10:21', e.log5, 'var(--color-success)'],
      ['10:21', e.log6],
    ];
    return rows.map(([time, text, color]) => ({ time, text, color: color ?? 'var(--color-text)' }));
  });

  /** Devices paired of the most the owner's plan allows (null = unlimited). */
  protected readonly bound = computed(() => {
    const max = this.workspaces.current()?.limits.devices;
    return fmt(this.t().ext.bound, {
      e: this.session.email(),
      n: this.devices.list().length,
      max: max ?? '∞',
    });
  });

  /** The version of the paired browser's extension, as it reported itself. */
  protected readonly version = computed(() =>
    fmt(this.t().ext.version, { v: this.devices.list().find((d) => d.version)?.version ?? '—' }),
  );
}

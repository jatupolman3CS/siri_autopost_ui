import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminStore } from '../../core/data/admin.store';
import { DashboardStatsService } from '../../core/data/dashboard-stats.service';
import { ExtensionStore } from '../../core/data/extension.store';
import { PlatformKey } from '../../core/data/models';
import { PostsStore } from '../../core/data/posts.store';
import { SEED } from '../../core/data/seed.data';
import { SessionStore } from '../../core/data/session.store';
import { SettingsStore } from '../../core/data/settings.store';
import { TeamStore } from '../../core/data/team.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { I18nService, fmt } from '../../core/i18n/i18n.service';

// Preview of what the browser extension's popup shows (the extension itself lives in
// siri_autopost_backend/client and will adopt this design).
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
  protected readonly team = inject(TeamStore);
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
      : this.ext.paused()
        ? e.paused
        : posting
          ? e.live
          : e.idle;
  });

  protected readonly next = computed(() => {
    const p = this.posts.next();
    const m = this.stats.nextInMin();
    if (!p) return { inMin: '', icon: 'ph-clock', time: '--:--', target: '', text: '' };
    const platform = SEED.platforms[p.platform];
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
    const used = this.settings.usedToday();
    return (['fb', 'ig', 'x'] as PlatformKey[]).map((k) => ({
      icon: SEED.platforms[k].icon,
      name: SEED.platforms[k].name,
      pct: Math.min(100, Math.round((used[k] / limits[k]) * 100)),
      label: `${used[k]}/${limits[k]}`,
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

  protected readonly bound = computed(() => {
    const max = this.admin.plans()[this.session.plan()].devices;
    return fmt(this.t().ext.bound, {
      e: this.session.email(),
      n: this.team.devices().length,
      max: max ?? '∞',
    });
  });
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AntiBanSettings, SettingsStore } from '../../core/data/settings.store';
import { PlatformKey } from '../../core/data/models';
import { PostsStore } from '../../core/data/posts.store';
import { SEED } from '../../core/data/seed.data';
import { SessionStore } from '../../core/data/session.store';
import { hm } from '../../core/i18n/format';
import { I18nService } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';

type HumanKey = 'typing' | 'scroll' | 'shuffle' | 'autopause' | 'warmup';

@Component({
  selector: 'app-antiban-page',
  imports: [RouterLink, CheckboxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './antiban-page.component.html',
  styleUrl: './antiban-page.component.scss',
})
export class AntibanPageComponent {
  private readonly notify = inject(NotificationService);
  private readonly posts = inject(PostsStore);
  private readonly session = inject(SessionStore);
  private readonly i18n = inject(I18nService);
  protected readonly settings = inject(SettingsStore);
  protected readonly t = this.i18n.t;
  protected readonly ab = this.settings.ab;

  /** Advanced anti-ban needs Pro or above. */
  protected readonly locked = computed(() => ['free', 'basic'].includes(this.session.plan()));

  protected readonly risk = computed(() => {
    const ab = this.ab();
    const t = this.t().ab;
    const score =
      (ab.min < 2 ? 2 : ab.min < 3 ? 1 : 0) +
      (ab.limits.fb > 40 ? 1 : 0) +
      (ab.typing ? 0 : 1) +
      (ab.scroll ? 0 : 1) +
      (ab.autopause ? 0 : 1) +
      (this.locked() ? 1 : 0);
    return score <= 1
      ? { label: t.riskLow, color: 'var(--color-success)' }
      : score <= 3
        ? { label: t.riskMed, color: 'var(--color-warning)' }
        : { label: t.riskHigh, color: 'var(--color-danger)' };
  });

  /** The next 5 queued posts, spaced by the current delay range. */
  protected readonly dispatch = computed(() => {
    const ab = this.ab();
    const fr = [0.35, 0.8, 0.5, 0.65, 0.2];
    const now = this.posts.now();
    let cur = now.getTime();
    return this.posts
      .items()
      .filter((p) => p.status === 'queued' && p.dt > now)
      .sort((a, b) => a.dt.getTime() - b.dt.getTime())
      .slice(0, 5)
      .map((p, i) => {
        const wait = Math.round(ab.min + (ab.max - ab.min) * fr[i]);
        cur += wait * 60000;
        const platform = SEED.platforms[p.platform];
        return {
          time: hm(new Date(cur)),
          icon: platform.icon,
          target: `${platform.name} · ${p.target}`,
          wait: `+${wait} ${this.t().common.min}`,
        };
      });
  });

  protected readonly limitRows = computed(() => {
    const ab = this.ab();
    const used = this.settings.usedToday();
    return (Object.keys(SEED.platforms) as PlatformKey[]).map((k) => {
      const r = used[k] / ab.limits[k];
      return {
        k,
        icon: SEED.platforms[k].icon,
        name: SEED.platforms[k].name,
        limit: ab.limits[k],
        usedLabel: `${this.t().ab.usedToday} ${used[k]}/${ab.limits[k]}`,
        pct: Math.min(100, Math.round(r * 100)),
        color: r >= 0.8 ? 'var(--color-warning)' : 'var(--color-primary)',
      };
    });
  });

  protected readonly humanRows = computed(() => {
    const t = this.t().ab;
    const ab = this.ab();
    const rows: [HumanKey, string][] = [
      ['typing', t.hTyping],
      ['scroll', t.hScroll],
      ['shuffle', t.hShuffle],
      ['autopause', t.hPause],
      ['warmup', t.hWarm],
    ];
    return rows.map(([k, label]) => ({ k, label, on: ab[k] }));
  });

  protected setMin(v: string): void {
    const min = parseInt(v, 10);
    this.settings.patchAb({ min, max: Math.max(min + 1, this.ab().max) });
  }

  protected setMax(v: string): void {
    const max = parseInt(v, 10);
    this.settings.patchAb({ max, min: Math.min(max - 1, this.ab().min) });
  }

  protected setLimit(k: PlatformKey, v: string): void {
    this.settings.patchAb({
      limits: { ...this.ab().limits, [k]: Math.max(1, parseInt(v, 10) || 1) },
    });
  }

  protected setHuman(k: HumanKey, on: boolean): void {
    this.settings.patchAb({ [k]: on } as Partial<AntiBanSettings>);
  }

  protected readonly saving = signal(false);

  protected async save(): Promise<void> {
    this.saving.set(true);
    try {
      await this.settings.saveAb();
      this.notify.success(this.t().ab.saved);
    } finally {
      this.saving.set(false);
    }
  }
}

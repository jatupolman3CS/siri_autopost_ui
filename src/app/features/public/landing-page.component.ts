import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AdminStore } from '../../core/data/admin.store';
import { PublicStatsStore } from '../../core/data/public-stats.store';
import { dayNames } from '../../core/i18n/format';
import { PlanKey } from '../../core/data/models';
import { tierViews } from '../../core/data/plans';
import { PLATFORMS } from '../../core/data/reference';
import { SettingsStore } from '../../core/data/settings.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { CycleSwitchComponent } from '../../shared/components/cycle-switch.component';
import {
  PlanCard,
  PlanCardsComponent,
} from '../../shared/components/plan-cards/plan-cards.component';

@Component({
  selector: 'app-landing-page',
  imports: [PlanCardsComponent, CycleSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss',
})
export class LandingPageComponent {
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsStore);
  private readonly admin = inject(AdminStore);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  protected readonly platforms = Object.values(PLATFORMS);
  // The product preview shows the platform's real figures (guests have no workspace of their own).
  private readonly publicStats = inject(PublicStatsStore);
  protected readonly stats = this.publicStats.state;
  protected readonly kpis = computed(() => {
    const a = this.t().api;
    const s = this.publicStats.stats();
    return [
      { label: a.landSent, value: s ? s.postsSent7d.toLocaleString() : '—' },
      {
        label: a.landRate,
        value: s?.successRate7d == null ? '—' : `${s.successRate7d.toFixed(1)}%`,
      },
      { label: a.landDevices, value: s ? s.devicesActive24h.toLocaleString() : '—' },
    ];
  });
  protected readonly bars = computed(() =>
    this.publicStats.bars().map((b) => ({
      ...b,
      label: dayNames(this.i18n.li())[b.date.getDay()],
    })),
  );

  constructor() {
    void this.publicStats.load();
  }

  protected readonly steps = computed(() => {
    const l = this.t().land;
    return [
      [l.s1t, l.s1b],
      [l.s2t, l.s2b],
      [l.s3t, l.s3b],
    ];
  });
  protected readonly features = computed(() => {
    const l = this.t().land;
    return [
      ['ph-calendar-blank', l.f1t, l.f1b],
      ['ph-images', l.f2t, l.f2b],
      ['ph-timer', l.f3t, l.f3b],
      ['ph-gauge', l.f4t, l.f4b],
      ['ph-wifi-slash', l.f5t, l.f5b],
      ['ph-chart-bar', l.f6t, l.f6b],
    ];
  });
  protected readonly personas = computed(() => {
    const l = this.t().land;
    return [
      ['ph-storefront', l.p1t, l.p1b],
      ['ph-megaphone', l.p2t, l.p2b],
      ['ph-buildings', l.p3t, l.p3b],
    ];
  });

  protected readonly tiers = computed<PlanCard[]>(() => {
    const t = this.t();
    return tierViews(this.admin.plans(), this.settings.bill().cycle, t).map((p) => ({
      ...p,
      highlighted: p.k === 'pro',
      variant: p.k === 'pro' ? 'primary' : 'secondary',
      cta: p.k === 'free' ? t.land.trial : t.common.choose,
    }));
  });

  protected startTrial(plan: PlanKey = 'free'): void {
    void this.router.navigate(['/signup'], { queryParams: { plan } });
  }

  protected scrollTo(id: string): void {
    const el = document.getElementById(id);
    if (el)
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 72,
        behavior: 'smooth',
      });
  }
}

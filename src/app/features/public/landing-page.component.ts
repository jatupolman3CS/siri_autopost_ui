import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AdminStore } from '../../core/data/admin.store';
import { DashboardStatsService } from '../../core/data/dashboard-stats.service';
import { PlanKey } from '../../core/data/models';
import { tierViews } from '../../core/data/plans';
import { SEED } from '../../core/data/seed.data';
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
  protected readonly t = inject(I18nService).t;
  protected readonly stats = inject(DashboardStatsService);

  protected readonly platforms = Object.values(SEED.platforms);
  protected readonly kpis = computed(() => this.stats.kpis().slice(0, 3));
  protected readonly queue = computed(() => this.stats.queueRows().slice(0, 4));

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

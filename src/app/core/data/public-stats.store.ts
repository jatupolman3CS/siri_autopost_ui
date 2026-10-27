import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiPublicStats, ApiService } from '../http/api.service';

export type StatsState = 'idle' | 'loading' | 'ready' | 'error';

// The landing page's figures (/api/public/stats): platform-wide counts of the last 7 days from posts that
// really went out through a paired browser. Counts only, never a customer's content.
@Injectable({ providedIn: 'root' })
export class PublicStatsStore {
  private readonly api = inject(ApiService);

  readonly stats = signal<ApiPublicStats | null>(null);
  readonly state = signal<StatsState>('idle');

  /** Posts per day for the chart; the tallest day is 100%. */
  readonly bars = computed(() => {
    const days = this.stats()?.days ?? [];
    const max = Math.max(1, ...days.map((d) => d.sent + d.failed));
    return days.map((d) => {
      const [y, m, day] = d.date.split('-').map(Number);
      const total = d.sent + d.failed;
      return {
        date: new Date(y, m - 1, day),
        total,
        h: total ? Math.max(6, Math.round((total / max) * 100)) : 0,
        failPct: total ? Math.round((d.failed / total) * 100) : 0,
      };
    });
  });

  async load(): Promise<void> {
    if (this.state() === 'loading') return;
    this.state.set('loading');
    try {
      this.stats.set(await this.api.publicStats());
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }
}

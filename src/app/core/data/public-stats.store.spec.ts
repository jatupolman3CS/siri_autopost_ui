import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideApiTesting } from '../../testing/api-testing';
import { PublicStatsStore } from './public-stats.store';

describe('PublicStatsStore', () => {
  let http: HttpTestingController;
  let store: PublicStatsStore;

  beforeEach(() => {
    http = provideApiTesting();
    store = TestBed.inject(PublicStatsStore);
  });

  afterEach(() => http.verify());

  it('loads the platform figures and scales the chart to the busiest day', async () => {
    const done = store.load();
    expect(store.state()).toBe('loading');
    http.expectOne('/api/public/stats').flush({
      postsSent7d: 12,
      postsFailed7d: 3,
      successRate7d: 80,
      devicesActive24h: 2,
      days: [
        { date: '2026-10-01', sent: 0, failed: 0 },
        { date: '2026-10-02', sent: 6, failed: 2 },
        { date: '2026-10-03', sent: 3, failed: 0 },
      ],
    });
    await done;
    expect(store.state()).toBe('ready');
    const bars = store.bars();
    expect(bars.map((b) => b.total)).toEqual([0, 8, 3]);
    expect(bars.map((b) => b.h)).toEqual([0, 100, 38]);
    expect(bars[1].failPct).toBe(25);
    expect(bars[1].date.getDate()).toBe(2); // a calendar day, not shifted by the time zone
  });

  it('shows an error state instead of made-up numbers', async () => {
    const done = store.load();
    http.expectOne('/api/public/stats').flush(null, { status: 500, statusText: 'Server Error' });
    await done;
    expect(store.state()).toBe('error');
    expect(store.stats()).toBeNull();
    expect(store.bars()).toEqual([]);
  });
});

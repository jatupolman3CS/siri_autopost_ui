import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { apiSchedule } from '../../testing/schedules.fixtures';
import { scheduleView } from './schedule-view';

describe('scheduleView', () => {
  const dict = () => TestBed.inject(I18nService).t();
  const ctx = (over: Partial<Parameters<typeof scheduleView>[1]> = {}) => ({
    t: dict(),
    li: 1,
    today: '2026-10-04',
    collection: { name: 'Condo', icon: 'ph-buildings' },
    set: { name: 'Groups' },
    ...over,
  });

  beforeEach(() => {
    localStorage.setItem('ap-lang', 'en');
    TestBed.resetTestingModule();
  });
  afterEach(() => localStorage.clear());

  it('names the pair and the icon, with dashes for a collection or set that is gone', () => {
    const v = scheduleView(apiSchedule({ id: 'a' }), ctx());
    expect(v.pair).toBe('Condo → Groups');
    expect(v.icon).toBe('ph-buildings');
    const gone = scheduleView(
      apiSchedule({ id: 'a' }),
      ctx({ collection: undefined, set: undefined }),
    );
    expect(gone.pair).toBe('— → —');
    expect(gone.icon).toBe('ph-folder');
  });

  it('lists the times of a daily schedule with its posts per day and how posts are picked', () => {
    const v = scheduleView(apiSchedule({ id: 'a', perDay: 6 }), ctx());
    expect(v.cadence).toBe(
      `${dict().sch.mDaily} · 09:00, 18:00 · 6 tasks/day · ${dict().sch.oShuffle}`,
    );
    const rotate = scheduleView(apiSchedule({ id: 'a', order: 'rotate' }), ctx());
    expect(rotate.cadence).toContain(dict().sch.oRotate);
  });

  it('describes rounds, a spread and a one-off with their own words and the slots the server worked out', () => {
    const interval = scheduleView(
      apiSchedule({
        id: 'a',
        mode: 'interval',
        everyHours: 8,
        firstTime: '06:30',
        slots: ['06:30', '14:30', '22:30'],
      }),
      ctx(),
    );
    expect(interval.cadence).toContain('Every 8 h from 06:30 (06:30, 14:30, 22:30)');
    const drip = scheduleView(
      apiSchedule({
        id: 'a',
        mode: 'drip',
        dripCount: 3,
        dripFrom: '10:00',
        dripTo: '14:00',
        slots: ['10:00', '12:00', '14:00'],
      }),
      ctx(),
    );
    expect(drip.cadence).toContain('3/day between 10:00–14:00 (10:00, 12:00, 14:00)');
    const once = scheduleView(
      apiSchedule({
        id: 'a',
        mode: 'once',
        startDate: '2026-12-25',
        onceTime: '16:45',
        slots: ['16:45'],
      }),
      ctx(),
    );
    expect(once.cadence).toContain('Once on 25 Dec 16:45');
  });

  it('counts the groups with their own times and leaves out an empty list', () => {
    const v = scheduleView(
      apiSchedule({ id: 'a', overrides: { x: ['08:00'], y: [], z: ['10:00', '12:00'] } }),
      ctx(),
    );
    expect(v.cadence).toContain('2 groups with their own times');
  });

  it('keeps bump and auto-delete out of the cadence and says they are only saved', () => {
    const v = scheduleView(apiSchedule({ id: 'a', bumpHours: 12, autoDeleteDays: 3 }), ctx());
    expect(v.cadence).not.toContain('Bump');
    expect(v.stored).toBe(
      `Bump after 12 h · Delete after 3 days (${dict().api.flow.storedOnlyBadge})`,
    );
    expect(scheduleView(apiSchedule({ id: 'a' }), ctx()).stored).toBe('');
  });

  it('shows today, the next run and the day the calendar opens on', () => {
    const next = new Date(2026, 9, 6, 11, 5);
    const v = scheduleView(
      apiSchedule({ id: 'a', todayCount: 2, nextRunAt: next.toISOString() }),
      ctx(),
    );
    expect(v.todayLabel).toBe('2 tasks today');
    expect(v.nextLabel).toBe('Next run: 6 Oct 11:05');
    expect(v.calendarDay).toBe('2026-10-06');
    const none = scheduleView(apiSchedule({ id: 'a', nextRunAt: null }), ctx());
    expect(none.nextLabel).toBe('Next run: —');
    expect(none.calendarDay).toBe('2026-10-04');
  });

  it('tells active, paused and finished apart', () => {
    const active = scheduleView(apiSchedule({ id: 'a' }), ctx());
    expect([active.statusLabel, active.toggleLabel, active.finished]).toEqual([
      'Active',
      'Pause',
      false,
    ]);
    expect(active.dot).toBe('var(--color-success)');
    const paused = scheduleView(apiSchedule({ id: 'a', active: false }), ctx());
    expect([paused.statusLabel, paused.toggleLabel, paused.finished]).toEqual([
      'Paused',
      'Resume',
      false,
    ]);
    expect(paused.dot).toBe('var(--color-warning)');
    const past = apiSchedule({ id: 'a', mode: 'once', active: false, startDate: '2026-10-03' });
    expect(scheduleView(past, ctx()).finished).toBe(true);
    expect(scheduleView(past, ctx()).statusLabel).toBe('Finished');
    // On its own day, or before, a paused once-schedule is only paused.
    expect(scheduleView({ ...past, startDate: '2026-10-04' }, ctx()).finished).toBe(false);
    expect(scheduleView({ ...past, active: true, startDate: '2026-10-03' }, ctx()).finished).toBe(
      false,
    );
  });
});

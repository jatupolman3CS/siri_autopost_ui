import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AccountsStore } from '../../core/data/accounts.store';
import { CollectionsStore } from '../../core/data/collections.store';
import { DevicesStore } from '../../core/data/devices.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { PostsStore } from '../../core/data/posts.store';
import { SchedulesStore } from '../../core/data/schedules.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiPost } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { NotificationService } from '../../core/services/notification.service';
import {
  ACCOUNTS,
  WS,
  answerWorkspaceLoads,
  apiPost,
  provideApiTesting,
  settle,
  signIn,
} from '../../testing/api-testing';
import { apiCollection, apiCollectionPost } from '../../testing/collection-fixtures';
import { apiSchedule } from '../../testing/schedules.fixtures';
import { TimelinePageComponent } from './timeline-page.component';

// 22:46 on 6 Oct 2026, local: the clock of every spec here (the red line sits at 22:46).
const NOW = new Date(2026, 9, 6, 22, 46);
const TODAY = '2026-10-06';
const at = (h: number, m = 0, day = 6) => new Date(2026, 9, day, h, m, 0).toISOString();

const CONDO = apiCollection({
  id: 'c1',
  name: 'Condo posts',
  posts: [apiCollectionPost({ id: 'cp1', text: 'Condo for rent {{code}}' })],
});
const PLANTS = apiCollection({ id: 'c2', name: 'Plant posts', posts: [] });
const SCHEDULES = [
  apiSchedule({ id: 's1', name: 'Morning condo', collectionId: 'c1' }),
  apiSchedule({ id: 's2', name: 'Plant rounds', collectionId: 'c2' }),
];

/** The posts of the day: a green, a red, two yellow (one overdue, one coming), a skipped one and a single post. */
const POSTS: ApiPost[] = [
  apiPost({
    id: 'ok',
    scheduledAt: at(9),
    status: 'success',
    scheduleId: 's1',
    target: 'Group A',
    content: 'Done text',
  }),
  apiPost({
    id: 'bad',
    scheduledAt: at(10),
    status: 'failed',
    failureCode: 'rate_limit',
    failureDetail: 'Facebook warned',
    scheduleId: 's1',
    target: 'Group B',
    content: 'Failed text',
    collectionPostId: 'cp1',
  }),
  apiPost({
    id: 'late',
    scheduledAt: at(22, 30),
    status: 'queued',
    scheduleId: 's2',
    target: 'Group C',
    content: 'Late text',
  }),
  apiPost({
    id: 'soon',
    scheduledAt: at(23, 15),
    status: 'queued',
    scheduleId: 's2',
    target: 'Group D',
    content: 'Soon text',
    code: 'D1',
  }),
  apiPost({
    id: 'skip',
    scheduledAt: at(11),
    status: 'skipped',
    scheduleId: 's2',
    target: 'Group E',
  }),
  apiPost({
    id: 'solo',
    scheduledAt: at(12),
    status: 'queued',
    scheduleId: null,
    target: 'Group F',
    content: 'Solo text',
  }),
  apiPost({
    id: 'tomorrow',
    scheduledAt: at(8, 0, 7),
    status: 'queued',
    scheduleId: 's1',
    target: 'Group G',
  }),
];

describe('TimelinePageComponent', () => {
  let http: HttpTestingController;

  async function open(
    over: {
      posts?: ApiPost[];
      day?: string;
      schedule?: string;
      role?: 'owner' | 'viewer';
      paired?: boolean;
    } = {},
  ) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = provideApiTesting({
      imports: [TimelinePageComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    TestBed.inject(WorkspaceStore);
    TestBed.inject(PostsStore);
    TestBed.inject(CollectionsStore);
    TestBed.inject(SchedulesStore);
    TestBed.inject(AccountsStore);
    TestBed.inject(DevicesStore); // the post window names the browser
    TestBed.inject(LinkSetsStore);
    await signIn(http, {
      posts: over.posts ?? POSTS,
      collections: [CONDO, PLANTS],
      schedules: SCHEDULES,
      workspace: { role: over.role ?? 'owner' },
    });
    if (over.paired !== false)
      TestBed.inject(AccountsStore).list.set([{ ...ACCOUNTS[0], connected: true }]);
    const fixture = TestBed.createComponent(TimelinePageComponent);
    if (over.day) fixture.componentRef.setInput('day', over.day);
    if (over.schedule) fixture.componentRef.setInput('schedule', over.schedule);
    fixture.detectChanges();
    await tick(fixture);
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const t = () => TestBed.inject(I18nService).t();
  const tick = async (fixture: ComponentFixture<unknown>) => {
    await settle();
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
  };
  const dots = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('.dot')];
  const dot = (el: HTMLElement, id: string) =>
    el.querySelector<HTMLButtonElement>(`.dot[data-post="${id}"]`)!;
  const rowNames = (el: HTMLElement) =>
    [...el.querySelectorAll('.trow .rname')].map((n) => n.textContent?.trim());
  const kpi = (el: HTMLElement, key: string) =>
    el.querySelector(`[data-testid="kpi-${key}"]`)?.textContent?.trim();
  const button = (root: ParentNode, text: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(text),
    );

  afterEach(() => {
    vi.useRealTimers();
    try {
      http?.verify();
    } finally {
      http = undefined!;
      TestBed.resetTestingModule();
      localStorage.clear();
    }
  });

  describe('the board', () => {
    it('has a row for each collection of the day, then the posts no schedule made, each post a square', async () => {
      const { el } = await open();
      expect(rowNames(el)).toEqual(['Condo posts', 'Plant posts', t().api.flow.tlRowOther]);
      // Six posts today (the seventh is tomorrow's), one square each.
      expect(dots(el)).toHaveLength(6);
      const condo = el.querySelector('.trow[data-row="c:c1"]')!;
      expect([...condo.querySelectorAll('.dot')].map((d) => d.getAttribute('data-post'))).toEqual([
        'ok',
        'bad',
      ]);
      expect(condo.querySelector('.rnote')?.textContent?.trim()).toBe('Morning condo');
      // How many went out, in the row's counter.
      expect(condo.querySelector('.rcount')?.textContent?.trim()).toBe('1/2');
    });

    it('colours the squares by status light: green posted, red failed, yellow waiting, grey skipped', async () => {
      const { el } = await open();
      const light = (id: string) =>
        ['green', 'yellow', 'red', 'grey'].find((c) => dot(el, id).classList.contains(c));
      expect(['ok', 'bad', 'late', 'soon', 'skip', 'solo'].map(light)).toEqual([
        'green',
        'red',
        'yellow',
        'yellow',
        'grey',
        'yellow',
      ]);
    });

    it('names every square for a screen reader: time, group and status', async () => {
      const { el } = await open();
      expect(dot(el, 'bad').getAttribute('aria-label')).toBe(
        fmt(t().api.flow.tlDot, { time: '10:00', target: 'Group B', status: t().status.failed }),
      );
    });

    it('counts the day: all, waiting, posting, posted, failed', async () => {
      const { el } = await open();
      expect(['all', 'queued', 'posting', 'done', 'failed'].map((k) => kpi(el, k))).toEqual([
        '6',
        '3',
        '0',
        '1',
        '1',
      ]);
    });

    it('draws the red now line at the time of the moment, today only', async () => {
      const { el } = await open();
      expect(el.querySelector('[data-testid="now-tag"]')?.textContent?.trim()).toBe(
        fmt(t().api.flow.tlNowLabel, { t: '22:46' }),
      );
      expect(el.querySelector('[data-testid="now-line"]')).not.toBeNull();
      // 22:46 at 120 px an hour, after the padding.
      const line = el.querySelector<HTMLElement>('[data-testid="now-line"]')!;
      expect(line.style.left).toBe(`${232 + 14 + (22 * 60 + 46) * 2}px`);
    });

    it('has no now line on another day', async () => {
      const { el } = await open({ day: '2026-10-07' });
      expect(el.querySelector('[data-testid="now-line"]')).toBeNull();
      expect(el.querySelector('[data-testid="now-tag"]')).toBeNull();
    });

    it('opens on another day and shows its posts', async () => {
      const { el } = await open({ day: '2026-10-07' });
      expect(dots(el).map((d) => d.getAttribute('data-post'))).toEqual(['tomorrow']);
      expect(rowNames(el)).toEqual(['Condo posts']);
    });

    it('says so when the day has no posts', async () => {
      const { el } = await open({ day: '2026-10-20' });
      expect(dots(el)).toHaveLength(0);
      expect(el.querySelector('app-empty-state')?.textContent).toContain(t().api.flow.tlEmptyTitle);
      expect(el.querySelector('a[href="/app/schedules"]')).not.toBeNull();
      expect(kpi(el, 'all')).toBe('0');
    });

    it('shows one schedule only when it comes from the schedules page', async () => {
      const { el } = await open({ schedule: 's2' });
      expect(rowNames(el)).toEqual(['Plant posts']);
      expect(dots(el).map((d) => d.getAttribute('data-post'))).toEqual(['skip', 'late', 'soon']);
      expect(kpi(el, 'all')).toBe('3');
    });
  });

  describe('the next post', () => {
    it('names the next queued post and how long is left, and marks its square', async () => {
      const { el } = await open();
      const bar = el.querySelector('[data-testid="next-up"]')!;
      // "late" is 16 minutes past its time and not taken yet: it is the oldest queued one still waiting.
      expect(bar.textContent).toContain('23:15');
      expect(bar.textContent).toContain('Group D');
      expect(bar.textContent).toContain(fmt(t().api.flow.tlNextIn, { n: 29 }));
      expect(dot(el, 'soon').classList.contains('next')).toBe(true);
      expect(dot(el, 'late').classList.contains('next')).toBe(false);
    });

    it('marks a queued post whose time has passed and that no browser took', async () => {
      const { el } = await open();
      expect(dot(el, 'late').classList.contains('overdue')).toBe(true);
      expect(dot(el, 'soon').classList.contains('overdue')).toBe(false);
    });

    it('says when nothing is queued', async () => {
      const { el } = await open({
        posts: [apiPost({ id: 'ok', scheduledAt: at(9), status: 'success', scheduleId: 's1' })],
      });
      expect(el.querySelector('[data-testid="next-up"]')?.textContent).toContain(
        t().api.flow.tlNextNone,
      );
    });

    it('opens the post window from the bar', async () => {
      const { fixture, el } = await open();
      el.querySelector<HTMLButtonElement>('[data-testid="next-up"] .linkish')!.click();
      await tick(fixture);
      expect(el.querySelector('[data-testid="pd-text"]')?.textContent).toContain('Soon text');
    });
  });

  describe('filters', () => {
    it('keeps the posts of one light, and counts each light', async () => {
      const { fixture, el } = await open();
      const chips = [...el.querySelectorAll<HTMLButtonElement>('.fchip')];
      expect(chips.map((c) => c.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
        `${t().api.flow.tlLightAll} (6)`,
        `${t().api.flow.tlLightGreen} (1)`,
        `${t().api.flow.tlLightYellow} (3)`,
        `${t().api.flow.tlLightRed} (1)`,
        `${t().api.flow.tlLightGrey} (1)`,
      ]);
      chips[3].click();
      await tick(fixture);
      expect(dots(el).map((d) => d.getAttribute('data-post'))).toEqual(['bad']);
      expect(rowNames(el)).toEqual(['Condo posts']);
      // The counters above are the day's, whatever the filter.
      expect(kpi(el, 'all')).toBe('6');
    });

    it('searches the group, the text, the group code and the schedule name', async () => {
      const { fixture, el } = await open();
      const search = el.querySelector<HTMLInputElement>('input[type="search"]')!;
      const type = async (v: string) => {
        search.value = v;
        search.dispatchEvent(new Event('input'));
        await tick(fixture);
        return dots(el).map((d) => d.getAttribute('data-post'));
      };
      expect(await type('group d')).toEqual(['soon']);
      expect(await type('failed text')).toEqual(['bad']);
      expect(await type('d1')).toEqual(['soon']);
      expect(await type('plant rounds')).toEqual(['skip', 'late', 'soon']);
      expect(await type('nothing like this')).toEqual([]);
      expect(el.querySelector('app-empty-state')?.textContent).toContain(
        t().api.flow.tlEmptyFiltered,
      );
    });

    it('picks a schedule from the list', async () => {
      const { fixture, el } = await open();
      const select = el.querySelector<HTMLSelectElement>('select')!;
      expect([...select.options].map((o) => o.textContent?.trim())).toEqual([
        t().api.flow.tlFilterScheduleAll,
        'Morning condo',
        'Plant rounds',
      ]);
      select.value = 's1';
      select.dispatchEvent(new Event('change'));
      await tick(fixture);
      expect(rowNames(el)).toEqual(['Condo posts']);
    });
  });

  describe('moving around', () => {
    it('goes to the next and the previous day, and back to today', async () => {
      const { fixture, el } = await open();
      const title = () => el.querySelector('.daytitle')?.textContent?.trim();
      const today = title();
      el.querySelectorAll<HTMLButtonElement>('.daynav .nav-btn')[1].click();
      await tick(fixture);
      expect(title()).not.toBe(today);
      expect(dots(el).map((d) => d.getAttribute('data-post'))).toEqual(['tomorrow']);
      expect(el.querySelector('[data-testid="now-line"]')).toBeNull();
      button(el, t().common.today)!.click();
      await tick(fixture);
      expect(title()).toBe(today);
      expect(dots(el)).toHaveLength(6);
    });

    it('zooms the axis and remembers the zoom', async () => {
      const { fixture, el } = await open();
      const width = () => el.querySelector<HTMLElement>('.canvas')!.style.width;
      expect(width()).toBe(`${232 + 28 + 24 * 120}px`);
      button(el, t().api.flow.tlZoomMinute)!.click();
      await tick(fixture);
      expect(width()).toBe(`${232 + 28 + 24 * 480}px`);
      expect(localStorage.getItem('ap-tl-zoom')).toBe('480');
    });

    it('starts at the zoom the person chose last time', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      // provideApiTesting clears the storage, so set it again right after.
      http = provideApiTesting({
        imports: [TimelinePageComponent],
        providers: [provideRouter([])],
      });
      localStorage.setItem('ap-tl-zoom', '60');
      TestBed.inject(WorkspaceStore);
      TestBed.inject(PostsStore);
      await signIn(http, { posts: [], collections: [CONDO], schedules: SCHEDULES });
      const fixture = TestBed.createComponent(TimelinePageComponent);
      fixture.detectChanges();
      await settle();
      answerWorkspaceLoads(http, { collections: [CONDO], schedules: SCHEDULES });
      await tick(fixture);
      // No posts: the zoom is on the toolbar all the same.
      const on = fixture.nativeElement.querySelector('.seg button.on');
      expect(on?.textContent?.trim()).toBe(t().api.flow.tlZoomOverview);
    });

    it('reads the posts again from the refresh button', async () => {
      const { fixture, el } = await open();
      button(el, t().api.flow.tlRefresh)!.click();
      await settle();
      answerWorkspaceLoads(http, { posts: POSTS });
      await tick(fixture);
      expect(dots(el)).toHaveLength(6);
    });
  });

  describe('hovering and clicking a square', () => {
    it('tells everything about the post on hover, and hides again when the mouse leaves', async () => {
      const { fixture, el } = await open();
      dot(el, 'bad').dispatchEvent(new Event('mouseenter'));
      await tick(fixture);
      const tip = fixture.nativeElement.querySelector('[data-testid="tip"]') as HTMLElement;
      expect(tip.getAttribute('role')).toBe('tooltip');
      expect(tip.textContent).toContain('10:00');
      expect(tip.textContent).toContain(t().status.failed);
      expect(tip.textContent).toContain('Group B');
      expect(tip.textContent).toContain('Morning condo');
      expect(tip.textContent).toContain('Failed text');
      // The reason: the generic title and what the extension reported.
      expect(tip.textContent).toContain('Facebook warned');
      dot(el, 'bad').dispatchEvent(new Event('mouseleave'));
      await tick(fixture);
      expect(fixture.nativeElement.querySelector('[data-testid="tip"]')).toBeNull();
    });

    it('shows the group code and flags a post that jumped the queue', async () => {
      const { fixture, el } = await open({
        posts: [
          apiPost({
            id: 'r',
            scheduledAt: at(23, 40),
            status: 'queued',
            scheduleId: 's2',
            code: 'D1',
            rushed: true,
          }),
        ],
      });
      expect(dot(el, 'r').classList.contains('rushed')).toBe(true);
      dot(el, 'r').dispatchEvent(new Event('mouseenter'));
      await tick(fixture);
      const tip = fixture.nativeElement.querySelector('[data-testid="tip"]') as HTMLElement;
      expect(tip.textContent).toContain('#D1');
      expect(tip.textContent).toContain(t().api.flow.pdRushed);
    });

    it('drops the card when the square it is about leaves the board (a filter) or the page scrolls', async () => {
      const { fixture, el } = await open();
      const tipOf = () => fixture.nativeElement.querySelector('[data-testid="tip"]');
      dot(el, 'bad').dispatchEvent(new Event('mouseenter'));
      await tick(fixture);
      expect(tipOf()).not.toBeNull();
      // Only the green posts are shown now: the red square, and so the card about it, is gone.
      el.querySelectorAll<HTMLButtonElement>('.fchip')[1].click();
      await tick(fixture);
      expect(dot(el, 'bad')).toBeNull();
      expect(tipOf()).toBeNull();

      dot(el, 'ok').dispatchEvent(new Event('mouseenter'));
      await tick(fixture);
      expect(tipOf()).not.toBeNull();
      window.dispatchEvent(new Event('scroll'));
      await tick(fixture);
      expect(tipOf()).toBeNull();
    });

    it('opens the post window on click, with its text, group, schedule and reason', async () => {
      const { fixture, el } = await open();
      dot(el, 'bad').click();
      await tick(fixture);
      const win = el.querySelector('.su-modal-panel')!;
      expect(win.textContent).toContain('Group B');
      expect(win.textContent).toContain('Morning condo');
      expect(win.textContent).toContain('Condo posts');
      expect(win.querySelector('[data-testid="pd-text"]')?.textContent).toBe('Failed text');
      expect(win.querySelector('[data-testid="pd-reason"]')?.textContent).toContain(
        'Facebook warned',
      );
    });
  });

  describe('the post window: edit, post now, rerun', () => {
    it('opens the library post it came from in the editor', async () => {
      const { fixture, el } = await open();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      dot(el, 'bad').click();
      await tick(fixture);
      el.querySelector<HTMLButtonElement>('[data-testid="pd-edit"]')!.click();
      await tick(fixture);
      expect(navigate).toHaveBeenCalledWith(['/app/posts'], { queryParams: { post: 'cp1' } });
      expect(el.querySelector('.su-modal-panel')).toBeNull();
    });

    it('cannot edit a post that did not come from the library (and says why)', async () => {
      const { fixture, el } = await open();
      dot(el, 'ok').click(); // posted, with no library post
      await tick(fixture);
      const edit = el.querySelector<HTMLButtonElement>('[data-testid="pd-edit"]')!;
      expect(edit.disabled).toBe(true);
      expect(edit.getAttribute('title')).toBe(t().api.flow.pdNoEdit);
    });

    it('posts a queued one now: it jumps the queue, the window closes and a toast says so', async () => {
      const { fixture, el } = await open();
      const notify = vi.spyOn(TestBed.inject(NotificationService), 'success');
      dot(el, 'soon').click();
      await tick(fixture);
      const run = el.querySelector<HTMLButtonElement>('[data-testid="pd-run"]')!;
      expect(run.textContent).toContain(t().api.flow.pdRunNow);
      expect(run.disabled).toBe(false);
      run.click();
      await settle();
      http.expectOne({ method: 'POST', url: `/api/workspaces/${WS}/posts/soon/run-now` }).flush({});
      await settle();
      // The posts are read again: the square is where "now" is, in the same row.
      answerWorkspaceLoads(http, {
        posts: POSTS.map((p) =>
          p.id === 'soon' ? { ...p, scheduledAt: at(22, 46), rushed: true } : p,
        ),
      });
      await tick(fixture);
      expect(notify).toHaveBeenCalledWith(t().api.flow.runNowDone);
      expect(el.querySelector('.su-modal-panel')).toBeNull();
      expect(dot(el, 'soon').classList.contains('rushed')).toBe(true);
      expect(dot(el, 'soon').style.left).toBe(`${14 + (22 * 60 + 46) * 2 - 8}px`);
    });

    it('reruns a failed one right now', async () => {
      const { fixture, el } = await open();
      const notify = vi.spyOn(TestBed.inject(NotificationService), 'success');
      dot(el, 'bad').click();
      await tick(fixture);
      const run = el.querySelector<HTMLButtonElement>('[data-testid="pd-run"]')!;
      expect(run.textContent).toContain(t().api.flow.pdRerun);
      run.click();
      await settle();
      http.expectOne({ method: 'POST', url: `/api/workspaces/${WS}/posts/bad/run-now` }).flush({});
      await settle();
      answerWorkspaceLoads(http, { posts: POSTS.filter((p) => p.id !== 'bad') });
      await tick(fixture);
      expect(notify).toHaveBeenCalledWith(t().api.flow.rerunDone);
    });

    it('is off for a post that went out, with the reason', async () => {
      const { fixture, el } = await open();
      dot(el, 'ok').click();
      await tick(fixture);
      const run = el.querySelector<HTMLButtonElement>('[data-testid="pd-run"]')!;
      expect(run.disabled).toBe(true);
      expect(run.getAttribute('title')).toBe(t().api.flow.pdCannotRun);
      expect(el.querySelector('[data-testid="pd-blocked"]')?.textContent).toContain(
        t().api.flow.pdCannotRun,
      );
    });

    it('is off while the browser of the post is unbound', async () => {
      const { fixture, el } = await open({ paired: false });
      dot(el, 'soon').click();
      await tick(fixture);
      const run = el.querySelector<HTMLButtonElement>('[data-testid="pd-run"]')!;
      expect(run.disabled).toBe(true);
      expect(run.getAttribute('title')).toBe(t().api.flow.pdUnbound);
    });

    it('is off for a viewer, who can still look', async () => {
      const { fixture, el } = await open({ role: 'viewer' });
      dot(el, 'soon').click();
      await tick(fixture);
      const run = el.querySelector<HTMLButtonElement>('[data-testid="pd-run"]')!;
      expect(run.disabled).toBe(true);
      expect(run.getAttribute('title')).toBe(t().api.permEdit);
      expect(el.querySelector<HTMLButtonElement>('[data-testid="pd-edit"]')!.disabled).toBe(true);
      expect(el.querySelector('[data-testid="pd-text"]')?.textContent).toContain('Soon text');
    });

    it('flags a post that is past its time and says it jumped the queue once it did', async () => {
      const { fixture, el } = await open();
      dot(el, 'late').click();
      await tick(fixture);
      expect(el.querySelector('.su-modal-panel')?.textContent).toContain(t().api.flow.pdOverdue);
    });

    it('closes by itself when the post is gone', async () => {
      const { fixture, el } = await open();
      dot(el, 'soon').click();
      await tick(fixture);
      expect(el.querySelector('.su-modal-panel')).not.toBeNull();
      const removed = TestBed.inject(PostsStore).remove('soon');
      await settle();
      http.expectOne({ method: 'DELETE', url: `/api/workspaces/${WS}/posts/soon` }).flush(null);
      await removed;
      await tick(fixture);
      expect(el.querySelector('.su-modal-panel')).toBeNull();
    });
  });
});

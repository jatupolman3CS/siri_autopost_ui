import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { CollectionsStore } from '../../core/data/collections.store';
import { DraftStore } from '../../core/data/draft.store';
import { PostsStore } from '../../core/data/posts.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiPost } from '../../core/http/api.service';
import { dkey } from '../../core/i18n/format';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import { NotificationService } from '../../core/services/notification.service';
import { WS, apiPost, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { apiCollection, apiCollectionPost } from '../../testing/collection-fixtures';
import { CalendarPageComponent } from './calendar-page.component';

/** Today at `hour`:00 local, as the API sends it. */
const at = (hour: number, day = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + day);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const TODAY = dkey(new Date());

const POST = apiCollectionPost({ id: 'cp1', collectionId: 'c1', text: 'Condo for rent {{code}}' });
const COLLECTION = apiCollection({ id: 'c1', name: 'Condo posts', posts: [POST] });

describe('CalendarPageComponent', () => {
  let http: HttpTestingController;

  async function open(posts: ApiPost[] = [], day: string | null = TODAY) {
    http = provideApiTesting({
      imports: [CalendarPageComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    TestBed.inject(WorkspaceStore);
    TestBed.inject(PostsStore);
    TestBed.inject(CollectionsStore);
    await signIn(http, { posts, collections: [COLLECTION] });
    const fixture = TestBed.createComponent(CalendarPageComponent);
    if (day) fixture.componentRef.setInput('day', day);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const t = () => TestBed.inject(I18nService).t();
  const rows = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('.day-row')];
  const button = (root: ParentNode, text: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.trim().includes(text),
    );
  const tick = async (fixture: ComponentFixture<unknown>) => {
    await settle();
    fixture.detectChanges();
  };

  afterEach(() => {
    try {
      http?.verify();
    } finally {
      http = undefined!;
      TestBed.resetTestingModule();
      localStorage.clear();
    }
  });

  describe('the selected day', () => {
    it('lists the posts of the day in time order with their platform, target and status', async () => {
      const { el } = await open([
        apiPost({
          id: 'b',
          scheduledAt: at(15),
          status: 'queued',
          target: 'Group B',
          content: 'Second',
        }),
        apiPost({
          id: 'a',
          scheduledAt: at(9),
          status: 'success',
          target: 'Group A',
          content: 'First',
        }),
      ]);
      expect(rows(el)).toHaveLength(2);
      expect(rows(el)[0].querySelector('.day-meta')?.textContent).toContain('09:00');
      expect(rows(el)[0].querySelector('.day-meta')?.textContent).toContain('Group A');
      expect(rows(el)[0].querySelector('.status')?.textContent?.trim()).toBe(t().status.success);
      expect(rows(el)[1].querySelector('.status')?.textContent?.trim()).toBe(t().status.queued);
      expect(el.querySelector('.day-head .muted')?.textContent).toBe(`2 ${t().common.posts}`);
    });

    it('says so when the day has nothing', async () => {
      const { el } = await open([], dkey(new Date(Date.now() + 3 * 864e5)));
      expect(rows(el)).toHaveLength(0);
      expect(el.querySelector('.panel app-empty-state')?.textContent).toContain(t().cal.empty);
    });

    it('shows the text of the task itself, line breaks kept', async () => {
      const { el } = await open([
        apiPost({
          id: 'a',
          scheduledAt: at(9),
          content: '#Jan24\nCondo for rent',
          collectionPostId: 'cp1',
        }),
      ]);
      expect(rows(el)[0].querySelector('.text')?.textContent).toBe('#Jan24\nCondo for rent');
    });

    it('falls back to the collection post when the task holds no text', async () => {
      const { el } = await open([
        apiPost({ id: 'a', scheduledAt: at(9), content: '  ', collectionPostId: 'cp1' }),
      ]);
      expect(rows(el)[0].querySelector('.text')?.textContent).toBe('Condo for rent {{code}}');
    });

    it('shows the group code as a chip, and no chip when the post has none', async () => {
      const { el } = await open([
        apiPost({ id: 'a', scheduledAt: at(9), code: '#Jan24' }),
        apiPost({ id: 'b', scheduledAt: at(10) }),
      ]);
      const tag = rows(el)[0].querySelector('.tag')!;
      expect(tag.textContent?.trim()).toBe('#Jan24');
      expect(tag.querySelector('.ph-hash')).not.toBeNull();
      expect(rows(el)[1].querySelector('.tag')).toBeNull();
    });

    it('marks a test post, which can be removed but not edited', async () => {
      const { el } = await open([
        apiPost({
          id: 't',
          scheduledAt: at(9),
          isTest: true,
          code: '#X',
          collectionPostId: 'cp1',
          status: 'queued',
        }),
      ]);
      const row = rows(el)[0];
      expect([...row.querySelectorAll('.tag')].map((n) => n.textContent?.trim())).toEqual([
        '#X',
        t().api.flow.calTest,
      ]);
      expect(button(row, t().common.edit)).toBeUndefined();
      expect(button(row, t().common.remove)).toBeDefined();
    });

    it('does not mark an ordinary post as a test', async () => {
      const { el } = await open([apiPost({ id: 'a', scheduledAt: at(9) })]);
      expect(rows(el)[0].textContent).not.toContain(t().api.flow.calTest);
    });

    it('offers edit and delete on a queued post only', async () => {
      const { el } = await open([
        apiPost({ id: 'q', scheduledAt: at(9), status: 'queued' }),
        apiPost({ id: 's', scheduledAt: at(10), status: 'success' }),
      ]);
      expect(rows(el)[0].querySelectorAll('.btns button')).toHaveLength(2);
      expect(rows(el)[1].querySelector('.btns')).toBeNull();
    });

    it('keeps the "fix" link on a failed post', async () => {
      const { el } = await open([
        apiPost({ id: 'f', scheduledAt: at(9), status: 'failed' }),
        apiPost({ id: 'p', scheduledAt: at(10), status: 'pending' }),
        apiPost({ id: 'q', scheduledAt: at(11), status: 'queued' }),
      ]);
      const fix = rows(el).map((r) =>
        r.querySelector<HTMLAnchorElement>('a.su-btn')?.getAttribute('href'),
      );
      expect(fix).toEqual(['/app/errors', '/app/errors', undefined]);
      expect(rows(el)[0].querySelector('a.su-btn')?.textContent?.trim()).toBe(t().common.fix);
    });
  });

  describe('edit', () => {
    it('opens the collection post a queued task came from in the composer', async () => {
      const { fixture, el } = await open([
        apiPost({ id: 'q', scheduledAt: at(9), status: 'queued', collectionPostId: 'cp1' }),
      ]);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      button(rows(el)[0], t().common.edit)!.click();
      await tick(fixture);
      const draft = TestBed.inject(DraftStore).draft();
      expect([draft.collectionId, draft.postId, draft.text]).toEqual(['c1', 'cp1', POST.text]);
      expect(navigate).toHaveBeenCalledWith(['/app/composer'], {
        queryParams: { collection: 'c1', post: 'cp1' },
      });
    });

    it('starts a new post with the text and media of a task that has no collection post', async () => {
      const { fixture, el } = await open([
        apiPost({
          id: 'q',
          scheduledAt: at(9),
          status: 'queued',
          content: 'Made before collections',
          mediaIds: ['m1'],
        }),
      ]);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      button(rows(el)[0], t().common.edit)!.click();
      await tick(fixture);
      const draft = TestBed.inject(DraftStore).draft();
      expect([draft.postId, draft.text, draft.media]).toEqual([
        null,
        'Made before collections',
        ['m1'],
      ]);
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate.mock.calls[0][0]).toEqual(['/app/composer']);
    });

    it('starts a new post when the collection post of the task is gone', async () => {
      const { fixture, el } = await open([
        apiPost({
          id: 'q',
          scheduledAt: at(9),
          status: 'queued',
          content: 'Its own text',
          collectionPostId: 'deleted',
        }),
      ]);
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      button(rows(el)[0], t().common.edit)!.click();
      await tick(fixture);
      const draft = TestBed.inject(DraftStore).draft();
      expect([draft.postId, draft.text]).toEqual([null, 'Its own text']);
    });
  });

  describe('add and delete', () => {
    it('"add" opens the schedule builder with the selected day as its start', async () => {
      const day = dkey(new Date(Date.now() + 20 * 864e5));
      const { fixture, el } = await open([], day);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      expect(button(el, t().cal.add)!.disabled).toBe(false);
      expect(el.querySelector('.add .past')).toBeNull();
      button(el, t().cal.add)!.click();
      await tick(fixture);
      expect(navigate).toHaveBeenCalledWith(['/app/schedules'], { queryParams: { start: day } });
      http.match((r) => r.url.endsWith('/posts')).forEach((r) => r.flush([]));
    });

    it('"add" works on today', async () => {
      const { fixture, el } = await open([], TODAY);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      expect(button(el, t().cal.add)!.disabled).toBe(false);
      button(el, t().cal.add)!.click();
      await tick(fixture);
      expect(navigate).toHaveBeenCalledWith(['/app/schedules'], { queryParams: { start: TODAY } });
      http.match((r) => r.url.endsWith('/posts')).forEach((r) => r.flush([]));
    });

    it('"add" is off on a day that has passed, with the reason', async () => {
      const past = dkey(new Date(Date.now() - 3 * 864e5));
      const { fixture, el } = await open([], past);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const add = button(el, t().cal.add)!;
      expect(add.disabled).toBe(true);
      expect(add.title).toBe(t().api.flow.calPastHint);
      expect(el.querySelector('.add .past')?.textContent).toBe(t().api.flow.calPastHint);
      expect(add.getAttribute('aria-describedby')).toBe(el.querySelector('.past')?.id);
      add.click();
      await tick(fixture);
      expect(navigate).not.toHaveBeenCalled();
      http.match((r) => r.url.endsWith('/posts')).forEach((r) => r.flush([]));
    });

    it('turns "add" on again when a day from today is picked', async () => {
      const past = dkey(new Date(Date.now() - 3 * 864e5));
      const { fixture, el } = await open([], past);
      expect(button(el, t().cal.add)!.disabled).toBe(true);
      button(el, t().common.today)!.click();
      await tick(fixture);
      expect(button(el, t().cal.add)!.disabled).toBe(false);
      expect(el.querySelector('.add .past')).toBeNull();
      http.match((r) => r.url.endsWith('/posts')).forEach((r) => r.flush([]));
    });

    it('deletes a queued post after the dialog is confirmed', async () => {
      const { fixture, el } = await open([
        apiPost({ id: 'q', scheduledAt: at(9), status: 'queued' }),
      ]);
      button(rows(el)[0], t().common.remove)!.click();
      await tick(fixture);
      const confirm = [
        ...document.querySelectorAll<HTMLButtonElement>('.su-modal-foot button'),
      ].find((b) => b.textContent?.includes(t().common.remove))!;
      confirm.click();
      await settle();
      const req = http.expectOne(`/api/workspaces/${WS}/posts/q`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      await settle();
      fixture.detectChanges();
      expect(rows(el)).toHaveLength(0);
      expect(
        TestBed.inject(NotificationService)
          .toasts()
          .map((x) => x.message),
      ).toContain(t().common.deleted);
    });
  });

  describe('the month', () => {
    it('opens on the day it is given, in that month', async () => {
      const { el } = await open([], '2026-11-20');
      expect(el.querySelector('.cal-title')?.textContent).toContain('2569');
      expect(el.querySelector('.cell.sel .num')?.textContent?.trim()).toBe('20');
      expect(el.querySelector('.panel h2')?.textContent).toBe('20 พ.ย. 2569');
      http.match((r) => r.url.endsWith('/posts')).forEach((r) => r.flush([]));
    });

    it('shows three chips a day and counts the rest', async () => {
      const { el } = await open(
        [9, 10, 11, 12, 13].map((h) =>
          apiPost({ id: `p${h}`, scheduledAt: at(h), content: `Post ${h}` }),
        ),
      );
      const cell = el.querySelector<HTMLElement>('.cell.sel')!;
      expect(cell.querySelectorAll('.chip')).toHaveLength(3);
      expect(cell.querySelector('.small.muted')?.textContent).toBe(fmt(t().cal.moreN, { n: 2 }));
    });

    it('keeps the legend: posted, failed, scheduled', async () => {
      const { el } = await open();
      expect([...el.querySelectorAll('.legend > span')].map((n) => n.textContent?.trim())).toEqual([
        t().cal.lSuccess,
        t().cal.lFailed,
        t().cal.lQueued,
      ]);
    });

    it('goes to the new-post composer from the header button', async () => {
      const { el } = await open();
      expect(el.querySelector('.actions a.su-btn-primary')?.getAttribute('href')).toBe(
        '/app/composer',
      );
    });

    it('asks for the posts of the other months when they are navigated to', async () => {
      const { fixture, el } = await open([], null);
      const posts = TestBed.inject(PostsStore);
      const before = posts.posts().length;
      el.querySelectorAll<HTMLButtonElement>('.nav-btn')[1].click();
      el.querySelectorAll<HTMLButtonElement>('.nav-btn')[1].click();
      await tick(fixture);
      // Two months ahead is outside what was loaded: it is asked for.
      const asked = http.match((r) => r.url.endsWith('/posts'));
      expect(asked.length).toBeGreaterThan(0);
      for (const r of asked) r.flush([]);
      await settle();
      expect(posts.posts().length).toBe(before);
    });
  });
});

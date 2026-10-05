import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { assistStorage } from '../../core/auth/token';
import { CollectionsStore } from '../../core/data/collections.store';
import { LibraryStore } from '../../core/data/library.store';
import { MasterPostsStore } from '../../core/data/master-posts.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiCollection, ApiCollectionPost, ApiRole } from '../../core/http/api.service';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { I18nService } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import {
  apiCollection,
  apiCollectionPost,
  apiPostSettings,
} from '../../testing/collection-fixtures';
import { PostsPageComponent } from './posts-page.component';

const MASTER = `/api/workspaces/${WS}/master-posts`;
const COLS = `/api/workspaces/${WS}/collections`;

const p1 = apiCollectionPost({
  id: 'p1',
  text: 'ขายคอนโด {{code}}\nโทรเลย',
  collectionIds: ['a'],
  mediaIds: ['m1', 'm2'],
  postedCount: 3,
  queuedCount: 2,
  failedCount: 1,
  lastPostedAt: '2026-10-04T09:30:00',
  nextAt: '2026-10-06T10:00:00',
});
const p2 = apiCollectionPost({
  id: 'p2',
  text: '{สวัสดี|หวัดดี} ครับ',
  collectionIds: ['a', 'b'],
  settings: { hashtags: '#own', weekdays: [1, 2], maxPerDay: 2 },
});
const p3 = apiCollectionPost({ id: 'p3', text: 'ปิดอยู่', active: false });
const p4 = apiCollectionPost({
  id: 'p4',
  text: 'รออนุมัติ',
  collectionIds: ['b'],
  approval: 'pending',
});
const p5 = apiCollectionPost({
  id: 'p5',
  text: 'ฉบับร่าง',
  collectionIds: ['b'],
  approval: 'draft',
});
const POSTS = [p1, p2, p3, p4, p5];

const CONDO = apiCollection({ id: 'a', name: 'Condo', posts: [p1, p2] });
const TICKETS = apiCollection({
  id: 'b',
  name: 'Tickets',
  posts: [p2, p4, p5],
  settings: { requireApproval: true },
});
const COLLECTIONS: ApiCollection[] = [CONDO, TICKETS];

describe('PostsPageComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<PostsPageComponent>;
  let el: HTMLElement;
  let posts: ApiCollectionPost[];
  const t = () => TestBed.inject(I18nService).t();
  const toasts = () => TestBed.inject(NotificationService).toasts();

  async function open(
    list: ApiCollectionPost[] = POSTS,
    role: ApiRole = 'owner',
    assist = false,
    collections: ApiCollection[] = COLLECTIONS,
  ): Promise<void> {
    posts = list;
    http = provideApiTesting({
      imports: [PostsPageComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    if (assist)
      assistStorage.set({
        adminToken: 'a',
        customerId: 'u-1',
        email: 'owner@shop.co',
        expiresAt: '2099-01-01T00:00:00Z',
      });
    TestBed.inject(WorkspaceStore);
    TestBed.inject(MasterPostsStore);
    TestBed.inject(CollectionsStore);
    TestBed.inject(LibraryStore);
    await signIn(http, { collections, masterPosts: list, workspace: { role } });
    fixture = TestBed.createComponent(PostsPageComponent);
    fixture.detectChanges();
    await settle();
    // Counts and times move while schedules run: the page reads both lists again when it opens.
    http.expectOne(MASTER).flush(list);
    http.expectOne(COLS).flush(collections);
    await settle();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  const rerender = async () => {
    await settle();
    fixture.detectChanges();
  };
  /** Answers the re-reads a change sets off (the post library and the collections). */
  const answerLists = async (list: ApiCollectionPost[] = posts) => {
    await settle();
    for (const r of http.match(MASTER)) r.flush(list);
    for (const r of http.match(COLS)) r.flush(COLLECTIONS);
    await rerender();
  };
  const btn = (text: string, root: ParentNode = el): HTMLButtonElement => {
    const all = [...root.querySelectorAll<HTMLButtonElement>('button')];
    return (all.find((b) => b.textContent!.trim() === text) ??
      all.find((b) => b.textContent!.includes(text)))!;
  };
  const byTestId = (id: string) => el.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!;
  const cards = () => [...el.querySelectorAll<HTMLElement>('app-master-post-card')];
  const cardOf = (id: string) => cards().find((c) => c.querySelector('.text')!.textContent === id)!;
  const textsOf = () => cards().map((c) => c.querySelector('.text')!.textContent);
  const setValue = async (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await rerender();
  };
  const editor = () => el.querySelector<HTMLElement>('app-post-editor')!;
  const submit = async () => {
    editor().querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await rerender();
  };

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    try {
      for (const r of http.match(MASTER)) r.flush(posts);
      for (const r of http.match(COLS)) r.flush(COLLECTIONS);
      http.verify();
    } finally {
      TestBed.resetTestingModule();
      localStorage.clear();
      assistStorage.set(null);
    }
  });

  describe('layout', () => {
    beforeEach(() => open());

    it('has the title, the subtitle, the new-post button and the stepper at step 1', () => {
      expect(el.querySelector('h1')!.textContent).toBe(t().api.flow.plTitle);
      expect(el.querySelector('.page-head p')!.textContent).toBe(t().api.flow.plSub);
      expect(byTestId('new-post').textContent).toContain(t().api.flow.plNew);
      expect(byTestId('new-post').disabled).toBe(false);
      expect(el.querySelectorAll('a.step').length).toBe(4);
      expect(el.querySelector('a.step[aria-current="step"] .num')!.textContent!.trim()).toBe('1');
    });

    it('leads to the collections from the next-step card', async () => {
      const go = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      expect(el.querySelector('.next')!.textContent).toContain(t().api.nextToCollections);
      el.querySelector<HTMLButtonElement>('.next button')!.click();
      expect(go).toHaveBeenCalledWith('/app/collections');
    });

    it('shows no permission note to an editor', () => {
      expect(el.querySelector('app-perm-note .perm-note')).toBeNull();
    });
  });

  it('shows "—" until the posts have arrived', async () => {
    http = provideApiTesting({
      imports: [PostsPageComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    posts = POSTS;
    TestBed.inject(WorkspaceStore);
    TestBed.inject(LibraryStore);
    await signIn(http);
    fixture = TestBed.createComponent(PostsPageComponent);
    fixture.detectChanges();
    await settle();
    el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.loading')!.textContent).toBe('—');
    expect(el.querySelector('app-empty-state')).toBeNull();
    http.expectOne(MASTER).flush(POSTS);
    http.match(COLS).forEach((r) => r.flush(COLLECTIONS));
    await rerender();
    expect(el.querySelector('.loading')).toBeNull();
    expect(cards().length).toBe(5);
  });

  it('says the library is empty, and still offers a new post', async () => {
    await open([]);
    expect(el.querySelector('app-empty-state')!.textContent).toContain(t().api.flow.plEmptyTitle);
    expect(byTestId('new-post').disabled).toBe(false);
    expect(el.querySelector('.tools')).toBeNull();
  });

  describe('a post card', () => {
    beforeEach(() => open());

    it('lists every post, oldest first, with its text clamped to a few lines', () => {
      expect(textsOf()).toEqual(POSTS.map((p) => p.text));
      expect(el.querySelector('app-master-post-card .text')!.textContent).toBe(p1.text);
    });

    it('shows the collections the post sits in, or that it waits in the library', () => {
      const chips = (id: string) =>
        [...cardOf(id).querySelectorAll('.where .chip')].map((c) => c.textContent!.trim());
      expect(chips(p1.text)).toEqual(['Condo']);
      expect(chips(p2.text)).toEqual(['Condo', 'Tickets']);
      expect(cardOf(p3.text).querySelector('.where')!.textContent).toContain(
        t().api.flow.plNoCollection,
      );
    });

    it('shows what became of the post: posted, queued, failed, last and next time', () => {
      const stats = cardOf(p1.text).querySelector('.stats')!.textContent!;
      expect(stats).toContain(t().api.flow.plPostedN.replace('{n}', '3'));
      expect(stats).toContain(t().api.flow.plQueuedN.replace('{n}', '2'));
      expect(stats).toContain(t().api.flow.plFailedN.replace('{n}', '1'));
      expect(stats).toContain(t().api.flow.plLastPosted.replace('{t}', '4'));
      expect(stats).toContain(t().api.flow.plNextAt.replace('{t}', '6'));
      expect(stats).toContain('09:30');
      expect(stats).toContain('10:00');
      expect(cardOf(p1.text).querySelector('.stats .bad')).not.toBeNull();
      const none = cardOf(p2.text).querySelector('.stats')!.textContent!;
      expect(none).toContain(t().api.flow.plNeverPosted);
      expect(cardOf(p2.text).querySelector('.stats .bad')).toBeNull();
    });

    it('shows the badges of the text, the own message and the own timing', () => {
      const chips = (text: string) =>
        [...cardOf(text).querySelectorAll('.meta .chip')].map((c) => c.textContent!.trim());
      expect(chips(p1.text)).toEqual([t().col.hasCode.trim()]);
      expect(chips(p2.text)).toEqual([
        t().col.hasSpin,
        t().api.flow.plOwnMsg,
        t().api.flow.plOwnSched,
      ]);
    });

    it('counts the media files', () => {
      expect(cardOf(p1.text).querySelector('.meta .small')!.textContent).toBe(
        t().api.flow.plMediaCount.replace('{n}', '2'),
      );
      expect(cardOf(p2.text).querySelector('.meta .small')!.textContent).toBe(t().col.noMedia);
    });

    it('dims a switched-off post and says what that means', () => {
      const off = cardOf(p3.text);
      expect(off.querySelector('section')!.classList.contains('off-item')).toBe(true);
      expect(off.querySelector('.off-note')!.textContent).toBe(t().api.flow.plOffHint);
      expect(off.querySelector<HTMLInputElement>('.sw input')!.checked).toBe(false);
      const on = cardOf(p1.text);
      expect(on.querySelector('section')!.classList.contains('off-item')).toBe(false);
      expect(on.querySelector('.off-note')).toBeNull();
      expect(on.querySelector<HTMLInputElement>('.sw input')!.checked).toBe(true);
    });

    it('shows the approval status only where a collection asks for approval (or it is pending)', () => {
      const status = (text: string) =>
        cardOf(text).querySelector('.meta .status')?.textContent?.trim();
      expect(status(p1.text)).toBeUndefined();
      expect(status(p4.text)).toBe(t().col.stPending);
      expect(status(p5.text)).toBe(t().col.stDraft);
      expect(status(p2.text)).toBe(t().col.stApproved);
    });
  });

  describe('search, filters and paging', () => {
    beforeEach(() => open());

    const chip = (key: string) =>
      el.querySelector<HTMLButtonElement>(`.chips .pick[data-filter="${key}"]`)!;
    const searchBox = () => el.querySelector<HTMLInputElement>('.find input')!;

    it('counts the posts on the filter chips', () => {
      expect(
        ['all', 'on', 'off', 'pending', 'loose'].map((k) =>
          chip(k).textContent!.replace(/\s+/g, ' ').trim(),
        ),
      ).toEqual([
        `${t().api.flow.plFAll} (5)`,
        `${t().api.flow.plFOn} (4)`,
        `${t().api.flow.plFOff} (1)`,
        `${t().api.flow.plFPending} (1)`,
        `${t().api.flow.plFLoose} (1)`,
      ]);
      expect(chip('all').getAttribute('aria-pressed')).toBe('true');
    });

    it.each([
      ['on', ['p1', 'p2', 'p4', 'p5']],
      ['off', ['p3']],
      ['pending', ['p4']],
      ['loose', ['p3']],
      ['all', ['p1', 'p2', 'p3', 'p4', 'p5']],
    ] as const)('"%s" shows only those posts', async (key, ids) => {
      chip(key).click();
      await rerender();
      expect(textsOf()).toEqual(ids.map((id) => POSTS.find((p) => p.id === id)!.text));
      expect(chip(key).getAttribute('aria-pressed')).toBe('true');
    });

    it('finds posts by a word of the text, ignoring case', async () => {
      await setValue(searchBox(), 'คอนโด');
      expect(textsOf()).toEqual([p1.text]);
      await setValue(searchBox(), 'ครับ');
      expect(textsOf()).toEqual([p2.text]);
      await setValue(searchBox(), '');
      expect(cards().length).toBe(5);
    });

    it('says when nothing matches, and the page controls stay out of the way', async () => {
      await setValue(searchBox(), 'ไม่มีแน่นอน');
      expect(cards()).toEqual([]);
      expect(el.querySelector('.nomatch')!.textContent).toBe(t().api.flow.plNoMatch);
      expect(el.querySelector('app-empty-state')).toBeNull();
    });

    it('narrows to the posts of one collection', async () => {
      const select = el.querySelector<HTMLSelectElement>('.find select')!;
      select.value = 'b';
      select.dispatchEvent(new Event('change'));
      await rerender();
      expect(textsOf()).toEqual([p2.text, p4.text, p5.text]);
      select.value = '';
      select.dispatchEvent(new Event('change'));
      await rerender();
      expect(cards().length).toBe(5);
    });

    it('combines the search, the state and the collection', async () => {
      chip('on').click();
      await rerender();
      const select = el.querySelector<HTMLSelectElement>('.find select')!;
      select.value = 'b';
      select.dispatchEvent(new Event('change'));
      await setValue(searchBox(), 'อนุมัติ');
      expect(textsOf()).toEqual([p4.text]);
    });

    it('shows how many posts were found', async () => {
      expect(el.querySelector('.row-tools .muted')!.textContent).toBe(
        t().api.flow.plShownN.replace('{n}', '5'),
      );
      chip('off').click();
      await rerender();
      expect(el.querySelector('.row-tools .muted')!.textContent).toBe(
        t().api.flow.plShownN.replace('{n}', '1'),
      );
    });
  });

  describe('paging', () => {
    const MANY = Array.from({ length: 25 }, (_, i) =>
      apiCollectionPost({ id: 'm' + i, text: 'post ' + i }),
    );

    it('shows a page at a time and turns the page', async () => {
      await open(MANY);
      expect(cards().length).toBe(20);
      expect(el.querySelector('app-pager nav')).not.toBeNull();
      el.querySelector<HTMLButtonElement>(
        `app-pager button[aria-label="${t().common.pgNext}"]`,
      )!.click();
      await rerender();
      expect(textsOf()).toEqual(MANY.slice(20).map((p) => p.text));
    });

    it('goes back to the first page when the search changes', async () => {
      await open(MANY);
      el.querySelector<HTMLButtonElement>(
        `app-pager button[aria-label="${t().common.pgNext}"]`,
      )!.click();
      await rerender();
      await setValue(el.querySelector<HTMLInputElement>('.find input')!, 'post 1');
      expect(cards().length).toBe(11);
      expect(textsOf()[0]).toBe('post 1');
    });
  });

  describe('switching a post on and off', () => {
    beforeEach(() => open());
    const sw = (text: string) => cardOf(text).querySelector<HTMLInputElement>('.sw input')!;

    it('shows the switch at once, asks the server, toasts and reads the collections again', async () => {
      sw(p1.text).click();
      await rerender();
      expect(cardOf(p1.text).querySelector('section')!.classList.contains('off-item')).toBe(true);
      const req = http.expectOne({ method: 'PUT', url: `${MASTER}/p1/active` });
      expect(req.request.body).toEqual({ active: false });
      req.flush({ ...p1, active: false, queuedCount: 0 });
      await answerLists();
      expect(toasts().map((x) => x.message)).toEqual([t().api.itemSwitchedOff]);
      expect(cardOf(p1.text).querySelector('.stats')!.textContent).toContain(
        t().api.flow.plQueuedN.replace('{n}', '0'),
      );
    });

    it('switches a post on', async () => {
      sw(p3.text).click();
      await rerender();
      const req = http.expectOne({ method: 'PUT', url: `${MASTER}/p3/active` });
      expect(req.request.body).toEqual({ active: true });
      req.flush({ ...p3, active: true });
      await answerLists();
      expect(toasts().map((x) => x.message)).toEqual([t().api.itemSwitchedOn]);
      expect(cardOf(p3.text).querySelector('.off-note')).toBeNull();
    });

    it('puts the switch back, with no success toast, when the API refuses', async () => {
      sw(p1.text).click();
      await rerender();
      http
        .expectOne({ method: 'PUT', url: `${MASTER}/p1/active` })
        .flush({}, { status: 403, statusText: 'Forbidden' });
      await rerender();
      expect(sw(p1.text).checked).toBe(true);
      expect(cardOf(p1.text).querySelector('.off-note')).toBeNull();
      expect(toasts().map((x) => x.message)).not.toContain(t().api.itemSwitchedOff);
    });
  });

  describe('approval', () => {
    beforeEach(() => open());

    it('offers the buttons that fit the state of the post', () => {
      const names = (text: string) =>
        [...cardOf(text).querySelectorAll<HTMLButtonElement>('.btns .su-btn')].map((b) =>
          b.textContent!.trim(),
        );
      expect(names(p5.text)).toEqual([
        t().col.requestApproval,
        t().common.edit,
        t().api.flow.plResults,
      ]);
      expect(names(p4.text)).toEqual([
        t().col.approve,
        t().col.reject,
        t().common.edit,
        t().api.flow.plResults,
      ]);
      expect(names(p1.text)).toEqual([t().common.edit, t().api.flow.plResults]);
    });

    it.each([
      [p5, 'request', 'pending'],
      [p4, 'approve', 'approved'],
      [p4, 'reject', 'draft'],
    ] as const)('%#: sends "%s" and shows the answer', async (post, action, next) => {
      const label = {
        request: t().col.requestApproval,
        approve: t().col.approve,
        reject: t().col.reject,
      }[action];
      btn(label, cardOf(post.text)).click();
      await rerender();
      const req = http.expectOne({ method: 'POST', url: `${MASTER}/${post.id}/approval` });
      expect(req.request.body).toEqual({ action });
      req.flush({ ...post, approval: next });
      await answerLists();
      const status = cardOf(post.text).querySelector('.meta .status')!.textContent!.trim();
      const names = {
        approved: t().col.stApproved,
        pending: t().col.stPending,
        draft: t().col.stDraft,
      };
      expect(status).toBe(names[next]);
    });
  });

  describe('selecting and the bulk bar', () => {
    beforeEach(() => open());
    const tick = (text: string) => cardOf(text).querySelector<HTMLInputElement>('.sel input')!;
    const bar = () => el.querySelector<HTMLElement>('.bulk');

    it('shows the bar only while posts are selected, with how many', async () => {
      expect(bar()).toBeNull();
      tick(p1.text).click();
      tick(p2.text).click();
      await rerender();
      expect(bar()!.textContent).toContain(t().api.flow.plBulkSelected.replace('{n}', '2'));
      tick(p1.text).click();
      await rerender();
      expect(bar()!.textContent).toContain(t().api.flow.plBulkSelected.replace('{n}', '1'));
      tick(p2.text).click();
      await rerender();
      expect(bar()).toBeNull();
    });

    it('selects the whole page, and clears it again', async () => {
      const all = el.querySelector<HTMLInputElement>('.row-tools app-checkbox input')!;
      all.click();
      await rerender();
      expect(cards().every((c) => c.querySelector<HTMLInputElement>('.sel input')!.checked)).toBe(
        true,
      );
      expect(bar()!.textContent).toContain(t().api.flow.plBulkSelected.replace('{n}', '5'));
      el.querySelector<HTMLInputElement>('.row-tools app-checkbox input')!.click();
      await rerender();
      expect(bar()).toBeNull();
      tick(p1.text).click();
      await rerender();
      btn(t().api.flow.plClearSelection, bar()!).click();
      await rerender();
      expect(bar()).toBeNull();
      expect(tick(p1.text).checked).toBe(false);
    });

    it('switches the selected posts on or off in one request, then reads again', async () => {
      tick(p1.text).click();
      tick(p3.text).click();
      await rerender();
      byTestId('bulk-off').click();
      await rerender();
      const req = http.expectOne({ method: 'POST', url: `${MASTER}/bulk` });
      expect(req.request.body).toEqual({
        postIds: ['p1', 'p3'],
        action: 'deactivate',
        collectionId: null,
      });
      req.flush({ changed: 1 });
      await answerLists(POSTS.map((p) => (p.id === 'p1' ? { ...p, active: false } : p)));
      expect(toasts().map((x) => x.message)).toEqual([t().api.flow.plBulkDone.replace('{n}', '1')]);
      expect(cardOf(p1.text).querySelector<HTMLInputElement>('.sw input')!.checked).toBe(false);
      byTestId('bulk-on').click();
      await rerender();
      expect(http.expectOne({ method: 'POST', url: `${MASTER}/bulk` }).request.body.action).toBe(
        'activate',
      );
    });

    it('adds the selected posts to a collection, and takes them out of one', async () => {
      tick(p3.text).click();
      await rerender();
      expect(byTestId('bulk-add').disabled).toBe(true);
      expect(byTestId('bulk-remove').disabled).toBe(true);
      const select = bar()!.querySelector<HTMLSelectElement>('select')!;
      select.value = 'a';
      select.dispatchEvent(new Event('change'));
      await rerender();
      expect(byTestId('bulk-add').disabled).toBe(false);
      byTestId('bulk-add').click();
      await rerender();
      let req = http.expectOne({ method: 'POST', url: `${MASTER}/bulk` });
      expect(req.request.body).toEqual({
        postIds: ['p3'],
        action: 'add_to_collection',
        collectionId: 'a',
      });
      req.flush({ changed: 1 });
      await answerLists(POSTS.map((p) => (p.id === 'p3' ? { ...p, collectionIds: ['a'] } : p)));
      expect(chipsOf(p3.text)).toEqual(['Condo']);
      byTestId('bulk-remove').click();
      await rerender();
      req = http.expectOne({ method: 'POST', url: `${MASTER}/bulk` });
      expect(req.request.body).toEqual({
        postIds: ['p3'],
        action: 'remove_from_collection',
        collectionId: 'a',
      });
      req.flush({ changed: 1 });
      await answerLists();
    });

    function chipsOf(text: string): string[] {
      return [...cardOf(text).querySelectorAll('.where .chip')].map((c) => c.textContent!.trim());
    }

    it('deletes the selected posts only after a confirmation that says it is for good', async () => {
      tick(p1.text).click();
      tick(p2.text).click();
      await rerender();
      byTestId('bulk-delete').click();
      await rerender();
      http.expectNone(`${MASTER}/bulk`);
      const dialog = el.querySelector<HTMLElement>('app-confirm-modal .su-modal-panel')!;
      expect(dialog.textContent).toContain(t().api.flow.plBulkDeleteBody.replace('{n}', '2'));
      btn(t().common.confirm, dialog).click();
      await settle();
      const req = http.expectOne({ method: 'POST', url: `${MASTER}/bulk` });
      expect(req.request.body).toEqual({
        postIds: ['p1', 'p2'],
        action: 'delete',
        collectionId: null,
      });
      req.flush({ changed: 2 });
      await answerLists([p3, p4, p5]);
      expect(textsOf()).toEqual([p3.text, p4.text, p5.text]);
      expect(bar()).toBeNull();
      expect(el.querySelector('app-confirm-modal .su-modal-panel')).toBeNull();
      expect(toasts().map((x) => x.message)).toEqual([t().api.flow.plBulkDone.replace('{n}', '2')]);
    });

    it('keeps the selection and the dialog when the API refuses the bulk delete', async () => {
      tick(p1.text).click();
      await rerender();
      byTestId('bulk-delete').click();
      await rerender();
      btn(
        t().common.confirm,
        el.querySelector<HTMLElement>('app-confirm-modal .su-modal-panel')!,
      ).click();
      await settle();
      http
        .expectOne({ method: 'POST', url: `${MASTER}/bulk` })
        .flush({}, { status: 403, statusText: 'Forbidden' });
      await answerLists();
      expect(el.querySelector('app-confirm-modal .su-modal-panel')!.textContent).toContain(
        t().api.itemActionFailed,
      );
      expect(bar()).not.toBeNull();
    });

    it('a post that was deleted drops out of the selection', async () => {
      tick(p1.text).click();
      tick(p2.text).click();
      await rerender();
      TestBed.inject(MasterPostsStore).posts.update((l) => l.filter((p) => p.id !== 'p2'));
      await rerender();
      expect(bar()!.textContent).toContain(t().api.flow.plBulkSelected.replace('{n}', '1'));
    });
  });

  describe('deleting one post', () => {
    beforeEach(() => open());
    const trash = (text: string) =>
      cardOf(text).querySelector<HTMLButtonElement>(
        `.btns .ibtn[aria-label="${t().api.flow.plDelete}"]`,
      )!;
    const dialog = () => el.querySelector<HTMLElement>('app-confirm-modal .su-modal-panel');

    it('asks first and says the post is deleted for good, leaves every collection, queued posts go', async () => {
      trash(p2.text).click();
      await rerender();
      expect(dialog()!.textContent).toContain(t().api.flow.plDeleteBody);
      http.expectNone(`${MASTER}/p2`);
      btn(t().common.cancel, dialog()!).click();
      await rerender();
      expect(dialog()).toBeNull();
      expect(cards().length).toBe(5);
    });

    it('deletes after the confirmation, toasts, and reads the collections again', async () => {
      trash(p2.text).click();
      await rerender();
      btn(t().common.confirm, dialog()!).click();
      await settle();
      http.expectOne({ method: 'DELETE', url: `${MASTER}/p2` }).flush(null);
      await answerLists([p1, p3, p4, p5]);
      expect(textsOf()).toEqual([p1.text, p3.text, p4.text, p5.text]);
      expect(dialog()).toBeNull();
      expect(toasts().map((x) => x.message)).toEqual([t().api.flow.plDeleted]);
    });

    it('brings the post back and keeps the dialog when the API refuses', async () => {
      trash(p2.text).click();
      await rerender();
      btn(t().common.confirm, dialog()!).click();
      await settle();
      http
        .expectOne({ method: 'DELETE', url: `${MASTER}/p2` })
        .flush({}, { status: 403, statusText: 'Forbidden' });
      await rerender();
      expect(cards().length).toBe(5);
      expect(dialog()!.textContent).toContain(t().api.itemActionFailed);
      expect(toasts().map((x) => x.message)).not.toContain(t().api.flow.plDeleted);
    });
  });

  describe('results of a post', () => {
    beforeEach(() => open());
    const rows = [
      {
        id: 'r1',
        target: 'กลุ่มคอนโด',
        targetUrl: 'https://www.facebook.com/groups/condo',
        status: 'success',
        scheduledAt: '2026-10-04T09:00:00',
        publishedAt: '2026-10-04T09:01:00',
        failureDetail: null,
        scheduleId: 's1',
      },
      {
        id: 'r2',
        target: 'กลุ่มรถ',
        targetUrl: 'javascript:alert(1)',
        status: 'failed',
        scheduledAt: '2026-10-03T18:00:00',
        publishedAt: null,
        failureDetail: 'ส่วนขยายไม่ได้ล็อกอิน',
        scheduleId: 's1',
      },
      {
        id: 'r3',
        target: 'กลุ่มบ้าน',
        targetUrl: null,
        status: 'queued',
        scheduledAt: '2026-10-06T10:00:00',
        publishedAt: null,
        failureDetail: null,
        scheduleId: 's2',
      },
    ];

    it('opens the results, reads them from the API and lists group, status, time and failure', async () => {
      btn(t().api.flow.plResults, cardOf(p1.text)).click();
      await rerender();
      expect(cardOf(p1.text).querySelector('app-post-activity')!.textContent).toContain(
        t().api.flow.plActLoading,
      );
      const req = http.expectOne((r) => r.url === `${MASTER}/p1/activity`);
      expect(req.request.params.get('take')).toBe('50');
      req.flush(rows);
      await rerender();
      const lines = [...cardOf(p1.text).querySelectorAll<HTMLElement>('app-post-activity .line')];
      expect(lines.length).toBe(3);
      expect(lines[0].querySelector('.status')!.textContent).toBe(t().status.success);
      expect(lines[0].textContent).toContain('กลุ่มคอนโด');
      expect(lines[0].textContent).toContain('09:01');
      expect(lines[0].querySelector('a')!.getAttribute('href')).toBe(
        'https://www.facebook.com/groups/condo',
      );
      expect(lines[1].querySelector('.status')!.textContent).toBe(t().status.failed);
      expect(lines[1].textContent).toContain('ส่วนขยายไม่ได้ล็อกอิน');
      expect(lines[1].textContent).toContain('18:00');
      // Only a web address becomes a link.
      expect(lines[1].querySelector('a')).toBeNull();
      expect(lines[2].querySelector('.status')!.textContent).toBe(t().status.queued);
      expect(lines[2].querySelector('a')).toBeNull();
    });

    it('says so when the post has not been sent anywhere', async () => {
      btn(t().api.flow.plResults, cardOf(p2.text)).click();
      await rerender();
      http.expectOne((r) => r.url === `${MASTER}/p2/activity`).flush([]);
      await rerender();
      expect(cardOf(p2.text).querySelector('app-post-activity')!.textContent).toContain(
        t().api.flow.plActEmpty,
      );
    });

    it('says the results could not be loaded', async () => {
      btn(t().api.flow.plResults, cardOf(p2.text)).click();
      await rerender();
      http
        .expectOne((r) => r.url === `${MASTER}/p2/activity`)
        .flush({}, { status: 404, statusText: 'Not found' });
      await rerender();
      expect(cardOf(p2.text).querySelector('app-post-activity')!.textContent).toContain(
        t().api.flow.plActFailed,
      );
    });

    it('hides the results again', async () => {
      btn(t().api.flow.plResults, cardOf(p2.text)).click();
      await rerender();
      http.expectOne((r) => r.url === `${MASTER}/p2/activity`).flush([]);
      await rerender();
      btn(t().api.flow.plHideResults, cardOf(p2.text)).click();
      await rerender();
      expect(cardOf(p2.text).querySelector('app-post-activity')).toBeNull();
    });
  });

  describe('editing a post', () => {
    beforeEach(async () => {
      await open();
      TestBed.inject(LibraryStore).media.set([
        { id: 'm1', name: 'a.mp4', meta: '', kind: 'video', used: 0, folderId: null, active: true },
        { id: 'm2', name: 'b.mp4', meta: '', kind: 'video', used: 0, folderId: null, active: true },
        { id: 'm3', name: 'c.mp4', meta: '', kind: 'video', used: 0, folderId: null, active: true },
      ]);
      btn(t().common.edit, cardOf(p1.text)).click();
      await rerender();
    });

    const textarea = () => editor().querySelector<HTMLTextAreaElement>('textarea.text')!;
    const input = (type: string) => [
      ...editor().querySelectorAll<HTMLInputElement>(`input[type="${type}"]`),
    ];
    const own = (i: number) => editor().querySelectorAll<HTMLElement>('.own')[i];
    const pick = (label: string) =>
      [...editor().querySelectorAll<HTMLButtonElement>('.pick')].find(
        (b) => b.textContent!.trim() === label,
      )!;
    const err = () => editor().textContent;

    it('opens an editor in the card with the text, the collections and the post settings', () => {
      expect(textarea().value).toBe(p1.text);
      expect(pick('Condo').getAttribute('aria-pressed')).toBe('true');
      expect(pick('Tickets').getAttribute('aria-pressed')).toBe('false');
      // The post follows its collection in everything and has no limits.
      expect(own(0).querySelector<HTMLInputElement>('app-checkbox input')!.checked).toBe(true);
      expect(own(1).querySelector<HTMLInputElement>('app-checkbox input')!.checked).toBe(true);
      expect(own(0).querySelector<HTMLInputElement>('input[type="text"]')!.disabled).toBe(true);
      expect(input('number')[0].value).toBe('0');
      expect(editor().querySelectorAll('.pick.day[aria-pressed="true"]').length).toBe(0);
    });

    it('closes without a request when cancelled', async () => {
      await setValue(textarea(), 'changed');
      btn(t().common.cancel, editor()).click();
      await rerender();
      expect(editor()).toBeNull();
      http.expectNone(`${MASTER}/p1`);
    });

    it('keeps what is typed when the list is read again underneath', async () => {
      await setValue(textarea(), 'half typed');
      TestBed.inject(MasterPostsStore).posts.update((l) =>
        l.map((p) => (p.id === 'p1' ? { ...p, postedCount: 99 } : p)),
      );
      await rerender();
      expect(textarea().value).toBe('half typed');
    });

    it('sends the whole post: text, media, collections and every setting', async () => {
      await setValue(textarea(), '  ขายคอนโดใหม่  ');
      pick('Tickets').click();
      own(0).querySelector<HTMLInputElement>('app-checkbox input')!.click();
      await rerender();
      await setValue(own(0).querySelector<HTMLInputElement>('input[type="text"]')!, '#ใหม่');
      own(1).querySelector<HTMLInputElement>('app-checkbox input')!.click();
      await rerender();
      await setValue(own(1).querySelector<HTMLTextAreaElement>('textarea')!, 'LINE @shop');
      btn(t().col.posTop, editor()).click();
      pick('จ').click();
      pick('พ').click();
      await rerender();
      await setValue(input('date')[0], '2026-10-10');
      await setValue(input('date')[1], '2026-12-31');
      await setValue(input('time')[0], '09:00');
      await setValue(input('time')[1], '17:30');
      await setValue(input('number')[0], '5');
      await submit();
      const req = http.expectOne({ method: 'PUT', url: `${MASTER}/p1` });
      expect(req.request.body).toEqual({
        text: 'ขายคอนโดใหม่',
        mediaIds: ['m1', 'm2'],
        collectionIds: ['a', 'b'],
        settings: {
          hashtags: '#ใหม่',
          footer: 'LINE @shop',
          footerPos: 'top',
          validFrom: '2026-10-10',
          validUntil: '2026-12-31',
          weekdays: [1, 3],
          timeFrom: '09:00',
          timeTo: '17:30',
          maxPerDay: 5,
        },
      });
      req.flush({ ...p1, text: 'ขายคอนโดใหม่', collectionIds: ['a', 'b'] });
      await answerLists([
        { ...p1, text: 'ขายคอนโดใหม่', collectionIds: ['a', 'b'] },
        ...POSTS.slice(1),
      ]);
      expect(editor()).toBeNull();
      expect(textsOf()[0]).toBe('ขายคอนโดใหม่');
      expect(toasts().map((x) => x.message)).toEqual([t().api.flow.plSaved]);
    });

    it('sends null for what follows the collection and "" for an own empty value', async () => {
      own(0).querySelector<HTMLInputElement>('app-checkbox input')!.click();
      await rerender();
      await submit();
      const req = http.expectOne({ method: 'PUT', url: `${MASTER}/p1` });
      expect(req.request.body.settings).toEqual({
        hashtags: '',
        footer: null,
        footerPos: null,
        validFrom: null,
        validUntil: null,
        weekdays: [],
        timeFrom: null,
        timeTo: null,
        maxPerDay: 0,
      });
      req.flush(p1);
      await answerLists();
    });

    it('starts from the own values of a post and can go back to following the collection', async () => {
      await answerLists();
      btn(t().common.cancel, editor()).click();
      await rerender();
      btn(t().common.edit, cardOf(p2.text)).click();
      await rerender();
      expect(own(0).querySelector<HTMLInputElement>('app-checkbox input')!.checked).toBe(false);
      expect(own(0).querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe('#own');
      expect(editor().querySelectorAll('.pick.day[aria-pressed="true"]').length).toBe(2);
      expect(input('number')[0].value).toBe('2');
      own(0).querySelector<HTMLInputElement>('app-checkbox input')!.click();
      await rerender();
      await submit();
      const req = http.expectOne({ method: 'PUT', url: `${MASTER}/p2` });
      expect(req.request.body.settings.hashtags).toBeNull();
      expect(req.request.body.settings.weekdays).toEqual([1, 2]);
      expect(req.request.body.collectionIds).toEqual(['a', 'b']);
      req.flush(p2);
      await answerLists();
    });

    it('takes a collection off and puts the post in none (it waits in the library)', async () => {
      pick('Condo').click();
      await rerender();
      await submit();
      const req = http.expectOne({ method: 'PUT', url: `${MASTER}/p1` });
      expect(req.request.body.collectionIds).toEqual([]);
      req.flush({ ...p1, collectionIds: [] });
      await answerLists();
    });

    it('does not lose the media, and can attach and detach library files', async () => {
      expect(editor().querySelectorAll('.media:not(.picker) .m').length).toBe(2);
      btn(t().api.flow.plMediaPick, editor()).click();
      await rerender();
      const picker = [...editor().querySelectorAll<HTMLButtonElement>('.picker .m')];
      expect(picker.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'false']);
      picker[2].click();
      picker[0].click();
      await rerender();
      await submit();
      const req = http.expectOne({ method: 'PUT', url: `${MASTER}/p1` });
      expect(req.request.body.mediaIds).toEqual(['m2', 'm3']);
      req.flush(p1);
      await answerLists();
    });

    it('removes an attached file with its own button', async () => {
      editor().querySelector<HTMLButtonElement>('.media .x')!.click();
      await rerender();
      await submit();
      const req = http.expectOne({ method: 'PUT', url: `${MASTER}/p1` });
      expect(req.request.body.mediaIds).toEqual(['m2']);
      req.flush(p1);
      await answerLists();
    });

    it('stops at the most files a post takes', async () => {
      const store = TestBed.inject(LibraryStore);
      store.media.set(
        Array.from({ length: INPUT_LIMITS.postMedia + 1 }, (_, i) => ({
          id: 'f' + i,
          name: 'f' + i,
          meta: '',
          kind: 'video' as const,
          used: 0,
          folderId: null,
          active: true,
        })),
      );
      btn(t().api.flow.plMediaPick, editor()).click();
      await rerender();
      // Page of 12: two pages are needed to reach 21 files.
      for (let page = 0; page < 2; page++) {
        for (const b of editor().querySelectorAll<HTMLButtonElement>('.picker .m')) b.click();
        await rerender();
        editor()
          .querySelector<HTMLButtonElement>(`app-pager button[aria-label="${t().common.pgNext}"]`)
          ?.click();
        await rerender();
      }
      expect(err()).toContain(t().api.mediaMax.replace('{n}', String(INPUT_LIMITS.postMedia)));
    });

    it('needs some text', async () => {
      await setValue(textarea(), '   ');
      await submit();
      http.expectNone(`${MASTER}/p1`);
      expect(err()).toContain(t().cmp.errText);
      await setValue(textarea(), 'now there is some');
      expect(err()).not.toContain(t().cmp.errText);
    });

    it('needs both times or none', async () => {
      await setValue(input('time')[0], '09:00');
      await submit();
      http.expectNone(`${MASTER}/p1`);
      expect(err()).toContain(t().api.flow.plErrTime);
    });

    it('needs the first date not to be after the last', async () => {
      await setValue(input('date')[0], '2026-12-31');
      await setValue(input('date')[1], '2026-10-01');
      await submit();
      http.expectNone(`${MASTER}/p1`);
      expect(err()).toContain(t().api.flow.plErrDates);
    });

    it.each(['-1', '51', '2.5', ''])('refuses "%s" posts a day', async (value) => {
      await setValue(input('number')[0], value);
      await submit();
      http.expectNone(`${MASTER}/p1`);
      expect(err()).toContain(
        t().api.flow.plErrMax.replace('{n}', String(INPUT_LIMITS.postMaxPerDay)),
      );
    });

    it('accepts the largest daily cap', async () => {
      await setValue(input('number')[0], String(INPUT_LIMITS.postMaxPerDay));
      await submit();
      const req = http.expectOne({ method: 'PUT', url: `${MASTER}/p1` });
      expect(req.request.body.settings.maxPerDay).toBe(INPUT_LIMITS.postMaxPerDay);
      req.flush(p1);
      await answerLists();
    });

    it('shows the reason the API gives and stays open with what was typed', async () => {
      await setValue(textarea(), 'edited');
      await submit();
      http
        .expectOne({ method: 'PUT', url: `${MASTER}/p1` })
        .flush({ title: 'โพสต์นี้ซ้ำกับโพสต์อื่น' }, { status: 422, statusText: 'Unprocessable' });
      await rerender();
      expect(editor().querySelector('.su-field-err')!.textContent).toContain(
        'โพสต์นี้ซ้ำกับโพสต์อื่น',
      );
      expect(textarea().value).toBe('edited');
      expect(store().byId('p1')!.text).toBe(p1.text);
    });

    it('falls back to a general message when the API gives none', async () => {
      await submit();
      http.expectOne({ method: 'PUT', url: `${MASTER}/p1` }).error(new ProgressEvent('error'));
      await rerender();
      expect(editor().querySelector('.su-field-err')!.textContent).toContain(
        t().api.flow.plSaveFailed,
      );
    });

    it('limits the text to what the API takes', () => {
      expect(textarea().getAttribute('maxlength')).toBe(String(INPUT_LIMITS.postText));
    });

    function store() {
      return TestBed.inject(MasterPostsStore);
    }
  });

  describe('a new post', () => {
    beforeEach(() => open());
    const dialog = () => el.querySelector<HTMLElement>('app-modal .su-modal-panel');
    const textarea = () => dialog()!.querySelector<HTMLTextAreaElement>('textarea.text')!;

    it('opens the editor in a dialog, empty, and closes it on cancel', async () => {
      byTestId('new-post').click();
      await rerender();
      expect(dialog()!.textContent).toContain(t().api.flow.plNewTitle);
      expect(textarea().value).toBe('');
      expect(dialog()!.querySelectorAll('.chips .pick[aria-pressed="true"]').length).toBe(0);
      btn(t().common.cancel, dialog()!).click();
      await rerender();
      expect(dialog()).toBeNull();
    });

    it('creates it in the library, in the chosen collections, switched on', async () => {
      byTestId('new-post').click();
      await rerender();
      await setValue(textarea(), 'โพสต์ใหม่');
      [...dialog()!.querySelectorAll<HTMLButtonElement>('.chips .pick')]
        .find((b) => b.textContent!.trim() === 'Condo')!
        .click();
      await rerender();
      dialog()!.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await rerender();
      const req = http.expectOne({ method: 'POST', url: MASTER });
      expect(req.request.body).toEqual({
        text: 'โพสต์ใหม่',
        mediaIds: [],
        collectionIds: ['a'],
        settings: apiPostSettings(),
        active: true,
      });
      const created = apiCollectionPost({ id: 'n1', text: 'โพสต์ใหม่', collectionIds: ['a'] });
      req.flush(created);
      await answerLists([...POSTS, created]);
      expect(dialog()).toBeNull();
      expect(textsOf().at(-1)).toBe('โพสต์ใหม่');
      expect(toasts().map((x) => x.message)).toEqual([t().api.flow.plCreated]);
    });

    it('can start in no collection and switched off', async () => {
      byTestId('new-post').click();
      await rerender();
      await setValue(textarea(), 'ร่างไว้ก่อน');
      [...dialog()!.querySelectorAll<HTMLInputElement>('app-checkbox input')].at(-1)!.click();
      await rerender();
      dialog()!.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await rerender();
      const req = http.expectOne({ method: 'POST', url: MASTER });
      expect(req.request.body.collectionIds).toEqual([]);
      expect(req.request.body.active).toBe(false);
      req.flush(apiCollectionPost({ id: 'n2', text: 'ร่างไว้ก่อน', active: false }));
      await answerLists();
    });

    it('starts in the collection the list is narrowed to', async () => {
      const select = el.querySelector<HTMLSelectElement>('.find select')!;
      select.value = 'b';
      select.dispatchEvent(new Event('change'));
      await rerender();
      byTestId('new-post').click();
      await rerender();
      const on = [...dialog()!.querySelectorAll('.chips .pick[aria-pressed="true"]')].map((b) =>
        b.textContent!.trim(),
      );
      expect(on).toEqual(['Tickets']);
    });

    it('keeps the dialog open with the reason when the API refuses', async () => {
      byTestId('new-post').click();
      await rerender();
      await setValue(textarea(), 'x');
      dialog()!.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await rerender();
      http
        .expectOne({ method: 'POST', url: MASTER })
        .flush({ title: 'ถึงจำนวนโพสต์สูงสุดแล้ว' }, { status: 403, statusText: 'Forbidden' });
      await rerender();
      expect(dialog()!.querySelector('.su-field-err')!.textContent).toContain(
        'ถึงจำนวนโพสต์สูงสุดแล้ว',
      );
      expect(textarea().value).toBe('x');
    });

    it('says there are no collections when the workspace has none', async () => {
      TestBed.resetTestingModule();
      await open(POSTS, 'owner', false, []);
      byTestId('new-post').click();
      await rerender();
      expect(dialog()!.textContent).toContain(t().api.flow.plColNone);
    });
  });

  describe('roles', () => {
    const everything = () => ({
      newPost: byTestId('new-post').disabled,
      sw: [...el.querySelectorAll<HTMLInputElement>('.sw input')].map((i) => i.disabled),
      edit: [...el.querySelectorAll<HTMLButtonElement>('.btns .su-btn')]
        .filter((b) => b.textContent!.includes(t().common.edit))
        .map((b) => b.disabled),
      trash: [...el.querySelectorAll<HTMLButtonElement>('.btns .ibtn')].map((b) => b.disabled),
    });

    it.each([
      ['viewer', true],
      ['editor', false],
      ['admin', false],
      ['owner', false],
    ] as const)('%s: new, switch, edit and delete are off = %s', async (role, off) => {
      await open(POSTS, role);
      const e = everything();
      expect(e.newPost).toBe(off);
      expect(e.sw.every((d) => d === off)).toBe(true);
      expect(e.edit.every((d) => d === off)).toBe(true);
      expect(e.trash.every((d) => d === off)).toBe(true);
    });

    it('a viewer sees the permission note and the hint on the buttons', async () => {
      await open(POSTS, 'viewer');
      expect(el.querySelector('app-perm-note .perm-note')!.textContent).toContain(
        TestBed.inject(I18nService).t().api.permEdit,
      );
      expect(byTestId('new-post').getAttribute('title')).toBe(t().api.permEdit);
      expect(cardOf(p1.text).querySelector('.btns .ibtn')!.getAttribute('title')).toBe(
        t().api.permEdit,
      );
    });

    it('is read-only in assist mode', async () => {
      await open(POSTS, 'owner', true);
      const e = everything();
      expect(e.newPost).toBe(true);
      expect(e.sw.every(Boolean)).toBe(true);
      expect(e.edit.every(Boolean)).toBe(true);
      expect(e.trash.every(Boolean)).toBe(true);
      expect(byTestId('new-post').getAttribute('title')).toBe(t().api.permAssist);
    });

    it('a viewer cannot change the posts selected, but can still read the results', async () => {
      await open(POSTS, 'viewer');
      cardOf(p1.text).querySelector<HTMLInputElement>('.sel input')!.click();
      await rerender();
      for (const id of ['bulk-on', 'bulk-off', 'bulk-delete'])
        expect(byTestId(id).disabled, id).toBe(true);
      btn(t().api.flow.plResults, cardOf(p1.text)).click();
      await rerender();
      http.expectOne((r) => r.url === `${MASTER}/p1/activity`).flush([]);
      await rerender();
      expect(cardOf(p1.text).querySelector('app-post-activity')).not.toBeNull();
    });

    it('only an admin may approve or send a post back', async () => {
      await open(POSTS, 'editor');
      const approve = btn(t().col.approve, cardOf(p4.text));
      expect(approve.disabled).toBe(true);
      expect(approve.getAttribute('title')).toBe(t().api.permAdmin);
      expect(btn(t().col.requestApproval, cardOf(p5.text)).disabled).toBe(false);
      TestBed.resetTestingModule();
      await open(POSTS, 'admin');
      expect(btn(t().col.approve, cardOf(p4.text)).disabled).toBe(false);
    });
  });
});

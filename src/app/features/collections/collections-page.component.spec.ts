import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { assistStorage } from '../../core/auth/token';
import { CollectionsStore } from '../../core/data/collections.store';
import { DraftStore } from '../../core/data/draft.store';
import { LibraryStore } from '../../core/data/library.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiCollection, ApiRole } from '../../core/http/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { UiPrefsService } from '../../core/services/ui-prefs.service';
import {
  WS,
  answerWorkspaceLoads,
  provideApiTesting,
  settle,
  signIn,
} from '../../testing/api-testing';
import { apiCollection, apiCollectionPost } from '../../testing/collection-fixtures';
import { CollectionsPageComponent } from './collections-page.component';

const BASE = `/api/workspaces/${WS}/collections`;

const a1 = apiCollectionPost({
  id: 'a1',
  collectionId: 'a',
  text: 'ขายคอนโด {{code}}\nโทรเลย',
  mediaIds: ['m1', 'm2'],
  postedCount: 3,
});
const a2 = apiCollectionPost({ id: 'a2', collectionId: 'a', text: '{สวัสดี|หวัดดี} ครับ' });
const b1 = apiCollectionPost({ id: 'b1', collectionId: 'b', text: 'ฉบับร่าง', approval: 'draft' });
const b2 = apiCollectionPost({
  id: 'b2',
  collectionId: 'b',
  text: 'รออนุมัติ',
  approval: 'pending',
});
const b3 = apiCollectionPost({ id: 'b3', collectionId: 'b', text: 'อนุมัติแล้ว' });

const DATA: ApiCollection[] = [
  apiCollection({ id: 'a', name: 'Condo', posts: [a1, a2], scheduleCount: 2 }),
  apiCollection({
    id: 'b',
    name: 'Tickets',
    icon: 'ph-ticket',
    posts: [b1, b2, b3],
    settings: { requireApproval: true, hashtags: '#movie', footer: 'LINE @shop' },
  }),
];

describe('CollectionsPageComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<CollectionsPageComponent>;
  let el: HTMLElement;
  let navigate: ReturnType<typeof vi.spyOn>;
  const t = () => TestBed.inject(I18nService).t();
  const toasts = () => TestBed.inject(NotificationService).toasts();

  async function open(
    data: ApiCollection[] = DATA,
    role: ApiRole = 'owner',
    assist = false,
  ): Promise<void> {
    http = provideApiTesting({
      imports: [CollectionsPageComponent],
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
    TestBed.inject(CollectionsStore);
    TestBed.inject(LibraryStore);
    await signIn(http, { collections: data, workspace: { role } });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(CollectionsPageComponent);
    fixture.detectChanges();
    await settle();
    // Counts of schedules and posts move on other pages: the page reads them again when it opens.
    http.expectOne(BASE).flush(data);
    await settle();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  /** The button whose text is exactly `text` (else the first that contains it). */
  const btn = (text: string, root: ParentNode = el): HTMLButtonElement => {
    const all = [...root.querySelectorAll<HTMLButtonElement>('button')];
    return (all.find((b) => b.textContent!.trim() === text) ??
      all.find((b) => b.textContent!.includes(text)))!;
  };
  const cards = () => [...el.querySelectorAll<HTMLElement>('app-collection-card')];
  const rows = (card: HTMLElement) => [...card.querySelectorAll<HTMLElement>('.post')];
  const rerender = async () => {
    await settle();
    fixture.detectChanges();
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    try {
      // The schedules store (names in the hints) reads posts and schedules once the page exists.
      answerWorkspaceLoads(http);
      http.verify();
    } finally {
      TestBed.resetTestingModule();
      localStorage.clear();
    }
  });

  describe('layout', () => {
    beforeEach(() => open());

    it('has the design title, subtitle, header buttons, stepper at step 1 and the next-step card', () => {
      expect(el.querySelector('h1')!.textContent).toBe(t().col.title);
      expect(el.querySelector('.page-head p')!.textContent).toBe(t().col.sub);
      expect(
        [...el.querySelectorAll('.page-head .actions button')].map((b) => b.textContent!.trim()),
      ).toEqual([t().col.exportCsv, t().col.newCol, t().col.write]);
      expect(el.querySelector('a.step[aria-current="step"] .num')!.textContent!.trim()).toBe('1');
      expect(el.querySelector('.next')!.textContent).toContain(t().flow.n1);
    });

    it('goes to the link sets from the next-step card', () => {
      const go = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      el.querySelector<HTMLButtonElement>('.next button')!.click();
      expect(go).toHaveBeenCalledWith('/app/targets');
    });

    it('hides the next-step card outside simple mode', async () => {
      TestBed.inject(UiPrefsService).set(false);
      await rerender();
      expect(el.querySelector('.next')).toBeNull();
    });

    it('shows a card per collection with its icon and "N posts · used by N schedules"', () => {
      expect(cards().length).toBe(2);
      const [condo, tickets] = cards();
      expect(condo.querySelector('.fw6')!.textContent).toBe('Condo');
      expect(condo.querySelector('.ico i')!.className).toContain('ph-folder');
      expect(tickets.querySelector('.ico i')!.className).toContain('ph-ticket');
      expect(condo.querySelector('.info .muted')!.textContent).toBe(
        `${t().col.postsN.replace('{n}', '2')} · ${t().api.flow.usedInN.replace('{n}', '2')}`,
      );
      expect(tickets.querySelector('.info .muted')!.textContent).toBe(
        `${t().col.postsN.replace('{n}', '3')} · ${t().col.notUsed}`,
      );
    });
  });

  it('shows "—" until the collections have arrived', async () => {
    http = provideApiTesting({
      imports: [CollectionsPageComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    TestBed.inject(WorkspaceStore);
    TestBed.inject(LibraryStore);
    await signIn(http);
    fixture = TestBed.createComponent(CollectionsPageComponent);
    fixture.detectChanges();
    await settle();
    el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.loading')!.textContent).toBe('—');
    expect(el.querySelector('app-empty-state')).toBeNull();
    http.expectOne(BASE).flush(DATA);
    await rerender();
    expect(el.querySelector('.loading')).toBeNull();
    expect(cards().length).toBe(2);
  });

  it('says there are no collections yet, and still offers to create one', async () => {
    await open([]);
    expect(el.querySelector('app-empty-state')!.textContent).toContain(
      t().api.flow.emptyCollectionsTitle,
    );
    expect(btn(t().col.newCol).disabled).toBe(false);
  });

  describe('posts', () => {
    beforeEach(() => open());

    it('lists the posts of the open collection (the first one) and none of the others', () => {
      const [condo, tickets] = cards();
      expect(rows(condo).map((r) => r.querySelector('.text')!.textContent)).toEqual([
        a1.text,
        a2.text,
      ]);
      expect(rows(tickets)).toEqual([]);
      expect(btn(t().col.collapse, condo)).toBeDefined();
      expect(btn(t().col.expand, tickets)).toBeDefined();
    });

    it('opens one collection at a time, and collapses it again', async () => {
      const [condo, tickets] = cards();
      btn(t().col.expand, tickets).click();
      await rerender();
      expect(rows(tickets).length).toBe(3);
      expect(rows(condo).length).toBe(0);
      expect(btn(t().col.expand, condo)).toBeDefined();
      expect(TestBed.inject(CollectionsStore).openId()).toBe('b');
      btn(t().col.collapse, tickets).click();
      await rerender();
      expect(rows(tickets).length).toBe(0);
      expect(TestBed.inject(CollectionsStore).openId()).toBeNull();
    });

    it('shows files, times posted, and badges for {{code}} and spintax', () => {
      const [first, second] = rows(cards()[0]);
      expect(first.querySelector('.meta .muted')!.textContent).toBe(
        `${t().col.mediaN.replace('{n}', '2')} · ${t().col.postedN.replace('{n}', '3')}`,
      );
      expect(first.querySelector('.chip')!.textContent).toContain(t().col.hasCode);
      expect(first.querySelectorAll('.chip').length).toBe(1);
      expect(second.querySelector('.meta .muted')!.textContent).toBe(
        `${t().col.noMedia} · ${t().col.postedN.replace('{n}', '0')}`,
      );
      expect(second.querySelector('.chip')!.textContent).toContain(t().col.hasSpin);
      expect(first.querySelector('.status')).toBeNull(); // no approval in this collection
    });

    it('shows library thumbnails for the media, an icon for files without one, and a text icon for none', async () => {
      const lib = TestBed.inject(LibraryStore);
      lib.media.set([
        { id: 'm1', name: 'a.png', meta: '', kind: 'image', used: 0 },
        { id: 'm2', name: 'b.mp4', meta: '', kind: 'video', used: 0 },
      ]);
      lib.thumbs.set({ m1: 'blob:thumb-1' });
      await rerender();
      const [first, second] = rows(cards()[0]);
      const thumbs = [...first.querySelectorAll('.thumb')];
      expect(thumbs[0].querySelector('img')!.getAttribute('src')).toBe('blob:thumb-1');
      expect(thumbs[1].querySelector('img')).toBeNull();
      expect(thumbs[1].querySelector('i')!.className).toContain('ph-video');
      expect(second.querySelector('.thumb i')!.className).toContain('ph-text-aa');
    });

    it('says an open collection has no posts', async () => {
      TestBed.inject(CollectionsStore).collections.update((l) =>
        l.map((c) => (c.id === 'a' ? { ...c, posts: [] } : c)),
      );
      await rerender();
      expect(cards()[0].textContent).toContain(t().col.empty);
    });

    it('shows 50 posts and a button for 50 more', async () => {
      const many = Array.from({ length: 120 }, (_, i) =>
        apiCollectionPost({ id: 'p' + i, collectionId: 'a', text: 'post ' + i }),
      );
      TestBed.inject(CollectionsStore).collections.update((l) =>
        l.map((c) => (c.id === 'a' ? { ...c, posts: many } : c)),
      );
      await rerender();
      expect(rows(cards()[0]).length).toBe(50);
      const more = cards()[0].querySelector<HTMLButtonElement>('.more')!;
      expect(more.textContent).toContain('70');
      more.click();
      await rerender();
      expect(rows(cards()[0]).length).toBe(100);
      cards()[0].querySelector<HTMLButtonElement>('.more')!.click();
      await rerender();
      expect(rows(cards()[0]).length).toBe(120);
      expect(cards()[0].querySelector('.more')).toBeNull();
    });
  });

  describe('settings', () => {
    beforeEach(async () => {
      await open();
      btn(t().col.settings, cards()[1]).click();
      await rerender();
    });

    const panel = () => cards()[1].querySelector('app-collection-settings')!;

    it('opens a panel with the fields of the design, filled from the collection', () => {
      const areas = [...panel().querySelectorAll<HTMLTextAreaElement>('textarea')];
      expect(areas.map((a) => a.value)).toEqual(['#movie', '', 'LINE @shop']);
      expect(panel().querySelectorAll('select').length).toBe(2);
      const checks = [...panel().querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
      expect(checks.map((c) => c.checked)).toEqual([true, false, true]);
      expect(btn(t().col.hideSettings, cards()[1])).toBeDefined();
    });

    it('says which settings are only stored: page tags, watermark position, image shuffle and watermark', () => {
      const hints = [...panel().querySelectorAll('.stored, .hint')].map((h) =>
        h.textContent!.trim(),
      );
      expect(hints.filter((h) => h === t().api.flow.storedOnly).length).toBe(4);
      // The approval rule is honoured, so its hint is the design's, not "stored only".
      expect(hints).toContain(t().col.approvalHint);
    });

    it('keeps the watermark position off until the watermark is on', async () => {
      const selects = () => [...panel().querySelectorAll<HTMLSelectElement>('select')];
      expect(selects()[1].disabled).toBe(true);
      panel().querySelectorAll<HTMLInputElement>('input[type=checkbox]')[1].click();
      await rerender();
      expect(selects()[1].disabled).toBe(false);
    });

    it('saves one complete PUT 800 ms after the last edit, and shows the edit at once', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const tags = panel().querySelectorAll<HTMLTextAreaElement>('textarea')[0];
      for (const v of ['#m', '#mo', '#movie night']) {
        tags.value = v;
        tags.dispatchEvent(new Event('input'));
      }
      panel().querySelectorAll<HTMLInputElement>('input[type=checkbox]')[1].click();
      expect(TestBed.inject(CollectionsStore).byId('b')?.settings.hashtags).toBe('#movie night');
      vi.advanceTimersByTime(799);
      http.expectNone({ method: 'PUT', url: `${BASE}/b` });
      vi.advanceTimersByTime(1);
      const req = http.expectOne({ method: 'PUT', url: `${BASE}/b` });
      expect(req.request.body).toEqual({
        name: 'Tickets',
        description: '',
        icon: 'ph-ticket',
        settings: {
          hashtags: '#movie night',
          pageTags: '',
          footer: 'LINE @shop',
          footerPos: 'end',
          shuffle: true,
          watermark: true,
          watermarkPos: 'br',
          requireApproval: true,
        },
      });
      req.flush(DATA[1]);
      await settle();
    });

    it('sends the footer position and the watermark position as the API names them', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const [footerPos, wmPos] = [...panel().querySelectorAll<HTMLSelectElement>('select')];
      footerPos.value = 'top';
      footerPos.dispatchEvent(new Event('change'));
      expect(wmPos.disabled).toBe(true);
      TestBed.inject(CollectionsStore).updateSettings('b', { watermark: true });
      await rerender();
      wmPos.value = 'tr';
      wmPos.dispatchEvent(new Event('change'));
      vi.advanceTimersByTime(800);
      const req = http.expectOne({ method: 'PUT', url: `${BASE}/b` });
      expect(req.request.body.settings).toMatchObject({ footerPos: 'top', watermarkPos: 'tr' });
      req.flush(DATA[1]);
      await settle();
    });

    it('puts the collection back when the API refuses the edit', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      panel().querySelectorAll<HTMLInputElement>('input[type=checkbox]')[0].click();
      expect(TestBed.inject(CollectionsStore).byId('b')?.settings.shuffle).toBe(false);
      vi.advanceTimersByTime(800);
      http
        .expectOne({ method: 'PUT', url: `${BASE}/b` })
        .flush({ title: 'x' }, { status: 403, statusText: 'Forbidden' });
      await rerender();
      expect(TestBed.inject(CollectionsStore).byId('b')?.settings.shuffle).toBe(true);
      expect(panel().querySelectorAll<HTMLInputElement>('input[type=checkbox]')[0].checked).toBe(
        true,
      );
    });
  });

  describe('new collection', () => {
    beforeEach(() => open());

    const modal = () => el.querySelector('app-new-collection-modal .su-modal-panel');
    const fill = (name: string, desc = '') => {
      const inputs = modal()!.querySelectorAll<HTMLInputElement>('input');
      inputs[0].value = name;
      inputs[0].dispatchEvent(new Event('input'));
      inputs[1].value = desc;
      inputs[1].dispatchEvent(new Event('input'));
    };
    const submit = async () => {
      modal()!.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
      await rerender();
    };

    it('opens with the design labels and an empty form', async () => {
      expect(modal()).toBeNull();
      btn(t().col.newCol).click();
      await rerender();
      expect(modal()!.querySelector('.su-modal-title')!.textContent).toBe(t().col.newCol);
      expect([...modal()!.querySelectorAll('label')].map((l) => l.textContent)).toEqual([
        t().col.colName,
        t().col.colDesc,
      ]);
      expect(modal()!.querySelector('input')!.getAttribute('maxlength')).toBe('120');
    });

    it('asks for a name', async () => {
      btn(t().col.newCol).click();
      await rerender();
      await submit();
      expect(modal()!.querySelector('.su-field-err')!.textContent).toBe(t().col.errName);
      http.expectNone({ method: 'POST', url: BASE });
    });

    it('creates the collection, toasts, closes and opens it', async () => {
      btn(t().col.newCol).click();
      await rerender();
      fill(' Shoes ', 'for sale');
      await submit();
      const req = http.expectOne({ method: 'POST', url: BASE });
      expect(req.request.body).toEqual({ name: 'Shoes', description: 'for sale' });
      req.flush(apiCollection({ id: 'c', name: 'Shoes', description: 'for sale' }));
      await rerender();
      expect(modal()).toBeNull();
      expect(toasts().map((x) => x.message)).toContain(t().col.created.replace('{c}', 'Shoes'));
      expect(cards().length).toBe(3);
      expect(TestBed.inject(CollectionsStore).openId()).toBe('c');
      expect(cards()[2].textContent).toContain(t().col.empty);
    });

    it('stays open with what was typed when the API refuses', async () => {
      btn(t().col.newCol).click();
      await rerender();
      fill('Shoes');
      await submit();
      http
        .expectOne({ method: 'POST', url: BASE })
        .flush({ title: 'ครบ' }, { status: 422, statusText: 'Unprocessable' });
      await rerender();
      expect(modal()).not.toBeNull();
      expect(modal()!.querySelector<HTMLInputElement>('input')!.value).toBe('Shoes');
      expect(cards().length).toBe(2);
    });

    it('closes on Cancel and starts empty the next time', async () => {
      btn(t().col.newCol).click();
      await rerender();
      fill('half');
      btn(t().common.cancel, modal()!).click();
      await rerender();
      expect(modal()).toBeNull();
      btn(t().col.newCol).click();
      await rerender();
      expect(modal()!.querySelector<HTMLInputElement>('input')!.value).toBe('');
    });
  });

  describe('navigation', () => {
    beforeEach(() => open());

    it('"write post" starts a blank post in the open collection and opens the composer', () => {
      TestBed.inject(DraftStore).patch({ text: 'old draft' });
      btn(t().col.write).click();
      expect(TestBed.inject(DraftStore).draft()).toMatchObject({ text: '', collectionId: 'a' });
      expect(navigate).toHaveBeenCalledWith(['/app/composer'], {
        queryParams: { collection: 'a' },
      });
    });

    it('"write a post here" starts a blank post in that collection', () => {
      btn(t().col.addPost, cards()[1]).click();
      expect(TestBed.inject(DraftStore).draft()).toMatchObject({ collectionId: 'b', postId: null });
      expect(navigate).toHaveBeenCalledWith(['/app/composer'], {
        queryParams: { collection: 'b' },
      });
    });

    it('"schedule" opens the schedule builder for the collection', () => {
      btn(t().col.schedule, cards()[0]).click();
      expect(navigate).toHaveBeenCalledWith(['/app/schedules'], {
        queryParams: { collection: 'a' },
      });
    });

    it('"edit" loads the post into the composer', () => {
      btn(t().common.edit, rows(cards()[0])[1]).click();
      expect(TestBed.inject(DraftStore).draft()).toMatchObject({
        text: a2.text,
        postId: 'a2',
        collectionId: 'a',
      });
      expect(navigate).toHaveBeenCalledWith(['/app/composer'], {
        queryParams: { collection: 'a', post: 'a2' },
      });
    });
  });

  describe('deleting a post', () => {
    beforeEach(() => open());

    it('removes it at once, without asking, then toasts', async () => {
      btn(t().common.remove, rows(cards()[0])[0]).click();
      await rerender();
      expect(rows(cards()[0]).length).toBe(1);
      expect(el.querySelector('.su-modal-panel')).toBeNull();
      expect(toasts()).toEqual([]);
      http.expectOne({ method: 'DELETE', url: `${BASE}/a/posts/a1` }).flush(null);
      await rerender();
      expect(toasts().map((x) => x.message)).toEqual([t().col.deleted]);
      expect(cards()[0].querySelector('.info .muted')!.textContent).toContain(
        t().col.postsN.replace('{n}', '1'),
      );
    });

    it('brings the post back, without a "deleted" toast, when the API refuses', async () => {
      btn(t().common.remove, rows(cards()[0])[0]).click();
      await rerender();
      http
        .expectOne({ method: 'DELETE', url: `${BASE}/a/posts/a1` })
        .flush({}, { status: 403, statusText: 'Forbidden' });
      await rerender();
      expect(rows(cards()[0]).length).toBe(2);
      expect(toasts()).toEqual([]);
    });
  });

  describe('approval', () => {
    const tickets = () => rows(cards()[1]);
    const names = (row: HTMLElement) =>
      [...row.querySelectorAll('.btns button')].map((b) => b.textContent!.trim());
    const states = (row: HTMLElement) =>
      [...row.querySelectorAll<HTMLButtonElement>('.btns button')].map((b) => b.disabled);

    async function openTickets(role: ApiRole, assist = false) {
      await open(DATA, role, assist);
      btn(t().col.expand, cards()[1]).click();
      await rerender();
    }

    it('shows each post status, and only the buttons that fit it', async () => {
      await openTickets('owner');
      expect(tickets().map((r) => r.querySelector('.status')!.textContent!.trim())).toEqual([
        t().col.stDraft,
        t().col.stPending,
        t().col.stApproved,
      ]);
      expect(names(tickets()[0])).toEqual([
        t().col.requestApproval,
        t().common.edit,
        t().common.remove,
      ]);
      expect(names(tickets()[1])).toEqual([
        t().col.approve,
        t().col.reject,
        t().common.edit,
        t().common.remove,
      ]);
      expect(names(tickets()[2])).toEqual([t().common.edit, t().common.remove]);
    });

    it('shows no status for a collection that needs no approval', async () => {
      await openTickets('owner');
      expect(el.querySelectorAll('app-collection-card')[0].querySelector('.status')).toBeNull();
    });

    it.each([
      ['viewer', [true, true, true], [true, true, true, true]],
      ['editor', [false, false, false], [true, true, false, false]],
      ['admin', [false, false, false], [false, false, false, false]],
      ['owner', [false, false, false], [false, false, false, false]],
    ] as const)(
      '%s: request / approve and send back / edit and delete off = %j / %j',
      async (role, draft, pending) => {
        await openTickets(role);
        expect(states(tickets()[0])).toEqual([...draft]);
        expect(states(tickets()[1])).toEqual([...pending]);
      },
    );

    it('is read-only in assist mode', async () => {
      await openTickets('owner', true);
      expect(states(tickets()[0]).every(Boolean)).toBe(true);
      expect(states(tickets()[1]).every(Boolean)).toBe(true);
      expect(el.querySelector('.perm-note')).not.toBeNull();
    });

    it('explains why a button is off', async () => {
      await openTickets('editor');
      expect(btn(t().col.approve).title).toBe(t().api.permAdmin);
      expect(btn(t().col.requestApproval).title).toBe('');
    });

    it('asks for approval: the status changes at once and the server answer is kept', async () => {
      await openTickets('editor');
      btn(t().col.requestApproval).click();
      await rerender();
      expect(tickets()[0].querySelector('.status')!.textContent!.trim()).toBe(t().col.stPending);
      expect(names(tickets()[0])).not.toContain(t().col.requestApproval);
      const req = http.expectOne({ method: 'POST', url: `${BASE}/b/posts/b1/approval` });
      expect(req.request.body).toEqual({ action: 'request' });
      req.flush({ ...b1, approval: 'pending' });
      await rerender();
      expect(tickets()[0].querySelector('.status')!.textContent!.trim()).toBe(t().col.stPending);
    });

    it('approves and sends back as an admin', async () => {
      await openTickets('admin');
      btn(t().col.approve).click();
      expect(
        http.expectOne({ method: 'POST', url: `${BASE}/b/posts/b2/approval` }).request.body,
      ).toEqual({ action: 'approve' });
    });

    it('sends a pending post back to draft', async () => {
      await openTickets('admin');
      btn(t().col.reject).click();
      await rerender();
      expect(tickets()[1].querySelector('.status')!.textContent!.trim()).toBe(t().col.stDraft);
      const req = http.expectOne({ method: 'POST', url: `${BASE}/b/posts/b2/approval` });
      expect(req.request.body).toEqual({ action: 'reject' });
      req.flush({}, { status: 403, statusText: 'Forbidden' });
      await rerender();
      expect(tickets()[1].querySelector('.status')!.textContent!.trim()).toBe(t().col.stPending);
    });
  });

  describe('roles', () => {
    it.each([
      ['viewer', true],
      ['editor', false],
    ] as const)('%s: new collection, write post and write here are off = %s', async (role, off) => {
      await open(DATA, role);
      expect(btn(t().col.newCol).disabled).toBe(off);
      expect(btn(t().col.write).disabled).toBe(off);
      expect(btn(t().col.addPost, cards()[0]).disabled).toBe(off);
      // Reading stays on: export and the way on to the schedules.
      expect(btn(t().col.exportCsv).disabled).toBe(false);
      expect(btn(t().col.schedule, cards()[0]).disabled).toBe(false);
      expect(!!el.querySelector('.perm-note')).toBe(off);
    });

    it('a viewer can read the settings but not change them', async () => {
      await open(DATA, 'viewer');
      btn(t().col.settings, cards()[0]).click();
      await rerender();
      const panel = cards()[0].querySelector('app-collection-settings')!;
      const controls = [...panel.querySelectorAll<HTMLInputElement>('textarea, select, input')];
      expect(controls.length).toBe(8);
      expect(controls.every((c) => c.disabled)).toBe(true);
    });

    it('is read-only in assist mode', async () => {
      await open(DATA, 'owner', true);
      expect(btn(t().col.newCol).disabled).toBe(true);
      expect(btn(t().col.write).disabled).toBe(true);
      expect(btn(t().common.edit).disabled).toBe(true);
      expect(btn(t().common.remove).disabled).toBe(true);
    });
  });

  describe('export', () => {
    beforeEach(() => open());

    it('saves the posts as CSV and toasts the file name', () => {
      const spy = vi.spyOn(CollectionsStore.prototype, 'exportCsv').mockReturnValue(true);
      btn(t().col.exportCsv).click();
      expect(spy).toHaveBeenCalled();
      expect(toasts().map((x) => x.message)).toEqual([
        t().col.exported.replace('{f}', 'autopost-posts.csv'),
      ]);
    });

    it('says so when the browser did not allow the download', () => {
      vi.spyOn(CollectionsStore.prototype, 'exportCsv').mockReturnValue(false);
      btn(t().col.exportCsv).click();
      expect(toasts().map((x) => [x.type, x.message])).toEqual([
        ['error', t().api.flow.exportFailed],
      ]);
    });
  });
});

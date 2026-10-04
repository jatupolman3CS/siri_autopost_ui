import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { assistStorage } from '../../core/auth/token';
import { CollectionsStore } from '../../core/data/collections.store';
import { ComposerPreviewService } from '../../core/data/composer-preview.service';
import { SchedulesStore } from '../../core/data/schedules.store';
import { DraftStore } from '../../core/data/draft.store';
import { LibraryStore } from '../../core/data/library.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { composeFull, generatePosts, seededRandom } from '../../core/flow';
import { ApiCollection, ApiLinkSet, ApiRole } from '../../core/http/api.service';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { UiPrefsService } from '../../core/services/ui-prefs.service';
import {
  WS,
  answerWorkspaceLoads,
  provideApiTesting,
  settle,
  signIn,
} from '../../testing/api-testing';
import {
  apiCollection,
  apiCollectionPost,
  apiLinkSet,
  apiSetLink,
} from '../../testing/collection-fixtures';
import { apiSchedule } from '../../testing/schedules.fixtures';
import { ComposerPageComponent } from './composer-page.component';

const BASE = `/api/workspaces/${WS}/collections`;

const a1 = apiCollectionPost({ id: 'a1', collectionId: 'a', text: 'ขายคอนโด', mediaIds: ['m1'] });
const a2 = apiCollectionPost({ id: 'a2', collectionId: 'a', text: 'โพสต์สอง' });
const b1 = apiCollectionPost({
  id: 'b1',
  collectionId: 'b',
  text: 'ตั๋วหนัง',
  approval: 'approved',
});

const DATA: ApiCollection[] = [
  apiCollection({ id: 'a', name: 'Condo', posts: [a1, a2], scheduleCount: 2 }),
  apiCollection({
    id: 'b',
    name: 'Tickets',
    posts: [b1],
    settings: { requireApproval: true, hashtags: '#movie', footer: 'LINE @shop' },
  }),
  apiCollection({ id: 'c', name: 'Empty' }),
];

const SETS: ApiLinkSet[] = [
  apiLinkSet({
    id: 's1',
    name: 'Condo groups',
    links: [
      apiSetLink({ id: 'g0', name: 'Off group', code: 'X', enabled: false }),
      apiSetLink({ id: 'g1', name: 'Bad', url: 'not a group', code: 'Y', valid: false }),
      apiSetLink({ id: 'g2', name: 'Plain group' }),
      apiSetLink({ id: 'g3', name: 'Coded group', code: 'ซื้อ-ขายคอนโด' }),
    ],
  }),
  apiLinkSet({
    id: 's2',
    name: 'Cars',
    links: [apiSetLink({ id: 'g4', name: '', url: 'https://www.facebook.com/groups/old.cars' })],
  }),
  apiLinkSet({ id: 's3', name: 'Nothing on' }),
];

describe('ComposerPageComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ComposerPageComponent>;
  let el: HTMLElement;
  let navigate: ReturnType<typeof vi.spyOn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  const t = () => TestBed.inject(I18nService).t();
  const draft = () => TestBed.inject(DraftStore);
  const store = () => TestBed.inject(CollectionsStore);
  const toasts = () => TestBed.inject(NotificationService).toasts();

  async function open(
    params: { collection?: string; post?: string } = {},
    opts: {
      role?: ApiRole;
      assist?: boolean;
      data?: ApiCollection[];
      sets?: ApiLinkSet[];
      before?: () => void;
    } = {},
  ): Promise<void> {
    http = provideApiTesting({
      imports: [ComposerPageComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    if (opts.assist)
      assistStorage.set({
        adminToken: 'a',
        customerId: 'u-1',
        email: 'owner@shop.co',
        expiresAt: '2099-01-01T00:00:00Z',
      });
    TestBed.inject(WorkspaceStore);
    TestBed.inject(CollectionsStore);
    TestBed.inject(LibraryStore);
    TestBed.inject(ComposerPreviewService);
    await signIn(http, {
      collections: opts.data ?? DATA,
      linkSets: opts.sets ?? SETS,
      workspace: { role: opts.role ?? 'owner' },
    });
    opts.before?.();
    const router = TestBed.inject(Router);
    navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(ComposerPageComponent);
    if (params.collection) fixture.componentRef.setInput('collection', params.collection);
    if (params.post) fixture.componentRef.setInput('post', params.post);
    fixture.detectChanges();
    await settle();
    // The page reads the collections again when it opens.
    answerOpening(opts.data ?? DATA, opts.sets ?? SETS);
    await rerender();
    el = fixture.nativeElement as HTMLElement;
  }

  /** The page reads the collections and the link sets again when it opens. */
  const answerOpening = (data: ApiCollection[] = DATA, sets: ApiLinkSet[] = SETS) => {
    http.expectOne(BASE).flush(data);
    http.expectOne(`/api/workspaces/${WS}/link-sets`).flush(sets);
  };
  const rerender = async () => {
    await settle();
    fixture?.detectChanges();
  };
  const btn = (text: string, root: ParentNode = el): HTMLButtonElement => {
    const all = [...root.querySelectorAll<HTMLButtonElement>('button')];
    return (all.find((b) => b.textContent!.trim() === text) ??
      all.find((b) => b.textContent!.includes(text)))!;
  };
  const textarea = () => el.querySelector<HTMLTextAreaElement>('#cmp-text')!;
  const type = async (value: string) => {
    textarea().value = value;
    textarea().dispatchEvent(new Event('input'));
    await rerender();
  };
  const select = (root: ParentNode, label: string) =>
    [...root.querySelectorAll('app-select-field')]
      .find((f) => f.querySelector('label')!.textContent === label)!
      .querySelector('select')!;
  const choose = async (sel: HTMLSelectElement, value: string) => {
    sel.value = value;
    sel.dispatchEvent(new Event('change'));
    await rerender();
  };
  const preview = () => el.querySelector('app-composer-preview')!;
  const previewText = () => preview().querySelector('.box')!.textContent!;
  const saveBtn = () => btn(t().cmp.save);

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

  describe('a new post', () => {
    beforeEach(() => open({ collection: 'b' }));

    it('has the design title and subtitle, the stepper at step 1 and the back button', () => {
      expect(el.querySelector('h1')!.textContent).toBe(t().cmp.title);
      expect(el.querySelector('.page-head p')!.textContent).toBe(t().cmp.sub);
      expect(el.querySelector('a.step[aria-current="step"] .num')!.textContent!.trim()).toBe('1');
      btn(t().nav.collections).click();
      expect(navigateByUrl).toHaveBeenCalledWith('/app/collections');
    });

    it('has no targets, time or repeat any more: it only writes a post of a collection', () => {
      const text = el.textContent!;
      for (const gone of [t().cmp.targets, t().cmp.repeat, t().cmp.submit, t().cmp.draft])
        expect(text).not.toContain(gone);
      expect(el.querySelector('input[type=date], input[type=time]')).toBeNull();
    });

    it('stops the text at 5000 characters and counts them', async () => {
      expect(textarea().getAttribute('maxlength')).toBe(String(INPUT_LIMITS.postText));
      await type('สวัสดี');
      expect(el.querySelector('.counter')!.textContent).toContain(`6 / ${INPUT_LIMITS.postText}`);
      expect(draft().draft().text).toBe('สวัสดี');
    });

    it('starts in the collection of the address', () => {
      expect(select(el, t().cmp.collection).value).toBe('b');
      expect(draft().draft()).toMatchObject({ collectionId: 'b', postId: null });
    });
  });

  describe('a post to edit', () => {
    it('is loaded from the address: its text, media, collection and the "edit" title', async () => {
      await open({ collection: 'a', post: 'a1' });
      expect(el.querySelector('h1')!.textContent).toBe(t().cmp.editTitle);
      expect(textarea().value).toBe('ขายคอนโด');
      expect(select(el, t().cmp.collection).value).toBe('a');
      expect(el.querySelector('.media-head')!.textContent).toContain(
        t().cmp.mediaSel.replace('{n}', '1'),
      );
    });

    it('waits for the collections before it looks for the post', async () => {
      http = provideApiTesting({
        imports: [ComposerPageComponent],
        providers: [provideRouter([{ path: '**', children: [] }])],
      });
      TestBed.inject(WorkspaceStore);
      await signIn(http);
      fixture = TestBed.createComponent(ComposerPageComponent);
      fixture.componentRef.setInput('post', 'a2');
      fixture.detectChanges();
      await settle();
      expect(draft().draft().postId).toBeNull();
      http.expectOne(BASE).flush(DATA);
      for (const r of http.match((r) => /\/(link-sets|media|media-folders|snippets)$/.test(r.url))) r.flush([]);
      await rerender();
      expect(draft().draft()).toMatchObject({ postId: 'a2', text: 'โพสต์สอง' });
    });

    it('finds the post even when only the post is in the address', async () => {
      await open({ post: 'b1' });
      expect(draft().draft()).toMatchObject({ postId: 'b1', collectionId: 'b' });
    });

    it('tells when the post is gone and starts a new one in the collection', async () => {
      await open({ collection: 'a', post: 'deleted' });
      expect(toasts().map((x) => x.message)).toEqual([t().api.flow.cmpPostGone]);
      expect(draft().draft()).toMatchObject({ postId: null, text: '', collectionId: 'a' });
      expect(el.querySelector('h1')!.textContent).toBe(t().cmp.title);
    });

    it('keeps the text typed before a trip to the library when the address names the same post', async () => {
      await open({ collection: 'a', post: 'a2' });
      await type('rewritten');
      fixture.destroy();
      // The library's "back to the post" leads here with the draft's own address.
      fixture = TestBed.createComponent(ComposerPageComponent);
      fixture.componentRef.setInput('collection', 'a');
      fixture.componentRef.setInput('post', 'a2');
      fixture.detectChanges();
      await settle();
      answerOpening();
      await rerender();
      el = fixture.nativeElement as HTMLElement;
      expect(textarea().value).toBe('rewritten');
    });

    it('continues the draft when the address has no parameters, with a default collection', async () => {
      await open({}, { before: () => store().lastId.set('b') });
      expect(select(el, t().cmp.collection).value).toBe('b');
      await type('half written');
      fixture.destroy();
      fixture = TestBed.createComponent(ComposerPageComponent);
      fixture.detectChanges();
      await settle();
      answerOpening();
      await rerender();
      el = fixture.nativeElement as HTMLElement;
      expect(textarea().value).toBe('half written');
    });
  });

  describe('tools', () => {
    beforeEach(() => open({ collection: 'a' }));

    const tools = () => el.querySelector('.tools');

    it("are folded away in simple mode, and the person's choice stays", async () => {
      expect(tools()).toBeNull();
      btn(t().cmp.tools).click();
      await rerender();
      expect(tools()).not.toBeNull();
      // The choice stays over the simple-mode switch, as in the design.
      TestBed.inject(UiPrefsService).set(false);
      await rerender();
      expect(tools()).not.toBeNull();
      btn(t().cmp.tools).click();
      await rerender();
      expect(tools()).toBeNull();
    });

    it('are open by default outside simple mode', async () => {
      TestBed.inject(UiPrefsService).set(false);
      await rerender();
      expect(tools()).not.toBeNull();
    });

    it('insert a saved snippet after the text, then go back to the placeholder', async () => {
      TestBed.inject(LibraryStore).snippets.set([
        { id: 's1', title: 'Hello', text: 'สวัสดีค่ะ', used: 0 },
      ]);
      btn(t().cmp.tools).click();
      await rerender();
      await type('ข้อความ');
      await choose(select(el, t().cmp.template), 's1');
      expect(textarea().value).toBe('ข้อความ\nสวัสดีค่ะ');
      expect(select(el, t().cmp.template).value).toBe('');
    });

    it('insert {{code}} once, and toast when it is there already', async () => {
      btn(t().cmp.tools).click();
      await rerender();
      await type('ขายของ');
      btn(t().cmp.insertCode).click();
      await rerender();
      expect(textarea().value).toBe('{{code}}\nขายของ');
      btn(t().cmp.insertCode).click();
      await rerender();
      expect(textarea().value).toBe('{{code}}\nขายของ');
      expect(toasts().map((x) => x.message)).toEqual([t().cmp.codeAlready]);
    });

    it('insert a spintax sample in front of the text', async () => {
      btn(t().cmp.tools).click();
      await rerender();
      await type('ขายของ');
      btn(t().cmp.insertSpin).click();
      await rerender();
      expect(textarea().value).toBe(t().api.flow.spinSample + 'ขายของ');
    });

    it('explain the code and spintax in a hint', async () => {
      btn(t().cmp.tools).click();
      await rerender();
      expect(tools()!.textContent).toContain(t().cmp.codeHint);
      expect(tools()!.textContent).toContain(t().cmp.spinHint);
    });
  });

  describe('media', () => {
    beforeEach(() =>
      open(
        { collection: 'a' },
        {
          before: () => {
            const lib = TestBed.inject(LibraryStore);
            lib.media.set([
              { id: 'm1', name: 'a.png', meta: '', kind: 'image', used: 0 },
              { id: 'm2', name: 'b.mp4', meta: '', kind: 'video', used: 0 },
            ]);
            lib.thumbs.set({ m1: 'blob:thumb-1' });
          },
        },
      ),
    );

    const pickers = () => [...el.querySelectorAll<HTMLButtonElement>('.media .m')];

    it('shows the library with thumbnails and an icon for videos', () => {
      expect(pickers().length).toBe(2);
      expect(pickers()[0].querySelector('img')!.getAttribute('src')).toBe('blob:thumb-1');
      expect(pickers()[1].querySelector('.thumb i')!.className).toContain('ph-video');
      expect(pickers()[0].title).toBe('a.png');
    });

    it('attaches and detaches a file with a click, and counts them', async () => {
      pickers()[1].click();
      await rerender();
      expect(draft().draft().media).toEqual(['m2']);
      expect(pickers()[1].getAttribute('aria-pressed')).toBe('true');
      expect(pickers()[1].querySelector('.tick')).not.toBeNull();
      expect(el.querySelector('.media-head')!.textContent).toContain(
        t().cmp.mediaSel.replace('{n}', '1'),
      );
      pickers()[1].click();
      await rerender();
      expect(draft().draft().media).toEqual([]);
    });

    it('refuses a 21st file with the library limit message', async () => {
      draft().patch({ media: Array.from({ length: INPUT_LIMITS.postMedia }, (_, i) => 'x' + i) });
      await rerender();
      pickers()[0].click();
      await rerender();
      expect(draft().draft().media.length).toBe(INPUT_LIMITS.postMedia);
      expect(toasts().map((x) => x.message)).toEqual([
        t().api.mediaMax.replace('{n}', String(INPUT_LIMITS.postMedia)),
      ]);
    });

    it('links to the library, with the design hint', () => {
      const link = el.querySelector<HTMLAnchorElement>('.media-head a')!;
      expect(link.getAttribute('href')).toBe('/app/library');
      expect(link.textContent).toContain(t().cmp.openLibrary);
      expect(el.textContent).toContain(t().cmp.mediaHint);
    });

    it('uploads to the library and attaches what the server took', async () => {
      const input = el.querySelector<HTMLInputElement>('input[type=file]')!;
      const file = new File(['x'], 'new.mp4', { type: 'video/mp4' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));
      await settle();
      const req = http.expectOne({ method: 'POST', url: `/api/workspaces/${WS}/media` });
      expect((req.request.body as FormData).get('file')).toBe(file);
      req.flush({
        id: 'm9',
        name: 'new.mp4',
        contentType: 'video/mp4',
        kind: 'video',
        size: 1,
        usedCount: 0,
        createdAt: '2026-10-01T00:00:00Z',
      });
      await rerender();
      expect(draft().draft().media).toEqual(['m9']);
      expect(pickers().length).toBe(3);
      expect(toasts().map((x) => x.message)).toContain(t().api.uploaded.replace('{n}', '1'));
    });

    it('says when the upload failed and attaches nothing', async () => {
      const input = el.querySelector<HTMLInputElement>('input[type=file]')!;
      Object.defineProperty(input, 'files', {
        value: [new File(['x'], 'bad.exe')],
        configurable: true,
      });
      input.dispatchEvent(new Event('change'));
      await settle();
      http
        .expectOne({ method: 'POST', url: `/api/workspaces/${WS}/media` })
        .flush({}, { status: 415, statusText: 'Unsupported' });
      await rerender();
      expect(draft().draft().media).toEqual([]);
      expect(toasts().map((x) => x.message)).toContain(t().api.uploadFailed);
    });
  });

  describe('media: empty library', () => {
    it('points to the library', async () => {
      await open({ collection: 'a' });
      expect(el.querySelector('.media')!.textContent).toContain(t().api.noMedia);
    });
  });

  describe('collection', () => {
    it('offers the workspace collections, and a hint of the schedules that use the chosen one', async () => {
      await open({ collection: 'a' });
      const sel = select(el, t().cmp.collection);
      expect([...sel.options].map((o) => o.textContent)).toEqual([
        t().cmp.colPh,
        'Condo',
        'Tickets',
        'Empty',
      ]);
      expect(el.querySelector('.cmp-hint')!.textContent).toBe(
        t().api.flow.cmpColHint.replace('{n}', '2'),
      );
      await choose(sel, 'c');
      expect(el.querySelector('.cmp-hint')!.textContent).toBe(t().cmp.colHintNone);
      expect(draft().draft().collectionId).toBe('c');
    });

    it('names the schedules that use the chosen collection, with their times, once they have loaded', async () => {
      await open({ collection: 'a' });
      const store = TestBed.inject(SchedulesStore);
      store.schedules.set([
        apiSchedule({ id: 'x1', name: 'Morning', collectionId: 'a', slots: ['09:00', '18:00'] }),
        apiSchedule({ id: 'x2', name: 'Other', collectionId: 'b' }),
      ]);
      store.loaded.set(true);
      await rerender();
      expect(el.querySelector('.cmp-hint')!.textContent).toBe(
        fmt(t().cmp.colHint, { s: 'Morning (09:00, 18:00)' }),
      );
    });

    it('says an approved post goes back to draft when it is edited in a collection that needs approval', async () => {
      await open({ collection: 'b', post: 'b1' });
      expect(el.textContent).toContain(t().api.flow.cmpEditResets);
      await choose(select(el, t().cmp.collection), 'a');
      expect(el.textContent).not.toContain(t().api.flow.cmpEditResets);
    });

    it('says to create the first collection when there is none', async () => {
      await open({}, { data: [] });
      expect(el.querySelector('.cmp-hint')!.textContent).toBe(t().api.flow.cmpNoCollections);
    });

    it('creates a collection from the page and chooses it', async () => {
      await open({ collection: 'a' });
      btn(t().cmp.newColLink).click();
      await rerender();
      const modal = el.querySelector('app-new-collection-modal .su-modal-panel')!;
      const name = modal.querySelector<HTMLInputElement>('input')!;
      name.value = 'Shoes';
      name.dispatchEvent(new Event('input'));
      modal.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
      await settle();
      http
        .expectOne({ method: 'POST', url: BASE })
        .flush(apiCollection({ id: 'n', name: 'Shoes' }));
      await rerender();
      expect(el.querySelector('app-new-collection-modal .su-modal-panel')).toBeNull();
      expect(draft().draft().collectionId).toBe('n');
      expect(select(el, t().cmp.collection).value).toBe('n');
    });
  });

  describe('saving', () => {
    it('saves a new post to its collection, toasts and goes to the collections page', async () => {
      await open({ collection: 'b' });
      await type('  ตั๋วหนังราคาพิเศษ  ');
      draft().patch({ media: ['m1', 'm2'] });
      saveBtn().click();
      await settle();
      const req = http.expectOne({ method: 'POST', url: `${BASE}/b/posts` });
      expect(req.request.body).toEqual({ text: 'ตั๋วหนังราคาพิเศษ', mediaIds: ['m1', 'm2'] });
      req.flush(
        apiCollectionPost({
          id: 'n1',
          collectionId: 'b',
          text: 'ตั๋วหนังราคาพิเศษ',
          approval: 'draft',
        }),
      );
      await rerender();
      expect(toasts().map((x) => x.message)).toEqual([t().cmp.saved.replace('{c}', 'Tickets')]);
      expect(navigateByUrl).toHaveBeenCalledWith('/app/collections');
      expect(draft().draft()).toMatchObject({ text: '', media: [], postId: null });
      expect(store().openId()).toBe('b');
      expect(store().lastId()).toBe('b');
      expect(
        store()
          .byId('b')
          ?.posts.map((p) => p.id),
      ).toEqual(['b1', 'n1']);
    });

    it('"save and write another" keeps the collection, empties the draft and stays', async () => {
      await open({ collection: 'a', post: 'a2' });
      await type('edited');
      btn(t().cmp.saveNew).click();
      await settle();
      const req = http.expectOne({ method: 'PUT', url: `${BASE}/a/posts/a2` });
      req.flush({ ...a2, text: 'edited' });
      await rerender();
      expect(navigateByUrl).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith(['/app/composer'], {
        queryParams: { collection: 'a', post: null },
      });
      expect(draft().draft()).toMatchObject({ text: '', postId: null, collectionId: 'a' });
      expect(textarea().value).toBe('');
      expect(el.querySelector('h1')!.textContent).toBe(t().cmp.title);
    });

    it('saves an edited post in place and says it was updated', async () => {
      await open({ collection: 'a', post: 'a1' });
      await type('ขายคอนโด ลดราคา');
      saveBtn().click();
      await settle();
      const req = http.expectOne({ method: 'PUT', url: `${BASE}/a/posts/a1` });
      expect(req.request.body).toEqual({
        text: 'ขายคอนโด ลดราคา',
        mediaIds: ['m1'],
        collectionId: null,
      });
      req.flush({ ...a1, text: 'ขายคอนโด ลดราคา' });
      await rerender();
      expect(toasts().map((x) => x.message)).toEqual([t().cmp.updated]);
      expect(navigateByUrl).toHaveBeenCalledWith('/app/collections');
      expect(store().byId('a')?.posts[0].text).toBe('ขายคอนโด ลดราคา');
    });

    it('moves the post when another collection is chosen', async () => {
      await open({ collection: 'a', post: 'a2' });
      await choose(select(el, t().cmp.collection), 'c');
      saveBtn().click();
      await settle();
      const req = http.expectOne({ method: 'PUT', url: `${BASE}/a/posts/a2` });
      expect(req.request.body.collectionId).toBe('c');
      req.flush({ ...a2, collectionId: 'c' });
      await rerender();
      expect(
        store()
          .byId('a')
          ?.posts.map((p) => p.id),
      ).toEqual(['a1']);
      expect(
        store()
          .byId('c')
          ?.posts.map((p) => p.id),
      ).toEqual(['a2']);
      expect(store().openId()).toBe('c');
    });

    it('asks for text and a collection, and sends nothing without them', async () => {
      await open({});
      draft().patch({ collectionId: '' });
      saveBtn().click();
      await rerender();
      expect(draft().draft().errText).toBe(t().cmp.errText);
      expect(draft().draft().errCol).toBe(t().cmp.errCol);
      expect(el.querySelector('.counter .err')!.textContent).toBe(t().cmp.errText);
      expect(el.querySelector('.col-panel .su-field-err')!.textContent).toBe(t().cmp.errCol);
      expect(textarea().classList).toContain('su-input-error');
      http.expectNone((r) => r.method !== 'GET');
      // Typing and choosing clear the errors.
      await type('x');
      expect(draft().draft().errText).toBe('');
      await choose(select(el, t().cmp.collection), 'a');
      expect(draft().draft().errCol).toBe('');
    });

    it('does not count blanks as text', async () => {
      await open({ collection: 'a' });
      await type('   \n  ');
      saveBtn().click();
      await rerender();
      expect(draft().draft().errText).toBe(t().cmp.errText);
    });

    it('keeps everything when the API refuses, and lets the person try again', async () => {
      await open({ collection: 'a' });
      await type('hello');
      saveBtn().click();
      await settle();
      http
        .expectOne({ method: 'POST', url: `${BASE}/a/posts` })
        .flush({ title: 'x' }, { status: 422, statusText: 'Unprocessable' });
      await rerender();
      expect(textarea().value).toBe('hello');
      expect(navigateByUrl).not.toHaveBeenCalled();
      expect(saveBtn().disabled).toBe(false);
      saveBtn().click();
      await settle();
      http
        .expectOne({ method: 'POST', url: `${BASE}/a/posts` })
        .flush(apiCollectionPost({ id: 'n', collectionId: 'a' }));
      await rerender();
      expect(navigateByUrl).toHaveBeenCalledWith('/app/collections');
    });

    it('sends one request when the button is pressed twice', async () => {
      await open({ collection: 'a' });
      await type('hello');
      saveBtn().click();
      saveBtn().click();
      await settle();
      http
        .expectOne({ method: 'POST', url: `${BASE}/a/posts` })
        .flush(apiCollectionPost({ id: 'n', collectionId: 'a' }));
      await rerender();
    });

    it('tells when the post was deleted meanwhile and keeps the text as a new post', async () => {
      await open({ collection: 'a', post: 'a2' });
      store().collections.update((l) =>
        l.map((c) => ({ ...c, posts: c.posts.filter((p) => p.id !== 'a2') })),
      );
      saveBtn().click();
      await rerender();
      expect(toasts().map((x) => x.message)).toEqual([t().api.flow.cmpPostGone]);
      expect(draft().draft()).toMatchObject({ postId: null, text: 'โพสต์สอง' });
      http.expectNone((r) => r.method !== 'GET');
    });

    it('"cancel" throws the draft away and goes to the collections', async () => {
      await open({ collection: 'a' });
      await type('hello');
      btn(t().common.cancel).click();
      expect(draft().draft().text).toBe('');
      expect(navigateByUrl).toHaveBeenCalledWith('/app/collections');
    });

    it('the back button keeps the draft', async () => {
      await open({ collection: 'a' });
      await type('hello');
      btn(t().nav.collections).click();
      expect(draft().draft().text).toBe('hello');
    });
  });

  describe('AI writer', () => {
    const modal = () => el.querySelector('app-ai-writer-modal .su-modal-panel')!;
    const field = (label: string) =>
      [...modal().querySelectorAll('app-input-field')]
        .find((f) => f.querySelector('label')!.textContent === label)!
        .querySelector('input')!;
    const fillTopic = (value: string, label = t().ai.topic) => {
      const input = field(label);
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const submit = async () => {
      modal().querySelector<HTMLButtonElement>('button[type=submit]')!.click();
      await settle();
    };

    beforeEach(async () => {
      await open({ collection: 'a' });
      btn(t().cmp.tools).click();
      await rerender();
      btn(t().cmp.ai).click();
      await rerender();
    });

    it('opens with the design fields, the collection of the draft chosen and the template note', () => {
      expect(modal().querySelector('.su-modal-title')!.textContent).toBe(t().ai.title);
      expect(select(modal(), t().ai.into).value).toBe('a');
      expect(select(modal(), t().ai.tone).value).toBe('friendly');
      expect(select(modal(), t().ai.count).value).toBe('3');
      expect(modal().textContent).toContain(t().ai.note);
      expect([...select(modal(), t().ai.tone).options].map((o) => o.textContent)).toEqual([
        t().ai.tFriendly,
        t().ai.tSales,
        t().ai.tFormal,
      ]);
    });

    it('asks for a topic and sends nothing without one', async () => {
      await submit();
      await rerender();
      expect(modal().querySelector('.su-field-err')!.textContent).toBe(t().ai.errTopic);
      http.expectNone((r) => r.method !== 'GET');
    });

    it('writes the posts from the templates and adds them to the collection in one batch', async () => {
      fillTopic('ชั้นวางไม้สัก');
      fillTopic('ส่งฟรี, รับประกัน 1 ปี', t().ai.points);
      await choose(select(modal(), t().ai.tone), 'sales');
      await choose(select(modal(), t().ai.count), '5');
      await choose(select(modal(), t().ai.into), 'b');
      await submit();
      const req = http.expectOne({ method: 'POST', url: `${BASE}/b/posts/batch` });
      const expected = generatePosts({
        topic: 'ชั้นวางไม้สัก',
        points: ['ส่งฟรี', 'รับประกัน 1 ปี'],
        tone: 'sales',
        count: 5,
      });
      expect(req.request.body.items).toEqual(expected.map((text) => ({ text, mediaIds: [] })));
      expect(req.request.body.items.length).toBe(5);
      req.flush(
        expected.map((text, i) =>
          apiCollectionPost({ id: 'ai' + i, collectionId: 'b', text, approval: 'draft' }),
        ),
      );
      await rerender();
      expect(toasts().map((x) => x.message)).toEqual([
        t().ai.generated.replace('{n}', '5').replace('{c}', 'Tickets'),
      ]);
      expect(el.querySelector('app-ai-writer-modal .su-modal-panel')).toBeNull();
      // The collections page opens with that collection open.
      expect(navigateByUrl).toHaveBeenCalledWith('/app/collections');
      expect(store().openId()).toBe('b');
      expect(store().byId('b')?.posts.length).toBe(6);
    });

    it('offers up to 20 posts at a time', () => {
      const counts = [...select(modal(), t().ai.count).options].map((o) => Number(o.value));
      expect(Math.max(...counts)).toBe(20);
    });

    it('stays open with the form when the API refuses', async () => {
      fillTopic('ชั้นวาง');
      await submit();
      http
        .expectOne({ method: 'POST', url: `${BASE}/a/posts/batch` })
        .flush({ title: 'ครบ' }, { status: 422, statusText: 'Unprocessable' });
      await rerender();
      expect(modal()).not.toBeNull();
      expect(field(t().ai.topic).value).toBe('ชั้นวาง');
      expect(navigateByUrl).not.toHaveBeenCalled();
    });

    it('closes on Cancel', async () => {
      btn(t().common.cancel, modal()).click();
      await rerender();
      expect(el.querySelector('app-ai-writer-modal .su-modal-panel')).toBeNull();
    });
  });

  describe('preview', () => {
    it('asks for text first, and says how it will be posted once there is some', async () => {
      await open({ collection: 'a' });
      expect(preview().querySelector('h2')!.textContent).toBe(t().cmp.previewTitle);
      expect(previewText()).toBe(t().cmp.previewEmpty);
      await type('ขายคอนโด');
      expect(previewText()).toBe('ซื้อ-ขายคอนโด\nขายคอนโด');
    });

    it('uses the first set and its first usable link that has a code', async () => {
      await open({ collection: 'a' });
      await type('ขายคอนโด');
      const sets = select(preview(), t().cmp.previewSet);
      expect([...sets.options].map((o) => o.textContent)).toEqual([
        'Condo groups',
        'Cars',
        'Nothing on',
      ]);
      expect(sets.value).toBe('s1');
      // Off and invalid links are never used, whatever their codes.
      expect(preview().querySelector('.note')!.textContent).toContain(
        t().cmp.previewFor.replace('{g}', 'Coded group'),
      );
      expect(preview().querySelector('.note')!.textContent).not.toContain(t().cmp.previewNoCode);
    });

    it('says the group has no code when it has none, and names it from its address when it has no name', async () => {
      await open({ collection: 'a' });
      await type('ขายรถ');
      await choose(select(preview(), t().cmp.previewSet), 's2');
      expect(preview().querySelector('.note')!.textContent).toContain(
        t().cmp.previewFor.replace('{g}', 'old.cars'),
      );
      expect(preview().querySelector('.note')!.textContent).toContain(t().cmp.previewNoCode);
      expect(previewText()).toBe('ขายรถ');
    });

    it('says a set has no links on', async () => {
      await open({ collection: 'a' });
      await choose(select(preview(), t().cmp.previewSet), 's3');
      expect(preview().querySelector('.note')!.textContent).toContain(t().ts.empty);
    });

    it('says there are no link sets yet', async () => {
      await open({ collection: 'a' }, { sets: [] });
      expect(preview().querySelector('.note')!.textContent).toContain(t().cmp.previewNoSet);
    });

    it('adds the footer and hashtags of the chosen collection', async () => {
      await open({ collection: 'b' });
      await type('ตั๋วหนัง {{code}}');
      expect(previewText()).toBe('ตั๋วหนัง ซื้อ-ขายคอนโด\n\nLINE @shop\n#movie');
      await choose(select(el, t().cmp.collection), 'a');
      expect(previewText()).toBe('ตั๋วหนัง ซื้อ-ขายคอนโด');
    });

    it('puts the footer before the text when the collection says so', async () => {
      const data = [
        apiCollection({
          id: 'a',
          name: 'Condo',
          settings: { footer: 'LINE @shop', footerPos: 'top' },
        }),
      ];
      await open({ collection: 'a' }, { data, sets: [] });
      await type('hello');
      expect(previewText()).toBe('LINE @shop\nhello');
    });

    it('picks other spintax words on "reshuffle", the same ones while nothing changes', async () => {
      await open({ collection: 'a' }, { sets: [] });
      const text = '{a|b|c|d|e|f|g|h|i|j}-{k|l|m|n|o|p|q|r|s|t}';
      await type(text);
      const seen = new Set<string>();
      for (let seed = 1; seed <= 4; seed++) {
        expect(previewText()).toBe(composeFull(text, '', null, seededRandom(seed)));
        seen.add(previewText());
        const again = previewText();
        await rerender();
        expect(previewText()).toBe(again);
        btn(t().cmp.respin, preview()).click();
        await rerender();
      }
      expect(seen.size).toBeGreaterThan(1);
    });

    it('shows chips for the attached media', async () => {
      await open(
        { collection: 'a' },
        {
          before: () => {
            const lib = TestBed.inject(LibraryStore);
            lib.media.set([
              { id: 'm1', name: 'a.png', meta: '', kind: 'image', used: 0 },
              { id: 'm2', name: 'b.mp4', meta: '', kind: 'video', used: 0 },
            ]);
            lib.thumbs.set({ m1: 'blob:thumb-1' });
          },
        },
      );
      expect(preview().querySelector('.chips')).toBeNull();
      draft().patch({ media: ['m2', 'm1', 'gone'] });
      await rerender();
      const chips = [...preview().querySelectorAll('.chip')];
      expect(chips.length).toBe(2);
      expect(chips[0].getAttribute('title')).toBe('b.mp4');
      expect(chips[0].querySelector('i')!.className).toContain('ph-video');
      expect(chips[1].querySelector('img')!.getAttribute('src')).toBe('blob:thumb-1');
    });
  });

  describe('roles', () => {
    const disabled = (b: HTMLElement) => (b as HTMLButtonElement).disabled;

    it.each([
      ['viewer', true],
      ['editor', false],
    ] as const)('%s: text, tools, media, collection and save are off = %s', async (role, off) => {
      await open({ collection: 'a' }, { role });
      btn(t().cmp.tools).click();
      await rerender();
      expect(textarea().readOnly).toBe(off);
      for (const text of [t().cmp.insertCode, t().cmp.insertSpin, t().cmp.ai, t().cmp.upload])
        expect(disabled(btn(text)), text).toBe(off);
      expect(disabled(btn(t().cmp.newColLink))).toBe(off);
      expect(disabled(saveBtn())).toBe(off);
      expect(disabled(btn(t().cmp.saveNew))).toBe(off);
      expect(select(el, t().cmp.collection).disabled).toBe(off);
      expect(!!el.querySelector('.perm-note')).toBe(off);
      // Cancel and back only leave the page.
      expect(disabled(btn(t().common.cancel))).toBe(false);
    });

    it('is read-only in assist mode', async () => {
      await open({ collection: 'a' }, { assist: true });
      expect(textarea().readOnly).toBe(true);
      expect(disabled(saveBtn())).toBe(true);
      expect(el.querySelector('.perm-note')).not.toBeNull();
    });

    it('sends nothing when a viewer gets past the disabled buttons', async () => {
      await open({ collection: 'a' }, { role: 'viewer' });
      draft().patch({ text: 'x' });
      saveBtn().click();
      await rerender();
      http.expectNone((r) => r.method !== 'GET');
    });

    it('lets a viewer open a post to read it', async () => {
      await open({ collection: 'a', post: 'a2' }, { role: 'viewer' });
      expect(textarea().value).toBe('โพสต์สอง');
    });
  });
});

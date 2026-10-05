import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { assistStorage } from '../../core/auth/token';
import { CollectionsStore } from '../../core/data/collections.store';
import { MasterPostsStore } from '../../core/data/master-posts.store';
import { DraftStore } from '../../core/data/draft.store';
import { LibraryStore } from '../../core/data/library.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiRole } from '../../core/http/api.service';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { I18nService } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { answerThumbs, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { apiCollection, apiCollectionPost } from '../../testing/collection-fixtures';
import { LibraryPageComponent } from './library-page.component';

describe('LibraryPageComponent and the composer draft', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<LibraryPageComponent>;
  let el: HTMLElement;
  let navigate: ReturnType<typeof vi.spyOn>;
  const t = () => TestBed.inject(I18nService).t();
  const draft = () => TestBed.inject(DraftStore);

  async function open(role: ApiRole = 'owner', assist = false): Promise<void> {
    http = provideApiTesting({
      imports: [LibraryPageComponent],
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
    TestBed.inject(LibraryStore);
    TestBed.inject(CollectionsStore);
    await signIn(http, {
      workspace: { role },
      collections: [
        apiCollection({
          id: 'a',
          posts: [apiCollectionPost({ id: 'a1', text: 'one', mediaIds: ['m1'] })],
        }),
      ],
    });
    const lib = TestBed.inject(LibraryStore);
    lib.media.set([
      { id: 'm1', name: 'a.png', meta: 'image/png · 1 KB', kind: 'image', used: 0 },
      { id: 'm2', name: 'b.png', meta: 'image/png · 1 KB', kind: 'image', used: 1 },
    ]);
    lib.snippets.set([{ id: 's1', title: 'Hello', text: 'สวัสดีค่ะ', used: 0 }]);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(LibraryPageComponent);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  const rerender = async () => {
    await settle();
    fixture.detectChanges();
  };
  const bar = () => el.querySelector('.draft-bar');
  const useButtons = () => [...el.querySelectorAll<HTMLButtonElement>('.card .su-btn-ghost')];
  const tab = async (i: number) => {
    el.querySelectorAll<HTMLButtonElement>('.tabs button')[i].click();
    await rerender();
  };

  afterEach(() => {
    vi.restoreAllMocks();
    try {
      answerThumbs(http);
      http.verify();
    } finally {
      TestBed.resetTestingModule();
      localStorage.clear();
    }
  });

  describe('the draft bar', () => {
    it('is not there while nothing is being written', async () => {
      await open();
      expect(bar()).toBeNull();
      draft().patch({ text: '   ' });
      await rerender();
      expect(bar()).toBeNull();
    });

    it('says how much is written and leads back to the post', async () => {
      await open();
      draft().patch({ text: 'สวัสดี', media: ['m1', 'm2'], collectionId: 'a' });
      await rerender();
      expect(bar()!.textContent).toContain(
        t().lib.draftBar.replace('{n}', '2').replace('{c}', '6'),
      );
      bar()!.querySelector<HTMLButtonElement>('button')!.click();
      expect(bar()!.textContent).toContain(t().lib.backToPost);
      expect(navigate).toHaveBeenCalledWith(['/app/composer'], {
        queryParams: { collection: 'a' },
      });
    });

    it('also shows for a post that is being edited, and the way back names the post', async () => {
      await open();
      const store = TestBed.inject(CollectionsStore);
      draft().edit(store.byId('a')!, store.postById('a1')!.post);
      await rerender();
      expect(bar()).not.toBeNull();
      bar()!.querySelector<HTMLButtonElement>('button')!.click();
      expect(navigate).toHaveBeenCalledWith(['/app/composer'], {
        queryParams: { collection: 'a', post: 'a1' },
      });
    });

    it('shows when only media was added, and goes to the plain composer without a collection', async () => {
      await open();
      draft().addMedia('m1');
      await rerender();
      expect(bar()).not.toBeNull();
      bar()!.querySelector<HTMLButtonElement>('button')!.click();
      expect(navigate).toHaveBeenCalledWith(['/app/composer'], { queryParams: {} });
    });
  });

  describe('"use"', () => {
    beforeEach(() => open());

    it('attaches a file to the draft and opens the composer', () => {
      useButtons()[1].click();
      expect(draft().draft().media).toEqual(['m2']);
      expect(navigate).toHaveBeenCalledWith(['/app/composer'], { queryParams: {} });
    });

    it('does not attach a file twice', () => {
      useButtons()[0].click();
      useButtons()[0].click();
      expect(draft().draft().media).toEqual(['m1']);
    });

    it('keeps the post that is being edited and its address', async () => {
      const store = TestBed.inject(CollectionsStore);
      draft().edit(store.byId('a')!, store.postById('a1')!.post);
      useButtons()[1].click();
      expect(draft().draft()).toMatchObject({ postId: 'a1', media: ['m1', 'm2'] });
      expect(navigate).toHaveBeenCalledWith(['/app/composer'], {
        queryParams: { collection: 'a', post: 'a1' },
      });
    });

    it('stays on the page with a message when the post has the most files already', () => {
      draft().patch({ media: Array.from({ length: INPUT_LIMITS.postMedia }, (_, i) => 'x' + i) });
      useButtons()[0].click();
      expect(navigate).not.toHaveBeenCalled();
      expect(
        TestBed.inject(NotificationService)
          .toasts()
          .map((x) => x.message),
      ).toEqual([t().api.mediaMax.replace('{n}', String(INPUT_LIMITS.postMedia))]);
    });

    it('adds a snippet after the text and opens the composer', async () => {
      draft().patch({ text: 'ข้อความเดิม' });
      await tab(1);
      useButtons()[0].click();
      expect(draft().draft().text).toBe('ข้อความเดิม\nสวัสดีค่ะ');
      expect(navigate).toHaveBeenCalledWith(['/app/composer'], { queryParams: {} });
    });
  });

  describe('rename, switch on/off and delete', () => {
    const API = '/api/workspaces/ws-1';
    const NO_CONTENT = { status: 204, statusText: 'No Content' };
    const apiMedia = (id: string, name: string, active = true) => ({
      id,
      name,
      contentType: 'image/png',
      kind: 'image' as const,
      size: 1024,
      usedCount: 0,
      createdAt: '2026-10-01T00:00:00Z',
      folderId: null,
      active,
    });
    const cardOf = (id: string) => el.querySelectorAll<HTMLElement>('.card')[id === 'm1' ? 0 : 1];
    const click = async (node: Element | null) => {
      (node as HTMLElement).click();
      await rerender();
    };
    const submitRename = async (name: string) => {
      const input = el.querySelector<HTMLInputElement>('app-rename-modal input')!;
      input.value = name;
      input.dispatchEvent(new Event('input'));
      el.querySelector<HTMLFormElement>('#rename-form')!.requestSubmit();
      await settle();
    };
    const confirm = async () => {
      const buttons = [...el.querySelectorAll<HTMLButtonElement>('app-confirm-modal button')];
      buttons.find((b) => b.textContent!.trim() === t().common.confirm)!.click();
      await settle();
    };

    it('renames a file through the dialog and shows the new name', async () => {
      await open();
      await click(cardOf('m1').querySelector('.rowtools .ibtn'));
      expect(el.querySelector<HTMLInputElement>('app-rename-modal input')!.value).toBe('a.png');
      await submitRename('  poster  ');
      const req = http.expectOne((r) => r.method === 'PUT' && r.url === `${API}/media/m1`);
      expect(req.request.body).toEqual({ name: 'poster' });
      req.flush(apiMedia('m1', 'poster'));
      await rerender();
      expect(cardOf('m1').textContent).toContain('poster');
      expect(el.querySelector('app-rename-modal .su-modal-panel')).toBeNull();
    });

    it('keeps the dialog open with a message when the name is refused', async () => {
      await open();
      await click(cardOf('m1').querySelector('.rowtools .ibtn'));
      await submitRename('x');
      http
        .expectOne((r) => r.method === 'PUT' && r.url === `${API}/media/m1`)
        .flush({ title: 'no' }, { status: 422, statusText: 'Unprocessable' });
      await rerender();
      expect(el.querySelector('app-rename-modal .su-modal-panel')).not.toBeNull();
      expect(el.querySelector('app-rename-modal')!.textContent).toContain(t().api.itemSaveFailed);
    });

    it('switches a file off: the card dims and "use" is off until it is switched on again', async () => {
      await open();
      await click(cardOf('m1').querySelector('app-checkbox input'));
      const req = http.expectOne((r) => r.method === 'POST' && r.url === `${API}/media/active`);
      expect(req.request.body).toEqual({ mediaIds: ['m1'], active: false });
      req.flush([apiMedia('m1', 'a.png', false)]);
      await rerender();
      expect(cardOf('m1').classList.contains('off')).toBe(true);
      expect(useButtons()[0].disabled).toBe(true);
      expect(useButtons()[0].title).toBe(t().api.itemOffUnusable);
      expect(useButtons()[1].disabled).toBe(false);
    });

    it('deletes a file after a confirmation, takes it off the draft and reads the collections again', async () => {
      await open();
      draft().addMedia('m1');
      await click(cardOf('m1').querySelectorAll('.rowtools .ibtn')[1]);
      expect(el.querySelector('app-confirm-modal')!.textContent).toContain('a.png');
      await confirm();
      const req = http.expectOne((r) => r.method === 'POST' && r.url === `${API}/media/delete`);
      expect(req.request.body).toEqual({ mediaIds: ['m1'] });
      req.flush(null, NO_CONTENT);
      await settle();
      http.expectOne((r) => r.method === 'GET' && r.url === `${API}/collections`).flush([]);
      await rerender();
      expect(
        TestBed.inject(LibraryStore)
          .media()
          .map((m) => m.id),
      ).toEqual(['m2']);
      expect(el.querySelectorAll('.card').length).toBe(1);
      expect(draft().draft().media).toEqual([]);
    });

    it('reads the post library again too (the server took the file off its posts)', async () => {
      await open();
      const master = TestBed.inject(MasterPostsStore);
      await settle();
      http.expectOne({ method: 'GET', url: `${API}/master-posts` }).flush([]);
      await settle();
      expect(master.loaded()).toBe(true);
      await click(cardOf('m1').querySelectorAll('.rowtools .ibtn')[1]);
      await confirm();
      http
        .expectOne((r) => r.method === 'POST' && r.url === `${API}/media/delete`)
        .flush(null, NO_CONTENT);
      await settle();
      http.expectOne((r) => r.method === 'GET' && r.url === `${API}/collections`).flush([]);
      const fresh = apiCollectionPost({ id: 'a1', text: 'one', mediaIds: [] });
      http.expectOne({ method: 'GET', url: `${API}/master-posts` }).flush([fresh]);
      await rerender();
      expect(master.posts()).toEqual([fresh]);
    });

    it('deletes the selected files in one request', async () => {
      await open();
      await click(el.querySelectorAll('.card .pick input')[0]);
      await click(el.querySelectorAll('.card .pick input')[1]);
      const del = [...el.querySelectorAll<HTMLButtonElement>('.selbar button')].find((b) =>
        b.textContent!.includes(t().api.mediaDeleteSel),
      )!;
      await click(del);
      await confirm();
      const req = http.expectOne((r) => r.method === 'POST' && r.url === `${API}/media/delete`);
      expect(req.request.body).toEqual({ mediaIds: ['m1', 'm2'] });
      req.flush(null, NO_CONTENT);
      await settle();
      http.expectOne((r) => r.method === 'GET' && r.url === `${API}/collections`).flush([]);
      await rerender();
      expect(el.querySelectorAll('.card').length).toBe(0);
    });

    it('edits a snippet in the same dialog as a new one', async () => {
      await open();
      await tab(1);
      await click(el.querySelector('.snip .rowtools .ibtn'));
      const fields = el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'app-modal input, app-modal textarea',
      );
      expect([...fields].map((f) => f.value)).toEqual(['Hello', 'สวัสดีค่ะ']);
      fields[0].value = 'Hi';
      fields[0].dispatchEvent(new Event('input'));
      const save = [...el.querySelectorAll<HTMLButtonElement>('app-modal button')].find(
        (b) => b.textContent!.trim() === t().common.save,
      )!;
      await click(save);
      const req = http.expectOne((r) => r.method === 'PUT' && r.url === `${API}/snippets/s1`);
      expect(req.request.body).toEqual({ title: 'Hi', text: 'สวัสดีค่ะ' });
      req.flush({ id: 's1', title: 'Hi', text: 'สวัสดีค่ะ', usedCount: 0, active: true });
      await rerender();
      expect(el.querySelector('.snip .fw6')!.textContent).toBe('Hi');
    });

    it('switches a snippet off and deletes it', async () => {
      await open();
      await tab(1);
      await click(el.querySelector('.snip app-checkbox input'));
      const off = http.expectOne(
        (r) => r.method === 'PUT' && r.url === `${API}/snippets/s1/active`,
      );
      expect(off.request.body).toEqual({ active: false });
      off.flush({ id: 's1', title: 'Hello', text: 'สวัสดีค่ะ', usedCount: 0, active: false });
      await rerender();
      expect(el.querySelector('.snip')!.classList.contains('off')).toBe(true);
      expect(useButtons()[0].disabled).toBe(true);

      await click(el.querySelectorAll('.snip .rowtools .ibtn')[1]);
      await confirm();
      http
        .expectOne((r) => r.method === 'DELETE' && r.url === `${API}/snippets/s1`)
        .flush(null, NO_CONTENT);
      await rerender();
      expect(el.querySelectorAll('.snip').length).toBe(0);
    });

    it('shows no rename or delete buttons to a viewer, and the switches are off', async () => {
      await open('viewer');
      expect(el.querySelector('.rowtools .ibtn')).toBeNull();
      expect(el.querySelector<HTMLInputElement>('.rowtools app-checkbox input')!.disabled).toBe(
        true,
      );
    });
  });

  describe('roles', () => {
    it.each([
      ['viewer', true],
      ['editor', false],
    ] as const)('%s: the "use" buttons are off = %s, with a reason', async (role, off) => {
      await open(role);
      expect(useButtons().map((b) => b.disabled)).toEqual([off, off]);
      expect(useButtons()[0].title).toBe(off ? t().api.permEdit : '');
      await tab(1);
      expect(useButtons().map((b) => b.disabled)).toEqual([off]);
    });

    it('is read-only in assist mode', async () => {
      await open('owner', true);
      expect(useButtons().every((b) => b.disabled)).toBe(true);
    });
  });
});

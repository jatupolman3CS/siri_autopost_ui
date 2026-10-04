import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { assistStorage } from '../../core/auth/token';
import { CollectionsStore } from '../../core/data/collections.store';
import { DraftStore } from '../../core/data/draft.store';
import { LibraryStore } from '../../core/data/library.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiRole } from '../../core/http/api.service';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { I18nService } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { provideApiTesting, settle, signIn } from '../../testing/api-testing';
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
          posts: [
            apiCollectionPost({ id: 'a1', collectionId: 'a', text: 'one', mediaIds: ['m1'] }),
          ],
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

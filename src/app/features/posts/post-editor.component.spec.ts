import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { assistStorage } from '../../core/auth/token';
import { AiStore } from '../../core/data/ai.store';
import { CollectionsStore } from '../../core/data/collections.store';
import { DraftStore } from '../../core/data/draft.store';
import { LibraryStore } from '../../core/data/library.store';
import { MasterPostsStore } from '../../core/data/master-posts.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { MAX_COMPOSED_LENGTH, composeFull, seededRandom } from '../../core/flow';
import {
  ApiAiStatus,
  ApiCollection,
  ApiCollectionPost,
  ApiLinkSet,
  ApiRole,
} from '../../core/http/api.service';
import { INPUT_LIMITS } from '../../core/http/input-limits';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { UiPrefsService } from '../../core/services/ui-prefs.service';
import {
  AI_STATUS,
  WS,
  answerThumbs,
  provideApiTesting,
  settle,
  signIn,
} from '../../testing/api-testing';
import {
  apiCollection,
  apiCollectionPost,
  apiLinkSet,
  apiPostSettings,
  apiSetLink,
} from '../../testing/collection-fixtures';
import { PostEditorComponent } from './post-editor.component';

const BASE = `/api/workspaces/${WS}`;
const MASTER = `${BASE}/master-posts`;
const COLS = `${BASE}/collections`;
const SETS = `${BASE}/link-sets`;
const AI_STATUS_URL = `${BASE}/ai/status`;
const AI_POSTS_URL = `${BASE}/ai/posts`;

const a1 = apiCollectionPost({
  id: 'a1',
  text: 'ขายคอนโด',
  mediaIds: ['m1'],
  collectionIds: ['a'],
});
const b1 = apiCollectionPost({
  id: 'b1',
  text: 'ตั๋วหนัง',
  approval: 'approved',
  collectionIds: ['b'],
});

const DATA: ApiCollection[] = [
  apiCollection({ id: 'a', name: 'Condo', posts: [a1], scheduleCount: 2 }),
  apiCollection({
    id: 'b',
    name: 'Tickets',
    posts: [b1],
    settings: { requireApproval: true, hashtags: '#movie', footer: 'LINE @shop' },
  }),
  apiCollection({ id: 'c', name: 'Empty' }),
];

const SET_LIST: ApiLinkSet[] = [
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

const MEDIA = [
  { id: 'm1', name: 'a.png', meta: '', kind: 'image' as const, used: 0, active: true },
  { id: 'm2', name: 'b.mp4', meta: '', kind: 'video' as const, used: 0, active: true },
  { id: 'm3', name: 'off.png', meta: '', kind: 'image' as const, used: 0, active: false },
];

describe('PostEditorComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<PostEditorComponent>;
  let el: HTMLElement;
  const t = () => TestBed.inject(I18nService).t();
  const draft = () => TestBed.inject(DraftStore);
  const toasts = () => TestBed.inject(NotificationService).toasts();

  async function open(
    opts: {
      post?: ApiCollectionPost | null;
      role?: ApiRole;
      assist?: boolean;
      data?: ApiCollection[];
      sets?: ApiLinkSet[];
      ai?: Partial<ApiAiStatus>;
      /** Leave the AI status unanswered (the AI button is a placeholder until it arrives). */
      aiPending?: boolean;
      before?: () => void;
    } = {},
  ): Promise<void> {
    http = provideApiTesting({
      imports: [PostEditorComponent],
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
    TestBed.inject(MasterPostsStore);
    TestBed.inject(LibraryStore);
    TestBed.inject(DraftStore);
    await signIn(http, {
      collections: opts.data ?? DATA,
      linkSets: opts.sets ?? SET_LIST,
      workspace: { role: opts.role ?? 'owner' },
    });
    opts.before?.();
    fixture = TestBed.createComponent(PostEditorComponent);
    fixture.componentRef.setInput('post', opts.post ?? null);
    fixture.detectChanges();
    await settle();
    // The editor reads the link sets of its preview again, and the AI status when the toolbar appears.
    for (const r of http.match(SETS)) r.flush(opts.sets ?? SET_LIST);
    if (!opts.aiPending)
      for (const r of http.match(AI_STATUS_URL)) r.flush({ ...AI_STATUS, ...opts.ai });
    await rerender();
    el = fixture.nativeElement as HTMLElement;
  }

  const rerender = async () => {
    await settle();
    fixture?.detectChanges();
  };
  const byId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
  const btn = (text: string, root: ParentNode = el): HTMLButtonElement => {
    const all = [...root.querySelectorAll<HTMLButtonElement>('button')];
    return (all.find((b) => b.textContent!.trim() === text) ??
      all.find((b) => b.textContent!.includes(text)))!;
  };
  const textarea = () => el.querySelector<HTMLTextAreaElement>('textarea.text')!;
  const type = async (value: string) => {
    textarea().value = value;
    textarea().dispatchEvent(new Event('input'));
    await rerender();
  };
  /** Puts the caret (or a selection) in the text area the way a person would. */
  const caret = (start: number, end = start) => {
    textarea().setSelectionRange(start, end);
    textarea().dispatchEvent(new Event('select'));
  };
  const click = async (testId: string) => {
    byId(testId).click();
    await rerender();
  };
  const pvText = () => byId('pv-text').textContent!;
  const popover = () => el.querySelector('app-pop .pop');

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    try {
      answerThumbs(http);
      for (const r of http.match(MASTER)) r.flush([]);
      for (const r of http.match(COLS)) r.flush(DATA);
      for (const r of http.match(SETS)) r.flush(SET_LIST);
      for (const r of http.match(AI_STATUS_URL)) r.flush(AI_STATUS);
      http.verify();
    } finally {
      TestBed.resetTestingModule();
      localStorage.clear();
      assistStorage.set(null);
    }
  });

  describe('one editor for a new post and an existing one', () => {
    it('a new post is bound to the draft: what is typed, attached and chosen lives there', async () => {
      await open({ before: () => TestBed.inject(LibraryStore).media.set(MEDIA) });
      await type('สวัสดี');
      expect(draft().draft().text).toBe('สวัสดี');
      byId('media-pick').click();
      await rerender();
      el.querySelector<HTMLButtonElement>('.picker .m')!.click();
      [...el.querySelectorAll<HTMLButtonElement>('.chips .pick')]
        .find((b) => b.textContent!.trim() === 'Condo')!
        .click();
      await rerender();
      expect(draft().draft()).toEqual({ text: 'สวัสดี', media: ['m1'], collectionIds: ['a'] });
    });

    it('shows the draft when it is filled from outside (the media library fills it)', async () => {
      await open();
      draft().patch({ text: 'from the library', media: ['m1'], collectionIds: ['b'] });
      await rerender();
      expect(textarea().value).toBe('from the library');
      expect(el.querySelector('.chips .pick[aria-pressed="true"]')!.textContent).toContain(
        'Tickets',
      );
    });

    it('continues a draft already there when it opens', async () => {
      await open({ before: () => draft().patch({ text: 'half written', collectionIds: ['a'] }) });
      expect(textarea().value).toBe('half written');
    });

    it('an existing post is edited with the editor’s own state: the draft is not touched', async () => {
      await open({ post: a1, before: () => draft().patch({ text: 'my draft' }) });
      expect(textarea().value).toBe('ขายคอนโด');
      await type('edited');
      expect(draft().draft().text).toBe('my draft');
    });

    it('is set up again only for another post, so a refresh of the list keeps what is typed', async () => {
      await open({ post: a1 });
      await type('half typed');
      fixture.componentRef.setInput('post', { ...a1, postedCount: 9 });
      await rerender();
      expect(textarea().value).toBe('half typed');
      fixture.componentRef.setInput('post', b1);
      await rerender();
      expect(textarea().value).toBe('ตั๋วหนัง');
    });

    it('stops the text at 5000 characters and counts them', async () => {
      await open();
      expect(textarea().getAttribute('maxlength')).toBe(String(INPUT_LIMITS.postText));
      await type('สวัสดี');
      expect(byId('counter').textContent).toContain(`6 / ${INPUT_LIMITS.postText}`);
    });
  });

  describe('the insert toolbar', () => {
    beforeEach(() => open());

    it('is always there above the text, not folded away', () => {
      const bar = el.querySelector('app-post-toolbar [role="toolbar"]')!;
      expect(bar).not.toBeNull();
      for (const id of ['tool-code', 'tool-spin', 'tool-snippet', 'tool-ai', 'tool-help'])
        expect(bar.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
      // Directly above the text area (its label comes first, then the bar).
      const field = textarea().closest('.field')!;
      const order = [...field.children].map((c) => c.tagName.toLowerCase());
      expect(order.indexOf('app-post-toolbar')).toBeLessThan(order.indexOf('textarea'));
      expect(el.textContent).not.toContain(t().cmp.tools);
    });

    it('names the buttons by what they put in', () => {
      expect(byId('tool-code').textContent).toContain(t().cmp.insertCode);
      expect(byId('tool-spin').textContent).toContain(t().cmp.insertSpin);
      expect(byId('tool-snippet').textContent).toContain(t().api.flow.edSnippetBtn);
      expect(byId('tool-ai').textContent).toContain(t().api.flow.edAiBtn);
      expect(byId('tool-code').getAttribute('title')).toBe(t().cmp.codeHint);
      expect(byId('tool-spin').getAttribute('title')).toBe(t().cmp.spinHint);
    });

    describe('{{code}}', () => {
      it('is written at the caret, and the caret goes after it', async () => {
        await type('ทักแชทเลย');
        caret(3);
        await click('tool-code');
        expect(textarea().value).toBe('ทัก{{code}}แชทเลย');
        expect(draft().draft().text).toBe('ทัก{{code}}แชทเลย');
        expect(textarea().selectionStart).toBe(3 + '{{code}}'.length);
        expect(textarea().selectionEnd).toBe(3 + '{{code}}'.length);
      });

      it('gets a line of its own at the start of the text', async () => {
        await type('ขายของ');
        caret(0);
        await click('tool-code');
        expect(textarea().value).toBe('{{code}}\nขายของ');
        expect(textarea().selectionStart).toBe('{{code}}\n'.length);
      });

      it('goes in an empty post with a new line after it, ready to write the text', async () => {
        await click('tool-code');
        expect(textarea().value).toBe('{{code}}\n');
        expect(textarea().selectionStart).toBe(9);
      });

      it('replaces the selection', async () => {
        await type('ขาย ตรงนี้ เลย');
        caret(4, 10);
        await click('tool-code');
        expect(textarea().value).toBe('ขาย {{code}} เลย');
      });

      it('can be written again where the caret is (a second place for the code)', async () => {
        await type('{{code}}\nขาย');
        caret(12);
        await click('tool-code');
        expect(textarea().value).toBe('{{code}}\nขาย{{code}}');
      });

      it('says so, and changes nothing, when the text would be over 5000 characters', async () => {
        await type('ก'.repeat(INPUT_LIMITS.postText));
        caret(10);
        await click('tool-code');
        expect(textarea().value.length).toBe(INPUT_LIMITS.postText);
        expect(toasts().map((x) => x.message)).toEqual([
          fmt(t().api.flow.edTooLongInsert, { n: INPUT_LIMITS.postText }),
        ]);
      });

      it('puts the caret back in the text area so typing goes on', async () => {
        await type('ab');
        caret(1);
        await click('tool-code');
        expect(document.activeElement).toBe(textarea());
      });
    });

    describe('Spintax', () => {
      const spinPopover = () => el.querySelector('app-spintax-popover');
      const option = (i: number) =>
        el.querySelectorAll<HTMLInputElement>('app-spintax-popover .custom .opt input')[i];
      const fill = async (i: number, value: string) => {
        option(i).value = value;
        option(i).dispatchEvent(new Event('input'));
        await rerender();
      };

      it('opens a small popover with the ready-made sets and a custom form', async () => {
        expect(popover()).toBeNull();
        await click('tool-spin');
        expect(popover()).not.toBeNull();
        expect(byId('tool-spin').getAttribute('aria-expanded')).toBe('true');
        const sets = [...spinPopover()!.querySelectorAll<HTMLElement>('.set')];
        expect(sets.map((s) => s.dataset['set'])).toEqual(['greet', 'close', 'cta']);
        expect(sets[0].textContent).toContain(t().api.flow.edSetGreet);
        expect(sets[0].textContent).toContain(t().api.flow.edSetGreetText);
        expect(sets[1].textContent).toContain(t().api.flow.edSetClose);
        expect(sets[2].textContent).toContain(t().api.flow.edSetCta);
        expect(spinPopover()!.textContent).toContain(t().api.flow.edSpinCustom);
        expect(spinPopover()!.querySelectorAll('.custom .opt input').length).toBe(2);
      });

      it('writes a ready-made set at the caret and closes', async () => {
        await type('ก่อน หลัง');
        caret(5);
        await click('tool-spin');
        spinPopover()!.querySelector<HTMLButtonElement>('[data-set="greet"]')!.click();
        await rerender();
        expect(textarea().value).toBe('ก่อน ' + t().api.flow.edSetGreetText + 'หลัง');
        expect(popover()).toBeNull();
        expect(textarea().selectionStart).toBe(5 + t().api.flow.edSetGreetText.length);
      });

      it('builds a custom group from the options typed, and shows it before it is written', async () => {
        await type('x ');
        caret(2);
        await click('tool-spin');
        expect(byId('spin-insert')).toBeDefined();
        expect((byId('spin-insert') as HTMLButtonElement).disabled).toBe(true);
        expect(byId('spin-built').textContent).toBe(t().api.flow.edSpinNeed2);
        await fill(0, 'ส่งฟรี');
        expect((byId('spin-insert') as HTMLButtonElement).disabled).toBe(true);
        await fill(1, 'ผ่อน 0%');
        expect(byId('spin-built').textContent).toBe('{ส่งฟรี|ผ่อน 0%}');
        byId('spin-add').click();
        await rerender();
        await fill(2, 'รับประกัน');
        expect(byId('spin-built').textContent).toBe('{ส่งฟรี|ผ่อน 0%|รับประกัน}');
        byId('spin-insert').click();
        await rerender();
        expect(textarea().value).toBe('x {ส่งฟรี|ผ่อน 0%|รับประกัน}');
        expect(popover()).toBeNull();
      });

      it('adds and removes options (two at least, ten at most) and drops braces and pipes', async () => {
        await click('tool-spin');
        expect(spinPopover()!.querySelectorAll('.opt .ibtn').length).toBe(0);
        for (let i = 0; i < 12; i++) {
          if (!(byId('spin-add') as HTMLButtonElement).disabled) byId('spin-add').click();
          await rerender();
        }
        expect(spinPopover()!.querySelectorAll('.custom .opt input').length).toBe(10);
        expect((byId('spin-add') as HTMLButtonElement).disabled).toBe(true);
        await fill(0, 'a|b');
        await fill(1, '{c}');
        expect(byId('spin-built').textContent).toBe('{ab|c}');
        spinPopover()!.querySelectorAll<HTMLButtonElement>('.opt .ibtn')[0].click();
        await rerender();
        expect(spinPopover()!.querySelectorAll('.custom .opt input').length).toBe(9);
        expect(option(0).value).toBe('{c}');
      });

      it('with words selected, wraps them as {selection|} and puts the caret after the pipe', async () => {
        await type('มีของใหม่ วันนี้');
        caret(0, 'มีของใหม่'.length);
        await click('tool-spin');
        expect(byId('spin-wrap').textContent).toContain('มีของใหม่');
        byId('spin-wrap').click();
        await rerender();
        expect(textarea().value).toBe('{มีของใหม่|} วันนี้');
        expect(textarea().selectionStart).toBe('{มีของใหม่|'.length);
        expect(textarea().value[textarea().selectionStart]).toBe('}');
        expect(popover()).toBeNull();
      });

      it('offers no wrap when nothing is selected', async () => {
        await type('ไม่มีอะไรเลือก');
        caret(2);
        await click('tool-spin');
        expect(el.querySelector('[data-testid="spin-wrap"]')).toBeNull();
      });

      it('starts the custom form with the selected words as the first option, and replaces them', async () => {
        await type('ทัก ได้เลย นะ');
        caret(4, 10);
        await click('tool-spin');
        expect(option(0).value).toBe('ได้เลย');
        await fill(1, 'ทักมา');
        byId('spin-insert').click();
        await rerender();
        expect(textarea().value).toBe('ทัก {ได้เลย|ทักมา} นะ');
      });

      it('closes on Escape (and the focus goes back to the button) and on a click outside', async () => {
        await click('tool-spin');
        spinPopover()!.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
        await rerender();
        expect(popover()).toBeNull();
        expect(document.activeElement).toBe(byId('tool-spin'));
        await click('tool-spin');
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await rerender();
        expect(popover()).toBeNull();
      });

      it('stays open for a click inside it (removing a row does not count as outside)', async () => {
        await click('tool-spin');
        byId('spin-add').click();
        await rerender();
        spinPopover()!.querySelectorAll<HTMLButtonElement>('.opt .ibtn')[0].click();
        await rerender();
        expect(popover()).not.toBeNull();
      });

      it('starts fresh every time it opens', async () => {
        await click('tool-spin');
        await fill(0, 'left over');
        await click('tool-spin');
        expect(popover()).toBeNull();
        await click('tool-spin');
        expect(option(0).value).toBe('');
      });

      it('writes nothing past the limit', async () => {
        await type('ก'.repeat(INPUT_LIMITS.postText));
        caret(INPUT_LIMITS.postText);
        await click('tool-spin');
        spinPopover()!.querySelector<HTMLButtonElement>('[data-set="cta"]')!.click();
        await rerender();
        expect(textarea().value.length).toBe(INPUT_LIMITS.postText);
        expect(toasts().length).toBe(1);
      });
    });

    describe('snippets', () => {
      const items = () => [
        ...el.querySelectorAll<HTMLButtonElement>('[data-testid="snippet-item"]'),
      ];

      it('lists only the snippets that are switched on, and writes one at the caret', async () => {
        TestBed.inject(LibraryStore).snippets.set([
          { id: 's1', title: 'Hello', text: 'สวัสดีค่ะ', used: 0, active: true },
          { id: 's2', title: 'Off one', text: 'ปิดอยู่', used: 0, active: false },
          { id: 's3', title: 'Old one', text: 'ไม่มีสถานะ', used: 0 },
        ]);
        await type('abc def');
        caret(3);
        await click('tool-snippet');
        expect(items().map((b) => b.querySelector('.fw5')!.textContent)).toEqual([
          'Hello',
          'Old one',
        ]);
        items()[0].click();
        await rerender();
        expect(textarea().value).toBe('abcสวัสดีค่ะ def');
        expect(popover()).toBeNull();
      });

      it('says there are none, with a way to the library', async () => {
        await click('tool-snippet');
        expect(popover()!.textContent).toContain(t().api.flow.edSnippetNone);
        expect(popover()!.querySelector('a')!.getAttribute('href')).toBe('/app/library');
      });

      it('writes exactly at the caret', async () => {
        TestBed.inject(LibraryStore).snippets.set([
          { id: 's1', title: 'Hello', text: '<<S>>', used: 0, active: true },
        ]);
        await type('abcdef');
        caret(3);
        await click('tool-snippet');
        items()[0].click();
        await rerender();
        expect(textarea().value).toBe('abc<<S>>def');
      });
    });

    describe('the "?" help', () => {
      it('says where the group code comes from and that every group gets different text', async () => {
        await click('tool-help');
        const help = popover()!;
        expect(help.textContent).toContain(t().api.flow.edHelpTitle);
        expect(help.textContent).toContain(t().api.flow.edHelpCodeB);
        expect(help.textContent).toContain(t().api.flow.edHelpSpinB);
        expect(help.querySelector('a')!.getAttribute('href')).toBe('/app/targets');
        expect(help.textContent).toContain(t().api.flow.edHelpSets);
      });

      it('has three examples, and writes one at the caret', async () => {
        await type('ก่อน');
        caret(4);
        await click('tool-help');
        const ex = [...popover()!.querySelectorAll<HTMLElement>('[data-example]')];
        expect(ex.map((e) => e.dataset['example'])).toEqual(['code', 'spin', 'both']);
        expect(ex[1].textContent).toContain(t().api.flow.edEx2Text);
        ex[1].querySelector('button')!.click();
        await rerender();
        expect(textarea().value).toBe('ก่อน' + t().api.flow.edEx2Text);
        expect(popover()).toBeNull();
      });

      it('has an accessible name', () => {
        expect(byId('tool-help').getAttribute('aria-label')).toBe(t().api.flow.edHelpBtn);
      });
    });
  });

  describe('the status line under the text', () => {
    beforeEach(() => open());
    const code = () => byId('status-code').textContent!.trim();
    const spin = () => byId('status-spin').textContent!.trim();
    const warnings = () =>
      [...el.querySelectorAll('[data-testid="status-warnings"] li')].map((l) =>
        l.textContent!.trim(),
      );

    it('says the code goes on line 1 when the text has no {{code}}', () => {
      expect(code()).toBe(t().api.flow.edCodeOff);
    });

    it('says {{code}} is replaced by each group’s code once it is in the text', async () => {
      await type('ขาย {{code}}');
      expect(code()).toBe(t().api.flow.edCodeOn);
      await type('{{ รหัส }}');
      expect(code()).toBe(t().api.flow.edCodeOn);
    });

    it('counts the Spintax groups and the variants they can make', async () => {
      expect(spin()).toBe(t().api.flow.edSpinOff);
      await type('{a|b|c} {d|e}');
      expect(spin()).toBe(fmt(t().api.flow.edSpinOn, { g: 2, v: 6 }));
      await type('{a|b|{c|d|e}}');
      expect(spin()).toBe(fmt(t().api.flow.edSpinOn, { g: 2, v: 5 }));
    });

    it('has no warnings for good text', async () => {
      await type('{{code}}\n{สวัสดี|หวัดดี} ครับ');
      expect(el.querySelector('[data-testid="status-warnings"]')).toBeNull();
    });

    it('warns about a brace that is never closed or never opened', async () => {
      await type('ขาย {a|b');
      expect(warnings()).toEqual([fmt(t().api.flow.edLintUnclosed, { t: '{a|b' })]);
      await type('a|b}');
      expect(warnings()).toEqual([fmt(t().api.flow.edLintUnopened, { t: 'a|b}' })]);
    });

    it('warns about {a} with no pipe, about empty options and about {{code}} inside a group', async () => {
      await type('{only}');
      expect(warnings()).toEqual([fmt(t().api.flow.edLintNoPipe, { t: '{only}' })]);
      await type('{a||b}');
      expect(warnings()).toEqual([fmt(t().api.flow.edLintEmpty, { t: '{a||b}' })]);
      await type('{ซื้อ {{code}}|สั่ง}');
      expect(warnings()).toEqual([fmt(t().api.flow.edLintCodeIn, { t: '{ซื้อ {{code}}|สั่ง}' })]);
    });

    it('shows one warning per kind and counts the rest', async () => {
      await type('{a} {b} {c||d} {e|f} {g|h|');
      const w = warnings();
      expect(w.length).toBe(3);
      expect(w[0]).toContain('{a}');
      await type('{a} {c||d} x} {g|h|');
      // three written out, and the fourth kind is counted
      expect(warnings().length).toBe(4);
      // Five kinds of mistake: three are written out and the other two are counted.
      await type('{a} {c||d} x} {g|h| {{code}} {i|{{code}}}');
      expect(warnings().length).toBe(4);
      expect(el.querySelector('[data-testid="status-warnings"] li.muted')!.textContent).toContain(
        fmt(t().api.flow.edLintMore, { n: 2 }),
      );
    });

    it('follows the text as it changes, also after a button wrote into it', async () => {
      await click('tool-code');
      expect(code()).toBe(t().api.flow.edCodeOn);
    });
  });

  describe('the preview', () => {
    const note = () => el.querySelector('app-post-preview .note')!.textContent!;
    const pvSelect = (label: string) =>
      [...el.querySelectorAll('app-post-preview app-select-field')]
        .find((f) => f.querySelector('label')!.textContent === label)!
        .querySelector('select')!;
    const choose = async (sel: HTMLSelectElement, value: string) => {
      sel.value = value;
      sel.dispatchEvent(new Event('change'));
      await rerender();
    };

    it('sits beside the form, asks for text first and says how it will be posted once there is some', async () => {
      await open();
      expect(el.querySelector('.pe > aside app-post-preview')).not.toBeNull();
      expect(el.querySelector('app-post-preview h2')!.textContent).toBe(t().cmp.previewTitle);
      expect(el.querySelector('app-post-preview .box')!.textContent).toBe(t().cmp.previewEmpty);
      await type('ขายคอนโด');
      expect(pvText()).toBe('ซื้อ-ขายคอนโด\nขายคอนโด');
    });

    it('uses the first set and its first usable group with a code, and says which group it is', async () => {
      await open();
      await type('ขายคอนโด');
      expect([...pvSelect(t().cmp.previewSet).options].map((o) => o.textContent)).toEqual([
        'Condo groups',
        'Cars',
        'Nothing on',
      ]);
      expect(pvSelect(t().cmp.previewSet).value).toBe('s1');
      // Off and invalid links are never used, whatever their codes.
      expect(note()).toContain(t().cmp.previewFor.replace('{g}', 'Coded group'));
      expect(byId('pv-code').textContent).toBe(fmt(t().api.flow.edPvCode, { c: 'ซื้อ-ขายคอนโด' }));
    });

    it('lets the person pick the group, and shows that group’s code in the text', async () => {
      await open();
      await type('ขายคอนโด');
      const groups = pvSelect(t().api.flow.edPvGroup);
      expect([...groups.options].map((o) => o.textContent)).toEqual([
        'Plain group',
        'Coded group · ซื้อ-ขายคอนโด',
      ]);
      expect(groups.value).toBe('1');
      await choose(groups, '0');
      expect(note()).toContain(t().cmp.previewFor.replace('{g}', 'Plain group'));
      expect(byId('pv-code').textContent).toBe(t().api.flow.edPvNoCode);
      expect(pvText()).toBe('ขายคอนโด');
      await choose(groups, '1');
      expect(pvText()).toBe('ซื้อ-ขายคอนโด\nขายคอนโด');
    });

    it('names a group from its address when it has no name, and says it has no code', async () => {
      await open();
      await type('ขายรถ');
      await choose(pvSelect(t().cmp.previewSet), 's2');
      expect(note()).toContain(t().cmp.previewFor.replace('{g}', 'old.cars'));
      expect(byId('pv-code').textContent).toBe(t().api.flow.edPvNoCode);
      expect(pvText()).toBe('ขายรถ');
    });

    it('says a set has no links on, and that there are no link sets yet', async () => {
      await open();
      await choose(pvSelect(t().cmp.previewSet), 's3');
      expect(note()).toContain(t().ts.empty);
      expect(el.querySelector('[data-testid="pv-code"]')).toBeNull();
      TestBed.resetTestingModule();
      await open({ sets: [] });
      expect(note()).toContain(t().cmp.previewNoSet);
    });

    it('highlights the words spintax picked, and not the rest', async () => {
      await open({ sets: [] });
      await type('สวัสดี {ครับ|ค่ะ|จ้า} ยินดีต้อนรับ');
      const marks = [...el.querySelectorAll('app-post-preview mark')];
      expect(marks.length).toBe(1);
      expect(['ครับ', 'ค่ะ', 'จ้า']).toContain(marks[0].textContent);
      expect(pvText()).toBe(`สวัสดี ${marks[0].textContent} ยินดีต้อนรับ`);
      expect(el.querySelector('app-post-preview')!.textContent).toContain(
        t().api.flow.edPvSpunHint,
      );
    });

    it('has nothing highlighted, and no hint, without spintax', async () => {
      await open({ sets: [] });
      await type('ไม่มีสุ่ม');
      expect(el.querySelector('app-post-preview mark')).toBeNull();
      expect(el.querySelector('app-post-preview')!.textContent).not.toContain(
        t().api.flow.edPvSpunHint,
      );
    });

    it('picks other spintax words on "reshuffle", the same ones while nothing changes', async () => {
      await open({ sets: [] });
      const text = '{a|b|c|d|e|f|g|h|i|j}-{k|l|m|n|o|p|q|r|s|t}';
      await type(text);
      const seen = new Set<string>();
      for (let seed = 1; seed <= 4; seed++) {
        expect(pvText()).toBe(composeFull(text, '', null, seededRandom(seed)));
        seen.add(pvText());
        const again = pvText();
        await rerender();
        expect(pvText()).toBe(again);
        byId('pv-respin').click();
        await rerender();
      }
      expect(seen.size).toBeGreaterThan(1);
    });

    it('shows 3 different variants at once, and goes back to one', async () => {
      await open({ sets: [] });
      await type('{a|b|c|d} {x|y|z}');
      expect(byId('pv-variants').textContent).toContain(t().api.flow.edPvVariants);
      await click('pv-variants');
      const boxes = [...el.querySelectorAll('[data-testid="pv-variant"] .box')].map(
        (b) => b.textContent!,
      );
      expect(boxes.length).toBe(3);
      expect(new Set(boxes).size).toBe(3);
      for (const b of boxes) expect(b).toMatch(/^[abcd] [xyz]$/);
      expect(byId('pv-variants').textContent).toContain(t().api.flow.edPvSingle);
      expect(byId('pv-variants').getAttribute('aria-pressed')).toBe('true');
      await click('pv-variants');
      expect(el.querySelector('[data-testid="pv-variant"]')).toBeNull();
      expect(byId('pv-text')).not.toBeNull();
    });

    it('cannot show variants of a text without spintax, and says why', async () => {
      await open({ sets: [] });
      await type('plain text');
      expect((byId('pv-variants') as HTMLButtonElement).disabled).toBe(true);
      expect(byId('pv-variants').getAttribute('title')).toBe(t().api.flow.edSpinOff);
    });

    it('counts the composed length against the 7,000 characters the server allows', async () => {
      await open({ sets: [] });
      await type('ก'.repeat(100));
      expect(byId('pv-length').textContent!.trim()).toBe(
        fmt(t().api.flow.edPvLen, { n: 100, max: MAX_COMPOSED_LENGTH }),
      );
      expect(byId('pv-length').classList).not.toContain('bad');
      expect(el.querySelector('app-post-preview [role="alert"]')).toBeNull();
    });

    it('warns when the post, with the group code, footer and hashtags, goes over the limit', async () => {
      const long = apiLinkSet({
        id: 'sl',
        name: 'Long code',
        links: [apiSetLink({ id: 'gl', name: 'Long', code: 'ร'.repeat(2100) })],
      });
      await open({ sets: [long] });
      await type('ก'.repeat(INPUT_LIMITS.postText));
      // 2100 (code) + 1 (line break) + 5000 (text) = 7101 characters: the server would refuse it.
      expect(byId('pv-length').textContent!.trim()).toBe(
        fmt(t().api.flow.edPvLen, { n: 7101, max: MAX_COMPOSED_LENGTH }),
      );
      expect(byId('pv-length').classList).toContain('bad');
      expect(el.querySelector('app-post-preview [role="alert"]')!.textContent).toBe(
        fmt(t().api.flow.edPvTooLong, { max: MAX_COMPOSED_LENGTH }),
      );
    });

    it('adds the footer and hashtags of the collection the post sits in', async () => {
      await open({ sets: [], post: b1, data: DATA });
      expect(pvText()).toBe('ตั๋วหนัง\n\nLINE @shop\n#movie');
      expect(el.querySelector('[data-testid="pv-collection"]')!.textContent).toBe(
        fmt(t().api.flow.edPvOneCol, { c: 'Tickets' }),
      );
    });

    it('says there is no collection to take a footer from when the post is in none', async () => {
      await open({ sets: [] });
      await type('hello');
      expect(el.querySelector('[data-testid="pv-collection"]')!.textContent).toBe(
        t().api.flow.edPvNoCol,
      );
      expect(pvText()).toBe('hello');
    });

    it('has a "preview as" collection for a post in several, the first one by default', async () => {
      await open({ sets: [], post: { ...b1, collectionIds: ['b', 'a'] } });
      const sel = pvSelect(t().api.flow.edPvAs);
      expect([...sel.options].map((o) => o.textContent)).toEqual(['Tickets', 'Condo']);
      expect(sel.value).toBe('b');
      expect(pvText()).toBe('ตั๋วหนัง\n\nLINE @shop\n#movie');
      await choose(sel, 'a');
      expect(pvText()).toBe('ตั๋วหนัง');
    });

    it('follows the selection of collections: the first one chosen is the one previewed', async () => {
      await open({ sets: [] });
      await type('hello');
      const chips = () => [...el.querySelectorAll<HTMLButtonElement>('.chips .pick')];
      chips()
        .find((b) => b.textContent!.trim() === 'Tickets')!
        .click();
      await rerender();
      expect(pvText()).toBe('hello\n\nLINE @shop\n#movie');
      chips()
        .find((b) => b.textContent!.trim() === 'Condo')!
        .click();
      await rerender();
      // The first one chosen stays the one previewed.
      expect(pvSelect(t().api.flow.edPvAs).value).toBe('b');
    });

    it("lays the post's own hashtags, footer and position (as typed, live) over the collection's", async () => {
      await open({ sets: [], post: b1 });
      expect(pvText()).toBe('ตั๋วหนัง\n\nLINE @shop\n#movie');
      el.querySelector<HTMLButtonElement>('[data-testid="more-toggle"]')!.click();
      await rerender();
      const own = () => el.querySelectorAll<HTMLElement>('.own');
      own()[0].querySelector<HTMLInputElement>('app-checkbox input')!.click();
      await rerender();
      const tags = own()[0].querySelector<HTMLInputElement>('input[type="text"]')!;
      tags.value = '#own';
      tags.dispatchEvent(new Event('input'));
      await rerender();
      expect(pvText()).toBe('ตั๋วหนัง\n\nLINE @shop\n#own');
      own()[1].querySelector<HTMLInputElement>('app-checkbox input')!.click();
      await rerender();
      // Its own empty footer means none for this post.
      expect(pvText()).toBe('ตั๋วหนัง\n#own');
      [...own()[2].querySelectorAll<HTMLButtonElement>('button')]
        .find((b) => b.textContent!.trim() === t().col.posTop)!
        .click();
      own()[1].querySelector<HTMLInputElement>('app-checkbox input')!.click();
      await rerender();
      expect(pvText()).toBe('LINE @shop\nตั๋วหนัง\n#own');
    });

    it('shows chips for the attached media, with a button that takes a file off the post', async () => {
      await open({ before: () => TestBed.inject(LibraryStore).media.set(MEDIA) });
      expect(el.querySelector('app-post-preview .chips')).toBeNull();
      draft().patch({ media: ['m2', 'm1', 'gone'] });
      await rerender();
      const chips = [...el.querySelectorAll('app-post-preview .chip')];
      expect(chips.length).toBe(2);
      expect(chips[0].getAttribute('title')).toBe('b.mp4');
      expect(chips[0].querySelector('i')!.className).toContain('ph-video');
      chips[0].querySelector<HTMLButtonElement>('.del')!.click();
      await rerender();
      expect(draft().draft().media).toEqual(['m1', 'gone']);
    });
  });

  describe('the AI button', () => {
    const ai = () => byId('tool-ai') as HTMLButtonElement;
    const reason = () => el.querySelector('[data-testid="ai-reason"]');

    it('is on, with no note, when the server has a key and the plan includes AI', async () => {
      await open();
      expect(ai().disabled).toBe(false);
      expect(ai().getAttribute('title')).toBe(t().ai.title);
      expect(reason()).toBeNull();
    });

    it('is DISABLED while the server has no AI key, says why (the admin has to set one up) and does not open', async () => {
      await open({ ai: { enabled: false, model: '' } });
      expect(ai().disabled).toBe(true);
      expect(ai().getAttribute('title')).toBe(t().api.flow.edAiNoKey);
      expect(reason()!.textContent).toContain(t().api.flow.edAiNoKey);
      ai().click();
      await rerender();
      expect(el.querySelector('app-ai-panel')).toBeNull();
    });

    it('is DISABLED on a plan without AI, with an upgrade link for the owner only', async () => {
      await open({ ai: { allowed: false } });
      expect(ai().disabled).toBe(true);
      expect(ai().getAttribute('title')).toBe(t().api.flow.edAiNoPlan);
      expect(reason()!.textContent).toContain(t().api.flow.edAiNoPlan);
      expect(reason()!.querySelector('a')!.getAttribute('href')).toBe('/app/billing');
      TestBed.resetTestingModule();
      await open({ ai: { allowed: false }, role: 'editor' });
      expect(reason()!.querySelector('a')).toBeNull();
    });

    it('is a placeholder, disabled, until the status has arrived (nothing is enabled before it)', async () => {
      await open({ aiPending: true });
      expect(ai().disabled).toBe(true);
      expect(ai().classList).toContain('skel');
      expect(reason()!.textContent).toContain(t().api.flow.edAiChecking);
      expect(TestBed.inject(AiStore).loaded()).toBe(false);
      for (const r of http.match(AI_STATUS_URL)) r.flush(AI_STATUS);
      await rerender();
      expect(ai().disabled).toBe(false);
      expect(ai().classList).not.toContain('skel');
      expect(reason()).toBeNull();
    });

    it('is disabled for a viewer and in assist mode, with the permission hint (the page already says why)', async () => {
      await open({ role: 'viewer' });
      expect(ai().disabled).toBe(true);
      expect(ai().getAttribute('title')).toBe(t().api.permEdit);
      expect(reason()).toBeNull();
      TestBed.resetTestingModule();
      await open({ assist: true });
      expect(ai().disabled).toBe(true);
      expect(ai().getAttribute('title')).toBe(t().api.permAssist);
    });

    it('can still open when today’s drafts are used up, and says so', async () => {
      await open({ ai: { draftsLeftToday: 0 } });
      expect(ai().disabled).toBe(false);
      expect(reason()!.textContent).toContain(t().api.flow.edAiNoDrafts);
      await click('tool-ai');
      expect(el.querySelector('app-ai-panel')).not.toBeNull();
      expect((byId('ai-write') as HTMLButtonElement).disabled).toBe(true);
    });

    it('opens and closes the panel, which stays in place above the text', async () => {
      await open();
      await click('tool-ai');
      const panel = el.querySelector('app-ai-panel')!;
      expect(panel).not.toBeNull();
      expect(ai().getAttribute('aria-pressed')).toBe('true');
      const field = textarea().closest('.field')!;
      const order = [...field.children].map((c) => c.tagName.toLowerCase());
      expect(order.indexOf('app-ai-panel')).toBeLessThan(order.indexOf('textarea'));
      await click('tool-ai');
      expect(panel.hasAttribute('hidden')).toBe(true);
      expect(ai().getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('the AI panel', () => {
    const panel = () => el.querySelector('app-ai-panel')!;
    const write = () => byId('ai-write') as HTMLButtonElement;
    const topic = () => panel().querySelector<HTMLInputElement>('app-input-field input')!;
    const typeIn = async (input: HTMLInputElement, value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await rerender();
    };
    const addPoint = async (value: string) => {
      const input = byId('ai-point-input') as HTMLInputElement;
      await typeIn(input, value);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await rerender();
    };
    const points = () =>
      [...panel().querySelectorAll('[data-testid="ai-points"] .point span')].map(
        (s) => s.textContent,
      );
    const cards = () => [...el.querySelectorAll<HTMLElement>('[data-testid="ai-card"]')];
    const answerStatus = async (over: Partial<ApiAiStatus> = {}) => {
      await settle();
      for (const r of http.match(AI_STATUS_URL)) r.flush({ ...AI_STATUS, ...over });
      await rerender();
    };

    beforeEach(async () => {
      await open({ ai: { draftsLeftToday: 5 } });
      await click('tool-ai');
    });

    it('is a friendly form: a topic, selling points, four tones, how many, and a Write button', () => {
      expect(panel().querySelector('h3')!.textContent).toBe(t().ai.title);
      expect(panel().textContent).toContain(t().ai.topic);
      expect(panel().textContent).toContain(t().ai.points);
      const tones = [...panel().querySelectorAll<HTMLElement>('[data-tone]')];
      expect(tones.map((b) => b.dataset['tone'])).toEqual(['friendly', 'formal', 'sales', 'short']);
      expect(tones.map((b) => b.textContent!.trim())).toEqual([
        t().ai.tFriendly,
        t().ai.tFormal,
        t().ai.tSales,
        t().api.flow.edAiToneShort,
      ]);
      expect(tones[0].getAttribute('aria-checked')).toBe('true');
      const counts = [...panel().querySelectorAll<HTMLElement>('[data-count]')];
      expect(counts.map((b) => b.dataset['count'])).toEqual(['1', '2', '3']);
      expect(counts[1].getAttribute('aria-checked')).toBe('true');
      expect(write().disabled).toBe(false);
      expect(write().textContent).toContain(t().ai.generate);
      expect(byId('ai-left').textContent).toBe(fmt(t().api.flow.edAiLeft, { n: 5 }));
      expect(topic().getAttribute('maxlength')).toBe(String(INPUT_LIMITS.aiTopic));
    });

    it('asks for a topic and sends nothing without one', async () => {
      write().click();
      await rerender();
      expect(panel().querySelector('.su-field-err')!.textContent).toBe(t().ai.errTopic);
      http.expectNone((r) => r.method === 'POST');
    });

    it('adds a selling point with Enter (not a comma), drops blanks and repeats, takes one off, ten at most', async () => {
      await addPoint('ส่งฟรี');
      await addPoint('  ');
      await addPoint('ส่งฟรี');
      await addPoint('รับประกัน 1 ปี');
      expect(points()).toEqual(['ส่งฟรี', 'รับประกัน 1 ปี']);
      expect((byId('ai-point-input') as HTMLInputElement).value).toBe('');
      panel().querySelectorAll<HTMLButtonElement>('[data-testid="ai-points"] .ibtn')[0].click();
      await rerender();
      expect(points()).toEqual(['รับประกัน 1 ปี']);
      for (let i = 0; i < 12; i++) await addPoint('point ' + i);
      expect(points().length).toBe(INPUT_LIMITS.aiPoints);
      expect((byId('ai-point-input') as HTMLInputElement).disabled).toBe(true);
      expect((byId('ai-point-input') as HTMLInputElement).placeholder).toBe(
        fmt(t().api.flow.edAiPointsMax, { n: INPUT_LIMITS.aiPoints }),
      );
    });

    it('writes: sends the topic, points, tone and count, shows skeleton cards, then the drafts', async () => {
      await typeIn(topic(), '  ชั้นวางไม้สัก  ');
      await addPoint('ส่งฟรี');
      panel().querySelector<HTMLButtonElement>('[data-tone="sales"]')!.click();
      panel().querySelector<HTMLButtonElement>('[data-count="3"]')!.click();
      await rerender();
      write().click();
      await rerender();
      const req = http.expectOne({ method: 'POST', url: AI_POSTS_URL });
      expect(req.request.body).toEqual({
        topic: 'ชั้นวางไม้สัก',
        points: ['ส่งฟรี'],
        tone: 'sales',
        count: 3,
      });
      // While it writes: three placeholder cards, and the button cannot be pressed again.
      expect(el.querySelectorAll('[data-testid="ai-skeleton"]').length).toBe(3);
      expect(write().disabled).toBe(true);
      req.flush({ variants: ['ร่างหนึ่ง', 'ร่างสอง', 'ร่างสาม'] });
      await rerender();
      expect(el.querySelectorAll('[data-testid="ai-skeleton"]').length).toBe(0);
      expect(cards().map((c) => c.querySelector('.draft')!.textContent)).toEqual([
        'ร่างหนึ่ง',
        'ร่างสอง',
        'ร่างสาม',
      ]);
      expect(cards()[0].textContent).toContain(fmt(t().api.flow.edAiDraftN, { n: 1 }));
      // The allowance is read again afterwards.
      await answerStatus({ draftsLeftToday: 2 });
      expect(byId('ai-left').textContent).toBe(fmt(t().api.flow.edAiLeft, { n: 2 }));
      expect(panel().textContent).toContain(t().api.flow.edAiCheck);
    });

    it('counts a selling point that was typed but not confirmed with Enter', async () => {
      await typeIn(topic(), 'topic');
      await typeIn(byId('ai-point-input') as HTMLInputElement, 'ลดราคา');
      write().click();
      await rerender();
      const req = http.expectOne({ method: 'POST', url: AI_POSTS_URL });
      expect(req.request.body.points).toEqual(['ลดราคา']);
      req.flush({ variants: ['x'] });
      await answerStatus();
    });

    describe('with drafts on the screen', () => {
      beforeEach(async () => {
        await typeIn(topic(), 'ชั้นวาง');
        write().click();
        await rerender();
        http
          .expectOne({ method: 'POST', url: AI_POSTS_URL })
          .flush({ variants: ['ร่างหนึ่ง', 'ร่างสอง'] });
        await answerStatus({ draftsLeftToday: 3 });
      });

      it('"Use this" replaces the text of the editor (so the preview shows it) and saves nothing', async () => {
        await type('ข้อความเดิม');
        byId('ai-use').click();
        await rerender();
        expect(textarea().value).toBe('ร่างหนึ่ง');
        expect(draft().draft().text).toBe('ร่างหนึ่ง');
        expect(pvText()).toContain('ร่างหนึ่ง');
        expect(toasts().map((x) => x.message)).toEqual([t().api.flow.edAiUsed]);
        http.expectNone((r) => r.method !== 'GET');
      });

      it('"Append" adds the draft after the text, with a blank line between', async () => {
        await type('ข้อความเดิม  \n');
        cards()[1].querySelector<HTMLButtonElement>('[data-testid="ai-append"]')!.click();
        await rerender();
        expect(textarea().value).toBe('ข้อความเดิม\n\nร่างสอง');
        http.expectNone((r) => r.method !== 'GET');
      });

      it('"Append" to an empty text is just the draft', async () => {
        byId('ai-append').click();
        await rerender();
        expect(textarea().value).toBe('ร่างหนึ่ง');
      });

      it('"Append" refuses when it would be over 5000 characters', async () => {
        await type('ก'.repeat(INPUT_LIMITS.postText - 3));
        byId('ai-append').click();
        await rerender();
        expect(textarea().value.length).toBe(INPUT_LIMITS.postText - 3);
        expect(toasts().map((x) => x.message)).toEqual([
          fmt(t().api.flow.edTooLongInsert, { n: INPUT_LIMITS.postText }),
        ]);
      });

      it('"Add as a separate post" saves the draft as another post, SWITCHED OFF, in the same collections, and leaves the editor alone', async () => {
        await type('โพสต์ที่กำลังเขียน');
        [...el.querySelectorAll<HTMLButtonElement>('.chips .pick')]
          .find((b) => b.textContent!.trim() === 'Condo')!
          .click();
        await rerender();
        cards()[1].querySelector<HTMLButtonElement>('[data-testid="ai-separate"]')!.click();
        await rerender();
        const req = http.expectOne({ method: 'POST', url: MASTER });
        expect(req.request.body).toEqual({
          text: 'ร่างสอง',
          mediaIds: [],
          collectionIds: ['a'],
          settings: apiPostSettings(),
          active: false,
        });
        // While it is being saved its button waits.
        expect(
          cards()[1].querySelector<HTMLButtonElement>('[data-testid="ai-separate"]')!.disabled,
        ).toBe(true);
        req.flush(
          apiCollectionPost({ id: 'n1', text: 'ร่างสอง', active: false, collectionIds: ['a'] }),
        );
        await rerender();
        for (const r of http.match(COLS)) r.flush(DATA);
        for (const r of http.match(MASTER)) r.flush([]);
        await rerender();
        expect(toasts().map((x) => x.message)).toEqual([t().api.flow.edAiAdded]);
        expect(textarea().value).toBe('โพสต์ที่กำลังเขียน');
        expect(
          cards()[1].querySelector<HTMLButtonElement>('[data-testid="ai-separate"]')!.disabled,
        ).toBe(false);
      });

      it('"Add as a separate post" says why when the API refuses, and keeps the draft', async () => {
        byId('ai-separate').click();
        await rerender();
        http
          .expectOne({ method: 'POST', url: MASTER })
          .flush({ title: 'ถึงจำนวนโพสต์สูงสุดแล้ว' }, { status: 403, statusText: 'Forbidden' });
        await rerender();
        expect(toasts().map((x) => x.message)).toEqual(['ถึงจำนวนโพสต์สูงสุดแล้ว']);
        expect(cards().length).toBe(2);
      });

      it('"Regenerate" asks again with the same request and replaces the drafts', async () => {
        byId('ai-regenerate').click();
        await rerender();
        const req = http.expectOne({ method: 'POST', url: AI_POSTS_URL });
        expect(req.request.body).toMatchObject({ topic: 'ชั้นวาง', count: 2, tone: 'friendly' });
        req.flush({ variants: ['ใหม่หนึ่ง', 'ใหม่สอง'] });
        await answerStatus({ draftsLeftToday: 1 });
        expect(cards().map((c) => c.querySelector('.draft')!.textContent)).toEqual([
          'ใหม่หนึ่ง',
          'ใหม่สอง',
        ]);
      });

      it('stays hidden, not thrown away, when the panel is closed, and is still there when it opens again', async () => {
        await click('tool-ai');
        expect(panel().hasAttribute('hidden')).toBe(true);
        await click('tool-ai');
        expect(panel().hasAttribute('hidden')).toBe(false);
        expect(cards().length).toBe(2);
      });

      it('closes with its own X', async () => {
        panel().querySelector<HTMLButtonElement>('.ai-head .ibtn')!.click();
        await rerender();
        expect(panel().hasAttribute('hidden')).toBe(true);
      });
    });

    it('shows the reason inline when the AI could not write, and "n drafts left today"', async () => {
      await typeIn(topic(), 'ชั้นวาง');
      write().click();
      await rerender();
      http
        .expectOne({ method: 'POST', url: AI_POSTS_URL })
        .flush(
          { title: 'วันนี้ใช้ AI ร่างโพสต์ครบ 20 ชิ้นแล้ว ลองใหม่พรุ่งนี้' },
          { status: 422, statusText: 'Unprocessable' },
        );
      await answerStatus({ draftsLeftToday: 0 });
      expect(byId('ai-error').textContent).toBe(
        'วันนี้ใช้ AI ร่างโพสต์ครบ 20 ชิ้นแล้ว ลองใหม่พรุ่งนี้',
      );
      expect(el.querySelectorAll('[data-testid="ai-skeleton"]').length).toBe(0);
      // Nothing is left to write with today: the button is off, with the reason beside it.
      expect(write().disabled).toBe(true);
      expect(byId('ai-left').textContent).toBe(fmt(t().api.flow.edAiLeft, { n: 0 }));
      expect(panel().querySelector('[data-testid="ai-reason"]')!.textContent).toContain(
        t().api.flow.edAiNoDrafts,
      );
    });

    it('falls back to a general message when the API gives no reason', async () => {
      await typeIn(topic(), 'ชั้นวาง');
      write().click();
      await rerender();
      http.expectOne({ method: 'POST', url: AI_POSTS_URL }).error(new ProgressEvent('error'));
      await answerStatus();
      expect(byId('ai-error').textContent).toBe(t().api.flow.edAiFailed);
    });

    it('turns its Write button off, with the reason beside it, when the server loses its key while it is open', async () => {
      TestBed.inject(AiStore).status.update((s) => ({ ...s!, enabled: false }));
      await rerender();
      expect(write().disabled).toBe(true);
      expect(write().getAttribute('title')).toBe(t().api.flow.edAiNoKey);
      expect(panel().querySelector('[data-testid="ai-reason"]')!.textContent).toContain(
        t().api.flow.edAiNoKey,
      );
      write().click();
      await rerender();
      http.expectNone((r) => r.method === 'POST');
    });
  });

  describe('media', () => {
    const attached = () => [...el.querySelectorAll<HTMLElement>('[data-testid="attached"] .m')];
    const pickers = () => [...el.querySelectorAll<HTMLButtonElement>('.media.picker .m')];
    const openPicker = async () => {
      await click('media-pick');
    };

    beforeEach(() => open({ before: () => TestBed.inject(LibraryStore).media.set(MEDIA) }));

    it('shows nothing attached at first, then the library to pick from, with thumbnails and an icon for videos', async () => {
      expect(el.textContent).toContain(t().api.flow.plMediaNone);
      await openPicker();
      expect(pickers().length).toBe(3);
      expect(pickers()[1].querySelector('.thumb i')!.className).toContain('ph-video');
      expect(pickers()[0].title).toBe('a.png');
    });

    it('attaches and detaches a file with a click, and counts them', async () => {
      await openPicker();
      pickers()[1].click();
      await rerender();
      expect(draft().draft().media).toEqual(['m2']);
      expect(pickers()[1].getAttribute('aria-pressed')).toBe('true');
      expect(pickers()[1].querySelector('.tick')).not.toBeNull();
      expect(el.textContent).toContain(t().cmp.mediaSel.replace('{n}', '1'));
      expect(attached().length).toBe(1);
      pickers()[1].click();
      await rerender();
      expect(draft().draft().media).toEqual([]);
    });

    it('cannot attach a file that is switched off in the library, and says so', async () => {
      await openPicker();
      expect(pickers()[2].disabled).toBe(true);
      expect(pickers()[2].title).toBe(t().api.flow.edMediaOff);
    });

    it('refuses a 21st file with the library limit message', async () => {
      draft().patch({ media: Array.from({ length: INPUT_LIMITS.postMedia }, (_, i) => 'x' + i) });
      await openPicker();
      pickers()[0].click();
      await rerender();
      expect(draft().draft().media.length).toBe(INPUT_LIMITS.postMedia);
      expect(el.querySelector('.su-field-err')!.textContent).toBe(
        t().api.mediaMax.replace('{n}', String(INPUT_LIMITS.postMedia)),
      );
    });

    it('links to the library, with the hint, and has an upload button', () => {
      const link = [...el.querySelectorAll<HTMLAnchorElement>('.block a')].find(
        (a) => a.getAttribute('href') === '/app/library',
      )!;
      expect(link.textContent).toContain(t().cmp.openLibrary);
      expect(el.textContent).toContain(t().cmp.mediaHint);
      expect(byId('media-upload').textContent).toContain(t().cmp.upload);
    });

    it('uploads to the library and attaches what the server took', async () => {
      const input = el.querySelector<HTMLInputElement>('input[type=file]')!;
      const file = new File(['x'], 'new.mp4', { type: 'video/mp4' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));
      await settle();
      const req = http.expectOne({ method: 'POST', url: `${BASE}/media` });
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
        .expectOne({ method: 'POST', url: `${BASE}/media` })
        .flush({}, { status: 415, statusText: 'Unsupported' });
      await rerender();
      expect(draft().draft().media).toEqual([]);
      expect(toasts().map((x) => x.message)).toContain(t().api.uploadFailed);
    });

    it('points to the library when it is empty', async () => {
      TestBed.inject(LibraryStore).media.set([]);
      await openPicker();
      expect(el.querySelector('.media.picker')!.textContent).toContain(t().api.noMedia);
    });
  });

  describe('collections', () => {
    const chips = () =>
      [...el.querySelectorAll<HTMLButtonElement>('.chips .pick')].filter(
        (b) => !b.classList.contains('day'),
      );

    it('offers the workspace collections as chips, with the limit in the hint', async () => {
      await open();
      expect(chips().map((c) => c.textContent!.trim())).toEqual(['Condo', 'Tickets', 'Empty']);
      expect(el.textContent).toContain(
        fmt(t().api.flow.plColHint, { n: INPUT_LIMITS.postCollections }),
      );
    });

    it('says there are no collections yet, and still offers to make one', async () => {
      await open({ data: [] });
      expect(el.textContent).toContain(t().api.flow.plColNone);
      expect(byId('new-collection').textContent).toContain(t().api.flow.edColNew);
    });

    it('makes a collection from the editor and puts the post in it', async () => {
      await open();
      await click('new-collection');
      const modal = el.querySelector('app-new-collection-modal .su-modal-panel')!;
      const name = modal.querySelector<HTMLInputElement>('input')!;
      name.value = 'Shoes';
      name.dispatchEvent(new Event('input'));
      modal.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
      await settle();
      http
        .expectOne({ method: 'POST', url: COLS })
        .flush(apiCollection({ id: 'n', name: 'Shoes' }));
      await rerender();
      expect(el.querySelector('app-new-collection-modal .su-modal-panel')).toBeNull();
      expect(draft().draft().collectionIds).toEqual(['n']);
      expect(
        chips()
          .find((c) => c.textContent!.trim() === 'Shoes')!
          .getAttribute('aria-pressed'),
      ).toBe('true');
    });

    it('takes at most 50 collections', async () => {
      const many = Array.from({ length: 52 }, (_, i) =>
        apiCollection({ id: 'x' + i, name: 'C' + i }),
      );
      await open({ data: many });
      for (const c of chips()) c.click();
      await rerender();
      expect(draft().draft().collectionIds.length).toBe(INPUT_LIMITS.postCollections);
      expect(el.querySelector('.su-field-err')!.textContent).toBe(
        fmt(t().api.flow.plColMax, { n: INPUT_LIMITS.postCollections }),
      );
    });

    it('says an approved post goes back to draft when it sits in a collection that needs approval', async () => {
      await open({ post: b1 });
      expect(el.textContent).toContain(t().api.flow.plApprovalResets);
      TestBed.resetTestingModule();
      await open({ post: a1 });
      expect(el.textContent).not.toContain(t().api.flow.plApprovalResets);
    });
  });

  describe('more options', () => {
    it('are folded away in simple mode, open for a post that has its own settings, and open when simple mode is off', async () => {
      await open({ post: a1 });
      expect(el.querySelector('.own')).toBeNull();
      expect(byId('more-toggle').getAttribute('aria-expanded')).toBe('false');
      await click('more-toggle');
      expect(el.querySelectorAll('.own').length).toBe(3);
      TestBed.resetTestingModule();
      await open({ post: { ...a1, settings: apiPostSettings({ weekdays: [1] }) } });
      expect(el.querySelectorAll('.own').length).toBe(3);
      TestBed.resetTestingModule();
      await open({ before: () => TestBed.inject(UiPrefsService).set(false) });
      expect(el.querySelectorAll('.own').length).toBe(3);
    });
  });

  describe('saving', () => {
    it('"save" saves a new post, resets the draft and says it is done (the panel closes)', async () => {
      await open();
      const saved: ApiCollectionPost[] = [];
      fixture.componentInstance.saved.subscribe((p) => saved.push(p));
      await type('  ตั๋วหนังราคาพิเศษ  ');
      draft().patch({ media: ['m1'], collectionIds: ['b'] });
      byId('save').click();
      await rerender();
      const req = http.expectOne({ method: 'POST', url: MASTER });
      expect(req.request.body).toEqual({
        text: 'ตั๋วหนังราคาพิเศษ',
        mediaIds: ['m1'],
        collectionIds: ['b'],
        settings: apiPostSettings(),
        active: true,
      });
      const created = apiCollectionPost({ id: 'n1', text: 'ตั๋วหนังราคาพิเศษ' });
      req.flush(created);
      await rerender();
      expect(saved).toEqual([created]);
      expect(draft().draft()).toEqual({ text: '', media: [], collectionIds: [] });
      expect(toasts().map((x) => x.message)).toEqual([t().api.flow.plCreated]);
    });

    it('"save and add another" keeps the collections, empties the rest and tells the page to stay', async () => {
      await open();
      const another: ApiCollectionPost[] = [];
      const saved: ApiCollectionPost[] = [];
      fixture.componentInstance.savedAnother.subscribe((p) => another.push(p));
      fixture.componentInstance.saved.subscribe((p) => saved.push(p));
      await type('หนึ่ง');
      draft().patch({ media: ['m1'], collectionIds: ['a', 'b'] });
      byId('save-another').click();
      await rerender();
      const req = http.expectOne({ method: 'POST', url: MASTER });
      req.flush(apiCollectionPost({ id: 'n1' }));
      await rerender();
      expect(another.length).toBe(1);
      expect(saved).toEqual([]);
      expect(draft().draft()).toEqual({ text: '', media: [], collectionIds: ['a', 'b'] });
      expect(toasts().map((x) => x.message)).toEqual([t().api.flow.edSavedAnother]);
    });

    it('Ctrl+Enter saves', async () => {
      await open();
      await type('quick');
      textarea().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }),
      );
      await rerender();
      http.expectOne({ method: 'POST', url: MASTER }).flush(apiCollectionPost({ id: 'n1' }));
      await rerender();
    });

    it('leaves out a collection that was deleted since the draft was started', async () => {
      await open({ before: () => draft().patch({ collectionIds: ['gone', 'a'], text: 'x' }) });
      byId('save').click();
      await rerender();
      const req = http.expectOne({ method: 'POST', url: MASTER });
      expect(req.request.body.collectionIds).toEqual(['a']);
      req.flush(apiCollectionPost({ id: 'n1' }));
      await rerender();
    });

    it('asks for text and sends nothing without it, also when only blanks are typed', async () => {
      await open();
      byId('save').click();
      await rerender();
      expect(el.querySelector('.counter .err')!.textContent).toBe(t().cmp.errText);
      expect(textarea().classList).toContain('su-input-error');
      await type('   \n  ');
      byId('save').click();
      await rerender();
      expect(el.querySelector('.counter .err')!.textContent).toBe(t().cmp.errText);
      http.expectNone((r) => r.method !== 'GET');
      await type('x');
      expect(el.querySelector('.counter .err')!.textContent).toBe('');
    });

    it('keeps everything when the API refuses, and lets the person try again', async () => {
      await open();
      await type('hello');
      byId('save').click();
      await rerender();
      http
        .expectOne({ method: 'POST', url: MASTER })
        .flush({ title: 'ซ้ำ' }, { status: 422, statusText: 'Unprocessable' });
      await rerender();
      expect(textarea().value).toBe('hello');
      expect(el.querySelector('.su-field-err')!.textContent).toContain('ซ้ำ');
      expect((byId('save') as HTMLButtonElement).disabled).toBe(false);
      byId('save').click();
      await rerender();
      http.expectOne({ method: 'POST', url: MASTER }).flush(apiCollectionPost({ id: 'n' }));
      await rerender();
    });

    it('sends one request when the button is pressed twice', async () => {
      await open();
      await type('hello');
      byId('save').click();
      byId('save').click();
      await rerender();
      http.expectOne({ method: 'POST', url: MASTER }).flush(apiCollectionPost({ id: 'n' }));
      await rerender();
    });

    it('"cancel" throws away the draft of a new post, but not an existing post (nothing of it is in the draft)', async () => {
      await open();
      const cancelled: unknown[] = [];
      fixture.componentInstance.cancelled.subscribe(() => cancelled.push(1));
      await type('hello');
      btn(t().common.cancel, el).click();
      expect(draft().draft().text).toBe('');
      expect(cancelled.length).toBe(1);
      TestBed.resetTestingModule();
      await open({ post: a1, before: () => draft().patch({ text: 'other draft' }) });
      btn(t().common.cancel, el).click();
      expect(draft().draft().text).toBe('other draft');
    });
  });

  describe('roles', () => {
    const disabled = (b: HTMLElement) => (b as HTMLButtonElement).disabled;

    it.each([
      ['viewer', true],
      ['editor', false],
    ] as const)(
      '%s: text, toolbar, media, collections and save are off = %s',
      async (role, off) => {
        await open({ role });
        expect(textarea().readOnly).toBe(off);
        for (const id of [
          'tool-code',
          'tool-spin',
          'tool-snippet',
          'media-upload',
          'media-pick',
          'new-collection',
          'save',
          'save-another',
        ])
          expect(disabled(byId(id)), id).toBe(off);
        for (const c of el.querySelectorAll<HTMLButtonElement>('.chips .pick'))
          expect(c.disabled).toBe(off);
        // Cancel only leaves.
        expect(disabled(btn(t().common.cancel))).toBe(false);
        // The off buttons say why.
        if (off) expect(byId('save').getAttribute('title')).toBe(t().api.permEdit);
      },
    );

    it('is read-only in assist mode', async () => {
      await open({ assist: true });
      expect(textarea().readOnly).toBe(true);
      expect(disabled(byId('save'))).toBe(true);
      expect(byId('save').getAttribute('title')).toBe(t().api.permAssist);
    });

    it('sends nothing, and writes nothing into the text, when a viewer gets past the disabled buttons', async () => {
      await open({ role: 'viewer' });
      draft().patch({ text: 'x' });
      await rerender();
      fixture.componentInstance['save']();
      await rerender();
      http.expectNone((r) => r.method !== 'GET');
    });

    it('lets a viewer open a post to read it, and see its preview', async () => {
      await open({ role: 'viewer', post: a1, sets: [] });
      expect(textarea().value).toBe('ขายคอนโด');
      expect(pvText()).toContain('ขายคอนโด');
    });
  });

  it('keeps the textarea label tied to the field', async () => {
    await open();
    const label = el.querySelector<HTMLLabelElement>('label.su-field-label')!;
    expect(label.getAttribute('for')).toBe(textarea().id);
    expect(label.textContent).toBe(t().api.flow.plText);
  });
});

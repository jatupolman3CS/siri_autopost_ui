import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountsStore } from '../../core/data/accounts.store';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { DevicesStore } from '../../core/data/devices.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiLinkSet } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import '../../core/i18n/i18n.line';
import { WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import {
  LINE_CONNECTED,
  apiChatLink,
  apiLineChat,
  apiLineChatPage,
  apiLineDevice,
  apiLineSet,
} from '../../testing/line.fixtures';
import { FB_CONNECTED, apiLink, apiLinkSet } from '../../testing/link-sets.fixtures';
import { TargetsPageComponent } from './targets-page.component';

const FB_SET = apiLinkSet({ id: 'fs', name: 'Condo groups', links: [apiLink({ id: 'g' })] });
const LINE_SET = apiLineSet({
  id: 'ls',
  name: 'ลูกค้าประจำ',
  links: [apiChatLink({ id: 'a', name: 'สมชาย' })],
});

// The link-set page with chat sets among the Facebook ones: a filter by kind, the note about the manual chat, the
// ownership overview with a row for the LINE account, and the import dialog of a chat set.
describe('TargetsPageComponent: LINE chat sets', () => {
  let http: HttpTestingController;

  async function open(sets: ApiLinkSet[], workspace: { lineChat?: boolean } = {}) {
    http = provideApiTesting({
      imports: [TargetsPageComponent],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: DeviceEventsService, useClass: FakeDeviceEvents },
      ],
    });
    TestBed.inject(WorkspaceStore);
    TestBed.inject(AccountsStore);
    TestBed.inject(DevicesStore);
    TestBed.inject(LinkSetsStore);
    await signIn(http, { workspace, linkSets: sets, devices: [apiLineDevice()] });
    TestBed.inject(AccountsStore).list.set([FB_CONNECTED, LINE_CONNECTED]);
    const fixture = TestBed.createComponent(TargetsPageComponent);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const t = () => TestBed.inject(I18nService).t();
  const cards = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('app-link-set-card')];
  const names = (el: HTMLElement) =>
    cards(el).map((c) => c.querySelector('.title .fw6')?.textContent?.trim());
  const seg = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('.seg button')];

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    try {
      http?.verify();
    } finally {
      http = undefined!;
      TestBed.resetTestingModule();
      localStorage.clear();
    }
  });

  it('is the page it always was while there is no chat set: no filter by kind, no note', async () => {
    const { el } = await open([FB_SET]);
    expect(seg(el)).toHaveLength(0);
    expect(el.querySelector('.callout.chat-note, [role=note]')).toBeNull();
    expect(names(el)).toEqual(['Condo groups']);
  });

  it('lists a chat set beside the Facebook ones, each card in its own wording', async () => {
    const { el } = await open([FB_SET, LINE_SET]);
    expect(names(el).sort()).toEqual(['Condo groups', 'ลูกค้าประจำ'].sort());
    const [fb] = cards(el).filter((c) => !c.querySelector('.badge'));
    expect(fb.querySelector('[data-testid="import-chats"]')).toBeNull();
    const line = cards(el).find((c) => c.querySelector('.badge'))!;
    expect(line.querySelector('[data-testid="import-chats"]')).not.toBeNull();
  });

  it('tells in the header that sending presses "manual chat" in the customer’s chat, once there is a chat set', async () => {
    const { el } = await open([FB_SET, LINE_SET]);
    expect(el.querySelector('[role=note]')?.textContent).toContain(t().api.line.chatManualNote);
  });

  it('filters by kind: all, Facebook groups, LINE chats', async () => {
    const { fixture, el } = await open([FB_SET, LINE_SET]);
    expect(seg(el).map((b) => b.textContent?.trim())).toEqual([
      t().api.line.chatFilterAll,
      t().api.line.chatChannelFb,
      t().api.line.chatChannelLine,
    ]);
    expect(seg(el)[0].getAttribute('aria-pressed')).toBe('true');
    seg(el)[2].click();
    fixture.detectChanges();
    expect(names(el)).toEqual(['ลูกค้าประจำ']);
    expect(seg(el)[2].getAttribute('aria-pressed')).toBe('true');
    seg(el)[1].click();
    fixture.detectChanges();
    expect(names(el)).toEqual(['Condo groups']);
    seg(el)[0].click();
    fixture.detectChanges();
    expect(names(el)).toHaveLength(2);
  });

  it('gives the LINE account its own row in the overview, with chats counted, apart from the Facebook extension', async () => {
    const { el } = await open([FB_SET, LINE_SET]);
    const rows = [...el.querySelectorAll('app-ownership-overview li')].map((li) =>
      li.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Shop PC');
    expect(rows[0]).toContain(fmt(t().api.flow.ownSetsGroups, { s: 1, g: 1 }));
    expect(rows[1]).toContain(fmt(t().api.line.chatOwnLineOf, { name: 'Shop PC' }));
    expect(rows[1]).toContain(fmt(t().api.line.chatOwnSetsChats, { s: 1, c: 1 }));
    expect(el.querySelector('app-ownership-overview .ph-chat-circle-text')).not.toBeNull();
  });

  it('heads the chat sets with the browser’s name and "LINE", apart from the Facebook sets of the same browser', async () => {
    const { el } = await open([FB_SET, LINE_SET]);
    const headings = [...el.querySelectorAll('.ext-heading')].map((h) => h.textContent?.trim());
    expect(headings).toEqual(['Shop PC', fmt(t().api.line.chatOwnLineOf, { name: 'Shop PC' })]);
  });

  it('says who sends a chat set: the browser, not the Facebook account', async () => {
    const { el } = await open([LINE_SET]);
    const owner = el.querySelector('app-set-owner .owner')!;
    expect(owner.textContent).toContain(fmt(t().api.flow.ownerLine, { name: 'Shop PC' }));
    expect(owner.classList.contains('none')).toBe(false);
  });

  describe('importing chats', () => {
    it('opens the dialog of the chat set that was pressed, with its customers', async () => {
      const { fixture, el } = await open([FB_SET, LINE_SET]);
      const line = cards(el).find((c) => c.querySelector('.badge'))!;
      line.querySelector<HTMLButtonElement>('[data-testid="import-chats"]')!.click();
      fixture.detectChanges();
      await settle();
      const read = http.expectOne(
        (x) => x.method === 'GET' && x.url === `/api/workspaces/${WS}/line/chats`,
      );
      expect(read.request.params.get('accountId')).toBe(LINE_CONNECTED.id);
      read.flush(apiLineChatPage([apiLineChat({ id: 'z', name: 'ปิติ' })]));
      await settle();
      fixture.detectChanges();
      expect(document.querySelector('app-import-line-chats-modal')).not.toBeNull();
      expect(document.querySelector('app-import-line-chats-modal')!.textContent).toContain('ปิติ');
    });

    it('does not read a single chat until the dialog is opened', async () => {
      await open([FB_SET, LINE_SET]);
      http.expectNone((x) => x.url.endsWith('/line/chats'));
      expect(document.querySelector('app-import-line-chats-modal')).toBeNull();
    });
  });
});

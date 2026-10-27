import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountsStore } from '../../core/data/accounts.store';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { DevicesStore } from '../../core/data/devices.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiAccount, ApiLinkSet, ApiWorkspace } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.line';
import { NotificationService } from '../../core/services/notification.service';
import { provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { FB_CONNECTED } from '../../testing/link-sets.fixtures';
import {
  LINE_CONNECTED,
  apiChatLink,
  apiLineChat,
  apiLineChatPage,
  apiLineDevice,
  apiLineSet,
  lineChatUrl,
} from '../../testing/line.fixtures';
import { ImportLineChatsModalComponent } from './import-line-chats-modal.component';

const CHATS = '/api/workspaces/ws-1/line/chats';
const IMPORT = '/api/workspaces/ws-1/link-sets/ls/links/from-line-chats';

const a = apiLineChat({ id: 'a', name: 'สมชาย', labels: ['VIP'] });
const b = apiLineChat({ id: 'b', name: 'มานี' });
const c = apiLineChat({ id: 'c', name: 'ปิติ', doNotSend: true });
const d = apiLineChat({ id: 'd', name: 'วีระ' });

const done = (added: number, extra: Record<string, unknown> = {}) => ({
  set: apiLineSet({ id: 'ls', links: [apiChatLink({ id: 'a' })] }),
  added,
  duplicates: 0,
  recoded: 0,
  invalid: 0,
  conflicts: 0,
  skippedDoNotSend: 0,
  ...extra,
});

// "Import from LINE chats": the customers of the Official Account of the set's browser, picked by name, label and how
// recently they chatted, and put into the set in one request.
describe('ImportLineChatsModalComponent', () => {
  let http: HttpTestingController;
  let closed = 0;

  async function open(
    opts: {
      set?: Partial<ApiLinkSet>;
      workspace?: Partial<ApiWorkspace>;
      accounts?: ApiAccount[];
      chats?: ReturnType<typeof apiLineChatPage>;
      /** Do not answer the roster read (a locked workspace never asks). */
      noRead?: boolean;
    } = {},
  ) {
    http = provideApiTesting({
      imports: [ImportLineChatsModalComponent],
      providers: [provideRouter([]), { provide: DeviceEventsService, useClass: FakeDeviceEvents }],
    });
    TestBed.inject(WorkspaceStore);
    TestBed.inject(AccountsStore);
    TestBed.inject(DevicesStore);
    TestBed.inject(LinkSetsStore);
    const set = apiLineSet({
      id: 'ls',
      links: [apiChatLink({ id: 'd', name: 'วีระ' })],
      ...opts.set,
    });
    await signIn(http, {
      workspace: opts.workspace,
      linkSets: [set],
      devices: [apiLineDevice()],
    });
    TestBed.inject(AccountsStore).list.set(opts.accounts ?? [FB_CONNECTED, LINE_CONNECTED]);
    const fixture = TestBed.createComponent(ImportLineChatsModalComponent);
    fixture.componentRef.setInput('setId', 'ls');
    closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    fixture.detectChanges();
    await settle();
    let read;
    if (!opts.noRead) {
      read = http.expectOne((x) => x.method === 'GET' && x.url === CHATS);
      read.flush(opts.chats ?? apiLineChatPage([a, b, c, d], { labels: ['VIP', 'ใหม่'] }));
      await settle();
    }
    fixture.detectChanges();
    return { fixture, el: document.body as HTMLElement, read };
  }

  const t = () => TestBed.inject(I18nService).t();
  const toasts = () =>
    TestBed.inject(NotificationService)
      .toasts()
      .map((x) => x.message);
  const items = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('app-modal .list .item')];
  const boxOf = (item: HTMLElement) =>
    item.querySelector<HTMLInputElement>('input[type=checkbox]')!;
  const addButton = (el: HTMLElement) =>
    [...el.querySelectorAll<HTMLButtonElement>('app-modal button.su-btn-primary')].at(-1)!;
  const tick = (item: HTMLElement) => {
    const box = boxOf(item);
    box.checked = true;
    box.dispatchEvent(new Event('change'));
  };

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

  it('reads the chats of the Official Account that sends the set, 50 a page', async () => {
    const { read } = await open();
    expect(read!.request.params.get('accountId')).toBe(LINE_CONNECTED.id);
    expect(read!.request.params.get('pageSize')).toBe('50');
    expect(read!.request.params.get('page')).toBe('1');
  });

  it('lists the customers; one already in the set, and one marked do-not-send, cannot be picked and say so', async () => {
    const { el } = await open();
    const rows = items(el);
    expect(rows.map((r) => r.querySelector('.text')?.textContent)).toEqual([
      'สมชาย',
      'มานี',
      'ปิติ',
      'วีระ',
    ]);
    expect(rows.map((r) => boxOf(r).disabled)).toEqual([false, false, true, true]);
    expect(rows[2].textContent).toContain(t().api.line.chatDoNotSend);
    expect(rows[3].textContent).toContain(t().api.line.chatImportInSet);
    expect(rows[0].textContent).toContain('VIP');
  });

  it('adds the ticked customers in one request, says what happened and closes', async () => {
    const { fixture, el } = await open();
    expect(addButton(el).disabled).toBe(true);
    tick(items(el)[0]);
    tick(items(el)[1]);
    fixture.detectChanges();
    expect(addButton(el).textContent?.trim()).toBe(fmt(t().api.line.chatImportGo, { n: 2 }));
    addButton(el).click();
    await settle();
    const req = http.expectOne((x) => x.method === 'POST' && x.url === IMPORT);
    expect(req.request.body).toEqual({
      accountId: LINE_CONNECTED.id,
      allMatching: false,
      chatIds: ['a', 'b'],
    });
    req.flush(done(2, { skippedDoNotSend: 1, duplicates: 1 }));
    await settle();
    expect(toasts()).toContain(fmt(t().api.line.chatImportDone, { n: 2, d: 1, s: 1 }));
    expect(closed).toBe(1);
    expect(TestBed.inject(LinkSetsStore).byId('ls')?.links).toHaveLength(1);
  });

  it('warns when the server left out chats another machine already has', async () => {
    const { fixture, el } = await open();
    tick(items(el)[0]);
    fixture.detectChanges();
    addButton(el).click();
    await settle();
    http
      .expectOne((x) => x.url === IMPORT)
      .flush(done(0, { conflicts: 1, conflictNote: 'สมชาย อยู่ในชุดของเครื่อง Laptop' }));
    await settle();
    expect(toasts()).toContain(
      fmt(t().api.line.chatImportConflicts, { n: 1, note: 'สมชาย อยู่ในชุดของเครื่อง Laptop' }),
    );
  });

  it('imports everything that matches the filters when asked, with the filters in the request', async () => {
    const { fixture, el } = await open({
      chats: apiLineChatPage([a, b, c, d], { total: 130, labels: ['VIP', 'ใหม่'] }),
    });
    // The filters first: label and recency (the search is typed and debounced; here the label and the days).
    const selects = [...el.querySelectorAll<HTMLSelectElement>('app-modal select')];
    selects[0].value = 'VIP';
    selects[0].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await settle();
    http
      .expectOne((x) => x.method === 'GET' && x.url === CHATS)
      .flush(apiLineChatPage([a], { total: 87, labels: ['VIP', 'ใหม่'] }));
    await settle();
    fixture.detectChanges();
    selects[1].value = '30';
    selects[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await settle();
    http
      .expectOne((x) => x.method === 'GET' && x.url === CHATS)
      .flush(apiLineChatPage([a], { total: 87, labels: ['VIP', 'ใหม่'] }));
    await settle();
    fixture.detectChanges();
    const all = el.querySelector<HTMLElement>('app-modal .find ~ app-checkbox input')!;
    expect(all.closest('app-checkbox')?.textContent).toContain(
      fmt(t().api.line.chatImportAll, { n: 87 }),
    );
    (all as HTMLInputElement).checked = true;
    all.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(addButton(el).textContent?.trim()).toBe(t().api.line.chatImportGoAll);
    // The ticks of the rows are ignored while everything is picked.
    expect(items(el).every((r) => boxOf(r).disabled)).toBe(true);
    addButton(el).click();
    await settle();
    const req = http.expectOne((x) => x.method === 'POST' && x.url === IMPORT);
    expect(req.request.body).toEqual({
      accountId: LINE_CONNECTED.id,
      allMatching: true,
      filter: { q: null, label: 'VIP', activeWithinDays: 30 },
    });
    req.flush(done(80, { duplicates: 3, skippedDoNotSend: 4 }));
    await settle();
    expect(closed).toBe(1);
  });

  it('shows the reason inline when the server refuses, and stays open to try again', async () => {
    const { fixture, el } = await open();
    tick(items(el)[0]);
    fixture.detectChanges();
    addButton(el).click();
    await settle();
    http
      .expectOne((x) => x.url === IMPORT)
      .flush({ title: 'ชุดแชทเต็ม 2,000 แชท' }, { status: 422, statusText: 'x' });
    await settle();
    fixture.detectChanges();
    expect(el.querySelector('app-modal .su-field-err')?.textContent).toBe('ชุดแชทเต็ม 2,000 แชท');
    expect(closed).toBe(0);
    expect(addButton(el).disabled).toBe(false);
  });

  it('asks for the machine first when the set has none (two LINE accounts, no choice) and sends nothing', async () => {
    const second: ApiAccount = { ...LINE_CONNECTED, id: 'acc-line2', name: 'LINE · Branch OA' };
    const { el } = await open({
      set: { postAsAccountId: null },
      accounts: [FB_CONNECTED, LINE_CONNECTED, second],
      noRead: true,
    });
    expect(el.querySelector('app-modal .su-field-err')?.textContent).toBe(
      t().api.line.chatImportNoOwner,
    );
    expect(addButton(el).disabled).toBe(true);
    // The list is not shown for no one in particular.
    expect(items(el)).toHaveLength(0);
    // Nobody's customers are asked for.
    http.expectNone((x) => x.method === 'GET' && x.url === CHATS);
  });

  it('shows the plan lock for a workspace whose plan has no LINE chats, and asks for nothing', async () => {
    const { el } = await open({ workspace: { lineChat: false }, noRead: true });
    expect(el.querySelector('app-modal app-feature-lock')).not.toBeNull();
    expect(addButton(el).disabled).toBe(true);
  });

  it('keeps the add button off for a viewer', async () => {
    const { fixture, el } = await open({ workspace: { role: 'viewer' } });
    tick(items(el)[0]);
    fixture.detectChanges();
    expect(addButton(el).disabled).toBe(true);
    expect(addButton(el).title).toBe(t().api.permEdit);
  });

  it('shows a chat with no name as a customer', async () => {
    const { el } = await open({
      chats: apiLineChatPage([apiLineChat({ id: 'z', name: '   ', url: lineChatUrl('z') })]),
    });
    expect(items(el)[0].querySelector('.text')?.textContent).toBe(t().api.line.chatCustomer);
  });
});

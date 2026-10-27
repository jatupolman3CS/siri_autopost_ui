import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountsStore } from '../../core/data/accounts.store';
import { DeviceEventsService } from '../../core/data/device-events.service';
import { DevicesStore } from '../../core/data/devices.store';
import { LinkSetsStore } from '../../core/data/link-sets.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { composeChat, seededRandom } from '../../core/flow/compose';
import { ApiAccount, ApiDevice, ApiLinkSet, ApiWorkspace } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.flow';
import '../../core/i18n/i18n.line';
import { provideApiTesting, settle, signIn } from '../../testing/api-testing';
import { FakeDeviceEvents } from '../../testing/fake-events';
import { FB_CONNECTED, apiLink, apiLinkSet } from '../../testing/link-sets.fixtures';
import {
  LINE_CONNECTED,
  apiChatLink,
  apiLineDevice,
  apiLineSet,
  lineChatUrl,
} from '../../testing/line.fixtures';
import { LinkSetCardComponent } from './link-set-card.component';

// A set of LINE customer chats: the same card with the customers' wording, an import button instead of adding or pasting
// links, the browsers that are logged in to a LINE Official Account in the "post as" select, and chat rows.
describe('LinkSetCardComponent: a set of LINE chats', () => {
  let http: HttpTestingController;

  async function open(
    opts: {
      /** What the card shows (default: a LINE set with two customers posted by the ready LINE account). */
      set?: Partial<ApiLinkSet>;
      /** The workspace list entry (default: a Pro owner). */
      workspace?: Partial<ApiWorkspace>;
      devices?: ApiDevice[];
      accounts?: ApiAccount[];
    } = {},
  ) {
    http = provideApiTesting({
      imports: [LinkSetCardComponent],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: DeviceEventsService, useClass: FakeDeviceEvents },
      ],
    });
    TestBed.inject(WorkspaceStore);
    TestBed.inject(AccountsStore);
    TestBed.inject(DevicesStore);
    TestBed.inject(LinkSetsStore);
    const set = apiLineSet({
      id: 'ls',
      name: 'ลูกค้าประจำ',
      links: [
        apiChatLink({ id: 'a', name: 'สมชาย' }),
        apiChatLink({ id: 'b', name: 'มานี', enabled: false }),
      ],
      ...opts.set,
    });
    await signIn(http, {
      workspace: opts.workspace,
      linkSets: [set],
      devices: opts.devices ?? [apiLineDevice()],
    });
    TestBed.inject(AccountsStore).list.set(opts.accounts ?? [FB_CONNECTED, LINE_CONNECTED]);
    const fixture = TestBed.createComponent(LinkSetCardComponent);
    fixture.componentRef.setInput('set', set);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, set };
  }

  const t = () => TestBed.inject(I18nService).t();
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim();
  const importButton = (el: HTMLElement) =>
    el.querySelector<HTMLButtonElement>('[data-testid="import-chats"]');

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

  it('has a chat badge, a chat icon and a count of chats, not of groups', async () => {
    const { el } = await open();
    expect(text(el.querySelector('.badge'))).toBe(t().api.line.chatBadge);
    expect(el.querySelector('.ico .ph-chat-circle-text')).not.toBeNull();
    expect(el.querySelector('.ico .ph-link')).toBeNull();
    expect(text(el.querySelector('.title .small'))).toBe(
      fmt(t().api.line.chatSetMeta, { n: 2, m: 1 }),
    );
  });

  it('offers "import from LINE chats" and neither a blank link nor pasted links', async () => {
    const { el } = await open();
    expect(text(importButton(el))).toBe(t().api.line.chatImport);
    const labels = [...el.querySelectorAll('.head button')].map((b) => text(b));
    expect(labels).not.toContain(t().ts.addLink);
    expect(labels).not.toContain(t().ts.bulk);
  });

  it('asks the page to open the import dialog', async () => {
    const { fixture, el } = await open();
    let asked = 0;
    fixture.componentInstance.chats.subscribe(() => asked++);
    importButton(el)!.click();
    expect(asked).toBe(1);
  });

  it('keeps the import off for a viewer, and for a plan without LINE chats it says why', async () => {
    const viewer = await open({ workspace: { role: 'viewer' } });
    expect(importButton(viewer.el)!.disabled).toBe(true);
    http.verify();
    TestBed.resetTestingModule();
    const { el } = await open({ workspace: { lineChat: false } });
    expect(importButton(el)!.disabled).toBe(true);
    expect(importButton(el)!.title).toBe(t().api.line.chatLockedBody);
  });

  it('is the only card with a chat badge and an import button: a Facebook set has neither', async () => {
    http = provideApiTesting({
      imports: [LinkSetCardComponent],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: DeviceEventsService, useClass: FakeDeviceEvents },
      ],
    });
    TestBed.inject(WorkspaceStore);
    TestBed.inject(AccountsStore);
    TestBed.inject(DevicesStore);
    TestBed.inject(LinkSetsStore);
    const fb = apiLinkSet({ id: 's1', links: [apiLink({ id: 'a' })] });
    await signIn(http, { linkSets: [fb] });
    const fixture = TestBed.createComponent(LinkSetCardComponent);
    fixture.componentRef.setInput('set', fb);
    fixture.detectChanges();
    await settle();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.badge')).toBeNull();
    expect(importButton(el)).toBeNull();
    expect(el.querySelector('.ico .ph-link')).not.toBeNull();
  });

  describe('the rows', () => {
    it('are customers: the name to edit, the chat address as plain text and a chat chip, no code field', async () => {
      const { el } = await open();
      const row = el.querySelector('app-link-row')!;
      const inputs = [...row.querySelectorAll<HTMLInputElement>('input.cell')];
      // The name and the daily cap; the address is not an input and there is no code.
      expect(inputs.map((i) => i.getAttribute('aria-label'))).toEqual([
        t().api.line.chatNamePh,
        t().ts.maxLabel,
      ]);
      expect(inputs[0].value).toBe('สมชาย');
      expect(row.querySelector('.ro')?.textContent).toBe(lineChatUrl('a'));
      expect(text(row.querySelector('app-chip'))).toBe(t().api.line.chatKind);
      expect(row.querySelector('.ph-chat-circle-text')).not.toBeNull();
    });

    it('keep a code field when the customer already has a code', async () => {
      const { el } = await open({
        set: { links: [apiChatLink({ id: 'a', name: 'สมชาย', code: 'VIP1' })] },
      });
      const labels = [...el.querySelectorAll<HTMLInputElement>('app-link-row input.cell')].map(
        (i) => i.getAttribute('aria-label'),
      );
      expect(labels).toContain(t().ts.codePh);
    });

    it('save a new name as the whole row, and do not flag the chat address as a bad group (the server flags stand)', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        const { fixture, el } = await open();
        const name = el.querySelector<HTMLInputElement>('app-link-row input.cell')!;
        name.value = 'คุณสมชาย';
        name.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        // The address stays valid on screen right away: the Facebook parser must not touch a chat row.
        expect(el.querySelector('app-link-row .note')).toBeNull();
        vi.advanceTimersByTime(700);
        const req = http.expectOne(
          (r) => r.method === 'PUT' && r.url === '/api/workspaces/ws-1/link-sets/ls/links/a',
        );
        expect(req.request.body).toEqual({
          name: 'คุณสมชาย',
          url: lineChatUrl('a'),
          code: '',
          dailyMax: 0,
          enabled: true,
        });
        req.flush(apiChatLink({ id: 'a', name: 'คุณสมชาย' }));
        await settle();
        fixture.detectChanges();
        expect(el.querySelector('app-link-row .note')).toBeNull();
        expect(TestBed.inject(LinkSetsStore).byId('ls')!.links[0]).toMatchObject({
          valid: true,
          kind: 'chat',
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('say the chat set is empty in the customers’ words', async () => {
      const { el } = await open({ set: { links: [] } });
      expect(text(el.querySelector('.empty'))).toBe(t().api.line.chatSetEmpty);
    });
  });

  describe('who sends the set', () => {
    const names = (el: HTMLElement) =>
      [...el.querySelectorAll<HTMLOptionElement>('.postas option')].map((o) => o.textContent);

    it('lists the browsers logged in to a LINE Official Account, by the name of the browser', async () => {
      const { el } = await open({ set: { postAsAccountId: null } });
      // One LINE account: no choice to make, so the row sits in the folded options; open them.
      TestBed.inject(LinkSetsStore).setMore('ls', true);
      await settle();
      expect(names(el)).toEqual([fmt(t().api.flow.postAsAutoNow, { name: 'Shop PC' }), 'Shop PC']);
    });

    it('says the set is ready when the LINE account of its browser can send', async () => {
      const { el } = await open({ set: { postAsAccountId: LINE_CONNECTED.id } });
      expect(text(el.querySelector('.postas .status'))).toBe(t().api.flow.postAsReady);
      expect(text(el.querySelector('.postas p:last-child'))).toBe(t().api.line.chatPostAsHint);
    });

    it('says LINE is not logged in on that browser, and that the set waits', async () => {
      const { el } = await open({
        set: { postAsAccountId: LINE_CONNECTED.id },
        devices: [apiLineDevice({}, { ready: false, sessionLost: true })],
      });
      expect(text(el.querySelector('.postas .status'))).toBe(t().api.line.chatLoginNeeded);
    });

    it('says the browser is offline when it is, like for a Facebook set', async () => {
      const { el } = await open({
        set: { postAsAccountId: LINE_CONNECTED.id },
        devices: [apiLineDevice({ online: false })],
      });
      expect(text(el.querySelector('.postas .status'))).toBe(t().api.flow.postAsOffline);
    });

    it('asks for the browser when two LINE accounts are connected and none is chosen', async () => {
      const second: ApiAccount = { ...LINE_CONNECTED, id: 'acc-line2', name: 'LINE · Branch OA' };
      const { el } = await open({
        set: { postAsAccountId: null },
        accounts: [FB_CONNECTED, LINE_CONNECTED, second],
        devices: [
          apiLineDevice(),
          apiLineDevice({ id: 'dev-2', name: 'Laptop' }, { accountId: 'acc-line2' }),
        ],
      });
      expect(names(el)).toEqual([t().api.flow.postAsPick, 'Shop PC', 'Laptop']);
      expect(text(el.querySelector('.postas .status'))).toBe(t().api.flow.postAsNone);
    });
  });

  describe('the rules and the example', () => {
    it('speak of customers: a random order of customers, one message per customer a day', async () => {
      const { el } = await open();
      const rules = el.querySelector('.rules')!;
      expect(text(rules)).toContain(t().api.line.chatRulesTitle);
      expect(text(rules)).toContain(t().api.line.chatRandomOrder);
      expect(text(rules)).toContain(t().api.line.chatDailyPerCustomer);
      expect(text(rules)).toContain(t().api.line.chatDailyPerCustomerUnit);
      expect(text(rules)).not.toContain(t().api.flow.setRandomOrder);
      // A chat set starts at one message per customer a day.
      expect(rules.querySelector<HTMLInputElement>('input[type=number]')!.value).toBe('1');
    });

    it('writes the example with the first customer’s name and no code line, footer or hashtags', async () => {
      const { fixture, el } = await open();
      TestBed.inject(LinkSetsStore).setMore('ls', true);
      fixture.detectChanges();
      await settle();
      const eg = el.querySelector('.eg')!;
      expect(text(eg.querySelector('.small'))).toBe(
        fmt(t().api.line.chatExample, { name: 'สมชาย' }),
      );
      expect(text(eg.querySelector('.sample'))).toBe(
        composeChat(t().api.line.chatExampleBody, 'สมชาย', '', seededRandom(1)),
      );
      expect(text(eg.querySelector('.sample'))).toContain('สมชาย');
    });

    it('has no example while no customer is on', async () => {
      const { fixture, el } = await open({
        set: { links: [apiChatLink({ id: 'b', name: 'มานี', enabled: false })] },
      });
      TestBed.inject(LinkSetsStore).setMore('ls', true);
      fixture.detectChanges();
      await settle();
      expect(el.querySelector('.eg')).toBeNull();
    });
  });
});

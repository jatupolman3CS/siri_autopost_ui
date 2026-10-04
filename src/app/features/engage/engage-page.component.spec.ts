import { HttpTestingController } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { assistStorage } from '../../core/auth/token';
import { AutoReplyStore } from '../../core/data/auto-reply.store';
import { WorkspaceStore } from '../../core/data/workspace.store';
import { ApiAutoReply, ApiRole } from '../../core/http/api.service';
import { I18nService, fmt } from '../../core/i18n/i18n.service';
import '../../core/i18n/i18n.engine';
import { NotificationService } from '../../core/services/notification.service';
import { lookup } from '../../core/services/title.strategy';
import {
  provideApiTesting,
  settle,
  signIn,
  signInHoldingWorkspaces,
} from '../../testing/api-testing';
import {
  AUTO_REPLY_URL,
  COLLECTIONS_URL,
  autoReply,
  autoReplyRule,
} from '../../testing/engine.fixtures';
import { EngagePageComponent } from './engage-page.component';

const PRICE = autoReplyRule({
  id: 'r1',
  keywords: 'ราคา, How Much',
  reply: 'ทักแชทมาได้เลยค่ะ',
  inbox: 'ราคา 1,290 บาท ส่งฟรี',
});
const SHIP = autoReplyRule({
  id: 'r2',
  keywords: 'ส่งฟรี',
  reply: '',
  inbox: 'ส่งฟรีทั่วไทย',
  scope: 'c1',
  on: false,
});
const COLLECTIONS = [
  { id: 'c1', name: 'Shelves', posts: [] },
  { id: 'c2', name: 'Chairs', posts: [] },
];

describe('EngagePageComponent', () => {
  let http: HttpTestingController;

  async function open(
    opts: { role?: ApiRole; plan?: boolean; assist?: boolean; rules?: ApiAutoReply } = {},
  ) {
    http = provideApiTesting({
      imports: [EngagePageComponent],
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
    await signIn(http, {
      workspace: { role: opts.role ?? 'owner', autoReply: opts.plan ?? true },
    });
    const fixture = TestBed.createComponent(EngagePageComponent);
    fixture.detectChanges();
    await settle();
    http
      .expectOne(AUTO_REPLY_URL)
      .flush(opts.rules ?? autoReply({ on: true, rules: [PRICE, SHIP] }));
    await settle();
    http.expectOne(COLLECTIONS_URL).flush(COLLECTIONS);
    await settle();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const t = () => TestBed.inject(I18nService).t();
  const store = () => TestBed.inject(AutoReplyStore);
  const toasts = () => TestBed.inject(NotificationService).toasts();
  const button = (root: ParentNode, text: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.trim().includes(text),
    );
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const rules = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('.rule')];
  const put = async () => {
    await settle();
    return http.expectOne({ url: AUTO_REPLY_URL, method: 'PUT' });
  };
  const newRule = (el: HTMLElement) => button(el.querySelector('.page-head')!, t().ar.newRule)!;
  const modal = () => document.querySelector<HTMLElement>('.su-modal-panel');

  afterEach(() => {
    try {
      http?.verify();
    } finally {
      http = undefined!;
      TestBed.resetTestingModule();
      localStorage.clear();
    }
  });

  describe('route', () => {
    it('is a lazy page of the signed-in area, titled with its dictionary text', async () => {
      http = provideApiTesting();
      const route = routes
        .find((r) => r.path === 'app')!
        .children!.find((c) => c.path === 'engage')!;
      expect(route.title).toBe('nav.engage');
      expect(lookup(TestBed.inject(I18nService).t(), route.title as string)).toBeTruthy();
      const loaded = await (route.loadComponent as () => Promise<Type<unknown>>)();
      expect(loaded).toBe(EngagePageComponent);
    });
  });

  describe('page', () => {
    it('shows the title and the corrected subtitle: the rules are only saved', async () => {
      const { el } = await open();
      expect(el.querySelector('h1')?.textContent).toBe(t().ar.title);
      expect(el.querySelector('.page-head p')?.textContent).toBe(t().ar.sub);
      expect(t().ar.sub).toMatch(/บันทึกกฎไว้เท่านั้น|only saved/);
    });

    it('waits for the rules before it shows any', async () => {
      http = provideApiTesting({
        imports: [EngagePageComponent],
        providers: [provideRouter([{ path: '**', children: [] }])],
      });
      TestBed.inject(WorkspaceStore);
      await signIn(http);
      const fixture = TestBed.createComponent(EngagePageComponent);
      fixture.detectChanges();
      await settle();
      expect(fixture.nativeElement.textContent).toContain(t().api.loading);
      expect(fixture.nativeElement.querySelector('.rule')).toBeNull();
      http.expectOne(AUTO_REPLY_URL).flush(autoReply());
      await settle();
      http.expectOne(COLLECTIONS_URL).flush([]);
      await settle();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain(t().api.loading);
    });

    it('lists the rules with keyword chips, scope, reply and chat message', async () => {
      const { el } = await open();
      expect(rules(el)).toHaveLength(2);
      const first = rules(el)[0];
      const chips = [...first.querySelectorAll('app-chip')].map((c) => c.textContent?.trim());
      expect(chips).toEqual(['ราคา', 'How Much', t().ar.scopeAll]);
      expect(first.textContent).toContain('ทักแชทมาได้เลยค่ะ');
      expect(first.textContent).toContain('ราคา 1,290 บาท ส่งฟรี');
      const second = rules(el)[1];
      // A rule with no reply shows a dash; a scope names its collection.
      expect([...second.querySelectorAll('app-chip')].map((c) => c.textContent?.trim())).toEqual([
        'ส่งฟรี',
        'Shelves',
      ]);
      expect(second.querySelector('.body .fs14')?.textContent).toContain('—');
      expect(second.classList.contains('off')).toBe(true);
      expect(first.classList.contains('off')).toBe(false);
    });

    it('shows "—" for a rule limited to a collection that is gone', async () => {
      const gone = autoReplyRule({ id: 'r9', keywords: 'x', scope: 'deleted-id' });
      const { el } = await open({ rules: autoReply({ rules: [gone] }) });
      expect(
        [...rules(el)[0].querySelectorAll('app-chip')].map((c) => c.textContent?.trim()),
      ).toEqual(['x', '—']);
    });

    it('counts the rules, says they are only saved, and has no counters of handled comments', async () => {
      const { el } = await open();
      const head = el.querySelector('.rules .panel-head')!;
      expect(head.textContent).toContain(fmt(t().api.engine.engageRuleCount, { n: 2, m: 1 }));
      expect(head.querySelector('app-chip')?.textContent).toBe(t().api.engine.storedOnlyBadge);
      // The design's "today: N comments answered" would be an invented number.
      expect(el.textContent).not.toContain(fmt(t().ar.stats, { c: 0, i: 0 }));
    });

    it('says there are no rules yet', async () => {
      const { el } = await open({ rules: autoReply() });
      expect(rules(el)).toHaveLength(0);
      expect(el.textContent).toContain(t().api.engine.engageNoRules);
    });

    it('replaces the comment feed with an honest empty state', async () => {
      const { el } = await open();
      const feed = el.querySelector('.feed')!;
      expect(feed.querySelector('h2')?.textContent).toBe(t().ar.feed);
      expect(feed.querySelector('app-empty-state')?.textContent).toContain(
        t().api.engine.engageFeedEmpty,
      );
      expect(feed.textContent).toContain(t().api.engine.engageNoFeed);
      expect(feed.textContent).not.toContain(t().ar.replyNow);
    });
  });

  describe('trying a rule (on this page only)', () => {
    const input = (el: HTMLElement) => el.querySelector<HTMLInputElement>('.tryit input')!;
    const result = (el: HTMLElement) => el.querySelector('.tryit .result')!.textContent;

    it('shows the prompt until something is typed', async () => {
      const { el } = await open();
      expect(result(el)).toBe(t().ar.tryPh);
      expect(el.querySelector('.tryit')?.textContent).toContain(t().api.engine.engageTryNote);
    });

    it('answers with what would be sent when a keyword is in the comment, in any case', async () => {
      const { fixture, el } = await open();
      type(input(el), 'HOW MUCH is it?');
      fixture.detectChanges();
      expect(result(el)).toBe(
        fmt(t().ar.tryResult, { r: 'ทักแชทมาได้เลยค่ะ', i: 'ราคา 1,290 บาท ส่งฟรี' }),
      );
    });

    it('says no rule matches, and ignores a rule that is off', async () => {
      const { fixture, el } = await open();
      type(input(el), 'ส่งฟรีไหมคะ'); // the shipping rule is off
      fixture.detectChanges();
      expect(result(el)).toBe(t().ar.tryNone);
    });

    it('does not call the API', async () => {
      const { fixture, el } = await open();
      type(input(el), 'ราคา');
      fixture.detectChanges();
      http.expectNone({ url: AUTO_REPLY_URL, method: 'PUT' });
    });
  });

  describe('changing the rules', () => {
    it('switches the whole feature on and off', async () => {
      const { el } = await open();
      const master = el.querySelector<HTMLInputElement>('.page-head input[type=checkbox]')!;
      expect(master.checked).toBe(true);
      master.click();
      const req = await put();
      expect(req.request.body.on).toBe(false);
      req.flush(req.request.body);
      await settle();
      expect(store().on()).toBe(false);
    });

    it('turns a rule on and off', async () => {
      const { el } = await open();
      rules(el)[1].querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
      const req = await put();
      expect((req.request.body as ApiAutoReply).rules[1].on).toBe(true);
      req.flush(req.request.body);
      await settle();
    });

    it('deletes a rule at once and says so', async () => {
      const { fixture, el } = await open();
      button(rules(el)[0], t().common.remove)!.click();
      fixture.detectChanges();
      expect(rules(el)).toHaveLength(1);
      const req = await put();
      expect((req.request.body as ApiAutoReply).rules.map((r) => r.id)).toEqual(['r2']);
      req.flush(req.request.body);
      await settle();
      expect(toasts().some((x) => x.message === t().ar.deleted)).toBe(true);
    });

    it('puts a rule back when the API refuses to delete it', async () => {
      const { fixture, el } = await open();
      button(rules(el)[0], t().common.remove)!.click();
      (await put()).flush({ title: 'no' }, { status: 403, statusText: 'Forbidden' });
      await settle();
      fixture.detectChanges();
      expect(rules(el)).toHaveLength(2);
      expect(toasts().some((x) => x.message === t().ar.deleted)).toBe(false);
    });
  });

  describe('the new rule dialog', () => {
    it('opens on "new rule", with the scope offering every collection and each collection', async () => {
      const { fixture, el } = await open();
      newRule(el).click();
      fixture.detectChanges();
      await settle();
      http.expectOne(COLLECTIONS_URL).flush(COLLECTIONS);
      await settle();
      fixture.detectChanges();
      expect(modal()?.querySelector('h2')?.textContent).toBe(t().ar.ruleTitle);
      const options = [...modal()!.querySelectorAll('option')].map((o) => [o.value, o.textContent]);
      expect(options).toEqual([
        ['all', t().ar.scopeAll],
        ['c1', 'Shelves'],
        ['c2', 'Chairs'],
      ]);
      expect(modal()!.querySelectorAll<HTMLInputElement>('input.su-input')[0].maxLength).toBe(300);
    });

    async function openDialog() {
      const r = await open();
      newRule(r.el).click();
      r.fixture.detectChanges();
      await settle();
      http.expectOne(COLLECTIONS_URL).flush(COLLECTIONS);
      await settle();
      r.fixture.detectChanges();
      return r;
    }
    const fields = () => modal()!.querySelectorAll<HTMLInputElement>('input.su-input');
    const saveButton = () => button(modal()!, t().common.save)!;

    it('wants keywords and at least one message', async () => {
      const { fixture } = await openDialog();
      saveButton().click();
      fixture.detectChanges();
      expect(modal()!.querySelector('.su-field-err')?.textContent).toBe(t().ar.errRule);
      type(fields()[0], 'สนใจ');
      saveButton().click();
      fixture.detectChanges();
      expect(modal()!.querySelector('.su-field-err')?.textContent).toBe(t().ar.errRule);
      http.expectNone({ url: AUTO_REPLY_URL, method: 'PUT' });
    });

    it('adds the rule, sends the whole list and closes with a toast', async () => {
      const { fixture } = await openDialog();
      type(fields()[0], ' สนใจ, ราคา ');
      type(fields()[2], 'ส่งรายละเอียดทางแชท');
      const select = modal()!.querySelector<HTMLSelectElement>('select')!;
      select.value = 'c2';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      saveButton().click();
      const req = await put();
      const body = req.request.body as ApiAutoReply;
      expect(body.on).toBe(true);
      expect(body.rules).toHaveLength(3);
      expect(body.rules[2]).toMatchObject({
        keywords: 'สนใจ, ราคา',
        reply: '',
        inbox: 'ส่งรายละเอียดทางแชท',
        scope: 'c2',
        on: true,
      });
      req.flush(body);
      await settle();
      fixture.detectChanges();
      expect(modal()).toBeNull();
      expect(toasts().some((x) => x.message === t().ar.saved)).toBe(true);
      expect(store().rules()).toHaveLength(3);
    });

    it('stays open and keeps the text when the API refuses', async () => {
      const { fixture } = await openDialog();
      type(fields()[0], 'สนใจ');
      type(fields()[1], 'ทักแชท');
      saveButton().click();
      (await put()).flush({ title: 'no' }, { status: 403, statusText: 'Forbidden' });
      await settle();
      fixture.detectChanges();
      expect(modal()).not.toBeNull();
      expect(fields()[0].value).toBe('สนใจ');
      expect(store().rules()).toHaveLength(2);
    });

    it('cancels without a save', async () => {
      const { fixture } = await openDialog();
      button(modal()!, t().common.cancel)!.click();
      fixture.detectChanges();
      expect(modal()).toBeNull();
    });

    it('starts empty each time it opens', async () => {
      const { fixture, el } = await openDialog();
      type(fields()[0], 'left over');
      button(modal()!, t().common.cancel)!.click();
      fixture.detectChanges();
      newRule(el).click();
      fixture.detectChanges();
      await settle();
      http.expectOne(COLLECTIONS_URL).flush(COLLECTIONS);
      await settle();
      fixture.detectChanges();
      expect(fields()[0].value).toBe('');
    });
  });

  describe('permissions and plan', () => {
    it('shows no lock banner and no dimmed content before the workspaces have arrived, then locks', async () => {
      http = provideApiTesting({
        imports: [EngagePageComponent],
        providers: [provideRouter([{ path: '**', children: [] }])],
      });
      const ws = TestBed.inject(WorkspaceStore);
      const held = await signInHoldingWorkspaces(http);
      const fixture = TestBed.createComponent(EngagePageComponent);
      fixture.detectChanges();
      await settle();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(ws.loaded()).toBe(false);
      expect(el.querySelector('app-feature-lock')).toBeNull();
      expect(el.querySelector('.locked')).toBeNull();
      await held.answer({ autoReply: false });
      fixture.detectChanges();
      await settle();
      fixture.detectChanges();
      expect(el.querySelector('app-feature-lock')).not.toBeNull();
      expect(el.querySelector('.grid-2')?.classList.contains('locked')).toBe(true);
    });

    it('is turned off under the lock banner on a plan without auto-reply, but keeps its content', async () => {
      const { el } = await open({ plan: false });
      expect(el.querySelector('app-feature-lock')?.textContent).toContain(t().ntf.advanced);
      expect(el.querySelector('app-feature-lock')?.textContent).toContain(t().ar.locked);
      expect(el.querySelector('a[href="/app/billing"]')?.textContent).toContain(t().common.upgrade);
      expect(rules(el)).toHaveLength(2);
      expect(el.querySelector('.grid-2')?.classList.contains('locked')).toBe(true);
      expect(newRule(el).disabled).toBe(true);
      expect(newRule(el).title).toBe(fmt(t().api.engine.planLocked, { plan: t().plans.pro.name }));
      expect(el.querySelector<HTMLInputElement>('.page-head input[type=checkbox]')!.disabled).toBe(
        true,
      );
      expect(rules(el)[0].querySelector<HTMLInputElement>('input[type=checkbox]')!.disabled).toBe(
        true,
      );
      expect(button(rules(el)[0], t().common.remove)!.disabled).toBe(true);
      expect(el.querySelector<HTMLInputElement>('.tryit input')!.disabled).toBe(true);
    });

    it('offers no upgrade to someone who is not the owner', async () => {
      const { el } = await open({ plan: false, role: 'admin' });
      expect(el.querySelector('app-feature-lock')).not.toBeNull();
      expect(el.querySelector('a[href="/app/billing"]')).toBeNull();
    });

    it('turns every control off for an editor and says why', async () => {
      const { el } = await open({ role: 'editor' });
      expect(el.querySelector('app-perm-note')?.textContent).toContain(t().api.permAdmin);
      expect(el.querySelector('app-feature-lock')).toBeNull();
      expect(newRule(el).disabled).toBe(true);
      expect(newRule(el).title).toBe(t().api.permAdmin);
      expect(button(rules(el)[0], t().common.remove)!.disabled).toBe(true);
      expect(el.querySelector<HTMLInputElement>('.page-head input[type=checkbox]')!.disabled).toBe(
        true,
      );
      // Trying a comment against the rules is local: a viewer may do it.
      expect(el.querySelector<HTMLInputElement>('.tryit input')!.disabled).toBe(false);
    });

    it('is read-only in assist mode', async () => {
      const { el } = await open({ assist: true });
      expect(el.querySelector('app-perm-note')?.textContent).toContain(t().api.permAssist);
      expect(newRule(el).disabled).toBe(true);
    });

    it('lets an admin change the rules', async () => {
      const { el } = await open({ role: 'admin' });
      expect(newRule(el).disabled).toBe(false);
      expect(button(rules(el)[0], t().common.remove)!.disabled).toBe(false);
    });

    it('stops offering new rules at the limit of 50', async () => {
      const many = Array.from({ length: 50 }, (_, i) => autoReplyRule({ id: `r${i}` }));
      const { el } = await open({ rules: autoReply({ rules: many }) });
      expect(newRule(el).disabled).toBe(true);
      expect(newRule(el).title).toBe(fmt(t().api.engine.engageFull, { n: 50 }));
    });
  });

  it('reads the dictionary in English too', async () => {
    const { fixture, el } = await open();
    TestBed.inject(I18nService).setLang('en');
    fixture.detectChanges();
    expect(el.querySelector('h1')?.textContent).toBe('Auto-reply (comment-to-inbox)');
    expect(el.textContent).toContain('The list of handled comments stays empty');
    TestBed.inject(I18nService).setLang('th');
  });
});

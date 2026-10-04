import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiAutoReply, ApiWorkspace } from '../http/api.service';
import { WORKSPACE, WS, provideApiTesting, settle, signIn } from '../../testing/api-testing';
import {
  AUTO_REPLY_URL,
  COLLECTIONS_URL,
  autoReply,
  autoReplyRule,
} from '../../testing/engine.fixtures';
import { AutoReplyStore, SCOPE_ALL, keywordsOf, matchRule } from './auto-reply.store';
import { WorkspaceStore } from './workspace.store';

const PRICE = autoReplyRule({ id: 'r1', keywords: 'ราคา, How Much ,  ', reply: 'DM us' });
const SHIP = autoReplyRule({ id: 'r2', keywords: 'ส่งฟรี', on: false });

describe('matchRule and keywordsOf', () => {
  it('splits the comma separated keywords, trimmed, without empty ones', () => {
    expect(keywordsOf(' ราคา, How Much ,, ')).toEqual(['ราคา', 'How Much']);
    expect(keywordsOf('')).toEqual([]);
  });

  it('matches a keyword contained in the text, in any case', () => {
    expect(matchRule([PRICE], 'HOW MUCH is the shelf?')?.id).toBe('r1');
    expect(matchRule([PRICE], 'ขอราคาหน่อยค่ะ')?.id).toBe('r1');
    expect(matchRule([PRICE], 'nice photo')).toBeNull();
  });

  it('ignores rules that are off and returns the first rule that matches', () => {
    expect(matchRule([SHIP, PRICE], 'ส่งฟรีไหม ราคาเท่าไหร่')?.id).toBe('r1');
    expect(matchRule([SHIP], 'ส่งฟรีไหม')).toBeNull();
    expect(matchRule([{ ...PRICE, keywords: '' }], 'anything')).toBeNull();
  });
});

describe('AutoReplyStore', () => {
  let http: HttpTestingController;
  let store: AutoReplyStore;

  async function start(
    opts: { rules?: ApiAutoReply; workspace?: Partial<ApiWorkspace> } = {},
  ): Promise<void> {
    http = provideApiTesting();
    TestBed.inject(WorkspaceStore);
    await signIn(http, { workspace: opts.workspace });
    store = TestBed.inject(AutoReplyStore);
    await settle();
    http
      .expectOne(AUTO_REPLY_URL)
      .flush(opts.rules ?? autoReply({ on: true, rules: [PRICE, SHIP] }));
    await settle();
    http.expectOne(COLLECTIONS_URL).flush([
      { id: 'c1', name: 'Shelves', posts: [] },
      { id: 'c2', name: 'Chairs', posts: [] },
    ]);
    await settle();
  }

  /** The save of the change just made (it is sent a tick later, behind the saves before it). */
  const put = async () => {
    await settle();
    return http.expectOne({ url: AUTO_REPLY_URL, method: 'PUT' });
  };

  afterEach(() => http.verify());

  it('loads the rules and the collection names for the scope labels', async () => {
    await start();
    expect(store.loaded()).toBe(true);
    expect(store.on()).toBe(true);
    expect(store.rules().map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(store.ruleCount()).toBe(2);
    expect(store.onCount()).toBe(1);
    expect(store.scopeName(SCOPE_ALL)).toBe('');
    expect(store.scopeName('c2')).toBe('Chairs');
    expect(store.scopeName('gone')).toBeNull();
  });

  it('is locked when the owner’s plan has no auto-reply', async () => {
    await start({ workspace: { autoReply: false } });
    expect(store.locked()).toBe(true);
  });

  it('empties itself with the workspace and loads the next one', async () => {
    await start();
    const ws = TestBed.inject(WorkspaceStore);
    ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
    ws.switchTo('ws-2');
    await settle();
    expect(store.rules()).toEqual([]);
    expect(store.loaded()).toBe(false);
    http.expectOne('/api/workspaces/ws-2/auto-reply').flush(autoReply({ rules: [SHIP] }));
    await settle();
    http.expectOne('/api/workspaces/ws-2/collections').flush([]);
    await settle();
    expect(store.rules().map((r) => r.id)).toEqual(['r2']);
  });

  describe('changes', () => {
    it('the master switch shows at once and sends the whole list', async () => {
      await start();
      const done = store.setOn(false);
      expect(store.on()).toBe(false);
      const req = await put();
      expect(req.request.body).toEqual({ on: false, rules: [PRICE, SHIP] });
      req.flush(req.request.body);
      expect(await done).toBe(true);
      expect(store.on()).toBe(false);
    });

    it('adds a rule that is on, with trimmed text and a new id', async () => {
      await start();
      const done = store.addRule({
        keywords: '  สนใจ ',
        reply: ' ทักแชท ',
        inbox: '',
        scope: 'c1',
      });
      expect(store.rules()).toHaveLength(3);
      const req = await put();
      const added = (req.request.body as ApiAutoReply).rules[2];
      expect(added).toMatchObject({
        keywords: 'สนใจ',
        reply: 'ทักแชท',
        inbox: '',
        scope: 'c1',
        on: true,
      });
      expect(added.id).toMatch(/^[0-9a-f-]{36}$/);
      req.flush(req.request.body);
      expect(await done).toBe(true);
    });

    it('scope defaults to every collection', async () => {
      await start({ rules: autoReply() });
      void store.addRule({ keywords: 'x', reply: 'y', inbox: '', scope: '' });
      const req = await put();
      expect((req.request.body as ApiAutoReply).rules[0].scope).toBe(SCOPE_ALL);
      req.flush(req.request.body);
    });

    it('toggles and deletes a rule', async () => {
      await start();
      const toggled = store.setRuleOn('r2', true);
      expect(store.rules().find((r) => r.id === 'r2')?.on).toBe(true);
      const t = await put();
      expect((t.request.body as ApiAutoReply).rules.find((r) => r.id === 'r2')?.on).toBe(true);
      t.flush(t.request.body);
      await toggled;

      const removed = store.removeRule('r1');
      expect(store.rules().map((r) => r.id)).toEqual(['r2']);
      const d = await put();
      expect((d.request.body as ApiAutoReply).rules.map((r) => r.id)).toEqual(['r2']);
      d.flush(d.request.body);
      expect(await removed).toBe(true);
    });

    it('puts everything back to what the server last accepted when a save is refused', async () => {
      await start();
      const done = store.removeRule('r1');
      expect(store.rules().map((r) => r.id)).toEqual(['r2']);
      (await put()).flush(
        { title: 'ต้องใช้แผน Pro ขึ้นไป' },
        { status: 403, statusText: 'Forbidden' },
      );
      expect(await done).toBe(false);
      expect(store.rules().map((r) => r.id)).toEqual(['r1', 'r2']);
      expect(store.on()).toBe(true);
    });

    it('sends quick changes one after the other, each with the list as it is by then', async () => {
      await start();
      const first = store.setRuleOn('r2', true);
      const second = store.removeRule('r1');
      await settle();
      const a = await put();
      expect((a.request.body as ApiAutoReply).rules.map((r) => r.id)).toEqual(['r2']);
      a.flush(a.request.body);
      await first;
      await settle();
      const b = await put();
      expect((b.request.body as ApiAutoReply).rules.map((r) => r.id)).toEqual(['r2']);
      b.flush(b.request.body);
      await second;
      expect(store.rules().map((r) => [r.id, r.on])).toEqual([['r2', true]]);
    });

    it('applies what the server answers (its own spelling) once nothing else is waiting', async () => {
      await start();
      const done = store.setOn(true);
      const req = await put();
      req.flush({ on: true, rules: [{ ...PRICE, keywords: 'ราคา' }, SHIP] });
      await done;
      expect(store.rules()[0].keywords).toBe('ราคา');
    });

    it('does not offer more than the 50 rules the API accepts', async () => {
      const many = Array.from({ length: 50 }, (_, i) => autoReplyRule({ id: `r${i}` }));
      await start({ rules: autoReply({ rules: many }) });
      expect(store.full()).toBe(true);
    });
  });

  it('match() uses the current rules', async () => {
    await start();
    expect(store.match('ราคาเท่าไหร่')?.id).toBe('r1');
    expect(store.match('ส่งฟรีไหม')).toBeNull(); // r2 is off
    expect(WS).toBe('ws-1');
  });
});

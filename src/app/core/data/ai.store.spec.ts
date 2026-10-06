import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { assistStorage } from '../auth/token';
import { ApiAiStatus, ApiRole, QUIET } from '../http/api.service';
import { I18nService } from '../i18n/i18n.service';
import {
  AI_STATUS,
  WORKSPACE,
  WS,
  provideApiTesting,
  settle,
  signIn,
} from '../../testing/api-testing';
import { AiStore } from './ai.store';
import { WorkspaceStore } from './workspace.store';

const STATUS = `/api/workspaces/${WS}/ai/status`;
const POSTS = `/api/workspaces/${WS}/ai/posts`;
const status = (over: Partial<ApiAiStatus> = {}): ApiAiStatus => ({ ...AI_STATUS, ...over });

describe('AiStore', () => {
  let http: HttpTestingController;
  const t = () => TestBed.inject(I18nService).t();

  /** Signs in with the store already there (so it asks for the status with the workspace's other loads). */
  async function open(
    answer: Partial<ApiAiStatus> | null = {},
    role: ApiRole = 'owner',
    assist = false,
  ): Promise<AiStore> {
    http = provideApiTesting();
    if (assist)
      assistStorage.set({
        adminToken: 'a',
        customerId: 'u-1',
        email: 'owner@shop.co',
        expiresAt: '2099-01-01T00:00:00Z',
      });
    TestBed.inject(WorkspaceStore);
    const ai = TestBed.inject(AiStore);
    await signIn(http, { aiStatus: status(answer ?? {}), workspace: { role } });
    return ai;
  }

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    localStorage.clear();
    assistStorage.set(null);
  });

  describe('before the status has arrived', () => {
    it('enables nothing, says it is checking and is not loaded', async () => {
      http = provideApiTesting();
      TestBed.inject(WorkspaceStore);
      await signIn(http);
      const ai = TestBed.inject(AiStore);
      await settle();
      expect(ai.loaded()).toBe(false);
      expect(ai.failed()).toBe(false);
      expect(ai.state()).toBe('loading');
      expect(ai.enabled()).toBe(false);
      expect(ai.allowed()).toBe(false);
      expect(ai.canOpen()).toBe(false);
      expect(ai.canWrite()).toBe(false);
      expect(ai.reason()).toBe(t().api.flow.edAiChecking);
      http.expectOne(STATUS).flush(status());
      await settle();
      expect(ai.loaded()).toBe(true);
      expect(ai.state()).toBe('ready');
    });
  });

  describe('with a key and the plan', () => {
    it('is ready: enabled, allowed, can be opened and can write, with no reason', async () => {
      const ai = await open();
      expect(ai.loaded()).toBe(true);
      expect(ai.enabled()).toBe(true);
      expect(ai.allowed()).toBe(true);
      expect(ai.model()).toBe('test-model');
      expect(ai.state()).toBe('ready');
      expect(ai.canOpen()).toBe(true);
      expect(ai.canWrite()).toBe(true);
      expect(ai.reason()).toBe('');
      expect(ai.remaining()).toBeNull();
    });
  });

  describe('without an AI key on the server', () => {
    it('is off and says the admin has to set one up', async () => {
      const ai = await open({ enabled: false, model: '' });
      expect(ai.loaded()).toBe(true);
      expect(ai.enabled()).toBe(false);
      expect(ai.state()).toBe('noKey');
      expect(ai.canOpen()).toBe(false);
      expect(ai.canWrite()).toBe(false);
      expect(ai.reason()).toBe(t().api.flow.edAiNoKey);
      expect(ai.reason()).toMatch(/AI/);
    });

    it('says no key even when the plan is not enough either (an upgrade would not help yet)', async () => {
      const ai = await open({ enabled: false, allowed: false });
      expect(ai.state()).toBe('noKey');
    });
  });

  describe('on a plan without AI', () => {
    it('is off and points to the plan', async () => {
      const ai = await open({ allowed: false });
      expect(ai.enabled()).toBe(true);
      expect(ai.allowed()).toBe(false);
      expect(ai.state()).toBe('noPlan');
      expect(ai.canOpen()).toBe(false);
      expect(ai.canWrite()).toBe(false);
      expect(ai.reason()).toBe(t().api.flow.edAiNoPlan);
    });
  });

  describe("today's allowance", () => {
    it('shows how many drafts are left, and no limit as null', async () => {
      const ai = await open({ draftsLeftToday: 7 });
      expect(ai.remaining()).toBe(7);
      expect(ai.state()).toBe('ready');
    });

    it('can still be opened when it is used up, but cannot write', async () => {
      const ai = await open({ draftsLeftToday: 0 });
      expect(ai.state()).toBe('noDrafts');
      expect(ai.canOpen()).toBe(true);
      expect(ai.canWrite()).toBe(false);
      expect(ai.reason()).toBe(t().api.flow.edAiNoDrafts);
    });
  });

  describe('the person', () => {
    it('a viewer cannot use it, whatever the server says', async () => {
      const ai = await open({}, 'viewer');
      expect(ai.state()).toBe('readonly');
      expect(ai.canOpen()).toBe(false);
      expect(ai.canWrite()).toBe(false);
      expect(ai.reason()).toBe(t().api.permEdit);
    });

    it.each(['editor', 'admin', 'owner'] as const)('a %s can', async (role) => {
      const ai = await open({}, role);
      expect(ai.canWrite()).toBe(true);
    });

    it('cannot in assist mode (read-only), and the reason says so', async () => {
      const ai = await open({}, 'owner', true);
      expect(ai.state()).toBe('readonly');
      expect(ai.reason()).toBe(t().api.permAssist);
    });
  });

  describe('when the status cannot be read', () => {
    it('stays off and says so (a refusal is not asked again)', async () => {
      http = provideApiTesting();
      TestBed.inject(WorkspaceStore);
      const ai = TestBed.inject(AiStore);
      await signIn(http, { workspace: { role: 'owner' } });
      // signIn answered the first request; ask again as a failing server would answer it
      ai.status.set(null);
      ai.loaded.set(false);
      const done = ai.load(WS);
      await settle();
      http.expectOne(STATUS).flush({}, { status: 403, statusText: 'Forbidden' });
      await done;
      expect(ai.loaded()).toBe(false);
      expect(ai.failed()).toBe(true);
      expect(ai.state()).toBe('failed');
      expect(ai.canOpen()).toBe(false);
      expect(ai.reason()).toBe(t().api.flow.edAiStatusFailed);
    });
  });

  describe('when the workspace changes', () => {
    it('empties itself and reads the status of the other workspace', async () => {
      const ai = await open({ draftsLeftToday: 3 });
      expect(ai.remaining()).toBe(3);
      const ws = TestBed.inject(WorkspaceStore);
      ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
      ws.switchTo('ws-2');
      await settle();
      expect(ai.loaded()).toBe(false);
      expect(ai.status()).toBeNull();
      expect(ai.canWrite()).toBe(false);
      for (const r of http.match((r) => r.url.startsWith('/api/workspaces/ws-2/'))) {
        if (r.request.url.endsWith('/ai/status')) r.flush(status({ allowed: false }));
        else r.flush([]);
      }
      await settle();
      expect(ai.loaded()).toBe(true);
      expect(ai.state()).toBe('noPlan');
    });

    it('drops a status that arrives for a workspace that is gone', async () => {
      http = provideApiTesting();
      TestBed.inject(WorkspaceStore);
      await signIn(http);
      const ai = TestBed.inject(AiStore);
      await settle();
      const late = http.expectOne(STATUS);
      const ws = TestBed.inject(WorkspaceStore);
      ws.list.update((l) => [...l, { ...WORKSPACE, id: 'ws-2', name: 'Other' }]);
      ws.switchTo('ws-2');
      await settle();
      late.flush(status());
      await settle();
      expect(ai.status()).toBeNull();
      expect(ai.loaded()).toBe(false);
      for (const r of http.match((r) => r.url.startsWith('/api/workspaces/ws-2/'))) r.flush([]);
    });
  });

  describe('write()', () => {
    const request = {
      topic: 'ชั้นวางไม้สัก',
      points: ['ส่งฟรี', 'รับประกัน 1 ปี'],
      tone: 'sales',
      count: 2,
    } as const;

    it('sends the topic, points, tone and count and answers the drafts', async () => {
      const ai = await open({ draftsLeftToday: 10 });
      const done = ai.write(request);
      await settle();
      const req = http.expectOne({ method: 'POST', url: POSTS });
      expect(req.request.body).toEqual({
        topic: 'ชั้นวางไม้สัก',
        points: ['ส่งฟรี', 'รับประกัน 1 ปี'],
        tone: 'sales',
        count: 2,
      });
      req.flush({ variants: ['draft one', 'draft two'] });
      await expect(done).resolves.toEqual(['draft one', 'draft two']);
      await settle();
      // The count of drafts left moves at once, then the server's own count replaces it.
      expect(ai.remaining()).toBe(8);
      http.expectOne(STATUS).flush(status({ draftsLeftToday: 8 }));
      await settle();
      expect(ai.remaining()).toBe(8);
    });

    it('does not invent a count when there is no limit', async () => {
      const ai = await open();
      const done = ai.write(request);
      await settle();
      http.expectOne({ method: 'POST', url: POSTS }).flush({ variants: ['x', 'y'] });
      await done;
      await settle();
      expect(ai.remaining()).toBeNull();
      http.expectOne(STATUS).flush(status());
    });

    it('never goes below zero, and then the panel cannot write any more', async () => {
      const ai = await open({ draftsLeftToday: 1 });
      const done = ai.write(request);
      await settle();
      http.expectOne({ method: 'POST', url: POSTS }).flush({ variants: ['x', 'y'] });
      await done;
      await settle();
      expect(ai.remaining()).toBe(0);
      expect(ai.canWrite()).toBe(false);
      http.expectOne(STATUS).flush(status({ draftsLeftToday: 0 }));
    });

    it('rejects with the API error (the caller shows its reason) and reads the status again', async () => {
      const ai = await open({ draftsLeftToday: 5 });
      const done = ai.write(request);
      const failed = done.catch((e) => e);
      await settle();
      http
        .expectOne({ method: 'POST', url: POSTS })
        .flush(
          { title: 'วันนี้ใช้ AI ร่างโพสต์ครบแล้ว' },
          { status: 422, statusText: 'Unprocessable' },
        );
      const error = (await failed) as { status: number; error: { title: string } };
      expect(error.status).toBe(422);
      expect(error.error.title).toBe('วันนี้ใช้ AI ร่างโพสต์ครบแล้ว');
      await settle();
      http.expectOne(STATUS).flush(status({ draftsLeftToday: 0 }));
      await settle();
      expect(ai.state()).toBe('noDrafts');
    });

    it('is a quiet request: the panel shows the refusal itself, the interceptor does not toast it', async () => {
      const ai = await open();
      const failed = ai.write(request).catch((e) => e);
      await settle();
      const req = http.expectOne({ method: 'POST', url: POSTS });
      expect(req.request.context.get(QUIET)).toBe(true);
      req.flush({}, { status: 403, statusText: 'Forbidden' });
      await failed;
      await settle();
      http.expectOne(STATUS).flush(status());
    });
  });
});

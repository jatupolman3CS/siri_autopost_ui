import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from '../core/auth/auth.interceptor';
import { SessionStore } from '../core/data/session.store';
import {
  ApiAccount,
  ApiAiStatus,
  ApiCollection,
  ApiCollectionPost,
  ApiDevice,
  ApiLinkSet,
  ApiPost,
  ApiUser,
  ApiWorkspace,
} from '../core/http/api.service';

// Test helpers: a signed-in user with one workspace, served by HttpTestingController.

export const WS = 'ws-1';

/** The workspace list entry the helpers answer with; pass `workspace` to signIn() to change it. */
export const WORKSPACE: ApiWorkspace = {
  id: WS,
  name: 'Shop',
  posts7: 0,
  members: 1,
  role: 'owner',
  limits: {
    accounts: 10,
    posts: null,
    devices: 3,
    seats: 3,
    groups: null,
    images: null,
    libraryPosts: null,
  },
  advancedAntiBan: true,
  notifications: true,
  autoReply: true,
  clientReports: false,
  // A Pro owner: the AI writer yes, bumping (Premium) no.
  ai: true,
  bump: false,
};

export const USER: ApiUser = {
  id: 'u-1',
  email: 'owner@shop.co',
  name: 'owner',
  role: 'user',
  plan: 'pro',
  cycle: 'month',
  status: 'active',
};

/** What GET notifications answers for a workspace that has not set anything up (tokens are never returned). */
export const NOTIFICATIONS = {
  telegram: { on: false, token: null, hasToken: false, chatId: '' },
  line: { on: false, token: null, hasToken: false, to: '' },
  channel: 'tg',
  events: {
    success: false,
    fail: true,
    shot: true,
    round: true,
    startStop: true,
    block: true,
    offline: true,
    quota: false,
  },
  sets: [],
  commandsOn: false,
  commandsUsers: '',
};

/**
 * What GET accounts answers: a workspace has one Facebook account for each browser it paired, and nothing else.
 * This one's browser was unbound since (it keeps its history and cannot post: `connected` false), so a spec that
 * wants a browser that posts adds `FB_CONNECTED` (testing/link-sets.fixtures.ts) or pairs a device.
 */
/** What GET ai/status answers by default: the server has a key, the plan includes the writer, no daily limit. */
export const AI_STATUS: ApiAiStatus = {
  enabled: true,
  allowed: true,
  model: 'test-model',
  draftsLeftToday: null,
};

export const ACCOUNTS: ApiAccount[] = [
  {
    id: 'acc-page',
    platform: 'fb',
    name: 'Facebook · Old PC',
    handle: 'Facebook',
    defaultTarget: 'โปรไฟล์',
    health: 'ok',
    groups: ['G1', 'G2', 'G3', 'G4'],
    connected: false,
  },
];

export function apiPost(over: Partial<ApiPost> & { id: string; scheduledAt: string }): ApiPost {
  return {
    accountId: 'acc-page',
    platform: 'fb',
    target: 'ขายของบ้านและสวน',
    content: 'hello',
    mediaIds: [],
    status: 'queued',
    failureCode: null,
    failureDetail: null,
    publishedAt: null,
    scheduleId: null,
    collectionPostId: null,
    linkId: null,
    code: null,
    targetUrl: null,
    isTest: false,
    ...over,
  };
}

export function provideApiTesting(extra: { imports?: unknown[]; providers?: unknown[] } = {}) {
  localStorage.clear();
  TestBed.configureTestingModule({
    imports: extra.imports as never[],
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      ...((extra.providers ?? []) as never[]),
    ],
  });
  return TestBed.inject(HttpTestingController);
}

/** The post library the server would list for these collections: each post once, in the order met. */
export function libraryOf(collections: ApiCollection[]): ApiCollectionPost[] {
  const seen = new Map<string, ApiCollectionPost>();
  for (const c of collections) for (const p of c.posts) if (!seen.has(p.id)) seen.set(p.id, p);
  return [...seen.values()];
}

/** Lets pending promise continuations and effects run. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
    TestBed.tick();
  }
}

/** Logs in and answers the workspace list, then the per-workspace loads it triggers. */
export async function signIn(
  http: HttpTestingController,
  data: {
    posts?: ApiPost[];
    errors?: ApiPost[];
    user?: Partial<ApiUser>;
    workspace?: Partial<ApiWorkspace>;
    devices?: ApiDevice[];
    collections?: ApiCollection[];
    /** Answers GET master-posts (the post library); by default the posts of `collections`, each once. */
    masterPosts?: ApiCollectionPost[];
    linkSets?: ApiLinkSet[];
    /** Answers GET schedules (the schedules store; typed by whoever builds it). */
    schedules?: unknown[];
    /** Answers GET ai/status (only read once an editor is open): by default a key and a plan, no limit. */
    aiStatus?: ApiAiStatus;
  } = {},
): Promise<void> {
  const login = TestBed.inject(SessionStore).logIn(USER.email, 'password1');
  http
    .expectOne('/api/auth/login')
    .flush({ token: 't0k', expiresAt: '2099-01-01', user: { ...USER, ...data.user } });
  await login;
  await settle();
  http.expectOne('/api/workspaces').flush([{ ...WORKSPACE, ...data.workspace }]);
  await settle();
  answerWorkspaceLoads(http, data);
  await settle();
}

/**
 * Logs in but leaves the workspace list unanswered, as on a reload before the list has arrived: `answer()` then
 * sends the list and answers the loads that follow, so a spec can look at a page in between.
 */
export async function signInHoldingWorkspaces(
  http: HttpTestingController,
  data: Parameters<typeof answerWorkspaceLoads>[1] = {},
): Promise<{ answer: (workspace?: Partial<ApiWorkspace>) => Promise<void> }> {
  const login = TestBed.inject(SessionStore).logIn(USER.email, 'password1');
  http.expectOne('/api/auth/login').flush({ token: 't0k', expiresAt: '2099-01-01', user: USER });
  await login;
  await settle();
  const list = http.expectOne('/api/workspaces');
  return {
    answer: async (workspace = {}) => {
      list.flush([{ ...WORKSPACE, ...workspace }]);
      await settle();
      answerWorkspaceLoads(http, data);
      await settle();
    },
  };
}

/** Answers the thumbnail fetches of the library files a page shows (they are fetched when a page shows them). */
export function answerThumbs(http: HttpTestingController): void {
  for (const r of http.match((req) => /\/media\/[^/]+\/content$/.test(req.url))) {
    r.flush(new Blob());
  }
}

export function answerWorkspaceLoads(
  http: HttpTestingController,
  data: {
    posts?: ApiPost[];
    errors?: ApiPost[];
    simulatedOffline?: boolean;
    devices?: ApiDevice[];
    collections?: ApiCollection[];
    masterPosts?: ApiCollectionPost[];
    linkSets?: ApiLinkSet[];
    schedules?: unknown[];
    aiStatus?: ApiAiStatus;
  } = {},
): void {
  const base = `/api/workspaces/${WS}`;
  answerThumbs(http);
  for (const r of http.match((req) => req.url === `${base}/posts`)) {
    const from = new Date(r.request.params.get('from')!);
    const to = new Date(r.request.params.get('to')!);
    r.flush(
      (data.posts ?? []).filter((p) => {
        const at = new Date(p.scheduledAt);
        return at >= from && at < to;
      }),
    );
  }
  for (const r of http.match(`${base}/errors`)) r.flush(data.errors ?? []);
  for (const r of http.match(`${base}/accounts`)) r.flush(ACCOUNTS);
  for (const r of http.match(`${base}/media`)) r.flush([]);
  for (const r of http.match(`${base}/snippets`)) r.flush([]);
  for (const r of http.match(`${base}/media-folders`)) r.flush([]);
  for (const r of http.match(`${base}/devices`)) r.flush(data.devices ?? []);
  // The collection → link set → schedule flow (empty unless a test passes data).
  for (const r of http.match(`${base}/collections`)) r.flush(data.collections ?? []);
  for (const r of http.match(`${base}/master-posts`))
    r.flush(data.masterPosts ?? libraryOf(data.collections ?? []));
  for (const r of http.match(`${base}/link-sets`)) r.flush(data.linkSets ?? []);
  for (const r of http.match(`${base}/schedules`)) r.flush(data.schedules ?? []);
  for (const r of http.match(`${base}/ai/status`)) r.flush(data.aiStatus ?? AI_STATUS);
  for (const r of http.match(`${base}/notifications`)) r.flush(NOTIFICATIONS);
  for (const r of http.match(`${base}/auto-reply`)) r.flush({ on: false, rules: [] });
  for (const r of http.match(`${base}/engine`))
    r.flush({
      antiBan: {
        min: 3,
        max: 12,
        limits: { fb: 40 },
        typing: true,
        typingSpeed: 'normal',
        scroll: true,
        shuffle: true,
        autoPause: true,
        warmup: false,
        advanced: {
          minGap: 2,
          dailyAll: 0,
          blockMin: 24,
          blockMax: 48,
          failStreak: 4,
          recentAvoid: 10,
          cooldown: 0,
          focus: true,
          autoOffFails: 3,
          stopFailPct: 30,
        },
      },
      offline: { policy: 'queue', window: '2h', line: true, email: true, push: false },
      extensionOnline: !data.simulatedOffline,
      simulatedOffline: !!data.simulatedOffline,
      devices: 0,
      devicesOnline: 0,
    });
}

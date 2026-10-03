import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from '../core/auth/auth.interceptor';
import { SessionStore } from '../core/data/session.store';
import { ApiAccount, ApiPost, ApiUser } from '../core/http/api.service';

// Test helpers: a signed-in user with one workspace, served by HttpTestingController.

export const WS = 'ws-1';

export const USER: ApiUser = {
  id: 'u-1',
  email: 'owner@shop.co',
  name: 'owner',
  role: 'user',
  plan: 'pro',
  cycle: 'month',
  status: 'active',
};

export const ACCOUNTS: ApiAccount[] = [
  {
    id: 'acc-page',
    platform: 'fb',
    name: 'Baan Dee',
    handle: 'เพจ Facebook',
    defaultTarget: 'เพจ',
    health: 'ok',
    groups: ['G1', 'G2', 'G3', 'G4'],
    connected: false,
  },
  {
    id: 'acc-ig',
    platform: 'ig',
    name: '@baandee',
    handle: 'Instagram',
    defaultTarget: 'ฟีด',
    health: 'ok',
    groups: [],
    connected: false,
  },
  {
    id: 'acc-tt',
    platform: 'tt',
    name: '@baandee',
    handle: 'TikTok',
    defaultTarget: 'โปรไฟล์',
    health: 'relogin',
    groups: [],
    connected: false,
  },
];

export function apiPost(over: Partial<ApiPost> & { id: string; scheduledAt: string }): ApiPost {
  return {
    accountId: 'acc-ig',
    platform: 'ig',
    target: 'ฟีด',
    content: 'hello',
    mediaIds: [],
    status: 'queued',
    failureCode: null,
    failureDetail: null,
    publishedAt: null,
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
  data: { posts?: ApiPost[]; errors?: ApiPost[] } = {},
): Promise<void> {
  const login = TestBed.inject(SessionStore).logIn(USER.email, 'password1');
  http.expectOne('/api/auth/login').flush({ token: 't0k', expiresAt: '2099-01-01', user: USER });
  await login;
  await settle();
  http
    .expectOne('/api/workspaces')
    .flush([{ id: WS, name: 'Shop', posts7: 0, members: 1, role: 'owner' }]);
  await settle();
  answerWorkspaceLoads(http, data);
  await settle();
}

export function answerWorkspaceLoads(
  http: HttpTestingController,
  data: { posts?: ApiPost[]; errors?: ApiPost[]; simulatedOffline?: boolean } = {},
): void {
  const base = `/api/workspaces/${WS}`;
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
  for (const r of http.match(`${base}/engine`))
    r.flush({
      antiBan: {
        min: 3,
        max: 12,
        limits: { fb: 40, x: 20, ig: 10, tt: 5, line: 3, th: 10 },
        typing: true,
        scroll: true,
        shuffle: true,
        autoPause: true,
        warmup: false,
      },
      offline: { policy: 'queue', window: '2h', line: true, email: true, push: false },
      extensionOnline: !data.simulatedOffline,
      simulatedOffline: !!data.simulatedOffline,
      devices: 0,
      devicesOnline: 0,
    });
}

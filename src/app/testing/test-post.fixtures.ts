import { HttpTestingController } from '@angular/common/http/testing';
import {
  ApiAccount,
  ApiAntiBan,
  ApiBackup,
  ApiCollection,
  ApiDevice,
  ApiLinkSet,
  ApiPost,
} from '../core/http/api.service';
import { ACCOUNTS, WS, apiPost } from './api-testing';
import { apiCollection, apiCollectionPost } from './collection-fixtures';
import { FB_CONNECTED, apiLink, apiLinkSet, apiPageLink } from './link-sets.fixtures';

// Fixtures of the test post page, the anti-ban page's backup/restore and the device auto-pause specs.

export const POSTS_URL = `/api/workspaces/${WS}/posts`;
export const TEST_POST_URL = `/api/workspaces/${WS}/test-post`;
export const MANUAL_POST_URL = `/api/workspaces/${WS}/test-post/manual`;
export const BACKUP_URL = `/api/workspaces/${WS}/backup`;
export const RESTORE_URL = `/api/workspaces/${WS}/restore`;
export const ENGINE_URL = `/api/workspaces/${WS}/engine`;
export const ANTI_BAN_URL = `${ENGINE_URL}/anti-ban`;

/** The Facebook account a paired browser brought. */
export const FB: ApiAccount = FB_CONNECTED;

/** A link set with two usable groups (one coded), one switched off and one with a wrong address. */
export const TEST_SET: ApiLinkSet = apiLinkSet({
  id: 's1',
  name: 'Condo groups',
  links: [
    apiLink({ id: 'a', name: 'Condo BKK', code: '#Jan24' }),
    apiLink({ id: 'b', name: 'Condo rent', url: 'https://www.facebook.com/groups/rent' }),
    apiLink({ id: 'off', name: 'Closed group', enabled: false, health: 'off' }),
    apiLink({ id: 'bad', name: 'Not a group', url: 'https://example.com', valid: false }),
  ],
});

/** A link set of one group and one page, that posts as the account of a second browser (`device({ id: 'dev-2' ... })`). */
export const PAGE_SET: ApiLinkSet = apiLinkSet({
  id: 's2',
  name: 'Shop pages',
  postAsAccountId: 'acc-laptop',
  links: [
    apiLink({ id: 'g1', name: 'Shop group' }),
    apiPageLink({ id: 'baandee.shop', name: 'Baandee page' }),
  ],
});

/** The Facebook account a second browser brought. */
export const LAPTOP_ACCOUNT: ApiAccount = {
  ...FB_CONNECTED,
  id: 'acc-laptop',
  name: 'Facebook · Laptop',
  groups: [],
};

/** A second paired browser, the one `PAGE_SET` posts as. */
export function laptop(over: Partial<ApiDevice> = {}): ApiDevice {
  return device({ id: 'dev-2', name: 'Laptop', accountId: LAPTOP_ACCOUNT.id, ...over });
}

export const TEST_COLLECTION: ApiCollection = apiCollection({
  id: 'c1',
  name: 'Condo',
  settings: { footer: 'LINE @shop', hashtags: '#condo' },
  posts: [
    apiCollectionPost({
      id: 'p1',
      text: 'ขายคอนโด {{code}}',
      mediaIds: ['m1', 'm2'],
    }),
    apiCollectionPost({ id: 'p2', text: 'ห้องว่างให้เช่า' }),
  ],
});

/** A collection that asks for approval: only its approved post can be tested. */
export const APPROVAL_COLLECTION: ApiCollection = apiCollection({
  id: 'c2',
  name: 'Tickets',
  settings: { requireApproval: true },
  posts: [
    apiCollectionPost({ id: 't1', text: 'รออนุมัติ', approval: 'pending' }),
    apiCollectionPost({ id: 't2', text: 'อนุมัติแล้ว' }),
  ],
});

/** What POST test-post/manual answers: a queued test post to the typed address, due now. */
export function manualPostDto(over: Partial<ApiPost> = {}): ApiPost {
  return testPostDto({
    id: 'mp1',
    target: 'baandee shop',
    content: 'ทดสอบ',
    targetUrl: 'https://www.facebook.com/baandee.shop',
    linkId: null,
    code: null,
    ...over,
  });
}

/** What POST test-post answers: a queued test post, due now, on the Facebook account. */
export function testPostDto(over: Partial<ApiPost> = {}): ApiPost {
  return apiPost({
    id: 'tp1',
    accountId: FB.id,
    platform: 'fb',
    target: 'Condo BKK',
    content: '#Jan24\nขายคอนโด',
    scheduledAt: new Date().toISOString(),
    status: 'queued',
    isTest: true,
    linkId: 'a',
    code: '#Jan24',
    ...over,
  });
}

/** A paired browser; pass `autoPausedUntil` for one the engine paused itself. */
export function device(over: Partial<ApiDevice> = {}): ApiDevice {
  return {
    id: 'dev-1',
    name: 'Shop PC',
    browser: 'Chrome',
    version: '2.3.0',
    createdAt: '2026-10-01T00:00:00Z',
    lastSeenAt: new Date().toISOString(),
    online: true,
    accountId: FB.id,
    jobsPaused: false,
    autoPausedUntil: null,
    autoPauseReason: null,
    ...over,
  };
}

/** What GET engine answers for the anti-ban page (the `antiBan` part of the shared fixture, with changes). */
export function antiBan(over: Partial<ApiAntiBan> = {}): ApiAntiBan {
  return {
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
    ...over,
  };
}

/** A small backup file as GET backup answers it. */
export const BACKUP: ApiBackup = {
  version: 2,
  createdAt: '2026-10-04T00:00:00Z',
  collections: [],
  linkSets: [],
  schedules: [],
  antiBanAdvanced: antiBan().advanced,
  notificationRules: null,
  autoReply: null,
};

/**
 * Answers what the other stores ask for on events and timers (their lists, the presence) with what they
 * already hold, so a spec about one page is not about them. The posts calls are left to the spec. `over` changes
 * an answer by the last part of its address ("devices": the list a spec with several browsers works with).
 */
export function flushBackground(
  http: HttpTestingController,
  over: Record<string, object> = {},
): void {
  const answers: Record<string, object> = {
    accounts: [...ACCOUNTS, FB],
    'link-sets': [TEST_SET],
    collections: [TEST_COLLECTION, APPROVAL_COLLECTION],
    devices: [device()],
    engine: {
      antiBan: antiBan(),
      offline: { policy: 'queue', window: '2h', line: true, email: true, push: false },
      extensionOnline: true,
      simulatedOffline: false,
      devices: 1,
      devicesOnline: 1,
    },
    errors: [],
    ...over,
  };
  for (const r of http.match((x) => !x.url.startsWith(POSTS_URL) && x.method === 'GET')) {
    const key = r.request.url.split('/').pop()!;
    if (key in answers) r.flush(answers[key]);
  }
}

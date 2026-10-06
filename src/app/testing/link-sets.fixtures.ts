import { linkKindOf } from '../core/flow/group-links';
import { ApiAccount, ApiDevice, ApiLinkSet, ApiSetLink } from '../core/http/api.service';

// Fixtures of the link-set specs (store and page): rows as the API answers them.

export const SET_URL = (set: string) => `/api/workspaces/ws-1/link-sets/${set}`;

export function apiLink(over: Partial<ApiSetLink> & { id: string }): ApiSetLink {
  const url = over.url ?? `https://www.facebook.com/groups/${over.id}`;
  return {
    name: over.id,
    url,
    code: '',
    dailyMax: 0,
    enabled: true,
    health: 'ok',
    failStreak: 0,
    valid: true,
    duplicate: false,
    // The server tells a group from a page by the address ("group" while the address is not valid).
    kind: linkKindOf(url),
    ...over,
  };
}

export function apiLinkSet(over: Partial<ApiLinkSet> & { id: string }): ApiLinkSet {
  return {
    name: 'Condo groups',
    postAsAccountId: null,
    accountIds: [],
    links: [],
    scheduleCount: 0,
    active: true,
    ...over,
  };
}

/** A page link (a vanity address) as the API answers it. */
export function apiPageLink(over: Partial<ApiSetLink> & { id: string }): ApiSetLink {
  return apiLink({ url: `https://www.facebook.com/${over.id}`, ...over });
}

/** A Facebook account a paired browser brought (the API names it "Facebook · <browser>"). */
export const FB_CONNECTED: ApiAccount = {
  id: 'acc-fb',
  platform: 'fb',
  name: 'Facebook · Shop PC',
  handle: 'Facebook',
  defaultTarget: 'โปรไฟล์',
  health: 'ok',
  groups: ['Condo BKK'],
  connected: true,
};

/** A paired browser as the API lists it: the one that brought `FB_CONNECTED`. */
export function apiDevice(over: Partial<ApiDevice> = {}): ApiDevice {
  return {
    id: 'dev-1',
    name: 'Shop PC',
    browser: 'Chrome 130',
    version: '2.2.0',
    createdAt: '2026-10-01T00:00:00Z',
    lastSeenAt: '2026-10-04T08:00:00Z',
    online: true,
    accountId: FB_CONNECTED.id,
    jobsPaused: false,
    ...over,
  };
}

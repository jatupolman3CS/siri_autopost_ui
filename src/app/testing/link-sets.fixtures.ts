import { ApiAccount, ApiLinkSet, ApiSetLink } from '../core/http/api.service';

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
    ...over,
  };
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

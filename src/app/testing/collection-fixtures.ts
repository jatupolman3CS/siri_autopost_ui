import {
  ApiCollection,
  ApiCollectionPost,
  ApiCollectionSettings,
  ApiLinkSet,
  ApiSetLink,
} from '../core/http/api.service';

// Fixtures of the collection → link set → schedule flow for the specs of the collections page, the composer,
// the library and the stores behind them (the shared signIn() helper answers the list calls with them).

export const COLLECTION_SETTINGS: ApiCollectionSettings = {
  hashtags: '',
  pageTags: '',
  footer: '',
  footerPos: 'end',
  shuffle: true,
  watermark: false,
  watermarkPos: 'br',
  requireApproval: false,
};

export function apiCollectionPost(
  over: Partial<ApiCollectionPost> & { id: string; collectionId: string },
): ApiCollectionPost {
  return {
    text: 'โพสต์ ' + over.id,
    mediaIds: [],
    approval: 'approved',
    postedCount: 0,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...over,
  };
}

export function apiCollection(
  over: Partial<Omit<ApiCollection, 'settings'>> & {
    id: string;
    settings?: Partial<ApiCollectionSettings>;
  },
): ApiCollection {
  return {
    name: 'ชุด ' + over.id,
    description: '',
    icon: 'ph-folder',
    posts: [],
    scheduleCount: 0,
    ...over,
    settings: { ...COLLECTION_SETTINGS, ...over.settings },
  };
}

export function apiSetLink(over: Partial<ApiSetLink> & { id: string }): ApiSetLink {
  return {
    name: '',
    url: 'https://www.facebook.com/groups/' + over.id,
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
    name: 'Set ' + over.id,
    postAsAccountId: null,
    accountIds: [],
    links: [],
    scheduleCount: 0,
    ...over,
  };
}

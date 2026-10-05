import {
  ApiCollection,
  ApiCollectionPost,
  ApiCollectionSettings,
  ApiPostSettings,
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

/** A post that follows its collection in everything and has no schedule limits of its own. */
export const POST_SETTINGS: ApiPostSettings = {
  hashtags: null,
  footer: null,
  footerPos: null,
  validFrom: null,
  validUntil: null,
  weekdays: [],
  timeFrom: null,
  timeTo: null,
  maxPerDay: 0,
};

export function apiPostSettings(over: Partial<ApiPostSettings> = {}): ApiPostSettings {
  return { ...POST_SETTINGS, ...over };
}

/** A post of the library. `collectionIds` is filled in by apiCollection() for the collection that holds it. */
export function apiCollectionPost(
  over: Partial<Omit<ApiCollectionPost, 'settings'>> & {
    id: string;
    settings?: Partial<ApiPostSettings>;
  },
): ApiCollectionPost {
  return {
    text: 'โพสต์ ' + over.id,
    mediaIds: [],
    approval: 'approved',
    active: true,
    collectionIds: [],
    postedCount: 0,
    queuedCount: 0,
    failedCount: 0,
    lastPostedAt: null,
    nextAt: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...over,
    settings: apiPostSettings(over.settings),
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
    scheduleCount: 0,
    active: true,
    ...over,
    // The server lists the collections a post sits in on the post itself.
    posts: (over.posts ?? []).map((p) =>
      p.collectionIds.includes(over.id)
        ? p
        : { ...p, collectionIds: [...p.collectionIds, over.id] },
    ),
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
    active: true,
    ...over,
  };
}

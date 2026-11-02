// Domain types for the AutoPost dashboard. Bilingual values are [th, en] pairs.
export type L10n = readonly [string, string];

/** The Facebook platform key (the other social platforms are a later phase). */
export type PlatformKey = 'fb';
/**
 * What a post, an account or a link set can be for: Facebook groups and pages, or a LINE Official Account's customer
 * chats. `PlatformKey` stays 'fb'; everything that comes from the API
 * (posts, accounts, link set channels) uses this one.
 */
export type PostPlatform = PlatformKey | 'line';
export type PlanKey = 'free' | 'basic' | 'pro' | 'agency';
export type Role = 'guest' | 'user' | 'admin';
export type Health = 'ok' | 'warn' | 'relogin';
export type PostStatus =
  'success' | 'failed' | 'queued' | 'posting' | 'skipped' | 'pending' | 'waiting';
export type ErrorCode =
  'rate_limit' | 'session' | 'network' | 'pending_approval' | 'media_too_large' | 'quota';
export type CustomerStatus = 'active' | 'trial' | 'pastdue' | 'suspended' | 'banned';
export type TxType = 'charge' | 'refund' | 'failed';
export type DiscountKey = 'd10' | 'd20' | 'd30' | 'dFree';
export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface Platform {
  name: string;
  icon: string;
}

export interface Workspace {
  id: string;
  name: string;
  posts7: number;
  members: number;
  /** The signed-in user's role in it. */
  role: MemberRole;
  /** The owner's effective limits (plan with the admin's overrides), whoever works in the workspace; null = unlimited. */
  limits: Record<LimitKey, number | null>;
  /** The owner's plan includes the advanced anti-ban settings. */
  advancedAntiBan: boolean;
  /** The owner's plan includes Telegram / LINE OA notifications (Pro and above). */
  notifications: boolean;
  /** The owner's plan includes auto-reply rules (Pro and above). */
  autoReply: boolean;
  /** The owner's plan includes white-label client reports (Premium, key `agency`). */
  clientReports: boolean;
  /** The owner's plan includes the AI post writer (Pro and above). */
  ai: boolean;
  /** The owner's plan includes bumping posts (Premium, key `agency`). */
  bump: boolean;
  /** The owner's plan includes LINE Official Account customer chats (`line_chat`, Pro and above). */
  lineChat: boolean;
}

/**
 * An account the API lists: the Facebook account of each paired browser ("Facebook · <browser name>") and, when the
 * browser also drives a LINE Official Account, a second one ("LINE · <OA name>", platform 'line'). It keeps its
 * history when its browser is unbound, but cannot post until a browser is paired again.
 */
export interface SocialAccount {
  id: string;
  /** 'fb', or 'line' for the LINE Official Account a browser is logged in to. */
  platform: PostPlatform;
  name: string;
  handle: string;
  /** Where posts go when the account has no groups (its timeline). */
  defaultTarget: string;
  health: Health;
  /** Facebook groups the browser synced for this account. */
  groups: string[];
  /** Posts through a paired browser; false once that browser was unbound. */
  connected: boolean;
}

/**
 * What an account is: one a browser posts for (`connected`), or one whose browser was unbound (it keeps its
 * history but cannot post until a browser is paired again). Every account comes from a paired browser.
 */
export type AccountKind = 'connected' | 'unbound';

export function accountKind(a: Pick<SocialAccount, 'connected'>): AccountKind {
  return a.connected ? 'connected' : 'unbound';
}

export interface Target {
  a: string;
  p: PlatformKey;
  t: L10n;
}

export interface MediaItem {
  id: string;
  name: string;
  /** "image/png · 900 KB" */
  meta: string;
  kind: 'image' | 'video';
  used: number;
  /** The library folder the file is in; null/absent = no folder. */
  folderId?: string | null;
  /** Off = kept in the library but not offered for new posts; absent = on. */
  active?: boolean;
}

export interface MediaFolder {
  id: string;
  name: string;
}

export interface Snippet {
  id: string;
  title: string;
  text: string;
  used: number;
  /** Off = kept in the library but not offered for new posts; absent = on. */
  active?: boolean;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  /** Key into t.team (aNow, a2h, aYesterday, aInvited). */
  active: string;
  you?: boolean;
}

export interface Device {
  id: string;
  name: string;
  browser: string;
  /** Sample address of the computer (the design's account lines read "via X · browser · IP"). */
  ip: string;
  /** Key into t.team (seenNow, seenYesterday). */
  seen: string;
  isThis: boolean;
  icon: string;
}

/** The functions a plan can include (the keys of `features` in /api/plans); an unknown key is ignored. */
export type PlanFeature =
  | 'advanced_anti_ban'
  | 'notifications'
  | 'auto_reply'
  | 'ai'
  | 'bump'
  | 'client_reports'
  | 'line_chat';

/** In the order a plan card and the comparison table list them. */
export const PLAN_FEATURES: readonly PlanFeature[] = [
  'ai',
  'advanced_anti_ban',
  'notifications',
  'auto_reply',
  'line_chat',
  'bump',
  'client_reports',
];

export const isPlanFeature = (k: string): k is PlanFeature =>
  (PLAN_FEATURES as readonly string[]).includes(k);

/** A plan's price (baht per month), its seven numbers (null = unlimited) and the functions it includes. */
export interface PlanLimits extends Record<LimitKey, number | null> {
  price: number;
  features: PlanFeature[];
}

export interface CustomerDevice {
  id: string;
  n: string;
  b: string;
  /** Last call from the extension. */
  seen: Date | null;
  online: boolean;
  i: string;
}

export interface CustomerJobs {
  ok: number;
  failed: number;
  queued: number;
  running: number;
}

/** The seven numbers a plan limits (and an admin may override per customer). */
export type LimitKey =
  'accounts' | 'posts' | 'devices' | 'seats' | 'groups' | 'images' | 'libraryPosts';

/** What the admin edits on a plan (the functions it includes are fixed by the API). */
export type PlanField = 'price' | LimitKey;

/** In the order the plan cards, the comparison table and the billing page list them. */
export const LIMIT_KEYS: readonly LimitKey[] = [
  'groups',
  'images',
  'libraryPosts',
  'posts',
  'devices',
  'seats',
  'accounts',
];

export interface Customer {
  id: string;
  name: string;
  email: string;
  plan: PlanKey;
  status: CustomerStatus;
  /** [year, month0] */
  since: number[];
  cycle: 'month' | 'year';
  accounts: number;
  seats: number;
  ext: string;
  /** Last sign-in or extension call. */
  lastActive: Date | null;
  paused: boolean;
  jobs: CustomerJobs;
  devices: CustomerDevice[];
  note?: string;
  limits?: Partial<Record<LimitKey, number>>;
  workspaces?: number;
  /** Pays through a Stripe subscription (the admin cannot move its plan). */
  hasSubscription?: boolean;
  /** End of the current billing period; with cancelAtPeriodEnd, when the plan ends. */
  renewsAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
}

export interface Transaction {
  id: string;
  /** [year, month0, day] on the Bangkok calendar */
  date: number[];
  cust: string;
  type: TxType;
  amount: number;
  /** A charge paid at Stripe that has not been refunded yet. */
  refundable?: boolean;
  /** On a refund: the charge it gives back. */
  refundOf?: string | null;
  /** Stripe's hosted invoice page. */
  receiptUrl?: string | null;
}

export interface Promo {
  code: string;
  discount: DiscountKey;
  uses: number;
  /** [year, month0, day] on the Bangkok calendar */
  expires: number[];
  /** The instant it stops working (the server accepts the code until then). */
  expiresAt: Date;
  /** Switched on; an active code past `expiresAt` is expired. */
  active: boolean;
}

export type ScheduleMode = 'daily' | 'weekdays' | 'weekend' | 'interval' | 'drip' | 'once';

/** One scheduled or finished posting task (a queue item or an error report). */
export interface PostItem {
  id: string;
  dt: Date;
  accountId: string;
  platform: PostPlatform;
  target: string;
  text: string;
  mediaIds: string[];
  status: PostStatus;
  /** Why a failed or pending post did not go out. */
  code: ErrorCode | null;
  /** What the extension reported, when it did. */
  detail?: string | null;
  /** When it went out (success and approval-pending posts); counts toward the 24-hour limits. */
  publishedAt?: Date | null;
  /** The schedule that planned it; null for posts made by hand or by the extension. */
  scheduleId?: string | null;
  /** The collection post it was made from (the editable original of `text`). */
  collectionPostId?: string | null;
  /** The link-set link it goes to. */
  linkId?: string | null;
  /** The group address, when the link is known. */
  targetUrl?: string | null;
  /** The group code written before the content (not the failure `code`). */
  groupCode?: string | null;
  /** A one-off test post. */
  isTest?: boolean;
  /** Asked to post now (jumped the queue) and still waiting for its browser to take it. */
  rushed?: boolean;
  /** LINE chat posts: how many times the extension moved it later because the customer was mid-conversation. */
  deferCount?: number;
}

export interface ErrorItem extends PostItem {
  code: ErrorCode;
}

export const PLAN_ORDER: PlanKey[] = ['free', 'basic', 'pro', 'agency'];

export const STATUS_DOT: Record<PostStatus, string> = {
  success: 'var(--color-success)',
  failed: 'var(--color-danger)',
  queued: 'var(--color-text-muted)',
  posting: 'var(--color-primary)',
  skipped: 'var(--color-border)',
  pending: 'var(--color-warning)',
  waiting: 'var(--color-warning)',
};

export const HEALTH_DOT: Record<Health, string> = {
  ok: 'var(--color-success)',
  warn: 'var(--color-warning)',
  relogin: 'var(--color-danger)',
};

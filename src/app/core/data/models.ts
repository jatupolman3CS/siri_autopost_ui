// Domain types for the AutoPost dashboard. Bilingual values are [th, en] pairs.
export type L10n = readonly [string, string];

export type PlatformKey = 'fb' | 'x' | 'ig' | 'tt' | 'line' | 'th';
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
export type AgoKey = 'now' | 'h2' | 'yesterday' | 'd3' | 'd12';

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
  /** The owner's plan includes white-label client reports (Agency). */
  clientReports: boolean;
}

/** A connected social account (from the API). */
export interface SocialAccount {
  id: string;
  platform: PlatformKey;
  name: string;
  handle: string;
  /** Where posts go when the account has no groups (page, timeline, feed...). */
  defaultTarget: string;
  health: Health;
  /** Facebook groups this account posts to; empty for every other kind of account. */
  groups: string[];
  /** Posts through a paired browser; false for the sample accounts of a new workspace. */
  connected: boolean;
}

/** Prefix of the Facebook account a paired browser brings (SocialAccount.ForDevice in the API). */
const DEVICE_ACCOUNT_PREFIX = 'Facebook · ';

/**
 * What an account is: one a browser posts for (`connected`), one whose browser was unbound (it keeps its
 * history but cannot post until the browser is paired again), or a sample account of a new workspace.
 * The API has no flag for the difference, so an unbound account is told by the name it got from its browser.
 */
export type AccountKind = 'connected' | 'unbound' | 'sample';

export function accountKind(a: Pick<SocialAccount, 'connected' | 'name'>): AccountKind {
  if (a.connected) return 'connected';
  return a.name.startsWith(DEVICE_ACCOUNT_PREFIX) ? 'unbound' : 'sample';
}

/** Sample account in the design data (landing preview, admin mock). */
export interface SeedAccount {
  id: string;
  /** The sample device (SeedData.devices) the account posts through. */
  deviceId: string;
  platform: PlatformKey;
  name: string;
  handle: L10n;
  health: Health;
  hasGroups?: boolean;
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
}

export interface SeedMedia {
  id: string;
  label: L10n;
  meta: string;
  kind: 'image' | 'video';
  used: number;
}

export interface SeedSnippet {
  id: string;
  title: L10n;
  text: L10n;
  used: number;
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

export interface PlanLimits {
  accounts: number | null;
  posts: number | null;
  devices: number | null;
  seats: number | null;
  price: number;
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

/** Sample customer device in the design data. */
export interface SeedCustomerDevice {
  n: string;
  b: string;
  s: AgoKey;
  i: string;
}

export interface CustomerJobs {
  ok: number;
  failed: number;
  queued: number;
  running: number;
}

export type LimitKey = 'devices' | 'accounts' | 'posts' | 'seats';

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

/** Sample customer in the design data. */
export interface SeedCustomer extends Omit<Customer, 'lastActive' | 'devices'> {
  active: AgoKey;
  devices: SeedCustomerDevice[];
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

export interface SeedFailure {
  id: string;
  /** [year, month0, day, hour, minute] */
  dt: number[];
  accountId: string;
  platform: PlatformKey;
  target: L10n;
  cidx: number;
  code: ErrorCode;
}

export interface SeedCollection {
  id: string;
  name: L10n;
  /** Phosphor icon class. */
  icon: string;
}

/** One Facebook group of a link set. */
export interface SeedLink {
  /** https://www.facebook.com/groups/<slug> */
  url: string;
  name: string;
  /** Written before the post text in this group ("" = none). */
  code: string;
  enabled: boolean;
  /** Most posts a day to this group (0 = no limit). */
  dailyMax: number;
}

export interface SeedTargetSet {
  id: string;
  name: L10n;
  /** Other social accounts that post to the same set. */
  accounts: string[];
  links: SeedLink[];
}

export type ScheduleMode = 'daily' | 'weekdays' | 'weekend' | 'interval' | 'drip' | 'once';

export interface SeedSchedule {
  id: string;
  name: L10n;
  /** Collection id. */
  col: string;
  /** Link set id. */
  set: string;
  mode: ScheduleMode;
  /** HH:MM */
  times: string[];
  /** Interval mode: a round every N hours from `first`. */
  every: number;
  /** HH:MM of the first round. */
  first: string;
  /** YYYY-MM-DD */
  start: string;
  order: 'shuffle' | 'rotate';
  /** Group URL -> own HH:MM times (a group missing here follows the schedule). */
  overrides: Record<string, string[]>;
  active: boolean;
  // Set only by the schedule builder (no sample schedule uses these modes or options).
  /** Drip mode: the window and the number of posts per group per day. */
  dripFrom?: string;
  dripTo?: string;
  dripN?: number;
  /** Once mode: HH:MM of the single post (its date is `start`). */
  onceTime?: string;
  /** Bump after N hours and delete after N days (0 = off); saved only, nothing applies them yet. */
  bump?: number;
  del?: number;
}

export interface SeedPost {
  id: string;
  /** Collection id. */
  col: string;
  /** Media ids of the library. */
  media: string[];
  text: L10n;
}

export interface SeedMemberGroup {
  url: string;
  name: string;
  members: number;
  /** Joining needs the admins' approval, so a post waits there. */
  approval: boolean;
  last: 'ok' | 'pending' | 'failed';
}

export interface SeedArRule {
  id: string;
  /** Comma separated keywords. */
  keywords: string;
  reply: string;
  inbox: string;
  /** 'all', or the id of the one collection the rule applies to. */
  scope: string;
  on: boolean;
}

export interface SeedArFeedItem {
  who: string;
  text: string;
  group: string;
  /** HH:MM */
  time: string;
  /** The rule that matched, null = none. */
  rule: string | null;
}

export interface SeedData {
  user: { name: L10n; email: string; initials: string };
  workspaces: Omit<
    Workspace,
    'role' | 'limits' | 'advancedAntiBan' | 'notifications' | 'autoReply' | 'clientReports'
  >[];
  platforms: Record<PlatformKey, Platform>;
  groups: string[];
  /** Post collections ("ชุดโพสต์") of the three-step flow: collections, link sets, schedules. */
  collections: SeedCollection[];
  /** Link sets ("ชุดลิงก์กลุ่ม"): Facebook group links with a group code each. */
  targetSets: SeedTargetSet[];
  schedules: SeedSchedule[];
  accounts: SeedAccount[];
  targets: Target[];
  /** Library posts: each belongs to one collection and may carry media of the library. */
  posts: SeedPost[];
  failed: SeedFailure[];
  media: SeedMedia[];
  snippets: SeedSnippet[];
  limits: Record<PlatformKey, number>;
  usedToday: Record<PlatformKey, number>;
  /** Groups a social account is a member of, offered by "import groups from account". */
  memberGroups: SeedMemberGroup[];
  /** Auto-reply rules and the comment feed of the engage page. */
  arRules: SeedArRule[];
  arFeed: SeedArFeedItem[];
  members: Member[];
  devices: Device[];
  planLimits: Record<PlanKey, PlanLimits>;
  invoices: number[][];
  customers: SeedCustomer[];
  subs: Record<'basic' | 'pro' | 'agency', number>;
  transactions: Transaction[];
  /** [year, month0, amount] */
  revenue: number[][];
  promos: Omit<Promo, 'expiresAt'>[];
  health: { label: L10n; value: string; status: 'ok' | 'warn' }[];
  thMonths: string[];
  thMonthsFull: string[];
  enMonths: string[];
  enMonthsFull: string[];
  thDays: string[];
  enDays: string[];
}

/** One scheduled or finished posting task (a queue item or an error report). */
export interface PostItem {
  id: string;
  dt: Date;
  accountId: string;
  platform: PlatformKey;
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

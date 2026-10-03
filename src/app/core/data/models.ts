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

/** Sample account in the design data (landing preview, admin mock). */
export interface SeedAccount {
  id: string;
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
  active: AgoKey;
  paused: boolean;
  jobs: CustomerJobs;
  devices: CustomerDevice[];
  note?: string;
  limits?: Partial<Record<LimitKey, number>>;
}

export interface Transaction {
  id: string;
  /** [year, month0, day] */
  date: number[];
  cust: string;
  type: TxType;
  amount: number;
}

export interface Promo {
  code: string;
  discount: DiscountKey;
  uses: number;
  /** [year, month0, day] */
  expires: number[];
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

export interface SeedData {
  user: { name: L10n; email: string; initials: string };
  workspaces: Workspace[];
  platforms: Record<PlatformKey, Platform>;
  groups: string[];
  // Collections, target sets and schedules come from a later design iteration
  // that has no screens yet; they are kept for the next phase.
  collections: unknown[];
  targetSets: unknown[];
  schedules: unknown[];
  accounts: SeedAccount[];
  targets: Target[];
  posts: { id: string; col: string; media: string[]; text: L10n }[];
  failed: SeedFailure[];
  media: SeedMedia[];
  snippets: SeedSnippet[];
  limits: Record<PlatformKey, number>;
  usedToday: Record<PlatformKey, number>;
  members: Member[];
  devices: Device[];
  planLimits: Record<PlanKey, PlanLimits>;
  invoices: number[][];
  customers: Customer[];
  subs: Record<'basic' | 'pro' | 'agency', number>;
  transactions: Transaction[];
  /** [year, month0, amount] */
  revenue: number[][];
  promos: Promo[];
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

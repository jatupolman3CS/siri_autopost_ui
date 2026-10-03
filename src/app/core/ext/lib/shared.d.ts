// Types for shared.js, a byte-identical copy of the extension's client/lib/shared.js
// (settings defaults, migrateSettings, spintax, the post composer). Keep in step with it.

export type PostMode = 'random' | 'sequence';
export type FooterPosition = 'afterGreeting' | 'top' | 'end';
export type TypingSpeed = 'slow' | 'normal' | 'fast';

export interface CampaignConfig {
  postMode: PostMode;
  footer: string;
  footerPosition: FooterPosition;
  pageTags: string;
  groupDelayMin: number;
  groupDelayMax: number;
  roundIntervalHours: number;
  roundJitterMin: number;
  maxRounds: number;
  shuffleGroups: boolean;
  skipChancePct: number;
  typingSpeed: TypingSpeed;
  typos: boolean;
  maxTypeChars: number;
  browseBeforePost: boolean;
  longBreakEvery: number;
  longBreakMin: number;
  longBreakMax: number;
  recentAvoid: number;
  groupCooldownHours: number;
  shuffleImages: boolean;
  leadChancePct: number;
  activeHoursEnabled: boolean;
  activeStart: string;
  activeEnd: string;
}

export interface TelegramSettings {
  enabled: boolean;
  botToken: string;
  chatId: string;
  onSuccess: boolean;
  onFail: boolean;
  screenshot: boolean;
  roundSummary: boolean;
  onStartStop: boolean;
}

export interface GlobalSettings {
  focusWindow: boolean;
  minGapMin: number;
  dailyMaxPosts: number;
  blockPauseHoursMin: number;
  blockPauseHoursMax: number;
  failStreakPause: number;
  telegram: TelegramSettings;
}

/** text = the group's own text (first line, or where {{code}} is). dailyMax 0 = no limit. */
export interface CampaignGroup {
  url: string;
  name: string;
  text: string;
  enabled: boolean;
  dailyMax: number;
}

export interface CampaignPost {
  id: string;
  text: string;
  imageIds: string[];
  groupUrls: string[];
}

export interface Campaign {
  id: string;
  name: string;
  enabled: boolean;
  groups: CampaignGroup[];
  posts: CampaignPost[];
  leadImageIds: string[];
  config: CampaignConfig;
}

export interface Settings {
  version: 2;
  global: GlobalSettings;
  campaigns: Campaign[];
}

/** A stored media file: data is a data URL. */
export interface MediaRecord {
  name: string;
  type: string;
  data: string;
}

export interface ParsedGroup {
  url: string;
  name: string;
  text: string;
  enabled: boolean;
  note: string;
  dailyMax: number;
}

export interface PageTag {
  name: string;
  query: string;
}

export type TagPart = { text: string; tag?: undefined } | { tag: PageTag; text?: undefined };

export const DEFAULT_CONFIG: CampaignConfig;
export const DEFAULT_TELEGRAM: TelegramSettings;
export const DEFAULT_GLOBAL: GlobalSettings;
export const CODE_RE: RegExp;
export const TYPING_SPEEDS: Record<TypingSpeed, { min: number; max: number }>;
export const GROUP_DAILY_MAX_LIMIT: number;

export function rand(min: number, max: number): number;
export function randInt(min: number, max: number): number;
export function humanRand(min: number, max: number): number;
export function chance(pct: number): boolean;
export function shuffle<T>(arr: readonly T[]): T[];
export function pick<T>(arr: readonly T[]): T;
export function spin(text: string): string;
export function normalizeGroupUrl(raw: string): string | null;
export function parseGroups(text: string): { valid: string[]; invalid: string[] };
export function parseGroupList(text: string): { groups: ParsedGroup[]; invalid: string[] };
export function usablePosts(posts: CampaignPost[]): CampaignPost[];
export function isWithinActive(date: Date, start: string, end: string): boolean;
export function nextActiveStart(date: Date, start: string, end: string): number;
export function fmtDateTime(ts: number | null | undefined): string;
export function fmtDuration(ms: number): string;
export function uid(): string;
export function newPost(): CampaignPost;
export function newCampaign(n: number): Campaign;
export function campaignImageIds(c: Campaign): string[];
export function postMediaIds(c: Campaign, post: CampaignPost, randomize?: boolean): string[];
export function sanitizeLike<T extends object>(defaults: T, obj: unknown): T;
export function groupDailyMax(v: unknown): number;
export function migrateSettings(raw: unknown): Settings;
export function activeGroups(campaign: Campaign): { url: string; text: string; name: string }[];
export function postsForGroup(campaign: Campaign, url: string): CampaignPost[];
export function groupsWithoutPosts(
  campaign: Campaign,
): { url: string; text: string; name: string }[];
export function leadingCodes(text: string): string;
export const codeKey: (token: string) => string;
export function stripCodes(text: string, keys: Set<string>): { text: string; codes: string[] };
export function parsePageTags(raw: string): PageTag[];
export function splitPageTags(text: string, raw: string): TagPart[];
export function composeText(
  postText: string,
  groupText: string,
  footer?: string,
  position?: FooterPosition,
): string;
export function replaceInPosts(
  settings: Settings,
  pairs: [string, string][],
  campaignIds?: string[] | null,
): number;
export function campaignProblem(c: Campaign): string;

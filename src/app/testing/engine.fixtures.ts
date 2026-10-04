import {
  ApiAutoReply,
  ApiAutoReplyRule,
  ApiNotifications,
  ApiReport,
  ApiReportGroup,
  ApiSharedReport,
} from '../core/http/api.service';
import { NOTIFICATIONS, WS } from './api-testing';

// Fixtures of the notifications, auto-reply and report specs (stores and pages): bodies as the API answers them.

export const NOTIFY_URL = `/api/workspaces/${WS}/notifications`;
export const AUTO_REPLY_URL = `/api/workspaces/${WS}/auto-reply`;
export const REPORT_URL = `/api/workspaces/${WS}/reports`;
export const COLLECTIONS_URL = `/api/workspaces/${WS}/collections`;

/** GET notifications of a workspace with the defaults, with the fields in `over` changed. */
export function notifications(over: Partial<ApiNotifications> = {}): ApiNotifications {
  return { ...(NOTIFICATIONS as ApiNotifications), ...over };
}

/** Telegram set up (token stored, chat filled) and switched on. */
export const TELEGRAM_READY: Pick<ApiNotifications, 'telegram'> = {
  telegram: { on: true, token: null, hasToken: true, chatId: '-100123' },
};

export function autoReplyRule(over: Partial<ApiAutoReplyRule> & { id: string }): ApiAutoReplyRule {
  return {
    keywords: 'ราคา, how much',
    reply: 'ทักแชทได้เลยค่ะ',
    inbox: 'ราคา 1,290 บาท',
    scope: 'all',
    on: true,
    ...over,
  };
}

export function autoReply(over: Partial<ApiAutoReply> = {}): ApiAutoReply {
  return { on: false, rules: [], ...over };
}

export function reportGroup(over: Partial<ApiReportGroup> & { name: string }): ApiReportGroup {
  return {
    linkId: null,
    url: null,
    platform: 'fb',
    posted: 0,
    pending: 0,
    failed: 0,
    rate: 100,
    enabled: true,
    health: 'ok',
    ...over,
  };
}

export function report(over: Partial<ApiReport> = {}): ApiReport {
  return {
    days: 7,
    from: '2026-09-27T05:00:00Z',
    to: '2026-10-04T05:00:00Z',
    groups: [],
    posts: [],
    ...over,
  };
}

export function sharedReport(over: Partial<ApiSharedReport> = {}): ApiSharedReport {
  return {
    brand: 'Baan Dee Studio',
    workspaceName: 'Shop',
    logo: true,
    period: 'week',
    createdAt: '2026-10-04T05:00:00Z',
    expiresAt: '2026-11-03T05:00:00Z',
    report: report(),
    ...over,
  };
}

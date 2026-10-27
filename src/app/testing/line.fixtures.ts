import {
  ApiAccount,
  ApiDevice,
  ApiDeviceLine,
  ApiLineChat,
  ApiLineChatPage,
  ApiLineOa,
  ApiLinkSet,
  ApiSetLink,
} from '../core/http/api.service';
import { apiDevice } from './link-sets.fixtures';

// Fixtures of the LINE chat specs (stores and pages): customers, chat links, a chat link set, the LINE account of a
// browser and the device list entry that reports it. The API's shapes, nothing invented: a chat link has `kind` 'chat'
// and the customer's name as its name, and its address is `https://chat.line.biz/<botId>/chat/<userId>`.

/** The Official Account's bot id (assumption A1 of the LINE spec: 5 to 64 letters, digits, `_` or `-`). */
export const LINE_BOT = 'Ubot0001';

/** The chat address of a customer; the user id is made at least 10 characters long, as the API needs. */
export const lineChatUrl = (key: string): string =>
  `https://chat.line.biz/${LINE_BOT}/chat/${('u' + key).padEnd(12, '0')}`;

/** One customer of the roster as `GET line/chats` answers it. */
export function apiLineChat(over: Partial<ApiLineChat> & { id: string }): ApiLineChat {
  return {
    accountId: 'acc-line',
    name: `ลูกค้า ${over.id}`,
    url: lineChatUrl(over.id),
    labels: [],
    lastMessageAt: null,
    unread: false,
    doNotSend: false,
    linkedSetCount: 0,
    ...over,
  };
}

/** A page of the roster as the API answers it (the accounts default to the one LINE account, ready). */
export function apiLineChatPage(
  items: ApiLineChat[],
  over: Partial<ApiLineChatPage> = {},
): ApiLineChatPage {
  return {
    items,
    total: items.length,
    labels: [],
    accounts: [{ id: 'acc-line', name: 'LINE · Shop OA', deviceId: 'dev-1', ready: true }],
    ...over,
  };
}

/** The LINE Official Account of the browser `FB_CONNECTED` belongs to (named "LINE · <OA name>" by the API). */
export const LINE_CONNECTED: ApiAccount = {
  id: 'acc-line',
  platform: 'line',
  name: 'LINE · Shop OA',
  handle: LINE_BOT,
  defaultTarget: 'แชท LINE',
  health: 'ok',
  groups: [],
  connected: true,
};

/** What `GET devices` says of a browser's LINE account (ready, 3 chats synced, not resting, logged in). */
export function apiDeviceLine(over: Partial<ApiDeviceLine> = {}): ApiDeviceLine {
  return {
    accountId: LINE_CONNECTED.id,
    name: LINE_CONNECTED.name,
    handle: LINE_BOT,
    botId: LINE_BOT,
    ready: true,
    readyAt: '2026-10-04T08:00:00Z',
    restUntil: null,
    syncedAt: '2026-10-04T07:00:00Z',
    chatCount: 3,
    sessionLost: false,
    ...over,
  };
}

/** A paired browser that also drives a LINE Official Account. */
export function apiLineDevice(over: Partial<ApiDevice> = {}, line: Partial<ApiDeviceLine> = {}) {
  return apiDevice({ line: apiDeviceLine(line), ...over });
}

/** A link of a chat set: the customer's name and chat address (the API flags it valid and kind 'chat'). */
export function apiChatLink(over: Partial<ApiSetLink> & { id: string }): ApiSetLink {
  return {
    name: `ลูกค้า ${over.id}`,
    url: lineChatUrl(over.id),
    code: '',
    dailyMax: 0,
    enabled: true,
    health: 'ok',
    failStreak: 0,
    valid: true,
    duplicate: false,
    kind: 'chat',
    channel: 'line',
    ...over,
  };
}

/** A LINE link set: one chat per customer per day by default, posted by the LINE account of a browser. */
export function apiLineSet(over: Partial<ApiLinkSet> & { id: string }): ApiLinkSet {
  return {
    name: 'ลูกค้าประจำ',
    postAsAccountId: LINE_CONNECTED.id,
    accountIds: [],
    links: [],
    scheduleCount: 0,
    active: true,
    randomOrder: true,
    dailyPerGroup: 1,
    channel: 'line',
    ...over,
  };
}

/** One Official Account of the master list as `GET line/oas` answers it (read by a browser, ready, no customers yet). */
export function apiLineOa(over: Partial<ApiLineOa> = {}): ApiLineOa {
  return {
    id: 'acc-line',
    name: 'LINE · Shop OA',
    botId: LINE_BOT,
    url: `https://chat.line.biz/${LINE_BOT}`,
    deviceId: 'dev-1',
    deviceName: 'Shop PC',
    deviceOnline: true,
    ready: true,
    chats: 0,
    syncedAt: null,
    sessionLost: false,
    linkSetCount: 0,
    ...over,
  };
}

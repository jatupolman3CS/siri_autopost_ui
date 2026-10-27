import {
  channelOf,
  chatLabel,
  duplicateChatFlags,
  duplicateFlagsFor,
  lineChatKey,
  lineChatTarget,
  linkUrlKey,
  normalizeChatUrl,
  normalizeLinkUrl,
} from './line-chats';

// The vectors are the ones of the server's LineChatUrlTests (backend tests/SIRIAUTOPOST.Domain.Tests): the web, the
// API and the extension must answer the same for the same text.
const CANON = 'https://chat.line.biz/U12345678/chat/c123456789012345';

describe('lineChatTarget (mirror of LineChatUrl)', () => {
  it.each([
    [CANON, CANON],
    ['http://chat.line.biz/U12345678/chat/c123456789012345', CANON],
    ['chat.line.biz/U12345678/chat/c123456789012345', CANON],
    ['https://www.chat.line.biz/U12345678/chat/c123456789012345', CANON],
    ['  https://chat.line.biz/U12345678/chat/c123456789012345/  ', CANON],
    ['https://chat.line.biz/U12345678/chat/c123456789012345?query=1#tab', CANON],
  ])('normalizes %s', (raw, expected) => {
    expect(lineChatTarget(raw)?.url).toBe(expected);
    expect(normalizeChatUrl(raw)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    '',
    '   ',
    'https://chat.line.biz/',
    'https://chat.line.biz/bot123',
    'https://chat.line.biz/bot123/chat',
    'https://chat.line.biz/bot123/chat/short',
    'https://other.line.biz/bot123/chat/c123456789012345',
    'https://manager.line.biz/U12345678/chat/c123456789012345',
    'https://facebook.com/groups/baandee',
  ])('refuses %s', (raw) => {
    expect(lineChatTarget(raw)).toBeNull();
    expect(normalizeChatUrl(raw)).toBe('');
  });

  it('extracts the bot id and the user id and keeps the typed case', () => {
    expect(lineChatTarget('https://chat.line.biz/myBot_01/chat/user_1234567890')).toEqual({
      botId: 'myBot_01',
      userId: 'user_1234567890',
      url: 'https://chat.line.biz/myBot_01/chat/user_1234567890',
    });
  });

  it('compares without regard to case, as the server does', () => {
    const a = 'https://chat.line.biz/MYBOT/chat/USER1234567890';
    const b = 'chat.line.biz/mybot/chat/user1234567890/';
    expect(lineChatKey(a)).toBe(lineChatKey(b));
    expect(lineChatKey(a)).not.toBe('');
    expect(lineChatKey('nope')).toBe('');
  });

  it('accepts the id lengths the server accepts and no others (bot 5-64, user 10-64)', () => {
    const ok = (bot: number, user: number) =>
      lineChatTarget(`chat.line.biz/${'b'.repeat(bot)}/chat/${'u'.repeat(user)}`) !== null;
    expect(ok(5, 10)).toBe(true);
    expect(ok(64, 64)).toBe(true);
    expect(ok(4, 10)).toBe(false);
    expect(ok(5, 9)).toBe(false);
    expect(ok(65, 10)).toBe(false);
    expect(ok(5, 65)).toBe(false);
  });
});

describe('chat rows', () => {
  it('calls a row by the customer name, else by the fallback the caller takes from the dictionary', () => {
    expect(chatLabel({ name: ' สมชาย ', url: CANON }, 'ลูกค้า')).toBe('สมชาย');
    expect(chatLabel({ name: '  ', url: CANON }, 'ลูกค้า')).toBe('ลูกค้า');
    expect(chatLabel({ url: CANON })).toBe('');
  });

  it('flags the second row of the same chat (case and spelling do not matter), not the first', () => {
    const rows = [
      { url: CANON },
      { url: 'https://chat.line.biz/U99999999/chat/c999999999999999' },
      { url: 'chat.line.biz/u12345678/chat/C123456789012345/' },
      { url: 'not a chat' },
      { url: 'not a chat' },
    ];
    expect(duplicateChatFlags(rows)).toEqual([false, false, true, false, false]);
  });
});

describe('by channel', () => {
  it('reads a missing channel (a server that predates chats) as Facebook', () => {
    expect(channelOf({})).toBe('fb');
    expect(channelOf(null)).toBe('fb');
    expect(channelOf({ channel: 'fb' })).toBe('fb');
    expect(channelOf({ channel: 'line' })).toBe('line');
  });

  it('normalizes and compares an address by the parser of its channel', () => {
    expect(normalizeLinkUrl('line', CANON)).toBe(CANON);
    expect(normalizeLinkUrl('line', 'https://www.facebook.com/groups/abc')).toBe('');
    expect(normalizeLinkUrl('fb', 'facebook.com/groups/ABC')).toBe(
      'https://www.facebook.com/groups/ABC',
    );
    expect(normalizeLinkUrl('fb', CANON)).toBe('');
    expect(linkUrlKey('fb', 'facebook.com/groups/ABC')).toBe('https://www.facebook.com/groups/abc');
    expect(linkUrlKey('line', CANON.toUpperCase().replace('HTTPS', 'https'))).toBe(
      CANON.toLowerCase(),
    );
  });

  it('flags duplicates with the parser of the channel', () => {
    const chats = [{ url: CANON }, { url: CANON.toLowerCase() }];
    expect(duplicateFlagsFor('line', chats)).toEqual([false, true]);
    // The Facebook parser does not know a chat address, so nothing is "the same" there.
    expect(duplicateFlagsFor('fb', chats)).toEqual([false, false]);
  });
});

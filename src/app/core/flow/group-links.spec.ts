import {
  defaultLinkName,
  duplicateUrlFlags,
  facebookTarget,
  groupSlug,
  groupUrlKey,
  isDuplicateUrl,
  linkKindOf,
  linkLabel,
  linksToCsv,
  normalizeGroupUrl,
  parseBulkLinks,
  parseLinkCsv,
  postsToCsv,
  previewBulkImport,
  previewCsvImport,
} from './group-links';

const G = 'https://www.facebook.com/groups/';
const FB = 'https://www.facebook.com/';

describe('normalizeGroupUrl', () => {
  it.each([
    ['https://www.facebook.com/groups/abc', G + 'abc'],
    ['http://facebook.com/groups/abc', G + 'abc'],
    ['facebook.com/groups/abc', G + 'abc'],
    ['www.facebook.com/groups/abc', G + 'abc'],
    ['https://m.facebook.com/groups/abc', G + 'abc'],
    ['https://web.facebook.com/groups/abc', G + 'abc'],
    ['https://mbasic.facebook.com/groups/abc', G + 'abc'],
    ['https://fb.com/groups/abc', G + 'abc'],
    ['HTTPS://WWW.FACEBOOK.COM/GROUPS/Abc', G + 'Abc'],
    ['  https://www.facebook.com/groups/abc  ', G + 'abc'],
    ['https://www.facebook.com/groups/123456789012345', G + '123456789012345'],
    ['https://www.facebook.com/groups/my.group_name-1', G + 'my.group_name-1'],
  ])('%s', (raw, expected) => {
    expect(normalizeGroupUrl(raw)).toBe(expected);
  });

  it('drops the trailing path, query and fragment', () => {
    expect(normalizeGroupUrl('https://www.facebook.com/groups/abc/')).toBe(G + 'abc');
    expect(normalizeGroupUrl('https://www.facebook.com/groups/abc/posts/123')).toBe(G + 'abc');
    expect(normalizeGroupUrl('https://www.facebook.com/groups/abc?ref=share')).toBe(G + 'abc');
    expect(normalizeGroupUrl('https://www.facebook.com/groups/abc#x')).toBe(G + 'abc');
  });

  // Neither a group nor a page (the server's FacebookGroupUrlTests): a vanity page name needs 5 or more letters,
  // digits or dots with a letter among them, and Facebook's own screens (watch, marketplace, login...) are no page.
  it.each([
    '',
    '   ',
    'abc',
    'https://example.com/groups/abc',
    'https://www.facebook.com/',
    'https://www.facebook.com/abc',
    'https://www.facebook.com/12345678',
    'https://www.facebook.com/watch/',
    'https://www.facebook.com/marketplace/item/123',
    'https://www.facebook.com/login.php',
    'https://www.facebook.com/pages/abc',
    'https://www.facebook.com/groups',
    'https://www.facebook.com/groups/',
    'https://www.facebook.com/groups/?x=1',
    'https://www.facebook.com/groups/.',
    'https://www.facebook.com/groups/..',
    'https://www.facebook.com/groups/_-',
    'https://notfacebook.com/baandee.shop',
    'https://l.facebook.com/groups/abc',
    'https://evilfacebook.com/groups/abc',
    'https://facebook.com.evil.com/groups/abc',
    'see https://www.facebook.com/groups/abc',
    'กลุ่ม',
  ])('is empty for %j', (raw) => {
    expect(normalizeGroupUrl(raw)).toBe('');
  });

  it('is empty for null and undefined', () => {
    expect(normalizeGroupUrl(null)).toBe('');
    expect(normalizeGroupUrl(undefined)).toBe('');
  });

  it('stops the slug at the first character a slug cannot hold', () => {
    expect(normalizeGroupUrl('https://www.facebook.com/groups/abc กลุ่ม')).toBe(G + 'abc');
  });
});

describe('Facebook pages', () => {
  it.each([
    ['https://www.facebook.com/baandee.shop', FB + 'baandee.shop', 'baandee.shop'],
    ['facebook.com/KHRUSIRI/', FB + 'KHRUSIRI', 'KHRUSIRI'],
    ['https://m.facebook.com/KHRUSIRI?ref=page_internal', FB + 'KHRUSIRI', 'KHRUSIRI'],
    ['fb.com/baandee#about', FB + 'baandee', 'baandee'],
    [
      'https://web.facebook.com/profile.php?id=100012345678901',
      FB + 'profile.php?id=100012345678901',
      '100012345678901',
    ],
    [
      'https://www.facebook.com/profile.php?ref=x&id=100012345678901',
      FB + 'profile.php?id=100012345678901',
      '100012345678901',
    ],
    [
      'https://www.facebook.com/pages/Baan-Dee/123456789',
      FB + 'pages/Baan-Dee/123456789',
      'Baan-Dee',
    ],
    [
      'https://www.facebook.com/p/Baan-Dee-100012345678901/',
      FB + 'p/Baan-Dee-100012345678901',
      'Baan-Dee-100012345678901',
    ],
  ])('%s is a page', (raw, url, slug) => {
    expect(normalizeGroupUrl(raw)).toBe(url);
    expect(facebookTarget(raw)).toEqual({ kind: 'page', slug, url });
    expect(linkKindOf(raw)).toBe('page');
  });

  it('keeps a page name as typed and compares addresses without regard to case', () => {
    expect(normalizeGroupUrl('FB.com/BaanDee.Shop')).toBe(FB + 'BaanDee.Shop');
    expect(groupUrlKey('FB.com/BaanDee.Shop')).toBe(
      groupUrlKey('https://m.facebook.com/baandee.shop/'),
    );
  });

  it('wants 5 or more characters with a letter for a vanity name', () => {
    expect(normalizeGroupUrl('facebook.com/abcd')).toBe('');
    expect(normalizeGroupUrl('facebook.com/abcde')).toBe(FB + 'abcde');
    expect(normalizeGroupUrl('facebook.com/12345.6789')).toBe('');
    expect(normalizeGroupUrl('facebook.com/1234a')).toBe(FB + '1234a');
  });

  it('refuses Facebook screens that look like a page name', () => {
    for (const screen of ['watch', 'marketplace', 'events', 'login', 'groups', 'reels', 'settings'])
      expect(normalizeGroupUrl('facebook.com/' + screen + '/'), screen).toBe('');
    expect(normalizeGroupUrl('facebook.com/Marketplace')).toBe('');
    expect(normalizeGroupUrl('facebook.com/photo.php?fbid=123456')).toBe('');
    expect(normalizeGroupUrl('facebook.com/profile.php?id=123')).toBe('');
    expect(normalizeGroupUrl('facebook.com/profile.php')).toBe('');
  });

  it('is a group when the address says groups, a page otherwise', () => {
    expect(linkKindOf(G + 'baandee')).toBe('group');
    expect(linkKindOf(FB + 'baandee')).toBe('page');
    expect(facebookTarget(G + 'baandee')).toEqual({
      kind: 'group',
      slug: 'baandee',
      url: G + 'baandee',
    });
    // An address that is neither counts as a group, as the server's kind does while an address is not valid.
    expect(linkKindOf('https://example.com/baandee')).toBe('group');
    expect(linkKindOf('')).toBe('group');
    expect(facebookTarget('https://example.com/baandee')).toBeNull();
    expect(facebookTarget(null)).toBeNull();
  });

  it('names a page from its address like a group', () => {
    expect(groupSlug(FB + 'baandee.shop')).toBe('baandee.shop');
    expect(groupSlug(FB + 'pages/Baan-Dee/123456789')).toBe('Baan-Dee');
    expect(linkLabel({ name: '', url: FB + 'pages/Baan-Dee/123456789' })).toBe('Baan-Dee');
    expect(defaultLinkName(FB + 'baandee.shop')).toBe('baandee shop');
    expect(defaultLinkName(FB + 'p/Baan-Dee-100012345678901')).toBe('Baan Dee 100012345678901');
    expect(defaultLinkName(FB + 'profile.php?id=100012345678901')).toBe('100012345678901');
  });

  it('reads pages in pasted lines and in a CSV, next to groups', () => {
    const r = parseBulkLinks(
      [
        'facebook.com/groups/shop.th | A1',
        'https://www.facebook.com/baandee.shop | P1',
        'facebook.com/watch',
        'https://www.facebook.com/profile.php?id=100012345678901',
      ].join('\n'),
    );
    expect(r.invalid).toEqual(['facebook.com/watch']);
    expect(r.links).toEqual([
      { url: G + 'shop.th', name: 'shop th', code: 'A1' },
      { url: FB + 'baandee.shop', name: 'baandee shop', code: 'P1' },
      { url: FB + 'profile.php?id=100012345678901', name: '100012345678901', code: '' },
    ]);
    const csv = parseLinkCsv(
      [
        'A,Shop page,https://m.facebook.com/baandee.shop/,P1',
        'A,Group,facebook.com/groups/g1,',
        'A,Screen,facebook.com/marketplace,',
      ].join('\n'),
    );
    expect(csv.invalid).toBe(1);
    expect(csv.rows.map((x) => x.url)).toEqual([FB + 'baandee.shop', G + 'g1']);
  });

  it('flags a repeated page address and exports pages like groups', () => {
    expect(
      duplicateUrlFlags([
        { url: FB + 'baandee.shop' },
        { url: 'FB.com/BaanDee.shop/' },
        { url: G + 'a' },
      ]),
    ).toEqual([false, true, false]);
    const csv = linksToCsv([
      {
        name: 'Set',
        links: [{ name: 'Shop', url: FB + 'baandee.shop', code: '', enabled: true, dailyMax: 1 }],
      },
    ]);
    expect(parseLinkCsv(csv).rows).toEqual([
      { set: 'Set', name: 'Shop', url: FB + 'baandee.shop', code: '' },
    ]);
  });
});

describe('groupSlug / linkLabel / defaultLinkName', () => {
  it('reads the text after groups/', () => {
    expect(groupSlug(G + 'abc')).toBe('abc');
    expect(groupSlug('https://www.facebook.com/groups/abc/posts/1')).toBe('abc');
    expect(groupSlug('https://www.facebook.com/groups/abc?x=1')).toBe('abc');
  });

  it('falls back to the text itself', () => {
    expect(groupSlug('not a url')).toBe('not a url');
    expect(groupSlug('')).toBe('');
    expect(groupSlug(null)).toBe('');
    expect(groupSlug(undefined)).toBe('');
  });

  it('labels a link by its trimmed name, else by its slug', () => {
    expect(linkLabel({ name: '  ขายของ  ', url: G + 'abc' })).toBe('ขายของ');
    expect(linkLabel({ name: '', url: G + 'abc' })).toBe('abc');
    expect(linkLabel({ name: '   ', url: G + 'abc' })).toBe('abc');
    expect(linkLabel({ url: G + 'abc' })).toBe('abc');
    expect(linkLabel({ name: null, url: null })).toBe('');
  });

  it('derives a name from the slug', () => {
    expect(defaultLinkName(G + 'my.group_name-1')).toBe('my group name 1');
    expect(defaultLinkName(G + 'a..b__c--d')).toBe('a b c d');
    expect(defaultLinkName(G + '123')).toBe('123');
  });
});

describe('parseBulkLinks', () => {
  it('reads url | code lines and names the link from the slug', () => {
    const r = parseBulkLinks(
      'https://www.facebook.com/groups/shop.th | A1\nfacebook.com/groups/second_hand|B 2\n',
    );
    expect(r.invalid).toEqual([]);
    expect(r.links).toEqual([
      { url: G + 'shop.th', name: 'shop th', code: 'A1' },
      { url: G + 'second_hand', name: 'second hand', code: 'B 2' },
    ]);
  });

  it('takes the code as empty when missing', () => {
    expect(parseBulkLinks('facebook.com/groups/a').links[0].code).toBe('');
    expect(parseBulkLinks('facebook.com/groups/a |').links[0].code).toBe('');
  });

  it('skips blank lines and handles CRLF', () => {
    const r = parseBulkLinks('\r\nfacebook.com/groups/a\r\n   \r\n\r\nfacebook.com/groups/b\r\n');
    expect(r.links.map((l) => l.url)).toEqual([G + 'a', G + 'b']);
    expect(r.invalid).toEqual([]);
  });

  it('collects lines that are neither a group nor a page address, trimmed', () => {
    const r = parseBulkLinks(
      '  hello world  \nfacebook.com/groups/a | X\nhttps://example.com/x | Y',
    );
    expect(r.links).toHaveLength(1);
    expect(r.invalid).toEqual(['hello world', 'https://example.com/x | Y']);
  });

  it('ignores text after a second pipe', () => {
    expect(parseBulkLinks('facebook.com/groups/a | X | Y').links[0].code).toBe('X');
  });

  it('keeps repeated addresses (the server decides what is a duplicate)', () => {
    expect(
      parseBulkLinks('facebook.com/groups/a\nhttps://m.facebook.com/groups/a/').links,
    ).toHaveLength(2);
  });

  it('keeps Thai codes', () => {
    expect(parseBulkLinks('facebook.com/groups/a | รหัส ก1').links[0].code).toBe('รหัส ก1');
  });

  it('is empty for empty input', () => {
    expect(parseBulkLinks('')).toEqual({ links: [], invalid: [] });
    expect(parseBulkLinks(null)).toEqual({ links: [], invalid: [] });
    expect(parseBulkLinks(undefined)).toEqual({ links: [], invalid: [] });
  });
});

describe('isDuplicateUrl / duplicateUrlFlags', () => {
  const links = [
    { url: G + 'a' },
    { url: 'https://m.facebook.com/groups/b/' },
    { url: 'broken' },
    { url: 'also broken' },
  ];

  it('compares normalized addresses', () => {
    expect(isDuplicateUrl(links, 'facebook.com/groups/a')).toBe(true);
    expect(isDuplicateUrl(links, G + 'b')).toBe(true);
    expect(isDuplicateUrl(links, G + 'c')).toBe(false);
  });

  it('never treats an invalid or empty address as a duplicate', () => {
    expect(isDuplicateUrl(links, 'broken')).toBe(false);
    expect(isDuplicateUrl(links, '')).toBe(false);
    expect(isDuplicateUrl(links, null)).toBe(false);
  });

  it('can leave the row being edited out', () => {
    expect(isDuplicateUrl(links, G + 'a', 0)).toBe(false);
    expect(isDuplicateUrl([...links, { url: G + 'a' }], G + 'a', 0)).toBe(true);
  });

  it('flags every row after the first with the same address', () => {
    expect(
      duplicateUrlFlags([
        { url: G + 'a' },
        { url: G + 'b' },
        { url: 'facebook.com/groups/a' },
        { url: G + 'a' },
      ]),
    ).toEqual([false, false, true, true]);
    expect(duplicateUrlFlags(links)).toEqual([false, false, false, false]);
    expect(duplicateUrlFlags([])).toEqual([]);
  });
});

describe('previewBulkImport', () => {
  const parsed = (text: string) => parseBulkLinks(text).links;

  it('counts new addresses', () => {
    expect(previewBulkImport([], parsed('facebook.com/groups/a\nfacebook.com/groups/b'))).toEqual({
      added: 2,
      duplicates: 0,
      recoded: 0,
    });
  });

  it('counts an address already in the set as a duplicate and a different non-empty code as recoded', () => {
    const existing = [
      { url: G + 'a', code: 'X' },
      { url: G + 'b', code: '' },
      { url: G + 'c', code: 'Z' },
    ];
    const text =
      'facebook.com/groups/a | Y\nfacebook.com/groups/b | N\nfacebook.com/groups/c | Z\nfacebook.com/groups/d';
    expect(previewBulkImport(existing, parsed(text))).toEqual({
      added: 1,
      duplicates: 3,
      recoded: 2,
    });
  });

  it('does not recode with an empty code', () => {
    expect(
      previewBulkImport([{ url: G + 'a', code: 'X' }], parsed('facebook.com/groups/a')),
    ).toEqual({
      added: 0,
      duplicates: 1,
      recoded: 0,
    });
  });

  it('treats a repeat inside the pasted text as a duplicate of the first, comparing with the latest code', () => {
    expect(
      previewBulkImport(
        [],
        parsed('facebook.com/groups/a | A\nfacebook.com/groups/a | B\nfacebook.com/groups/a | B'),
      ),
    ).toEqual({ added: 1, duplicates: 2, recoded: 1 });
  });

  it('matches existing rows by their normalized address and ignores invalid ones', () => {
    const existing = [
      { url: 'https://m.facebook.com/groups/a/', code: null },
      { url: 'broken' },
      {},
    ];
    expect(previewBulkImport(existing, parsed('facebook.com/groups/a | N'))).toEqual({
      added: 0,
      duplicates: 1,
      recoded: 1,
    });
  });

  it('is zero for nothing pasted', () => {
    expect(previewBulkImport([{ url: G + 'a' }], [])).toEqual({
      added: 0,
      duplicates: 0,
      recoded: 0,
    });
  });
});

describe('parseLinkCsv', () => {
  it('reads comma separated rows and normalizes the address', () => {
    const r = parseLinkCsv(
      'ชุด A,ขายของ,https://m.facebook.com/groups/abc/,CODE1\nชุด B,,facebook.com/groups/xyz,',
    );
    expect(r.invalid).toBe(0);
    expect(r.rows).toEqual([
      { set: 'ชุด A', name: 'ขายของ', url: G + 'abc', code: 'CODE1' },
      { set: 'ชุด B', name: '', url: G + 'xyz', code: '' },
    ]);
  });

  it('reads tab separated rows pasted from a spreadsheet', () => {
    const r = parseLinkCsv('A\tname\tfacebook.com/groups/abc\tC1');
    expect(r.rows).toEqual([{ set: 'A', name: 'name', url: G + 'abc', code: 'C1' }]);
  });

  it('skips the header line, in any case, and a BOM', () => {
    const r = parseLinkCsv(
      '\ufeffSet,Name,URL,code,enabled,dailyMax\nA,n,facebook.com/groups/abc,,1,0',
    );
    expect(r.rows).toHaveLength(1);
    expect(r.invalid).toBe(0);
  });

  it('only skips a header that is the first record', () => {
    const r = parseLinkCsv('A,n,facebook.com/groups/abc\nset,name,url');
    expect(r.rows).toHaveLength(1);
    expect(r.invalid).toBe(1);
  });

  it('handles quoted cells', () => {
    const r = parseLinkCsv('"Set, one","Name ""x""",facebook.com/groups/abc,"A,B"');
    expect(r.rows).toEqual([{ set: 'Set, one', name: 'Name "x"', url: G + 'abc', code: 'A,B' }]);
  });

  it('counts records with fewer than 3 columns, an invalid address or no set name as invalid', () => {
    const r = parseLinkCsv(
      [
        'A,name',
        'A,name,not a url',
        ',name,facebook.com/groups/abc',
        'A,n,facebook.com/groups/ok',
      ].join('\n'),
    );
    expect(r.rows).toHaveLength(1);
    expect(r.invalid).toBe(3);
  });

  it('keeps repeated rows for the server to skip', () => {
    expect(parseLinkCsv('A,n,facebook.com/groups/a\nA,m,facebook.com/groups/a').rows).toHaveLength(
      2,
    );
  });

  it('ignores blank lines and extra columns', () => {
    const r = parseLinkCsv('\n\nA,n,facebook.com/groups/a,C,1,5,extra\n\n');
    expect(r.rows).toEqual([{ set: 'A', name: 'n', url: G + 'a', code: 'C' }]);
    expect(r.invalid).toBe(0);
  });

  it('is empty for empty input', () => {
    expect(parseLinkCsv('')).toEqual({ rows: [], invalid: 0 });
    expect(parseLinkCsv(null)).toEqual({ rows: [], invalid: 0 });
  });

  it('reads back what linksToCsv writes', () => {
    const csv = linksToCsv([
      {
        name: 'ชุด "หนึ่ง", ใหญ่',
        links: [
          { name: 'ร้าน, A', url: G + 'a', code: 'ก1', enabled: true, dailyMax: 0 },
          { name: '', url: G + 'b', code: '', enabled: false, dailyMax: 3 },
        ],
      },
    ]);
    const r = parseLinkCsv(csv);
    expect(r.invalid).toBe(0);
    expect(r.rows).toEqual([
      { set: 'ชุด "หนึ่ง", ใหญ่', name: 'ร้าน, A', url: G + 'a', code: 'ก1' },
      { set: 'ชุด "หนึ่ง", ใหญ่', name: '', url: G + 'b', code: '' },
    ]);
  });
});

describe('CSV formula injection', () => {
  const links = [
    {
      name: '=HYPERLINK("http://evil","x")',
      url: G + 'a',
      code: '+66 812345678',
      enabled: true,
      dailyMax: 0,
    },
    { name: '@cmd', url: G + 'b', code: '-1', enabled: true, dailyMax: 3 },
  ];

  it('linksToCsv writes formula-like names and codes as text and keeps numbers', () => {
    const csv = linksToCsv([{ name: '=SET', links }]);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[1]).toBe(`'=SET,"'=HYPERLINK(""http://evil"",""x"")",${G}a,'+66 812345678,1,0`);
    expect(lines[2]).toBe(`'=SET,'@cmd,${G}b,'-1,1,3`);
  });

  it('an exported file read back gives the original names and codes', () => {
    const csv = linksToCsv([{ name: '=SET', links }]);
    const r = parseLinkCsv(csv);
    expect(r.invalid).toBe(0);
    expect(r.rows).toEqual([
      { set: '=SET', name: '=HYPERLINK("http://evil","x")', url: G + 'a', code: '+66 812345678' },
      { set: '=SET', name: '@cmd', url: G + 'b', code: '-1' },
    ]);
  });

  it('postsToCsv guards the post text', () => {
    const csv = postsToCsv([
      {
        name: '-promo',
        posts: [{ text: '=cmd|"/c calc"!A1', mediaIds: ['m'], approval: 'approved' }],
      },
    ]);
    expect(csv.slice(1).split('\r\n')[1]).toBe(`'-promo,"'=cmd|""/c calc""!A1",1,approved`);
  });

  it('a file typed by hand with an ordinary leading apostrophe is left alone', () => {
    const r = parseLinkCsv("'A,'n,facebook.com/groups/abc,'c");
    expect(r.rows).toEqual([{ set: "'A", name: "'n", url: G + 'abc', code: "'c" }]);
  });
});

describe('previewCsvImport', () => {
  const rows = (text: string) => parseLinkCsv(text).rows;

  it('creates unknown sets and the addresses a set lacks', () => {
    const existing = [{ name: 'A', links: [{ url: G + 'a' }] }];
    const r = previewCsvImport(
      existing,
      rows(
        'A,n,facebook.com/groups/a\nA,n,facebook.com/groups/b\nB,n,facebook.com/groups/a\nB,n,facebook.com/groups/c',
      ),
    );
    expect(r).toEqual({ links: 3, sets: 1 });
  });

  it('skips a repeat inside the file and counts a new set once', () => {
    const r = previewCsvImport(
      [],
      rows(
        'N,n,facebook.com/groups/a\nN,n,https://m.facebook.com/groups/a/\nN,n,facebook.com/groups/b',
      ),
    );
    expect(r).toEqual({ links: 2, sets: 1 });
  });

  it('matches set names exactly', () => {
    const r = previewCsvImport([{ name: 'A', links: [] }], rows('a,n,facebook.com/groups/x'));
    expect(r).toEqual({ links: 1, sets: 1 });
  });

  it('is zero for no rows', () => {
    expect(previewCsvImport([{ name: 'A', links: [] }], [])).toEqual({ links: 0, sets: 0 });
  });
});

describe('linksToCsv', () => {
  it('starts with a BOM and the header and writes one CRLF row per link', () => {
    const csv = linksToCsv([
      {
        name: 'A',
        links: [
          { name: 'one', url: G + 'a', code: 'X', enabled: true, dailyMax: 2 },
          { name: 'two', url: G + 'b', code: '', enabled: false, dailyMax: 0 },
        ],
      },
      {
        name: 'B',
        links: [{ name: 'three', url: G + 'c', code: 'Y', enabled: true, dailyMax: 0 }],
      },
    ]);
    expect(csv.startsWith('\ufeffset,name,url,code,enabled,dailyMax\r\n')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'set,name,url,code,enabled,dailyMax',
      `A,one,${G}a,X,1,2`,
      `A,two,${G}b,,0,0`,
      `B,three,${G}c,Y,1,0`,
    ]);
  });

  it('quotes cells with commas, quotes and line breaks', () => {
    const csv = linksToCsv([
      {
        name: 'S,1',
        links: [{ name: 'say "hi"', url: G + 'a', code: 'a\nb', enabled: true, dailyMax: 0 }],
      },
    ]);
    expect(csv).toContain(`"S,1","say ""hi""",${G}a,"a\nb",1,0`);
  });

  it('writes only the header for no sets or empty sets', () => {
    expect(linksToCsv([])).toBe('\ufeffset,name,url,code,enabled,dailyMax');
    expect(linksToCsv([{ name: 'A', links: [] }])).toBe('\ufeffset,name,url,code,enabled,dailyMax');
  });
});

describe('postsToCsv', () => {
  it('writes the collection, text, media count and status of every post', () => {
    const csv = postsToCsv([
      {
        name: 'โปรโมชั่น',
        posts: [
          { text: 'สวัสดี\nโปร "แรง", วันนี้', mediaIds: ['m1', 'm2'], approval: 'approved' },
          { text: 'ร่าง', mediaIds: [], approval: 'draft' },
        ],
      },
      { name: 'ว่าง', posts: [] },
    ]);
    expect(csv.startsWith('\ufeffcollection,text,media,status\r\n')).toBe(true);
    expect(csv.slice(1)).toBe(
      [
        'collection,text,media,status',
        'โปรโมชั่น,"สวัสดี\nโปร ""แรง"", วันนี้",2,approved',
        'โปรโมชั่น,ร่าง,0,draft',
      ].join('\r\n'),
    );
  });

  it('writes only the header for no collections', () => {
    expect(postsToCsv([])).toBe('\ufeffcollection,text,media,status');
  });
});

describe('group slugs and case', () => {
  it('refuses a slug without a letter or a digit', () => {
    expect(normalizeGroupUrl(G + '.')).toBe('');
    expect(normalizeGroupUrl(G + '..')).toBe('');
    expect(normalizeGroupUrl(G + '-_-')).toBe('');
    expect(normalizeGroupUrl(G + 'a.')).toBe(G + 'a.');
  });

  it('keeps the slug as typed but compares it without case', () => {
    expect(normalizeGroupUrl('facebook.com/groups/ABC')).toBe(G + 'ABC');
    expect(groupUrlKey('facebook.com/groups/ABC')).toBe(G + 'abc');
    expect(groupUrlKey('nonsense')).toBe('');
    expect(isDuplicateUrl([{ url: G + 'abc' }], G + 'ABC')).toBe(true);
    expect(
      duplicateUrlFlags([{ url: G + 'abc' }, { url: G + 'ABC' }, { url: G + 'other' }]),
    ).toEqual([false, true, false]);
  });

  it('counts a bulk or CSV import of the same group in another case as a duplicate', () => {
    const existing = [{ url: G + 'abc', code: '#1' }];
    expect(previewBulkImport(existing, [{ url: G + 'ABC', name: 'x', code: '' }])).toEqual({
      added: 0,
      duplicates: 1,
      recoded: 0,
    });
    expect(
      previewCsvImport(
        [{ name: 'S', links: existing }],
        [{ set: 'S', name: 'n', url: G + 'ABC', code: '' }],
      ),
    ).toEqual({ links: 0, sets: 0 });
  });
});

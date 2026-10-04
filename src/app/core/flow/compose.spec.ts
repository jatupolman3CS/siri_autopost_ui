import {
  compose,
  composeFull,
  hasCodeTag,
  hasSpin,
  MAX_SPIN_ROUNDS,
  postFlags,
  seededRandom,
  spin,
  spinVariants,
} from './compose';

/** A random source that returns the given values in turn (then the last one forever). */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};
const first = () => 0;
const last = () => 0.999999;

describe('hasCodeTag', () => {
  it.each([
    '{{code}}',
    '{{ code }}',
    '{{CODE}}',
    '{{Code}}',
    '{{   code   }}',
    '{{รหัส}}',
    '{{ รหัส }}',
    'ซื้อเลย {{ รหัส }} วันนี้',
    '{{\tcode\n}}',
    'a {{code}} b {{code}}',
  ])('finds the tag in %j', (text) => {
    expect(hasCodeTag(text)).toBe(true);
  });

  it.each([
    '',
    'code',
    '{code}',
    '{{codes}}',
    '{{ co de }}',
    '{{code}',
    '{code}}',
    '{{ รหัสลับ }}',
    '{{}}',
  ])('does not find a tag in %j', (text) => {
    expect(hasCodeTag(text)).toBe(false);
  });

  it('is false for null and undefined', () => {
    expect(hasCodeTag(null)).toBe(false);
    expect(hasCodeTag(undefined)).toBe(false);
  });
});

describe('hasSpin / postFlags', () => {
  it('detects a group with a pipe', () => {
    expect(hasSpin('{a|b}')).toBe(true);
    expect(hasSpin('x {สวัสดี|หวัดดี} y')).toBe(true);
    expect(hasSpin('{a|{b|c}}')).toBe(true);
    expect(hasSpin('{|}')).toBe(true);
  });

  it('ignores braces without a pipe and a pipe outside braces', () => {
    expect(hasSpin('{a}')).toBe(false);
    expect(hasSpin('a|b')).toBe(false);
    expect(hasSpin('{{code}}')).toBe(false);
    expect(hasSpin('')).toBe(false);
    expect(hasSpin(null)).toBe(false);
  });

  it('reports both flags', () => {
    expect(postFlags('{a|b} {{code}}')).toEqual({ hasCode: true, hasSpin: true });
    expect(postFlags('{a|b}')).toEqual({ hasCode: false, hasSpin: true });
    expect(postFlags('{{ รหัส }}')).toEqual({ hasCode: true, hasSpin: false });
    expect(postFlags('plain')).toEqual({ hasCode: false, hasSpin: false });
    expect(postFlags(undefined)).toEqual({ hasCode: false, hasSpin: false });
  });
});

describe('spin', () => {
  it('leaves text without spintax as it is', () => {
    expect(spin('hello {{code}} {x}', first)).toBe('hello {{code}} {x}');
    expect(spin('', first)).toBe('');
    expect(spin(null, first)).toBe('');
    expect(spin(undefined, first)).toBe('');
  });

  it('picks uniformly: the random value chooses the option', () => {
    expect(spin('{a|b|c}', first)).toBe('a');
    expect(spin('{a|b|c}', () => 0.4)).toBe('b');
    expect(spin('{a|b|c}', last)).toBe('c');
    expect(spin('{a|b}', () => 0.5)).toBe('b');
  });

  it('never goes out of range, even for an out-of-range random value', () => {
    expect(spin('{a|b}', () => 1)).toBe('b');
    expect(spin('{a|b}', () => -0.5)).toBe('a');
  });

  it('resolves groups from left to right, one random value each', () => {
    expect(spin('{a|b} {c|d} {e|f}', sequence(0, 0.99, 0))).toBe('a d e');
  });

  it('resolves nested groups from the inside out', () => {
    // the first random value picks inside {b|c}, the second picks in what is left: {a|<inner>}
    expect(spin('{a|{b|c}}', sequence(0, 0))).toBe('a');
    expect(spin('{a|{b|c}}', sequence(0, 0.99))).toBe('b');
    expect(spin('{a|{b|c}}', sequence(0.99, 0.99))).toBe('c');
    expect(spin('{x|{y|{z|w}}}', sequence(0.99, 0, 0.99))).toBe('y');
    expect(spin('{{a|b}|c}', sequence(0, 0.99))).toBe('c');
    expect(spin('{{a|b}|c}', sequence(0.99, 0.99))).toBe('c');
    expect(spin('{{a|b}|c}', sequence(0.99, 0))).toBe('b');
  });

  it('keeps an inner group that was picked and resolves what it left behind', () => {
    // inner {c|d} -> d, then {a|b|d} -> d
    expect(spin('{a|b|{c|d}}', sequence(0.99, 0.99))).toBe('d');
  });

  it('allows empty options', () => {
    expect(spin('x{|!}y', first)).toBe('xy');
    expect(spin('x{|!}y', last)).toBe('x!y');
    expect(spin('{|}', first)).toBe('');
  });

  it('works on Thai text and emoji', () => {
    expect(spin('{สวัสดีค่ะ|หวัดดีค่ะ} 👋 {ของดี|ของใหม่}', sequence(0.99, 0))).toBe(
      'หวัดดีค่ะ 👋 ของดี',
    );
  });

  it('keeps a group with a single option and no pipe', () => {
    expect(spin('{only}', first)).toBe('{only}');
  });

  it('leaves the code tag alone', () => {
    expect(spin('{a|b} {{code}} {{ รหัส }}', first)).toBe('a {{code}} {{ รหัส }}');
  });

  it('stops after the maximum number of rounds', () => {
    const groups = MAX_SPIN_ROUNDS + 3;
    const out = spin('{a|b}'.repeat(groups), first);
    expect(out).toBe('a'.repeat(MAX_SPIN_ROUNDS) + '{a|b}'.repeat(3));
  });

  it('uses Math.random when no source is given', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    try {
      expect(spin('{a|b}')).toBe('b');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('compose', () => {
  it('replaces every code tag with the trimmed code', () => {
    expect(compose('รหัส {{code}} และ {{ รหัส }} ครับ', '  AB12  ')).toBe(
      'รหัส AB12 และ AB12 ครับ',
    );
    expect(compose('{{CODE}}', 'x')).toBe('x');
  });

  it('puts the code on the first line when the text has no tag', () => {
    expect(compose('ขายของ', 'AB12')).toBe('AB12\nขายของ');
    expect(compose('line1\nline2', 'AB12')).toBe('AB12\nline1\nline2');
  });

  it('writes just the code for an empty text', () => {
    expect(compose('', 'AB12')).toBe('AB12');
    expect(compose(null, 'AB12')).toBe('AB12');
  });

  it('leaves the text when there is no code', () => {
    expect(compose('ขายของ', '')).toBe('ขายของ');
    expect(compose('ขายของ', '   ')).toBe('ขายของ');
    expect(compose('ขายของ', null)).toBe('ขายของ');
    expect(compose('ขายของ', undefined)).toBe('ขายของ');
    expect(compose('', '')).toBe('');
  });

  it('removes the tag when the code is empty', () => {
    expect(compose('a {{code}} b', '')).toBe('a  b');
    expect(compose('{{code}}', null)).toBe('');
  });

  it('does not add the code again when the tag is used', () => {
    expect(compose('x {{code}}', 'C')).toBe('x C');
  });

  it('writes a code with dollar signs literally', () => {
    expect(compose('a {{code}} b', '$&-$1-$$')).toBe('a $&-$1-$$ b');
  });

  it('can be called twice in a row (no regex state leaks)', () => {
    expect(compose('{{code}}', 'a')).toBe('a');
    expect(compose('{{code}}', 'a')).toBe('a');
    expect(hasCodeTag('{{code}}')).toBe(true);
    expect(hasCodeTag('{{code}}')).toBe(true);
  });
});

describe('composeFull', () => {
  const base = { hashtags: '', footer: '', footerPos: 'end' as const };

  it('is the composed text when the collection adds nothing', () => {
    expect(composeFull('ขายของ', 'C1', base, first)).toBe('C1\nขายของ');
    expect(composeFull('ขายของ', '', base, first)).toBe('ขายของ');
    expect(composeFull('ขายของ', '', null, first)).toBe('ขายของ');
    expect(composeFull('ขายของ', '', undefined, first)).toBe('ขายของ');
    expect(composeFull('ขายของ', '', {}, first)).toBe('ขายของ');
  });

  it('adds the footer after the text, separated by a blank line', () => {
    expect(composeFull('ขาย', '', { ...base, footer: 'ทักแชทได้เลย' }, first)).toBe(
      'ขาย\n\nทักแชทได้เลย',
    );
  });

  it('adds the footer before the text when it is on top', () => {
    expect(composeFull('ขาย', '', { ...base, footer: 'F', footerPos: 'top' }, first)).toBe(
      'F\nขาย',
    );
  });

  it('treats the group code as part of the text, so a top footer goes above it', () => {
    expect(composeFull('ขาย', 'C1', { ...base, footer: 'F', footerPos: 'top' }, first)).toBe(
      'F\nC1\nขาย',
    );
  });

  it('does not add a footer the text already contains', () => {
    expect(composeFull('ขาย\n\nทักแชท', '', { ...base, footer: 'ทักแชท' }, first)).toBe(
      'ขาย\n\nทักแชท',
    );
    expect(
      composeFull('ทักแชท ขาย', '', { ...base, footer: 'ทักแชท', footerPos: 'top' }, first),
    ).toBe('ทักแชท ขาย');
  });

  it('trims the footer before comparing and adding it', () => {
    expect(composeFull('ขาย', '', { ...base, footer: '  F \n' }, first)).toBe('ขาย\n\nF');
    expect(composeFull('ขาย F', '', { ...base, footer: '  F ' }, first)).toBe('ขาย F');
  });

  it('ignores a footer that is only spaces', () => {
    expect(composeFull('ขาย', '', { ...base, footer: '  \n ' }, first)).toBe('ขาย');
  });

  it('adds the hashtags on a new line after everything', () => {
    expect(composeFull('ขาย', '', { ...base, hashtags: '#ขาย #โปร' }, first)).toBe(
      'ขาย\n#ขาย #โปร',
    );
    expect(composeFull('ขาย', '', { ...base, footer: 'F', hashtags: '#a' }, first)).toBe(
      'ขาย\n\nF\n#a',
    );
    expect(
      composeFull('ขาย', '', { ...base, footer: 'F', footerPos: 'top', hashtags: '#a' }, first),
    ).toBe('F\nขาย\n#a');
  });

  it('does not add hashtags the text already contains', () => {
    expect(composeFull('ขาย #โปร #ขาย', '', { ...base, hashtags: '#โปร #ขาย' }, first)).toBe(
      'ขาย #โปร #ขาย',
    );
    expect(composeFull('x #a', '', { ...base, hashtags: ' #a ' }, first)).toBe('x #a');
  });

  it('ignores hashtags that are only spaces', () => {
    expect(composeFull('ขาย', '', { ...base, hashtags: '   ' }, first)).toBe('ขาย');
  });

  it('adds hashtags even when the footer was already in the text', () => {
    expect(composeFull('ขาย F', '', { ...base, footer: 'F', hashtags: '#a' }, first)).toBe(
      'ขาย F\n#a',
    );
  });

  it('resolves spintax in the text and in the footer, text first', () => {
    const settings = { ...base, footer: '{ทักแชท|โทรมา}' };
    expect(composeFull('{สวัสดี|หวัดดี}', '', settings, sequence(0.99, 0))).toBe(
      'หวัดดี\n\nทักแชท',
    );
    expect(composeFull('{สวัสดี|หวัดดี}', '', settings, sequence(0, 0.99))).toBe('สวัสดี\n\nโทรมา');
  });

  it('does not spin the group code or the hashtags', () => {
    expect(composeFull('x', '{a|b}', { ...base, hashtags: '{c|d}' }, first)).toBe(
      '{a|b}\nx\n{c|d}',
    );
  });

  it('does not resolve a group that contains a code tag (the server cannot either)', () => {
    expect(composeFull('{ซื้อ {{code}}|สั่ง {{code}}}', 'AB', base, last)).toBe(
      '{ซื้อ AB|สั่ง AB}',
    );
  });

  it('never cuts a long text', () => {
    const long = 'ก'.repeat(6000);
    const out = composeFull(long, 'C', { ...base, footer: 'F', hashtags: '#a' }, first);
    expect(out).toBe('C\n' + long + '\n\nF\n#a');
    expect(out.length).toBeGreaterThan(6000);
  });

  it('works with the full collection settings object', () => {
    const settings = {
      hashtags: '#h',
      pageTags: 'ignored',
      footer: 'F',
      footerPos: 'top' as const,
      shuffle: true,
      watermark: false,
      watermarkPos: 'br' as const,
      requireApproval: false,
    };
    expect(composeFull('t', '', settings, first)).toBe('F\nt\n#h');
  });

  it('treats an unknown footer position as the end', () => {
    expect(composeFull('t', '', { footer: 'F', footerPos: null }, first)).toBe('t\n\nF');
  });
});

describe('seededRandom', () => {
  it('gives the same sequence for the same seed', () => {
    const a = seededRandom(20261003);
    const b = seededRandom(20261003);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('gives other sequences for other seeds', () => {
    const a = Array.from({ length: 5 }, seededRandom(1));
    const b = Array.from({ length: 5 }, seededRandom(2));
    expect(a).not.toEqual(b);
  });

  it('stays in [0, 1)', () => {
    const r = seededRandom(7);
    for (let i = 0; i < 5000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('treats seed 0 like seed 1 and accepts negative and fractional seeds', () => {
    expect(Array.from({ length: 4 }, seededRandom(0))).toEqual(
      Array.from({ length: 4 }, seededRandom(1)),
    );
    expect(() => seededRandom(-5)()).not.toThrow();
    expect(() => seededRandom(1.5)()).not.toThrow();
    expect(seededRandom(Number.NaN)()).toBe(seededRandom(1)());
  });

  it('spreads values over the range', () => {
    const r = seededRandom(42);
    const buckets = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) buckets[Math.floor(r() * 4)]++;
    for (const n of buckets) expect(n).toBeGreaterThan(800);
  });
});

describe('spinVariants', () => {
  it('returns the text itself when there is no spintax', () => {
    expect(spinVariants('plain {{code}}', 3)).toEqual(['plain {{code}}']);
    expect(spinVariants('', 3)).toEqual(['']);
  });

  it('returns nothing for a non-positive or invalid maximum', () => {
    expect(spinVariants('{a|b}', 0)).toEqual([]);
    expect(spinVariants('{a|b}', -2)).toEqual([]);
    expect(spinVariants('{a|b}', Number.NaN)).toEqual([]);
    expect(spinVariants('plain', 0)).toEqual([]);
  });

  it('returns distinct results, at most the maximum', () => {
    const v = spinVariants('{a|b|c|d} {x|y|z}', 4);
    expect(v).toHaveLength(4);
    expect(new Set(v).size).toBe(4);
    for (const s of v) expect(s).toMatch(/^[abcd] [xyz]$/);
  });

  it('returns fewer when the text has fewer variants', () => {
    expect(spinVariants('{a|b}', 5).sort()).toEqual(['a', 'b']);
    expect(spinVariants('{a|a}', 3)).toEqual(['a']);
  });

  it('finds every branch of a nested group', () => {
    expect(spinVariants('{a|{b|c}}', 10).sort()).toEqual(['a', 'b', 'c']);
  });

  it('keeps Thai text and surrounding words', () => {
    const v = spinVariants('{สวัสดี|หวัดดี}ค่ะ', 5).sort();
    expect(v).toEqual(['สวัสดีค่ะ', 'หวัดดีค่ะ']);
  });

  it('is repeatable for the same input', () => {
    expect(spinVariants('{a|b|c} {d|e|f}', 3)).toEqual(spinVariants('{a|b|c} {d|e|f}', 3));
  });

  it('uses the random source it is given', () => {
    expect(spinVariants('{a|b}', 2, sequence(0, 0.99))).toEqual(['a', 'b']);
  });
});

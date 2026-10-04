import {
  AI_DEFAULT_COUNT,
  AI_MAX_COUNT,
  AI_TONES,
  clampCount,
  closings,
  generatePosts,
  openings,
  parsePoints,
  type AiTone,
} from './ai-writer';
import { hasSpin, spin } from './compose';

/** The prototype's `confirmAi` text builder, copied as it is, to compare against. */
function prototypePosts(topic: string, pts: string[], tone: AiTone, n: number): string[] {
  const open = {
    friendly: [
      '{สวัสดีค่ะ|หวัดดีค่ะ|ทักทายค่ะ} 👋',
      'มาแล้วค่ะ {ของดี|ของใหม่|ตัวท็อป}',
      '{ใครกำลังหา|ใครมองหา} {topic} อยู่ ทางนี้เลยค่ะ',
    ],
    sales: [
      '{โปรแรง|ดีลพิเศษ|ราคาพิเศษ} {topic}',
      '{topic} {ลดจริง|คุ้มจริง} วันนี้เท่านั้น',
      '{รับจำนวนจำกัด|สต็อกมีน้อย} {topic}',
    ],
    formal: [
      'ขอแนะนำ {topic}',
      'เรียนลูกค้าทุกท่าน {topic} พร้อมจำหน่ายแล้ว',
      '{topic} คุณภาพมาตรฐาน พร้อมบริการหลังการขาย',
    ],
  }[tone];
  const close = {
    friendly: ['{สนใจทักแชทได้เลยนะคะ|ทักมาคุยกันได้เลยค่ะ}', '{ส่งไว|จัดส่งเร็ว} ทั่วไทยค่ะ'],
    sales: ['{ทักเลย|สั่งเลย} ก่อนหมด', 'คอมเมนต์ “สนใจ” แล้วทีมงานทักกลับทันที'],
    formal: ['สอบถามเพิ่มเติมได้ทางข้อความ', 'ขอบคุณที่ไว้วางใจ'],
  }[tone];
  const made: string[] = [];
  for (let i = 0; i < n; i++) {
    const o = open[i % open.length].replace('{topic}', topic);
    const body = pts.length ? '\n' + pts.map((p, j) => (j % 2 ? '✔ ' : '• ') + p).join('\n') : '';
    made.push(o + (o.includes(topic) ? '' : ' ' + topic) + body + '\n' + close[i % close.length]);
  }
  return made;
}

describe('generatePosts', () => {
  it('writes the friendly posts of the prototype', () => {
    expect(
      generatePosts({
        topic: 'ครีมกันแดด',
        points: ['SPF50', 'กันน้ำ', 'ไม่เหนียว'],
        tone: 'friendly',
        count: 3,
      }),
    ).toEqual([
      '{สวัสดีค่ะ|หวัดดีค่ะ|ทักทายค่ะ} 👋 ครีมกันแดด\n• SPF50\n✔ กันน้ำ\n• ไม่เหนียว\n{สนใจทักแชทได้เลยนะคะ|ทักมาคุยกันได้เลยค่ะ}',
      'มาแล้วค่ะ {ของดี|ของใหม่|ตัวท็อป} ครีมกันแดด\n• SPF50\n✔ กันน้ำ\n• ไม่เหนียว\n{ส่งไว|จัดส่งเร็ว} ทั่วไทยค่ะ',
      '{ใครกำลังหา|ใครมองหา} ครีมกันแดด อยู่ ทางนี้เลยค่ะ\n• SPF50\n✔ กันน้ำ\n• ไม่เหนียว\n{สนใจทักแชทได้เลยนะคะ|ทักมาคุยกันได้เลยค่ะ}',
    ]);
  });

  it('writes the sales and formal posts without points', () => {
    expect(generatePosts({ topic: 'รองเท้า', tone: 'sales', count: 2 })).toEqual([
      '{โปรแรง|ดีลพิเศษ|ราคาพิเศษ} รองเท้า\n{ทักเลย|สั่งเลย} ก่อนหมด',
      'รองเท้า {ลดจริง|คุ้มจริง} วันนี้เท่านั้น\nคอมเมนต์ “สนใจ” แล้วทีมงานทักกลับทันที',
    ]);
    expect(generatePosts({ topic: 'รองเท้า', tone: 'formal', count: 1 })).toEqual([
      'ขอแนะนำ รองเท้า\nสอบถามเพิ่มเติมได้ทางข้อความ',
    ]);
  });

  it('matches the prototype for every tone, count and point list', () => {
    for (const tone of AI_TONES) {
      for (const count of [1, 2, 3, 4, 5, 7, 12]) {
        for (const points of [[], ['a'], ['a', 'b'], ['a', 'b', 'c', 'd']]) {
          expect(generatePosts({ topic: 'สินค้าใหม่', points, tone, count })).toEqual(
            prototypePosts('สินค้าใหม่', points, tone, count),
          );
        }
      }
    }
  });

  it('alternates bullet marks, starting with a dot', () => {
    const [post] = generatePosts({
      topic: 'x',
      points: ['one', 'two', 'three', 'four'],
      tone: 'formal',
      count: 1,
    });
    expect(post.split('\n').slice(1, 5)).toEqual(['• one', '✔ two', '• three', '✔ four']);
  });

  it('cycles through the openings and closings (3 and 2 lines: the pairs repeat after 6 posts)', () => {
    const posts = generatePosts({ topic: 'T', tone: 'formal', count: 7 });
    expect(posts[6]).toBe(posts[0]);
    expect(posts[3].split('\n')[0]).toBe(posts[0].split('\n')[0]);
    expect(posts[3]).not.toBe(posts[0]);
    expect(new Set(posts).size).toBe(6);
  });

  it('puts the topic after an opening that does not mention it', () => {
    const [, second] = generatePosts({ topic: 'ครีม', tone: 'friendly', count: 2 });
    expect(second.startsWith('มาแล้วค่ะ {ของดี|ของใหม่|ตัวท็อป} ครีม\n')).toBe(true);
  });

  it('does not repeat the topic in an opening that has it', () => {
    const [, , third] = generatePosts({ topic: 'ครีม', tone: 'friendly', count: 3 });
    expect(third.split('ครีม')).toHaveLength(2);
  });

  it('trims the topic and the points and drops blank points', () => {
    expect(
      generatePosts({
        topic: '  ครีม  ',
        points: ['  a ', '', '   ', 'b'],
        tone: 'formal',
        count: 1,
      }),
    ).toEqual(['ขอแนะนำ ครีม\n• a\n✔ b\nสอบถามเพิ่มเติมได้ทางข้อความ']);
  });

  it('writes a topic with dollar signs as typed', () => {
    const [post] = generatePosts({ topic: 'ราคา $& $1 $$', tone: 'formal', count: 1 });
    expect(post.startsWith('ขอแนะนำ ราคา $& $1 $$\n')).toBe(true);
  });

  it('defaults to the friendly tone and to 3 posts', () => {
    expect(generatePosts({ topic: 'x' })).toEqual(
      generatePosts({ topic: 'x', tone: 'friendly', count: 3 }),
    );
    expect(generatePosts({ topic: 'x', tone: null, count: null })).toHaveLength(3);
    expect(generatePosts({ topic: 'x', tone: 'weird' as AiTone })).toEqual(
      generatePosts({ topic: 'x', tone: 'friendly' }),
    );
    expect(generatePosts({ topic: 'x', tone: 'toString' as AiTone })).toHaveLength(3);
  });

  it('keeps the count between 1 and 20', () => {
    expect(generatePosts({ topic: 'x', count: 1 })).toHaveLength(1);
    expect(generatePosts({ topic: 'x', count: 20 })).toHaveLength(20);
    expect(generatePosts({ topic: 'x', count: 500 })).toHaveLength(20);
    expect(generatePosts({ topic: 'x', count: 0 })).toHaveLength(3);
    expect(generatePosts({ topic: 'x', count: -4 })).toHaveLength(1);
    expect(generatePosts({ topic: 'x', count: Number.NaN })).toHaveLength(3);
    expect(generatePosts({ topic: 'x', count: 2.8 })).toHaveLength(2);
  });

  it('can start at another opening for different wording', () => {
    const base = generatePosts({ topic: 'x', tone: 'formal', count: 3 });
    const shifted = generatePosts({ topic: 'x', tone: 'formal', count: 3, offset: 1 });
    expect(shifted[0].split('\n')[0]).toBe(base[1].split('\n')[0]);
    expect(shifted).not.toEqual(base);
    expect(generatePosts({ topic: 'x', tone: 'formal', count: 3, offset: 6 })).toEqual(base);
    expect(
      generatePosts({ topic: 'x', tone: 'formal', count: 3, offset: -1 })[0].split('\n')[0],
    ).toBe(base[2].split('\n')[0]);
    expect(generatePosts({ topic: 'x', tone: 'formal', count: 3, offset: Number.NaN })).toEqual(
      base,
    );
  });

  it('is repeatable: the same request gives the same posts', () => {
    const req = { topic: 'สบู่', points: ['หอม'], tone: 'sales' as const, count: 6 };
    expect(generatePosts(req)).toEqual(generatePosts(req));
  });

  it('leaves spintax for the moment of posting, and it resolves to clean text', () => {
    for (const tone of AI_TONES) {
      for (const post of generatePosts({ topic: 'ครีม', points: ['a'], tone, count: 6 })) {
        const resolved = spin(post, () => 0.5);
        expect(hasSpin(resolved)).toBe(false);
        expect(resolved).not.toMatch(/[{}|]/);
        expect(resolved).toContain('ครีม');
      }
    }
  });

  it('stays within the post limit for a long topic and many points', () => {
    const [post] = generatePosts({
      topic: 'ก'.repeat(300),
      points: Array.from({ length: 12 }, () => 'ข'.repeat(100)),
      count: 1,
    });
    expect(post.length).toBeLessThan(5000);
  });
});

describe('templates', () => {
  it('lists the lines of every tone', () => {
    for (const tone of AI_TONES) {
      expect(openings(tone)).toHaveLength(3);
      expect(closings(tone).length).toBeGreaterThanOrEqual(2);
    }
    expect(openings('formal')[0]).toBe('ขอแนะนำ {topic}');
    expect(closings('formal')[1]).toBe('ขอบคุณที่ไว้วางใจ');
    expect(openings('nope' as AiTone)).toBe(openings('friendly'));
  });
});

describe('parsePoints', () => {
  it('splits on commas and line breaks and trims', () => {
    expect(parsePoints('กันน้ำ, SPF50 ,\nไม่เหนียว\r\n,, ')).toEqual([
      'กันน้ำ',
      'SPF50',
      'ไม่เหนียว',
    ]);
  });

  it('is empty for nothing', () => {
    expect(parsePoints('')).toEqual([]);
    expect(parsePoints('  , ,\n')).toEqual([]);
    expect(parsePoints(null)).toEqual([]);
    expect(parsePoints(undefined)).toEqual([]);
  });
});

describe('clampCount', () => {
  it('keeps the count in 1..20 and defaults to 3', () => {
    expect(AI_DEFAULT_COUNT).toBe(3);
    expect(AI_MAX_COUNT).toBe(20);
    expect([1, 5, 20, 21, 0, -1, null, undefined, Number.NaN, 4.9].map(clampCount)).toEqual([
      1, 5, 20, 20, 3, 1, 3, 3, 3, 4,
    ]);
  });
});

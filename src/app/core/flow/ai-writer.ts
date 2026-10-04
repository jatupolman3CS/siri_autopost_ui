// The "AI writer" of the prototype is a template generator, not a model: every post is an opening
// line and a closing line (both written in spintax, which is resolved only when the post is sent)
// around the topic and a bullet per selling point. This is a port of it; nothing here is a server
// rule. The text it returns is user content (Thai) and goes into the collection like typed text
// (the server takes up to 20 posts in one batch).

export type AiTone = 'friendly' | 'sales' | 'formal';

export const AI_TONES: readonly AiTone[] = ['friendly', 'sales', 'formal'];
export const AI_MAX_COUNT = 20;
export const AI_DEFAULT_COUNT = 3;

export interface AiRequest {
  topic: string;
  /** Selling points, one bullet each. */
  points?: readonly string[] | null;
  tone?: AiTone | null;
  /** How many posts: 1 to 20, a missing or zero count means 3. */
  count?: number | null;
  /**
   * Where to start in the opening and closing lines (default 0, the prototype's order). Use a
   * different one to get other wording for the same topic.
   */
  offset?: number | null;
}

const TOPIC = '{topic}';

const OPENINGS: Record<AiTone, readonly string[]> = {
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
};

const CLOSINGS: Record<AiTone, readonly string[]> = {
  friendly: ['{สนใจทักแชทได้เลยนะคะ|ทักมาคุยกันได้เลยค่ะ}', '{ส่งไว|จัดส่งเร็ว} ทั่วไทยค่ะ'],
  sales: ['{ทักเลย|สั่งเลย} ก่อนหมด', 'คอมเมนต์ “สนใจ” แล้วทีมงานทักกลับทันที'],
  formal: ['สอบถามเพิ่มเติมได้ทางข้อความ', 'ขอบคุณที่ไว้วางใจ'],
};

const templatesOf = (table: Record<AiTone, readonly string[]>, tone: AiTone | null | undefined) =>
  table[tone && Object.hasOwn(table, tone) ? tone : 'friendly'];

/** Opening templates of a tone; `{topic}` stands for the topic. */
export function openings(tone: AiTone): readonly string[] {
  return templatesOf(OPENINGS, tone);
}

export function closings(tone: AiTone): readonly string[] {
  return templatesOf(CLOSINGS, tone);
}

/** Splits the selling-points field: one point per comma or line, blanks dropped. */
export function parsePoints(raw: string | null | undefined): string[] {
  return String(raw ?? '')
    .split(/[,\n]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** The number of posts to make: 1 to 20, a missing, zero or unreadable count gives 3. */
export function clampCount(count: number | null | undefined): number {
  const n = Math.trunc(Number(count)) || AI_DEFAULT_COUNT;
  return Math.max(1, Math.min(AI_MAX_COUNT, n));
}

/**
 * Writes `count` posts about `topic`. Post i takes the (offset + i)-th opening and closing line of
 * the tone (they cycle), puts the topic after the opening when the opening does not mention it,
 * then one bullet per point ("• " and "✔ " alternate) and the closing line. The spintax in the
 * result is left as written. The same request always gives the same posts.
 */
export function generatePosts(request: AiRequest): string[] {
  const topic = String(request.topic ?? '').trim();
  const points = (request.points ?? []).map((p) => String(p).trim()).filter(Boolean);
  const open = templatesOf(OPENINGS, request.tone);
  const close = templatesOf(CLOSINGS, request.tone);
  const start = Math.trunc(Number(request.offset)) || 0;
  const posts: string[] = [];
  for (let i = 0; i < clampCount(request.count); i++) {
    // A function replacer, so `$` in a topic is never read as a replacement pattern.
    const opening = open[mod(start + i, open.length)].replace(TOPIC, () => topic);
    const bullets = points.length
      ? '\n' + points.map((p, j) => (j % 2 ? '✔ ' : '• ') + p).join('\n')
      : '';
    const closing = close[mod(start + i, close.length)];
    posts.push(opening + (opening.includes(topic) ? '' : ' ' + topic) + bullets + '\n' + closing);
  }
  return posts;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

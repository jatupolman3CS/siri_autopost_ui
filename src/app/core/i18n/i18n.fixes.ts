import { AP_I18N } from './i18n.data';

type Pair = readonly [string, string];

/**
 * The shape of the generated dictionary (i18n.data.ts) with every branch optional and every leaf a
 * [th, en] pair: a fix can only name a leaf that exists, and must give both languages.
 */
export type Fixes<T> = T extends Pair
  ? Pair
  : T extends readonly unknown[]
    ? readonly Fixes<T[number]>[]
    : { readonly [K in keyof T]?: Fixes<T[K]> };

// Corrections to the design handoff's copy where it describes something the system does not do. i18n.data.ts
// is generated from that handoff (npm run import:design) and must not be edited by hand, so every corrected
// leaf lives here instead and is merged over it (see I18nService). Each fix says what the design got wrong.
// A re-import never undoes a fix; if the design itself is corrected, delete the leaf here.
export const AP_I18N_FIXES = {
  land: {
    // There is no trial: the Free plan is permanent and needs no card.
    heroNote: ['ใช้ฟรีได้เลย ไม่ต้องใช้บัตรเครดิต', 'Free to start, no credit card required'],
    trial: ['เริ่มใช้ฟรี', 'Start for free'],
    // Only Facebook groups can be posted to through the extension today.
    platforms: [
      'โพสต์ลงกลุ่ม Facebook ได้แล้ว แพลตฟอร์มอื่นกำลังตามมา',
      'Posts to Facebook groups now, more platforms coming',
    ],
    s1b: [
      'ตอนนี้โพสต์ลงกลุ่ม Facebook ได้ แพลตฟอร์มอื่น (Instagram, X, TikTok, LINE OA, Threads) จะเพิ่มภายหลัง',
      'Facebook groups work today; Instagram, X, TikTok, LINE OA and Threads come later',
    ],
    // Nothing sends reminders.
    f5b: [
      'เลือกข้ามโพสต์ที่เลยเวลา หรือเก็บไว้รอจนเปิดเครื่องอีกครั้ง',
      'Skip late posts, or keep them queued until your computer is back on',
    ],
    // There are no reports beyond the success rate and the error list.
    p3b: [
      'แยกเวิร์กสเปซต่อลูกค้า และกำหนดสิทธิ์ให้ทีม',
      'A workspace per client, with roles for your team',
    ],
  },
  auth: {
    signup: ['สมัครใช้ฟรี', 'Create a free account'],
    signupSub: ['ใช้ฟรีได้เลย ไม่ต้องใช้บัตร', 'Free to start, no card needed'],
  },
  common: {
    // The limit counts a rolling 24 hours, not the calendar day.
    postsToday: ['โพสต์ใน 24 ชม.', 'Posts, last 24 h'],
    perDay: ['ต่อ 24 ชม.', 'per 24 h'],
  },
  cmp: {
    // There are no collections or schedules pages: the composer schedules directly.
    sub: [
      'เขียนโพสต์ เลือกบัญชีและกลุ่มปลายทาง แล้วตั้งเวลาและการทำซ้ำในหน้านี้',
      'Write the post, pick the accounts and groups, and set when it goes out and whether it repeats, all here',
    ],
    // "(randomized)" was only true with the smart delay on; the summary adds its own ending.
    summary: [
      'จะสร้าง {n} งานโพสต์ใน {p} แพลตฟอร์ม ระหว่าง {t1}–{t2}',
      'Creates {n} tasks across {p} platforms between {t1}–{t2}',
    ],
    // The draft only lives in this browser tab.
    toastDraft: [
      'เก็บฉบับร่างไว้แล้ว (อยู่ในหน้านี้จนกว่าจะปิดหรือรีโหลด)',
      'Draft kept (it stays in this tab until you close or reload the page)',
    ],
  },
  ab: {
    // Facebook rolling 24-hour limit; the server fails the post (quota), it does not roll it over.
    limitsBody: [
      'จำนวนโพสต์สูงสุดใน 24 ชั่วโมงต่อแพลตฟอร์ม เมื่อถึงเพดาน โพสต์ที่เหลือจะล้มเหลวด้วยสาเหตุโควตา (ลองใหม่ภายหลังได้) ไม่ถูกเลื่อนไปพรุ่งนี้เอง',
      'Maximum posts per platform in any 24 hours. At the limit the rest fail with a quota error (retry later); nothing rolls over to tomorrow',
    ],
    usedToday: ['ใช้ไปใน 24 ชม.', 'Used in 24 h'],
    // The random wait is applied when posts are scheduled; the extension only enforces the minimum gap.
    delayBody: [
      'โพสต์ที่ตั้งเวลาพร้อมกันจะเว้นระยะสุ่มระหว่างค่าต่ำสุดถึงสูงสุด และไม่โพสต์จากบัญชีเดียวกันถี่กว่าค่าต่ำสุด',
      'Posts scheduled together are spaced by a random wait between the minimum and maximum, and one account never posts closer than the minimum',
    ],
    riskNote: [
      'คำนวณจากค่าหน่วงต่ำสุด เพดาน Facebook และการพิมพ์/เลื่อนหน้าที่เปิดไว้',
      'Based on the minimum delay, the Facebook daily limit, and typing and scrolling',
    ],
    // Shuffle, auto-pause and warm-up are stored but the extension does not act on them yet.
    humanBody: [
      'ส่วนขยายใช้การพิมพ์และการเลื่อนหน้า ตัวเลือกอื่นบันทึกไว้แต่ยังไม่มีผล',
      'The extension uses typing and scrolling. The other options are saved but have no effect yet',
    ],
  },
  off: {
    // Skip still lets a post go out up to 10 minutes late (Offline.SkipGrace).
    skipBody: [
      'โพสต์ที่เลยเวลาเกิน 10 นาทีจะถูกข้ามแทนการโพสต์ย้อนหลัง เหมาะกับโปรโมชันที่ผูกกับเวลา',
      'A post more than 10 minutes late is skipped instead of sent. Best for time-sensitive promotions',
    ],
    // Nothing sends reminders; the API treats this policy like "Queue".
    notifyBody: [
      'ยังไม่รองรับ: ไม่มีการส่งแจ้งเตือน ระบบจะเก็บโพสต์ไว้เหมือนนโยบาย “เก็บไว้รอโพสต์”',
      'Not supported yet: no reminder is sent. Posts are kept like with “Queue”',
    ],
    // The window is a rolling 24 hours, not "the same calendar day".
    wDay: ['ภายใน 24 ชั่วโมง', 'Within 24 hours'],
    noWaiting: ['ไม่มีโพสต์ค้างรอส่วนขยาย', 'Nothing is waiting for the extension'],
  },
  err: {
    // Reconnecting only marks the account as signed in again; it is not TikTok-specific.
    signedIn: [
      'ทำเครื่องหมายว่าเข้าสู่ระบบอีกครั้งแล้ว กดลองใหม่ได้เลย',
      'Marked as signed in again. You can retry now',
    ],
  },
  reasons: {
    // The design's texts were sample cases (TikTok, LINE OA, X video size). The server uses these codes for
    // any platform and for more situations, and the real reason arrives as the failure detail, which the
    // errors page shows instead of the body when there is one.
    rate_limit: {
      body: [
        'Facebook แสดงคำเตือนหรือจำกัดการโพสต์ ส่วนขยายจึงหยุดและโพสต์นี้ยังไม่ถูกส่ง',
        'Facebook showed a warning or a posting limit, so the extension stopped and this post was not sent',
      ],
      fix: [
        'รอสักพักแล้วกดลองใหม่ และพิจารณาเพิ่มระยะหน่วงระหว่างโพสต์หรือลดเพดานต่อวัน',
        'Wait a while, then retry, and consider a longer delay between posts or a lower daily limit',
      ],
    },
    session: {
      title: ['ต้องเข้าสู่ระบบใหม่', 'Sign-in needed'],
      body: [
        'ส่วนขยายโพสต์ไม่ได้เพราะบัญชีขอให้เข้าสู่ระบบใหม่',
        'The extension could not post because the account asked to sign in again',
      ],
      fix: [
        'เปิดเบราว์เซอร์ที่ติดตั้งส่วนขยาย เข้าสู่ระบบบัญชีนั้น แล้วกด “เข้าสู่ระบบใหม่” และลองใหม่',
        'Open the browser with the extension, sign in to the account, press “Sign in again”, then retry',
      ],
    },
    network: {
      title: ['โพสต์ไม่สำเร็จ', 'The post did not complete'],
      body: [
        'ส่วนขยายทำโพสต์ไม่เสร็จ (การเชื่อมต่อหลุด ไม่ส่งผลกลับใน 15 นาที หรือไม่พบกลุ่มแล้ว) โพสต์อาจออกไปแล้วหรือยังไม่ออกก็ได้',
        'The extension did not finish the post (connection lost, no report within 15 minutes, or the group is gone). It may or may not have gone out',
      ],
      fix: [
        'ตรวจดูในกลุ่มก่อน ถ้ายังไม่มีโพสต์ค่อยกดลองใหม่',
        'Check the group first, then retry if the post is not there',
      ],
    },
    media_too_large: {
      title: ['ไฟล์ใหญ่เกินกำหนด', 'File too large'],
      body: [
        'ไฟล์ที่แนบกับโพสต์นี้ใหญ่กว่าที่แพลตฟอร์มรับได้',
        'A file attached to this post is larger than the platform accepts',
      ],
      fix: [
        'ใช้ไฟล์ที่เล็กลงจากคลังสื่อ แล้วกดลองใหม่',
        'Use a smaller file from the library, then retry',
      ],
    },
    quota: {
      title: ['ถึงเพดานการโพสต์แล้ว', 'Posting limit reached'],
      body: [
        'ถึงเพดานต่อ 24 ชั่วโมงของแพลตฟอร์มนี้ (หรือโควตาของแผน) โพสต์นี้จึงไม่ถูกส่ง',
        'The limit for this platform in 24 hours (or your plan’s posts) was reached, so this post was not sent',
      ],
      fix: [
        'เพิ่มเพดานในหน้าความปลอดภัยบัญชี อัปเกรดแผน หรือกดลองใหม่ภายหลัง',
        'Raise the limit in Account safety, upgrade the plan, or retry later',
      ],
    },
  },
  plans: {
    // The Free plan is permanent: there is no 14-day trial.
    free: {
      name: ['ฟรี', 'Free'],
      tag: ['ใช้ฟรีไม่จำกัดเวลา', 'Free, no time limit'],
    },
  },
  team: {
    // Devices are limited per workspace by the owner's plan, not per account.
    devicesBody: [
      'เวิร์กสเปซนี้จับคู่อุปกรณ์ได้สูงสุด {n} เครื่อง ตามแผนของเจ้าของ',
      'This workspace can pair at most {n} devices, set by the owner’s plan',
    ],
    devicesUnl: ['ไม่จำกัดจำนวนอุปกรณ์', 'No device limit'],
    // The gate shows whenever the owner's plan has a single seat.
    gate: [
      'แผนปัจจุบันมี 1 ที่นั่ง จึงยังเชิญสมาชิกไม่ได้',
      'Your plan has a single seat, so you cannot invite teammates yet',
    ],
    gateBody: [
      'อัปเกรดเป็นแผนที่มีหลายที่นั่งเพื่อเชิญเพื่อนร่วมทีมและลูกค้า พร้อมกำหนดสิทธิ์แยกตามเวิร์กสเปซ',
      'Upgrade to a plan with more seats to invite teammates and clients with per-workspace roles',
    ],
    // No email is sent: the person joins when they sign up or log in with that address.
    invited: [
      'เพิ่มคำเชิญสำหรับ {e} แล้ว เขาเข้าทีมเมื่อสมัครหรือเข้าสู่ระบบด้วยอีเมลนี้ (ไม่มีการส่งอีเมล)',
      'Invitation added for {e}. They join when they sign up or log in with this email (no email is sent)',
    ],
    // The device stops at its next call to the API, and has to be paired again from the web.
    revokeBody: [
      'ส่วนขยายบนอุปกรณ์นี้จะหยุดโพสต์ภายในไม่กี่วินาที และต้องจับคู่ใหม่จากหน้าเว็บจึงจะโพสต์ได้อีก',
      'The extension on this device stops posting within moments and must be paired again from the web to post again',
    ],
  },
  adm: {
    // The failed-card note was a fixed sample ("declined twice, email sent").
    nPastDue: [
      'ตัดบัตรครั้งล่าสุดไม่สำเร็จ Stripe จะลองใหม่ให้อัตโนมัติ',
      'The last card payment failed; Stripe retries automatically',
    ],
    // Limits apply to everyone on the plan at once; a new price applies to new subscriptions.
    plansSub: [
      'ข้อจำกัดของแผนมีผลกับลูกค้าทุกคนในแผนทันที ส่วนราคาใหม่ใช้กับการสมัครใหม่ การเปลี่ยนแต่ละช่องบันทึกอัตโนมัติ',
      'Plan limits apply to every customer on the plan at once; a new price applies to new subscriptions. Each change saves as you make it',
    ],
    // Suspend and ban block sign-in and posting and pause billing; neither cancels the subscription.
    aSuspend: [
      'ลูกค้าเข้าสู่ระบบและโพสต์ไม่ได้จนกว่าจะคืนสถานะ และหยุดเรียกเก็บเงินไว้ ส่วนขยายทุกเครื่องหยุดเมื่อติดต่อเซิร์ฟเวอร์ครั้งถัดไป',
      'The customer cannot sign in or post until restored, and billing pauses. Every extension stops at its next call',
    ],
    aBan: [
      'บล็อกบัญชี: เข้าสู่ระบบและโพสต์ไม่ได้ และหยุดการเรียกเก็บเงินไว้ คืนสถานะได้ภายหลัง',
      'Blocks the account: sign-in and posting stop and billing is paused. It can be restored later',
    ],
    // The job counts cover the last 24 hours (and what is queued), not the calendar day.
    jobsCol: ['งาน 24 ชม. (สำเร็จ · ล้มเหลว · รอ)', 'Jobs, 24 h (ok · failed · queued)'],
    jOk: ['สำเร็จใน 24 ชม.', 'Posted, 24 h'],
    jFailed: ['ล้มเหลว 24 ชม.', 'Failed, 24 h'],
    postLimit: ['โพสต์ต่อ 24 ชม.', 'Posts per 24 h'],
    limPosts: ['โพสต์ต่อ 24 ชม.', 'Posts per 24 h'],
    gQueued: ['รอโพสต์', 'Queued'],
  },
  ext: {
    // The popup preview shows the real device's version and pauses the real jobs.
    version: ['เวอร์ชัน {v} · Chrome', 'Version {v} · Chrome'],
    pause: ['พักรับงาน', 'Pause jobs'],
    paused: ['พักรับงานอยู่', 'Jobs paused'],
    quota: ['โควตาใน 24 ชม.', 'Quota, last 24 h'],
  },
} as const satisfies Fixes<typeof AP_I18N>;

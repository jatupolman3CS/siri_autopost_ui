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
      'ไม่ต้องให้รหัสผ่านกับเรา บัญชีอยู่ในเบราว์เซอร์ของคุณเสมอ ตอนนี้โพสต์ลงกลุ่ม Facebook ได้ แพลตฟอร์มอื่น (Instagram, X, TikTok, LINE OA, Threads) จะเพิ่มภายหลัง',
      'No passwords handed to us; your account stays in your browser. Facebook groups work today; Instagram, X, TikTok, LINE OA and Threads come later',
    ],
    // The Thai text had a stray "แรก" and promised to connect any social account; only Facebook works today.
    ctaBody: [
      'ติดตั้งส่วนขยาย ล็อกอิน Facebook ในเบราว์เซอร์ของคุณตามปกติ และตั้งเวลาโพสต์แรกได้ภายใน 10 นาที',
      'Install the extension, sign in to Facebook in your browser as usual and schedule your first post in 10 minutes',
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
    // The design's "Post updated. Applies to tasks not yet sent" is not what happens: a schedule copies the
    // composed text into every task when it queues them, so editing the library post leaves queued tasks alone.
    updated: [
      'อัปเดตโพสต์แล้ว งานที่จัดคิวไว้แล้วยังใช้ข้อความเดิม งานที่จัดคิวหลังจากนี้ใช้ข้อความใหม่',
      'Post updated. Tasks already queued keep the old text; tasks queued from now on use the new one',
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
    // The meter counts what is really applied: the delay, the Facebook limit, typing, scrolling, the automatic
    // pause, and whether the plan has the advanced rules (the design's list, minus what nothing applies).
    riskNote: [
      'คำนวณจากค่าหน่วงต่ำสุด เพดาน Facebook การพิมพ์ การเลื่อนหน้า การหยุดอัตโนมัติ และกฎขั้นสูงของแผน',
      'Based on the minimum delay, the Facebook daily limit, typing, scrolling, the automatic pause and the plan’s advanced rules',
    ],
    // The extension types and scrolls; the server enforces the automatic pause and the warm-up caps. Only
    // "shuffle" is still saved without effect.
    humanBody: [
      'ส่วนขยายใช้การพิมพ์และการเลื่อนหน้า เซิร์ฟเวอร์บังคับใช้การหยุดอัตโนมัติและวอร์มอัพ ส่วนการสุ่มลำดับบันทึกไว้แต่ยังไม่มีผล',
      'The extension types and scrolls, and the server enforces the automatic pause and the warm-up. Shuffle is saved but has no effect yet',
    ],
    // The cap counts a rolling 24 hours (all platforms, this workspace), not the calendar day.
    dailyAll: [
      'เพดานโพสต์รวมใน 24 ชม. (0 = ไม่จำกัด)',
      'Overall posts per 24 hours (0 = no limit)',
    ],
    // The server looks at the last 24 hours and only once at least 10 posts have finished.
    stopFail: [
      'หยุดทุกตารางเมื่อล้มเหลวเกิน (% ของ 24 ชม. หลังมีอย่างน้อย 10 โพสต์, 0 = ปิด)',
      'Stop every schedule when failures exceed (% of the last 24 h, after at least 10 posts; 0 = off)',
    ],
    // The caps only apply while the warm-up switch above is on; the age counts from pairing the browser.
    warmBody: [
      'เมื่อเปิดโหมดวอร์มอัพด้านบน บัญชีที่เพิ่งผูกเครื่องจะถูกจำกัดโพสต์ต่อวันแล้วค่อยเพิ่มตามตาราง',
      'With the warm-up switch above on, a newly paired account is capped per day and ramps up on this timetable',
    ],
    // The file does not hold the basic sliders and limits, nor any token.
    backupBody: [
      'ดาวน์โหลดชุดโพสต์ ชุดลิงก์ ตารางโพสต์ ค่าขั้นสูง กฎแจ้งเตือนและตอบกลับอัตโนมัติเป็นไฟล์เดียว เพื่อย้ายเครื่องหรือเก็บสำรอง',
      'Download every collection, link set, schedule, the advanced settings and the notification and auto-reply rules as one file, to move machines or keep a backup',
    ],
    // Restoring also drops the posts the replaced schedules had queued and queues them again.
    restoreHint: [
      'วางเนื้อหาไฟล์สำรอง (JSON) ชุดโพสต์ ชุดลิงก์ และตารางปัจจุบันจะถูกแทนที่ โพสต์ที่ตารางเดิมจัดคิวไว้จะถูกลบแล้วจัดคิวใหม่',
      'Paste the backup file (JSON). The current collections, link sets and schedules are replaced; posts the old schedules queued are deleted and queued again',
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
    // The design's button says the extension "re-checks" the sign-in, and its help text names TikTok and a
    // sample "Windows 11 PC". Pressing it only marks the account as signed in again (nothing is checked).
    signin: ['ฉันเข้าสู่ระบบแล้ว', 'I have signed in again'],
    signinHow: [
      'เปิด Facebook ในเบราว์เซอร์ที่ผูกส่วนขยายไว้ แล้วเข้าสู่ระบบตามปกติ จากนั้นกดปุ่มนี้',
      'Open Facebook in the browser paired with the extension and sign in as usual, then press this',
    ],
    checking: ['กำลังทำเครื่องหมายว่าเข้าสู่ระบบแล้ว…', 'Marking the account as signed in again…'],
    // Reconnecting only marks the account as signed in again; it is not TikTok-specific.
    signedIn: [
      'ทำเครื่องหมายว่าเข้าสู่ระบบอีกครั้งแล้ว กดลองใหม่ได้เลย',
      'Marked as signed in again. You can retry now',
    ],
  },
  sch: {
    // The design asks for a name, but the name is optional: without one the API calls the schedule "collection → set".
    errForm: [
      'กรุณาเลือกชุดโพสต์ ชุดลิงก์ และเวลาอย่างน้อย 1 เวลา',
      'Please choose a collection, a link set and at least one time',
    ],
  },
  ts: {
    // The design's "synced at 10:12" was a fixed sample time: the list is whatever the extension last reported.
    importHint: [
      'รายการกลุ่มที่ส่วนขยายซิงก์ไว้ล่าสุดของบัญชีนี้ เลือกกลุ่มที่ต้องการเพิ่มเข้าชุด กลุ่มที่อยู่ในชุดแล้วถูกข้าม',
      'The groups the extension last synced for this account. Tick the groups to add; groups already in the set are skipped',
    ],
    // The design named a sample page and a sample profile. Accounts are picked from the workspace's real accounts
    // and labelled with their real names, so these are only the generic kinds.
    postAsPage: ['เพจ Facebook', 'Facebook page'],
    postAsProfile: ['โปรไฟล์ส่วนตัว', 'Personal profile'],
    // The design used this label both for a group the engine switched off after failures and for one the owner
    // switched off by hand. Only the failure case has its own text (hOffReason, with the count); a link that is
    // off with no failures was switched off on purpose, so "auto-disabled" would be wrong.
    hOff: ['ปิดใช้งานอยู่', 'Switched off'],
    // The file is read as UTF-8 and may be at most 2 MB; the design only talked about pasting.
    csvHint: [
      'วางข้อมูลจาก Excel หรือเลือกไฟล์ CSV ที่เป็น UTF-8 (ไม่เกิน 2 MB): ชุดลิงก์, ชื่อกลุ่ม, ลิงก์, รหัสกลุ่ม (คั่นด้วยจุลภาคหรือแท็บ) ชุดที่ยังไม่มีจะถูกสร้างให้',
      'Paste rows from Excel or choose a UTF-8 CSV file (up to 2 MB): set, group name, link, group code (comma or tab separated). Missing sets are created',
    ],
  },
  ntf: {
    // The design says the extension sends the messages and the tokens stay on the machine. Our server sends
    // them (Telegram and LINE), and the tokens are stored on the server and never shown again.
    sub: [
      'รับแจ้งเตือนผ่าน Telegram หรือ LINE OA เลือกเหตุการณ์ที่ต้องการ และตั้งค่าแยกตามชุดลิงก์หรือรายกลุ่มได้ ข้อความส่งจากเซิร์ฟเวอร์ของเรา โทเค็นเก็บไว้ที่เซิร์ฟเวอร์และไม่แสดงให้เห็นอีกหลังบันทึก',
      'Get alerts on Telegram or LINE OA, choose which events to send, and override the settings per link set or per group. Messages are sent by our server; tokens are stored on the server and never shown again after saving',
    ],
    // "Near the daily limit" suggests an early warning; the alert goes out when a post fails for hitting the limit.
    eQuota: ['ถึงเพดานการโพสต์', 'Posting limit reached'],
    // Nothing reads the bot yet: the allow-list and the switch are only saved.
    cmdBody: [
      'ยังใช้ไม่ได้: คำสั่งผ่านแชท (หยุด/เริ่ม/ดูสถานะ) บันทึกการตั้งค่าไว้ล่วงหน้าเท่านั้น ยังไม่มีบอทที่รับคำสั่ง',
      'Not available yet: chat commands (stop, start, status) are only saved ahead of time, and nothing listens to the bot',
    ],
    cmdSample: [
      'ตัวอย่างเมื่อเปิดให้ใช้: /status → “ทำงานอยู่ · วันนี้ 18/32 โพสต์ · ล้มเหลว 1 · รอบถัดไป 14:00”',
      'Example once it is available: /status → “Running · today 18/32 posts · 1 failed · next round 14:00”',
    ],
    // The design's sample has an emoji, a code line and a clock time. The server sends one line: the result, the
    // group with its code in brackets (no brackets without a code) and the start of the post. {g} carries both.
    sample: ['โพสต์สำเร็จ · {g} · “{t}”', 'Posted · {g} · “{t}”'],
  },
  ai: {
    // There is no language model: the drafts are filled in from text templates.
    note: [
      'โพสต์สร้างจากแม่แบบข้อความ ไม่ได้ใช้โมเดลภาษา โปรดตรวจและแก้ก่อนนำไปใช้',
      'Posts are filled in from text templates, not written by a language model. Review and edit them before use',
    ],
  },
  ar: {
    // The rules are stored, but the extension does not read comments or reply yet.
    sub: [
      'ตั้งกฎตอบคอมเมนต์ตามคีย์เวิร์ดและข้อความเข้าแชทไว้ล่วงหน้าได้ แต่ตอนนี้ส่วนขยายยังไม่อ่านคอมเมนต์และยังไม่ตอบ จึงบันทึกกฎไว้เท่านั้น',
      'Set keyword rules for replying to comments and sending a chat message ahead of time. For now the extension does not read comments or reply, so the rules are only saved',
    ],
    // AI writing is not gated by the plan (and is template based); only the auto-reply page is.
    locked: ['ตอบกลับอัตโนมัติใช้ได้ในแผน Pro ขึ้นไป', 'Auto-reply is available on Pro and above'],
  },
  rep: {
    // Likes and comments are not collected by the extension.
    sub: [
      'ดูว่ากลุ่มไหนคุ้ม โพสต์ไหนใช้บ่อย และส่งรายงานให้ลูกค้าได้จากที่นี่ ยังไม่มีข้อมูลไลก์และคอมเมนต์ เพราะส่วนขยายยังไม่อ่านกลับมา',
      'See which groups pay off, which posts are used most, and send client reports from here. Likes and comments are not collected yet, because the extension does not read them back',
    ],
    // The share link is a snapshot made when it is created (valid for 30 days), not a live page.
    fLink: [
      'ลิงก์แชร์ (สรุปตัวเลข ณ วันที่สร้าง ใช้ได้ 30 วัน)',
      'Shareable link (a snapshot of the numbers when it is created, valid for 30 days)',
    ],
    // A group is switched off where it is listed, not "in every link set".
    disabledMsg: ['ปิดกลุ่ม {g} แล้ว', 'Group {g} switched off'],
    // The design has the agency upload its own logo. Nothing stores one: the box only decides whether the
    // AutoPost name and mark show on the shared page, so it is a "white-label" switch.
    logo: [
      'ซ่อนโลโก้และชื่อ AutoPost บนรายงาน (แสดงเฉพาะชื่อแบรนด์ของคุณ)',
      'Hide the AutoPost logo and name on the report (show only your brand name)',
    ],
    // The report is a page behind a link (print or save as PDF from it), not a generated file, and its logo is
    // the brand name only (see logo).
    clientSub: [
      'สรุปผลของเวิร์กสเปซนี้เป็นหน้ารายงานที่ลูกค้าเปิดผ่านลิงก์ได้ ใส่ชื่อแบรนด์ของเอเจนซี่และซ่อนชื่อ AutoPost ได้ (white-label) พิมพ์หรือบันทึกเป็น PDF จากหน้ารายงาน',
      'A summary of this workspace as a page your client opens from a link, with your agency’s brand name and no AutoPost branding (white-label). Print it or save it as a PDF from the report page',
    ],
    // The periods are the last 7 and the last 30 days counted back from now, not a calendar week or month.
    pWeek: ['7 วันล่าสุด', 'Last 7 days'],
    pMonth: ['30 วันล่าสุด', 'Last 30 days'],
    // {p} is a period name; the design's "<period> report for <workspace> created: <file>" named a file.
    created: ['สร้างรายงาน ({p}) ของ {w} แล้ว: {l}', 'Report ({p}) for {w} created: {l}'],
  },
  test: {
    // The test post is real, so the page shows its real state (queued, posting, result), not simulated steps.
    // The leaves l1-l7 (opening the group, scrolling, typing...) describe steps nothing reports back, so no page uses them.
    logTitle: ['ความคืบหน้า', 'Progress'],
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

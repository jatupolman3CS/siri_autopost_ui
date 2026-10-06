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
    // Only Facebook groups and pages are posted to (the design also listed Instagram, X, TikTok, LINE OA and
    // Threads): the line next to the Facebook mark says exactly that, and nothing else is promised.
    platforms: ['โพสต์ลงกลุ่มและเพจ Facebook', 'Posts to Facebook groups and pages'],
    heroTitle: [
      'โพสต์ขายของลงทุกกลุ่มและเพจ Facebook อัตโนมัติ โดยไม่เสี่ยงโดนแบน',
      'Post to every Facebook group and page automatically, without risking a ban',
    ],
    s1t: [
      'ติดตั้งส่วนขยายในเบราว์เซอร์ที่คุณล็อกอิน Facebook อยู่แล้ว',
      'Install the extension in the browser where you are signed in to Facebook',
    ],
    s1b: [
      'ไม่ต้องให้รหัสผ่านหรือเชื่อมต่อ API กับเรา บัญชีอยู่ในเบราว์เซอร์ของคุณเสมอ ตอนนี้โพสต์ลงกลุ่มและเพจ Facebook',
      'No passwords or API access handed to us; your account stays in your browser. Posts to Facebook groups and pages',
    ],
    s2b: [
      'เขียนครั้งเดียว เลือกกลุ่มและเพจปลายทาง ตั้งเวลาและทำซ้ำ',
      'Write once, pick the target groups and pages, set the time and repeat',
    ],
    s3b: [
      'หน่วงเวลาสุ่ม พิมพ์ทีละตัวอักษร และหยุดเองเมื่อ Facebook เตือน',
      'Random delays, character-by-character typing, and an automatic pause when Facebook warns you',
    ],
    f4b: ['ตั้งจำนวนโพสต์ Facebook สูงสุดต่อวัน', 'Cap how many Facebook posts go out per day'],
    p2t: ['ผู้ดูแลเพจและกลุ่ม Facebook', 'Facebook page and group managers'],
    p2b: [
      'ศูนย์กลางตารางคอนเทนต์สำหรับหลายกลุ่มและหลายเพจ',
      'One content calendar for all your groups and pages',
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
    // The plan counts Facebook accounts (one for each paired browser), not social accounts of any platform.
    accounts: ['บัญชี Facebook', 'Facebook accounts'],
    // The limit counts a rolling 24 hours, not the calendar day.
    postsToday: ['โพสต์ใน 24 ชม.', 'Posts, last 24 h'],
    perDay: ['ต่อ 24 ชม.', 'per 24 h'],
  },
  // The posts are a library of their own now (the first step); a collection includes posts that exist already.
  flow: {
    s1: ['จัดโพสต์เป็นชุด', 'Put posts into collections'],
    s1b: ['โพสต์หนึ่งอยู่ได้หลายชุด', 'One post can sit in several collections'],
    // The link sets hold Facebook groups and pages.
    s2: ['วางลิงก์กลุ่มหรือเพจเป็นชุด', 'Paste group and page links into a set'],
    n1: ['วางลิงก์กลุ่มหรือเพจที่จะโพสต์', 'Paste the groups and pages to post to'],
  },
  // The menu names the posting targets: Facebook groups and pages.
  nav: {
    targets: ['ลิงก์กลุ่มและเพจ', 'Group & page links'],
    groupsShort: ['กลุ่มและเพจที่จะโพสต์', 'Groups and pages to post to'],
  },
  ov: {
    // A link set holds groups and pages, so the first step counts links.
    s1: ['วางลิงก์กลุ่มหรือเพจที่จะโพสต์', 'Paste the groups and pages to post to'],
    s1d: ['{n} ลิงก์ ใน {m} ชุด', '{n} links in {m} sets'],
    s1a: ['เพิ่มลิงก์กลุ่มหรือเพจ', 'Add group or page links'],
    // The panel lists the paired extensions (the devices), not the sample social accounts of the design; the note
    // below is no longer shown, and says what is true if it ever is.
    accountsTitle: ['ส่วนขยายที่เชื่อมต่อ', 'Connected extensions'],
    accountsNote: [
      'ระบบไม่เชื่อมต่อ Facebook เอง ส่วนขยายใช้บัญชีที่คุณล็อกอินอยู่ในเบราว์เซอร์ที่ผูกไว้ แล้วโพสต์จากเครื่องนั้น',
      'We never connect to Facebook ourselves. The extension uses the account you are signed in to on the paired browser and posts from that machine',
    ],
  },
  col: {
    sub: [
      'จัดโพสต์จากคลังโพสต์เป็นชุดตามสินค้าหรือหัวข้อ โพสต์หนึ่งอยู่ได้หลายชุด แต่ละชุดจะถูกจับคู่กับชุดลิงก์ที่ตรงกันในหน้าตารางโพสต์ เช่น ชุดคอนโดลงเฉพาะกลุ่มคอนโด',
      'Put posts from the post library into collections by product or topic; one post can sit in several. Each collection is paired with the matching link set on the Schedules page, so condo posts only reach condo groups',
    ],
    // The row's button takes the post out of this collection only; the post stays in the library.
    deleted: [
      'เอาโพสต์ออกจากชุดแล้ว โพสต์ยังอยู่ในคลังโพสต์',
      'Post taken out of the collection. It is still in the post library',
    ],
  },
  cmp: {
    // The design's "Post updated. Applies to tasks not yet sent" is not what happens: a schedule copies the
    // composed text into every task when it queues them, so editing the library post leaves queued tasks alone.
    updated: [
      'อัปเดตโพสต์แล้ว งานที่จัดคิวไว้แล้วยังใช้ข้อความเดิม งานที่จัดคิวหลังจากนี้ใช้ข้อความใหม่',
      'Post updated. Tasks already queued keep the old text; tasks queued from now on use the new one',
    ],
    // "(randomized)" was only true with the smart delay on; the summary adds its own ending. Facebook is the
    // only platform, so {p} counts the targets (groups and pages).
    summary: [
      'จะสร้าง {n} งานโพสต์ไปยัง {p} กลุ่มหรือเพจ ระหว่าง {t1}–{t2}',
      'Creates {n} tasks to {p} groups and pages between {t1}–{t2}',
    ],
    // The editor's insert toolbar: the buttons say what they put in, and the hints explain {{code}} and
    // Spintax in plain words (the design only showed the raw braces, which people could not make sense of).
    insertCode: ['{{code}} รหัสกลุ่ม', '{{code}} Group code'],
    insertSpin: ['{ } Spintax', '{ } Spintax'],
    codeHint: [
      'แทรก {{code}} ตรงเคอร์เซอร์ ตอนโพสต์ระบบแทนด้วยรหัสของแต่ละกลุ่ม ถ้าไม่ใส่ รหัสจะอยู่บรรทัดแรกเอง',
      'Inserts {{code}} at the cursor. When the post goes out it is replaced by each group’s own code. Without it the code goes on line 1',
    ],
    spinHint: [
      'สุ่มคำให้แต่ละกลุ่มได้ข้อความไม่ซ้ำกัน เช่น {สวัสดี|หวัดดี} กลุ่มหนึ่งได้ “สวัสดี” อีกกลุ่มได้ “หวัดดี”',
      'Mixes words so every group gets different text, like {Hello|Hi}: one group gets “Hello”, another “Hi”',
    ],
    // The draft only lives in this browser tab.
    toastDraft: [
      'เก็บฉบับร่างไว้แล้ว (อยู่ในหน้านี้จนกว่าจะปิดหรือรีโหลด)',
      'Draft kept (it stays in this tab until you close or reload the page)',
    ],
  },
  ab: {
    // Facebook is the only platform: one rolling 24-hour limit; the server fails the post (quota), it does not roll it over.
    limitsTitle: ['เพดานโพสต์ Facebook ต่อวัน', 'Facebook daily limit'],
    limitsBody: [
      'จำนวนโพสต์ Facebook สูงสุดใน 24 ชั่วโมง เมื่อถึงเพดาน โพสต์ที่เหลือจะล้มเหลวด้วยสาเหตุโควตา (ลองใหม่ภายหลังได้) ไม่ถูกเลื่อนไปพรุ่งนี้เอง',
      'Maximum Facebook posts in any 24 hours. At the limit the rest fail with a quota error (retry later); nothing rolls over to tomorrow',
    ],
    w4: ['หลังจากนั้น: ตามเพดานโพสต์ Facebook ต่อวัน', 'After that: the Facebook daily limit'],
    // Facebook is the only platform.
    hPause: [
      'หยุดอัตโนมัติเมื่อ Facebook แสดงคำเตือน',
      'Pause automatically when Facebook shows a warning',
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
    // The extension types (at the chosen speed), scrolls and brings its window to the front; the server shuffles the
    // order of the groups of a slot, enforces the automatic pause and the warm-up caps. Nothing is saved without effect.
    humanBody: [
      'ส่วนขยายพิมพ์ เลื่อนหน้า และดึงหน้าต่างขึ้นมาไว้ด้านหน้า ส่วนเซิร์ฟเวอร์สุ่มลำดับกลุ่มในแต่ละรอบ หยุดอัตโนมัติ และจำกัดบัญชีใหม่ (วอร์มอัพ)',
      'The extension types, scrolls and brings its window to the front; the server shuffles the order of the groups in each round, pauses automatically and caps new accounts (warm-up)',
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
    // Restoring also drops the posts the replaced schedules had queued and queues them again. It takes two
    // clicks: "Check the file" lists what the file holds, and only the second one replaces anything.
    restoreHint: [
      'วางเนื้อหาไฟล์สำรอง (JSON) แล้วกด “ตรวจไฟล์” เพื่อดูสรุปก่อน ยังไม่มีอะไรถูกแทนที่จนกว่าจะยืนยันอีกครั้ง ชุดโพสต์ ชุดลิงก์ และตารางปัจจุบันจะถูกแทนที่ โพสต์ที่ตารางเดิมจัดคิวไว้จะถูกลบแล้วจัดคิวใหม่',
      'Paste the backup file (JSON) and press “Check the file” to see a summary first; nothing is replaced until you confirm again. The current collections, link sets and schedules are replaced; posts the old schedules queued are deleted and queued again',
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
    // The bump is real now (the extension comments on the posted link again) and a Premium function.
    bump: ['ดันโพสต์ (Premium)', 'Bump posts (Premium)'],
    bumpOff: ['ไม่ดัน', 'No bump'],
    bumpH: ['ดันหลังโพสต์ {h} ชม.', 'Bump {h} h after the post'],
    // A link set holds groups and pages: the per-link times are called that.
    set: ['ชุดลิงก์', 'Link set'],
    perGroup: ['เวลาเฉพาะกลุ่มหรือเพจ', 'Per-group and page times'],
    perGroupHint: [
      'ลิงก์ที่เว้นว่างจะใช้เวลาของตาราง ใส่หลายเวลาคั่นด้วยจุลภาค เช่น 09:30, 19:00',
      'Blank links follow the schedule. Separate several times with commas, e.g. 09:30, 19:00',
    ],
    pickSetFirst: [
      'เลือกชุดลิงก์ก่อน แล้วจึงกำหนดเวลาเฉพาะลิงก์ได้',
      'Choose a link set first to set per-link times',
    ],
    overridesN: ['เวลาเฉพาะ {n} ลิงก์', '{n} links with their own times'],
    codeNote: [
      '{n} ลิงก์ในชุดนี้มีรหัสกลุ่ม ระบบจะเขียนรหัสก่อนเนื้อหาให้อัตโนมัติ',
      '{n} links in this set have a code; it is written before the content automatically',
    ],
    // The design asks for a name, but the name is optional: without one the API calls the schedule "collection → set".
    errForm: [
      'กรุณาเลือกชุดโพสต์ ชุดลิงก์ และเวลาอย่างน้อย 1 เวลา',
      'Please choose a collection, a link set and at least one time',
    ],
  },
  ts: {
    // A link set holds Facebook groups AND pages (the server tells them apart by the address).
    title: ['ลิงก์กลุ่มและเพจ', 'Group & page links'],
    sub: [
      'วางลิงก์กลุ่มหรือเพจ Facebook ที่ต้องการโพสต์ จัดเป็นชุดตามหัวข้อ และใส่รหัสกลุ่มเพื่อให้ระบบเขียนรหัสก่อนเนื้อหาทุกครั้งที่โพสต์ลงที่นั้น',
      'Paste the Facebook group or page links you post to, organise them into sets by topic, and add a group code so the engine writes it before the content every time it posts there',
    ],
    namePh: ['ชื่อกลุ่มหรือเพจ', 'Group or page name'],
    urlPh: ['ลิงก์กลุ่มหรือเพจ Facebook', 'Facebook group or page link'],
    bulkTitle: ['วางลิงก์ครั้งละหลายกลุ่มหรือเพจ', 'Paste several group or page links at once'],
    bulkHint: [
      'หนึ่งบรรทัดต่อหนึ่งกลุ่มหรือเพจ ใส่รหัสกลุ่มหลังเครื่องหมาย | ได้ ลิงก์ที่มีอยู่แล้วจะถูกข้าม (อัปเดตรหัสให้ถ้าเปลี่ยน)',
      'One group or page per line. Put the group code after a | sign. Links already in the set are skipped (their code is updated if it changed)',
    ],
    bulkPh: [
      'https://www.facebook.com/groups/condo.bkk | #Jan240015\nhttps://www.facebook.com/groups/condo.rent\nhttps://www.facebook.com/baandee.shop',
      'https://www.facebook.com/groups/condo.bkk | #Jan240015\nhttps://www.facebook.com/groups/condo.rent\nhttps://www.facebook.com/baandee.shop',
    ],
    bulkEmpty: [
      'ไม่พบลิงก์กลุ่มหรือเพจ Facebook ในข้อความที่วาง',
      'No Facebook group or page links found in the pasted text',
    ],
    invalidUrl: ['ไม่ใช่ลิงก์กลุ่มหรือเพจ Facebook', 'Not a Facebook group or page link'],
    csvTitle: [
      'นำเข้าลิงก์กลุ่มและเพจจาก CSV / Excel',
      'Import group and page links from CSV / Excel',
    ],
    reenabled: ['เปิดใช้ลิงก์อีกครั้งแล้ว', 'Link enabled again'],
    // The extension (a paired browser) that posts the set; the select lists the browsers by name.
    postAs: ['ส่วนขยายที่โพสต์ชุดนี้', 'Extension that posts this set'],
    // The design used this label both for a group the engine switched off after failures and for one the owner
    // switched off by hand. Only the failure case has its own text (hOffReason, with the count); a link that is
    // off with no failures was switched off on purpose, so "auto-disabled" would be wrong.
    hOff: ['ปิดใช้งานอยู่', 'Switched off'],
    // The file is read as UTF-8 and may be at most 2 MB; the design only talked about pasting.
    csvHint: [
      'วางข้อมูลจาก Excel หรือเลือกไฟล์ CSV ที่เป็น UTF-8 (ไม่เกิน 2 MB): ชุดลิงก์, ชื่อกลุ่มหรือเพจ, ลิงก์กลุ่มหรือเพจ, รหัสกลุ่ม (คั่นด้วยจุลภาคหรือแท็บ) ชุดที่ยังไม่มีจะถูกสร้างให้',
      'Paste rows from Excel or choose a UTF-8 CSV file (up to 2 MB): set, group or page name, group or page link, group code (comma or tab separated). Missing sets are created',
    ],
  },
  ntf: {
    // The design says the extension sends the messages and the tokens stay on the machine. Our server sends
    // them (Telegram and LINE), and the tokens are stored on the server and never shown again.
    sub: [
      'รับแจ้งเตือนผ่าน Telegram หรือ LINE OA เลือกเหตุการณ์ที่ต้องการ และตั้งค่าแยกตามชุดลิงก์หรือรายกลุ่มและเพจได้ ข้อความส่งจากเซิร์ฟเวอร์ของเรา โทเค็นเก็บไว้ที่เซิร์ฟเวอร์และไม่แสดงให้เห็นอีกหลังบันทึก',
      'Get alerts on Telegram or LINE OA, choose which events to send, and override the settings per link set or per group and page. Messages are sent by our server; tokens are stored on the server and never shown again after saving',
    ],
    // The links of a set are groups and pages.
    perSetHint: [
      'ชุดที่ตั้งเป็น “ตามค่าเริ่มต้น” ใช้ช่องทางและเหตุการณ์ด้านบน ปรับเฉพาะชุดหรือกดดูรายกลุ่มและเพจเพื่อตั้งค่าแยกรายลิงก์',
      'Sets left on “Workspace default” use the channel and events above. Override a set, or open its groups and pages to set them one by one',
    ],
    groups: ['รายกลุ่มและเพจ', 'Groups and pages'],
    hideGroups: ['ซ่อนรายกลุ่มและเพจ', 'Hide groups and pages'],
    summary: [
      '{on} จาก {n} ลิงก์ได้รับการแจ้งเตือน · Telegram {tg} · LINE OA {ln}',
      '{on} of {n} links send alerts · Telegram {tg} · LINE OA {ln}',
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
    // The writer is a real AI model now (it needs an AI key set up by the admin and the Pro plan or above): the
    // design's note about a prototype with templates is not true any more, and the selling points are typed one
    // at a time (Enter adds one), not as a comma-separated list.
    note: [
      'AI อาจเขียนผิดพลาดได้ ตรวจและแก้ก่อนโพสต์จริง',
      'AI can make mistakes. Read and edit the draft before it goes out',
    ],
    pointsPh: [
      'พิมพ์จุดขายแล้วกด Enter เช่น ส่งฟรี',
      'Type a selling point and press Enter, e.g. Free shipping',
    ],
  },
  ar: {
    // The rules are stored, but the extension does not read comments or reply yet.
    sub: [
      'ตั้งกฎตอบคอมเมนต์ตามคีย์เวิร์ดและข้อความเข้าแชทไว้ล่วงหน้าได้ แต่ตอนนี้ส่วนขยายยังไม่อ่านคอมเมนต์และยังไม่ตอบ จึงบันทึกกฎไว้เท่านั้น',
      'Set keyword rules for replying to comments and sending a chat message ahead of time. For now the extension does not read comments or reply, so the rules are only saved',
    ],
    // This text is the auto-reply page's own lock (the AI writer has its own note in the post editor).
    locked: ['ตอบกลับอัตโนมัติใช้ได้ในแผน Pro ขึ้นไป', 'Auto-reply is available on Pro and above'],
  },
  rep: {
    // Likes and comments are not collected by the extension.
    sub: [
      'ดูว่ากลุ่มหรือเพจไหนคุ้ม โพสต์ไหนใช้บ่อย และส่งรายงานให้ลูกค้าได้จากที่นี่ ยังไม่มีข้อมูลไลก์และคอมเมนต์ เพราะส่วนขยายยังไม่อ่านกลับมา',
      'See which groups and pages pay off, which posts are used most, and send client reports from here. Likes and comments are not collected yet, because the extension does not read them back',
    ],
    byGroup: ['ผลต่อกลุ่มและเพจ', 'By group and page'],
    group: ['กลุ่ม / เพจ', 'Group / page'],
    disable: ['ปิดลิงก์นี้', 'Disable link'],
    // The plan is called "Premium" for people (its key stays `agency`).
    client: ['รายงานส่งลูกค้า (Premium)', 'Client report (Premium)'],
    clientLocked: [
      'รายงานส่งลูกค้าแบบ white-label ใช้ได้ในแผน Premium',
      'White-label client reports are available on the Premium plan',
    ],
    // The share link is a snapshot made when it is created (valid for 30 days), not a live page.
    fLink: [
      'ลิงก์แชร์ (สรุปตัวเลข ณ วันที่สร้าง ใช้ได้ 30 วัน)',
      'Shareable link (a snapshot of the numbers when it is created, valid for 30 days)',
    ],
    // A group or page is switched off where it is listed, not "in every link set".
    disabledMsg: ['ปิด {g} แล้ว', '{g} switched off'],
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
    // Groups and pages (Facebook only), through the extension the person picks; the page has two panels (from a
    // collection, by hand), so the design's "one group" wording is widened.
    sub: [
      'ส่งโพสต์จริง 1 โพสต์ลงกลุ่มหรือเพจ Facebook ตอนนี้ ผ่านส่วนขยายที่เลือก เพื่อตรวจว่างานของตารางโพสต์ทำงานได้จริง ทั้งส่วนขยาย รหัสกลุ่ม ข้อความ และรูป เลือกจากชุดโพสต์ หรือพิมพ์เองก็ได้',
      'Send one real post to a Facebook group or page right now, through the extension you choose, to check that the jobs of a schedule really work: the extension, the group code, the text and the images. Pick it from a collection, or type it yourself',
    ],
    group: ['กลุ่มหรือเพจปลายทาง', 'Target group or page'],
    groupPh: ['เลือกกลุ่มหรือเพจ…', 'Choose a group or page…'],
    needPick: [
      'เลือกกลุ่มหรือเพจ และชุดโพสต์ก่อน',
      'Choose a group or page and a collection first',
    ],
    // The test post is real, so the page shows its real state (queued, posting, result), not simulated steps.
    // The leaves l1-l7 (opening the group, scrolling, typing...) describe steps nothing reports back, so no page uses them.
    logTitle: ['ความคืบหน้า', 'Progress'],
  },
  reasons: {
    // The design's texts were sample cases (TikTok, LINE OA, X video size). The server uses these codes for
    // more situations than the sample, and the real reason arrives as the failure detail, which the errors
    // page shows instead of the body when there is one. Facebook is the only platform.
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
        'ไฟล์ที่แนบกับโพสต์นี้ใหญ่กว่าที่ Facebook รับได้',
        'A file attached to this post is larger than Facebook accepts',
      ],
      fix: [
        'ใช้ไฟล์ที่เล็กลงจากคลังสื่อ แล้วกดลองใหม่',
        'Use a smaller file from the library, then retry',
      ],
    },
    quota: {
      title: ['ถึงเพดานการโพสต์แล้ว', 'Posting limit reached'],
      body: [
        'ถึงเพดานโพสต์ Facebook ต่อ 24 ชั่วโมง (หรือโควตาของแผน) โพสต์นี้จึงไม่ถูกส่ง',
        'The Facebook limit for 24 hours (or your plan’s posts) was reached, so this post was not sent',
      ],
      fix: [
        'เพิ่มเพดานในหน้าความปลอดภัยบัญชี อัปเกรดแผน หรือกดลองใหม่ภายหลัง',
        'Raise the limit in Account safety, upgrade the plan, or retry later',
      ],
    },
  },
  plans: {
    // The Free plan is permanent: there is no 14-day trial. Each tag says who the package suits.
    free: {
      name: ['ฟรี', 'Free'],
      tag: [
        'เหมาะกับ: ลองใช้ระบบ ฟรีไม่จำกัดเวลา',
        'Good for: trying it out, free with no time limit',
      ],
    },
    basic: {
      tag: ['เหมาะกับ: ร้านเล็ก ขายคนเดียว', 'Good for: a small shop with one seller'],
    },
    pro: {
      tag: [
        'เหมาะกับ: คนขายที่ใช้หลายเบราว์เซอร์',
        'Good for: a seller who works with several browsers',
      ],
    },
    // The top plan (key `agency`) is shown to people as "Premium": it carries every function, bumping included.
    agency: {
      name: ['Premium', 'Premium'],
      tag: ['เหมาะกับ: เอเจนซี่และคนใช้งานหนัก', 'Good for: agencies and heavy use'],
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
    // The plans count Facebook accounts (one for each paired browser).
    accLimit: ['จำนวนบัญชี Facebook', 'Facebook accounts allowed'],
    limAccounts: ['บัญชี Facebook', 'Facebook accounts'],
  },
} as const satisfies Fixes<typeof AP_I18N>;

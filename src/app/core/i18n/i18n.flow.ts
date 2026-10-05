import { registerPack } from './i18n.service';

// Lazy dictionary pack "flow": the strings the design handoff lacks for the Collections -> Link sets ->
// Schedules flow and its neighbours (composer, calendar, overview additions). Only the lazily loaded pages
// that read t().api.flow import this module, which registers the pack (see registerPack in i18n.service.ts),
// so it stays out of the first bundle. Every file that reads t().api.flow must `import './i18n.flow'`.
//
// How to add a leaf: append `name: ['ไทย', 'English'],` (a [th, en] pair, both languages) below, then read
// it as t().api.flow.name; fill {placeholders} with fmt(). Only the pages of this flow append here, so that
// pack files of different features never collide. A string of the design that is wrong for the real system
// is corrected in i18n.fixes.ts instead, with a comment saying what the design got wrong.
export const AP_I18N_FLOW = {
  // A setting that is saved with the collection, link set or schedule but not applied yet (collection page
  // tags, image shuffle and watermark; schedule bump and auto-delete). Keep the design's label and add this hint.
  // It says plainly that nothing applies the value (neither the extension nor the server), so a switch that is
  // on does not read as active.
  storedOnly: [
    'บันทึกไว้เท่านั้น ยังไม่มีส่วนใดนำค่านี้ไปใช้',
    'Saved only: nothing applies this setting yet',
  ],
  storedOnlyBadge: ['บันทึกเท่านั้น', 'Saved only'],
  // A control of a plan the owner does not have ({plan} is the plan's name, from t().plans).
  planLocked: ['ใช้ได้ในแผน {plan} ขึ้นไป', 'Available on {plan} and above'],

  // Collections and composer
  // Schedule names are not on the collection (only how many schedules use it), so the page counts them.
  usedInN: ['ใช้ใน {n} ตาราง', 'Used by {n} schedule(s)'],
  cmpColHint: ['ชุดนี้ถูกใช้ในตารางโพสต์ {n} ตาราง', 'This collection is used by {n} schedule(s)'],
  // An approved post that is edited in a collection that needs approval goes back to draft (server rule).
  cmpEditResets: [
    'ชุดนี้ต้องอนุมัติโพสต์ ถ้าแก้โพสต์ที่อนุมัติแล้ว โพสต์จะกลับเป็นฉบับร่างและต้องส่งขออนุมัติใหม่',
    'This collection needs approval: editing an approved post sends it back to draft and it must be approved again',
  ],
  cmpPostGone: [
    'ไม่พบโพสต์นี้แล้ว (อาจถูกลบไปแล้ว) จึงเริ่มโพสต์ใหม่ในชุดนี้แทน',
    'That post no longer exists (it may have been deleted), so a new post starts in this collection instead',
  ],
  cmpNoCollections: [
    'ยังไม่มีชุดโพสต์ สร้างชุดแรกก่อนจึงจะเก็บโพสต์ได้',
    'There are no collections yet. Create the first one to save the post in',
  ],
  // The spintax the "insert spintax" button puts in front of the text (user content: a sample to edit).
  spinSample: ['{สวัสดีค่ะ|หวัดดีค่ะ|ทักทายค่ะ} ', '{Hello|Hi|Hey} '],
  exportFailed: [
    'ส่งออกไฟล์ไม่สำเร็จ เบราว์เซอร์ไม่ให้ดาวน์โหลด',
    'The export failed: the browser did not allow the download',
  ],
  // A collection may hold thousands of posts: the page shows the first 50 and this button adds 50 more.
  showMorePosts: ['แสดงโพสต์เพิ่ม (เหลืออีก {n})', 'Show more posts ({n} left)'],

  // Empty states of the three pages (heading + description for app-empty-state).
  emptyCollectionsTitle: ['ยังไม่มีชุดโพสต์', 'No post collections yet'],
  emptyCollectionsBody: [
    'สร้างชุดโพสต์ แล้วเขียนโพสต์เก็บไว้ในชุด เช่น ชุดตามสินค้าหรือหัวข้อ',
    'Create a collection and write posts into it, for example one per product or topic',
  ],
  emptyLinkSetsTitle: ['ยังไม่มีชุดลิงก์กลุ่ม', 'No link sets yet'],
  emptyLinkSetsBody: [
    'สร้างชุดลิงก์ แล้ววางลิงก์กลุ่ม Facebook ที่ต้องการโพสต์',
    'Create a link set and paste the Facebook group links you post to',
  ],
  emptySchedulesTitle: ['ยังไม่มีตารางโพสต์', 'No schedules yet'],
  emptySchedulesBody: [
    'จับคู่ชุดโพสต์กับชุดลิงก์ แล้วเลือกวันและเวลาที่ต้องการให้โพสต์',
    'Pair a collection with a link set, then choose the days and times it should post',
  ],

  // Posting needs a paired browser: a schedule posts through the Facebook account of a connected computer.
  needDevice: [
    'ผูกเครื่องก่อน: ตารางโพสต์ผ่านส่วนขยายในเบราว์เซอร์ที่ผูกไว้เท่านั้น',
    'Pair a computer first: schedules post only through the extension in a paired browser',
  ],

  // Link sets
  // How many schedules use the set (the API gives a count, not the names; a refused delete names them).
  linkSetUsedBy: ['ใช้ในตารางโพสต์ {n} ตาราง', 'Used by schedules: {n}'],
  // The "post as" select: only Facebook accounts with a paired computer can post.
  postAsAuto: [
    'อัตโนมัติ: บัญชี Facebook แรกที่ผูกเครื่อง',
    'Automatic: the first connected Facebook account',
  ],
  postAsHint: [
    'เลือกได้เฉพาะบัญชี Facebook ที่ผูกเครื่องแล้ว บัญชีนี้โพสต์ลงทุกกลุ่มในชุด',
    'Only Facebook accounts with a paired computer can be chosen. This account posts to every group in the set',
  ],
  postAsMissing: ['บัญชีที่ไม่พบแล้ว', 'Account no longer exists'],
  // Import from an account (what the extension of that account last synced).
  importAccount: ['บัญชี Facebook', 'Facebook account'],
  importNoAccount: [
    'ยังไม่มีบัญชี Facebook ที่ผูกเครื่อง ผูกเครื่องที่หน้าทีมและเวิร์กสเปซก่อน แล้วค่อยดึงกลุ่มจากบัญชีนั้น',
    'No Facebook account is connected yet. Pair a computer in Team & workspaces first, then pick groups from it',
  ],
  importEmpty: [
    'บัญชีนี้ยังไม่มีกลุ่มที่ส่วนขยายซิงก์ไว้ ส่วนขยายส่งรายชื่อกลุ่มจากชุดโพสต์ของมันเอง เพิ่มกลุ่มที่นั่นก่อน หรือวางลิงก์เองก็ได้',
    'This account has no synced groups yet. The extension sends the groups of its own campaigns: add groups there first, or paste the links yourself',
  ],
  importFailed: ['โหลดรายชื่อกลุ่มของบัญชีนี้ไม่ได้', 'Could not load the groups of this account'],
  // CSV import: the text box, or a file read in the browser.
  csvChooseFile: ['เลือกไฟล์ CSV', 'Choose a CSV file'],
  csvFileError: ['อ่านไฟล์นี้ไม่ได้', 'Could not read this file'],
  // The file is read in the browser as UTF-8 (a BOM is dropped) and is at most 2 MB.
  csvTooBig: [
    'ไฟล์ใหญ่เกิน 2 MB เลือกไฟล์ที่เล็กกว่านี้ หรือแบ่งเป็นหลายไฟล์',
    'The file is larger than 2 MB. Choose a smaller file or split it into several',
  ],
  csvNotUtf8: [
    'ไฟล์นี้ไม่ใช่ UTF-8 ใน Excel ให้บันทึกเป็น “CSV UTF-8” แล้วเลือกใหม่',
    'This file is not UTF-8. In Excel, save it as “CSV UTF-8” and choose it again',
  ],
  csvNoRows: [
    'ไม่มีแถวที่ใช้ได้ แต่ละแถวต้องมีชื่อชุดและลิงก์กลุ่ม Facebook',
    'No usable rows: each row needs a set name and a Facebook group link',
  ],

  // Schedules, calendar and overview
  schGoCollections: ['ไปสร้างชุดโพสต์', 'Create a collection'],
  schGoLinkSets: ['ไปสร้างชุดลิงก์กลุ่ม', 'Create a link set'],
  // Checked before the request, with the same reasons the API gives (a new schedule needs something to post and somewhere to post it).
  schNoPosts: [
    'ชุดโพสต์นี้ยังไม่มีโพสต์ เพิ่มโพสต์ก่อนสร้างตาราง',
    'This collection has no posts yet. Add a post before creating the schedule',
  ],
  schNoApproved: [
    'ชุดโพสต์นี้ยังไม่มีโพสต์ที่อนุมัติแล้ว อนุมัติโพสต์ก่อนสร้างตาราง',
    'This collection has no approved posts yet. Approve a post before creating the schedule',
  ],
  schNoTargets: [
    'ชุดลิงก์นี้ยังไม่มีกลุ่มที่เปิดใช้งานและลิงก์ถูกต้อง หรือบัญชีอื่นให้โพสต์',
    'This link set has no enabled group with a valid link, and no other account to post to',
  ],
  // The schedule was made but the server queued nothing: its times today have passed, or its first day is more than 14 days away.
  schNothingQueued: [
    'สร้างตาราง {s} แล้ว แต่ยังไม่มีงานเข้าคิว เวลาของวันนี้เลยมาแล้ว หรือวันเริ่มอยู่ไกลเกิน 14 วัน ระบบจะจัดคิวให้เมื่อใกล้ถึง',
    'Schedule {s} created, but nothing is queued yet: its times today have passed, or its first day is more than 14 days away. It is queued when the day gets close',
  ],
  // A "once" schedule switches itself off after its day; resuming it would queue nothing.
  schFinished: ['เสร็จสิ้นแล้ว', 'Finished'],
  // The calendar marks a real post made from the test page.
  calTest: ['ทดสอบ', 'Test'],
  // A schedule cannot start on a day that has passed: "add" is off there.
  calPastHint: [
    'วันนี้ผ่านไปแล้ว เพิ่มตารางโพสต์ได้ตั้งแต่วันนี้เป็นต้นไป',
    'This day has passed. A schedule can start today or on a later day',
  ],
  // The server accepts a start date from yesterday to a year ahead.
  schBadDate: [
    'วันเริ่มต้องอยู่ระหว่างเมื่อวานถึงอีก 1 ปีข้างหน้า',
    'The start date must be between yesterday and a year from now',
  ],
  // When a schedule starts: at its own times, or the moment "create" is pressed.
  schStartLabel: ['เริ่มโพสต์', 'Start posting'],
  schStartAtTime: ['ตามเวลาที่ตั้งไว้', 'At the times I set'],
  schStartNow: ['เริ่มทันทีที่กดสร้าง', 'Right away, when I press create'],
  schStartNowNote: [
    'เมื่อกดสร้าง ระบบจะเริ่มโพสต์รอบแรกทันที โดยเข้าทีละกลุ่มแบบสุ่มลำดับ เว้นระยะห่างแต่ละกลุ่มแบบคนเล่น Facebook จากนั้นจึงโพสต์ตามเวลาที่ตั้งไว้ต่อไป',
    'When you press create, the first round starts at once: one group at a time in a random order, with a pause between groups like a person browsing Facebook. Then the schedule carries on at its times',
  ],
  schStartNowOnceNote: [
    'โพสต์ครั้งเดียวทันทีที่กดสร้าง โดยเข้าทีละกลุ่มแบบสุ่มลำดับ เว้นระยะห่างแต่ละกลุ่มแบบคนเล่น Facebook (ไม่ใช้วันและเวลาที่ตั้ง)',
    'One round right when you press create: one group at a time in a random order, with a pause between groups like a person browsing Facebook (the date and time are not used)',
  ],
  schSummaryNow: [
    'เริ่มทันที: {m} ปลายทาง ทีละกลุ่ม เว้น {a}–{b} นาทีระหว่างกลุ่ม',
    'Starts now: {m} targets one by one, {a}–{b} min apart',
  ],

  // Hand-over to the extension: the panel of the schedules page. A schedule hands its posts to the extension one
  // at a time (the extension asks every 30 s); nothing has to be set up in the extension's own campaigns.
  dispTitle: ['การส่งงานให้ส่วนขยาย', 'Hand-over to the extension'],
  dispSub: [
    'ตารางโพสต์ส่งงานให้ส่วนขยายเองทีละโพสต์ พร้อมข้อความและลิงก์กลุ่ม ส่วนขยายมารับงานทุก 30 วินาที ไม่ต้องตั้งชุดโพสต์หรือกลุ่มในส่วนขยายอีก',
    'A schedule hands its posts to the extension one at a time, with the text and the group link. The extension asks for work every 30 seconds, so nothing has to be set up in the extension itself',
  ],
  dispReady: ['พร้อมรับงาน', 'Ready for jobs'],
  dispOffline: [
    'ออฟไลน์ เปิด Chrome ที่ติดตั้งส่วนขยายค้างไว้ งานรออยู่ในคิวและจะส่งให้เมื่อกลับมา',
    'Offline. Keep the Chrome that has the extension open: the jobs wait in the queue and are handed over when it is back',
  ],
  dispPaused: ['พักรับงาน (สั่งจากเว็บ)', 'Paused from the web (takes no jobs)'],
  dispResume: ['กลับมารับงาน', 'Resume'],
  dispQueue: ['คิววันนี้ {n} โพสต์ · ถัดไป {t}', 'Queued today: {n} · next at {t}'],
  dispPosting: ['กำลังโพสต์ลง {g}', 'Posting to {g}'],
  dispQueueEmpty: ['วันนี้ไม่มีโพสต์รอคิว', 'Nothing is queued for today'],
  dispTake: ['ให้รับงานเดี๋ยวนี้', 'Take jobs now'],
  dispTakeHint: [
    'สั่งให้ส่วนขยายมารับโพสต์ที่ถึงเวลาทันที ไม่ต้องรอรอบ 30 วินาที (ยังคงเว้นระยะตามค่าความปลอดภัยของบัญชี)',
    'Tell the extension to take the due post now instead of waiting for its 30-second round (the account-safety gap still applies)',
  ],
  dispTaken: [
    'สั่งส่วนขยายรับงานแล้ว โพสต์ที่ถึงเวลาจะเริ่มทันที',
    'The extension was told to take its jobs. A due post starts at once',
  ],
  dispTakeFailed: [
    'สั่งส่วนขยายรับงานไม่สำเร็จ ลองใหม่อีกครั้ง',
    'Could not tell the extension to take its jobs. Try again',
  ],
  dispConfigNote: [
    'ค่าของตัวส่วนขยายเอง (ชุดโพสต์ในส่วนขยาย เวลา Telegram) แยกไว้ในหน้า “ตั้งค่าส่วนขยาย” ตารางโพสต์ไม่ใช้ค่าเหล่านั้น',
    'The extension’s own settings (its campaigns, timing, Telegram) are on a separate “Extension settings” page. Schedules do not use them',
  ],
  dispConfigLink: ['ตั้งค่าส่วนขยาย', 'Extension settings'],
} as const;

registerPack('flow', AP_I18N_FLOW);

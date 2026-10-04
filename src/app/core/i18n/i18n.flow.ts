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
  storedOnly: [
    'บันทึกไว้ แต่ส่วนขยายยังไม่ใช้ค่านี้',
    'Saved, but the extension does not apply this yet',
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
} as const;

registerPack('flow', AP_I18N_FLOW);

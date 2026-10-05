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

  // Posts a group may get again (the schedule's "repeat" choice; only the random order uses it)
  repeatLabel: ['โพสต์ซ้ำกับกลุ่มเดิม', 'The same post to the same group'],
  repeatRecent: ['ไม่ซ้ำกับครั้งก่อน ๆ (แนะนำ)', 'Not one it had lately (recommended)'],
  repeatAny: ['ซ้ำได้ แม้ในวันเดียวกัน', 'May repeat, even within a day'],
  repeatNever: ['ไม่ซ้ำเลย จนกว่าจะใช้ครบทุกโพสต์', 'Never, until every post was used'],
  repeatRecentNote: [
    'แต่ละกลุ่มจะไม่ได้โพสต์ที่เพิ่งลงไปล่าสุด (ตามค่า “หลีกเลี่ยงโพสต์ล่าสุด” ในความปลอดภัยบัญชี) นานเข้าโพสต์เดิมอาจกลับมาได้',
    'A group does not get the posts it had last (the “recent avoid” setting of account safety); an old post may come back after a while',
  ],
  repeatAnyNote: [
    'สุ่มได้ทุกโพสต์ กลุ่มเดิมอาจได้โพสต์เดิมซ้ำในวันเดียวกัน (กลุ่มต่าง ๆ ในรอบเดียวกันยังได้คนละโพสต์)',
    'Any post: a group may get the same post again, even on the same day (groups in the same round still get different posts)',
  ],
  repeatNeverNote: [
    'แต่ละกลุ่มไม่ได้โพสต์ซ้ำเลยจนกว่าจะได้ครบทุกโพสต์ในชุด แล้วจึงเริ่มรอบใหม่ (นับรวมโพสต์ที่เคยลงหรือรอคิวอยู่)',
    'A group never gets a post twice until it has had every post of the collection, then it starts over (posts already sent or queued count)',
  ],
  repeatRotateNote: [
    'ใช้กับแบบ “สุ่มไม่ให้ซ้ำ” เท่านั้น แบบหมุนเวียนใช้โพสต์ตามลำดับอยู่แล้ว',
    'Applies to the random order only; “rotate in order” already goes through the posts in turn',
  ],
  repeatShortAny: ['ซ้ำได้', 'may repeat'],
  repeatShortNever: ['ไม่ซ้ำเลย', 'no repeats'],

  // The post library (features/posts): every post manages itself and a collection only includes it.
  plTitle: ['คลังโพสต์', 'Post library'],
  plSub: [
    'จัดการโพสต์ทีละโพสต์ในที่เดียว: เปิดหรือปิด ตั้งข้อความและช่วงเวลาของโพสต์เอง ดูผลที่โพสต์ไปแล้ว แล้วค่อยเอาโพสต์ไปใส่ในชุดโพสต์ โพสต์หนึ่งอยู่ได้หลายชุด',
    'Manage each post on its own: switch it on or off, give it its own message and timing, see its results, then put it into collections. One post can sit in several',
  ],
  plNew: ['เพิ่มโพสต์', 'New post'],
  plNewTitle: ['โพสต์ใหม่', 'New post'],
  plEditTitle: ['แก้ไขโพสต์', 'Edit post'],
  plSearch: ['ค้นหาในข้อความโพสต์', 'Search the post text'],
  plSearchPh: ['พิมพ์คำที่อยู่ในโพสต์…', 'Type a word of the post…'],
  plFilterState: ['แสดง', 'Show'],
  plFAll: ['ทั้งหมด', 'All'],
  plFOn: ['เปิดอยู่', 'On'],
  plFOff: ['ปิดอยู่', 'Off'],
  plFPending: ['รออนุมัติ', 'Awaiting approval'],
  plFLoose: ['ยังไม่อยู่ในชุดใด', 'In no collection'],
  plFilterCollection: ['ชุดโพสต์', 'Collection'],
  plAnyCollection: ['ทุกชุด', 'Any collection'],
  plShownN: ['พบ {n} โพสต์', '{n} post(s) found'],
  plEmptyTitle: ['ยังไม่มีโพสต์ในคลัง', 'No posts in the library yet'],
  plEmptyBody: [
    'เพิ่มโพสต์แรกของคุณ จะใส่ในชุดโพสต์ตอนนี้หรือทีหลังก็ได้',
    'Add your first post. You can put it into collections now or later',
  ],
  plNoMatch: ['ไม่พบโพสต์ที่ตรงกับที่ค้นหาหรือตัวกรอง', 'No post matches the search or the filter'],
  plOffHint: [
    'ปิดอยู่: ระบบไม่นำโพสต์นี้ไปโพสต์ และโพสต์ที่ตั้งคิวไว้ล่วงหน้าถูกเอาออกแล้ว จนกว่าจะเปิดอีกครั้ง',
    'Off: this post is never sent and its queued posts were removed, until you switch it on again',
  ],
  plInCollections: ['อยู่ในชุด', 'In collections'],
  plNoCollection: [
    'ยังไม่อยู่ในชุดใด รออยู่ในคลัง',
    'In no collection yet: waiting in the library',
  ],
  plPostedN: ['โพสต์แล้ว {n}', 'Posted {n}'],
  plQueuedN: ['รอคิว {n}', 'Queued {n}'],
  plFailedN: ['ไม่สำเร็จ {n}', 'Failed {n}'],
  plLastPosted: ['ล่าสุด {t}', 'Last {t}'],
  plNextAt: ['ครั้งถัดไป {t}', 'Next {t}'],
  plNeverPosted: ['ยังไม่เคยโพสต์', 'Never posted'],
  plOwnMsg: ['ข้อความของโพสต์เอง', 'Own message'],
  plOwnSched: ['จำกัดช่วงเวลาเอง', 'Own timing'],
  plSelectOne: ['เลือกโพสต์นี้', 'Select this post'],
  plMediaCount: ['{n} ไฟล์สื่อ', '{n} media file(s)'],
  plResults: ['ผลการโพสต์', 'Results'],
  plHideResults: ['ซ่อนผลการโพสต์', 'Hide results'],
  plActLoading: ['กำลังโหลดผล…', 'Loading the results…'],
  plActEmpty: ['โพสต์นี้ยังไม่เคยถูกส่งไปที่ใด', 'This post has not been sent anywhere yet'],
  plActFailed: ['โหลดผลการโพสต์ไม่สำเร็จ', 'Could not load the results'],
  plActScheduled: ['ตั้งไว้ {t}', 'Scheduled {t}'],
  plActPublished: ['โพสต์เมื่อ {t}', 'Posted {t}'],
  plActOpenGroup: ['เปิดกลุ่ม', 'Open the group'],
  plDelete: ['ลบโพสต์', 'Delete post'],
  plDeleteBody: [
    'ลบโพสต์นี้ถาวร? โพสต์จะออกจากทุกชุดโพสต์ และโพสต์ที่ตั้งคิวไว้ล่วงหน้าจะถูกเอาออก ลบแล้วกู้คืนไม่ได้',
    'Delete this post for good? It leaves every collection and its queued posts are removed. This cannot be undone',
  ],
  plDeleted: ['ลบโพสต์แล้ว', 'Post deleted'],
  plBulkSelected: ['เลือกแล้ว {n} โพสต์', '{n} post(s) selected'],
  plSelectPage: ['เลือกทั้งหน้านี้', 'Select this page'],
  plClearSelection: ['ไม่เลือกเลย', 'Clear selection'],
  plBulkOn: ['เปิดที่เลือก', 'Switch selected on'],
  plBulkOff: ['ปิดที่เลือก', 'Switch selected off'],
  plBulkDelete: ['ลบที่เลือก', 'Delete selected'],
  plBulkAdd: ['เพิ่มเข้าชุด', 'Add to collection'],
  plBulkRemove: ['เอาออกจากชุด', 'Take out of collection'],
  plBulkPick: ['เลือกชุดโพสต์…', 'Choose a collection…'],
  plBulkDone: ['ทำกับ {n} โพสต์แล้ว', 'Done for {n} post(s)'],
  plBulkDeleteTitle: ['ลบโพสต์ที่เลือก', 'Delete the selected posts'],
  plBulkDeleteBody: [
    'ลบ {n} โพสต์ถาวร? โพสต์จะออกจากทุกชุดโพสต์ และโพสต์ที่ตั้งคิวไว้ล่วงหน้าจะถูกเอาออก ลบแล้วกู้คืนไม่ได้',
    'Delete {n} post(s) for good? They leave every collection and their queued posts are removed. This cannot be undone',
  ],
  // The editor of a post (inline on its card, and in the "new post" dialog).
  plText: ['ข้อความโพสต์', 'Post text'],
  plMediaTitle: ['สื่อที่แนบ', 'Attached media'],
  plMediaPick: ['เลือกสื่อจากคลัง', 'Pick from the media library'],
  plMediaHide: ['ซ่อนคลังสื่อ', 'Hide the media library'],
  plMediaNone: ['ยังไม่ได้แนบสื่อ', 'No media attached'],
  plMediaGone: ['ไฟล์ที่ไม่พบในคลังสื่อ', 'A file missing from the media library'],
  plColTitle: ['อยู่ในชุดโพสต์', 'Sits in collections'],
  plColHint: [
    'เลือกได้ไม่เกิน {n} ชุด ไม่เลือกเลยโพสต์จะรออยู่ในคลังจนกว่าจะเอาไปใส่ชุด',
    'Up to {n} collections. With none the post waits in the library until you put it into one',
  ],
  plColNone: [
    'ยังไม่มีชุดโพสต์ สร้างได้ที่หน้าชุดโพสต์',
    'No collections yet. Create one on the Collections page',
  ],
  plColMax: ['เลือกได้ไม่เกิน {n} ชุด', 'At most {n} collections'],
  plMsgTitle: ['ข้อความของโพสต์นี้', 'Message of this post'],
  plMsgHint: [
    'ตามชุดโพสต์คือใช้ค่าของชุดที่โพสต์ไปลง หรือกำหนดเองเฉพาะโพสต์นี้ เว้นว่างไว้ = ไม่ใส่ในโพสต์นี้',
    'Follow the collection uses the value of the collection it goes out from, or set your own for this post. Left empty = none for this post',
  ],
  plFollowCol: ['ตามชุดโพสต์', 'Follow the collection'],
  plHashtags: ['แฮชแท็กท้ายโพสต์', 'Hashtags at the end'],
  plFooter: ['ข้อความท้ายโพสต์', 'Footer block'],
  plFooterPos: ['ตำแหน่งข้อความท้าย', 'Footer position'],
  plSchedTitle: ['ช่วงเวลาที่โพสต์นี้โพสต์ได้', 'When this post may go out'],
  plSchedHint: [
    'ตารางโพสต์ยังเป็นผู้กำหนดเวลา ส่วนนี้จำกัดเฉพาะโพสต์นี้ รอบเวลาที่ไม่ตรงจะไม่ได้โพสต์นี้ (นับตามปฏิทินของตารางโพสต์) เว้นว่างทั้งหมด = ไม่จำกัด',
    'Schedules still decide the times. This only limits this post: a slot it does not allow does not get it (in the schedule’s calendar). Everything empty = no limit',
  ],
  plValidFrom: ['ใช้ตั้งแต่วันที่', 'From date'],
  plValidUntil: ['ถึงวันที่', 'Until date'],
  plWeekdays: ['วันในสัปดาห์ (ไม่เลือก = ทุกวัน)', 'Weekdays (none = every day)'],
  plTimeFrom: ['ตั้งแต่เวลา', 'From time'],
  plTimeTo: ['ถึงเวลา', 'To time'],
  plTimeHint: [
    'ใส่ทั้งสองช่องหรือเว้นว่างทั้งคู่ ช่วงเวลาข้ามเที่ยงคืนได้ เช่น 22:00 ถึง 02:00',
    'Fill both or neither. The window may pass midnight, for example 22:00 to 02:00',
  ],
  plMaxPerDay: ['โพสต์ได้ไม่เกินกี่ครั้งต่อวัน', 'At most this many times a day'],
  plMaxPerDayHint: [
    'นับรวมทุกกลุ่มในหนึ่งวัน 0 = ไม่จำกัด สูงสุด {n}',
    'Counted over all groups in a day. 0 = no limit, at most {n}',
  ],
  plErrTime: [
    'ใส่เวลาให้ครบทั้งสองช่อง หรือเว้นว่างทั้งคู่',
    'Fill both times or leave both empty',
  ],
  plErrDates: ['วันเริ่มต้องไม่เกินวันสิ้นสุด', 'The first date must not be after the last'],
  plErrMax: ['ใส่จำนวนเต็มตั้งแต่ 0 ถึง {n}', 'Enter a whole number from 0 to {n}'],
  plActiveNew: ['เปิดใช้งานทันที', 'Switch it on right away'],
  plApprovalResets: [
    'ถ้าโพสต์นี้อนุมัติแล้ว และมีชุดโพสต์ที่ต้องอนุมัติ การแก้ข้อความหรือสื่อจะทำให้โพสต์กลับเป็นฉบับร่าง',
    'An approved post that sits in a collection needing approval goes back to draft when its text or media change',
  ],
  plSave: ['บันทึกโพสต์', 'Save post'],
  plCreated: ['เพิ่มโพสต์แล้ว', 'Post added'],
  plSaved: ['บันทึกโพสต์แล้ว', 'Post saved'],
  plSaveFailed: [
    'บันทึกโพสต์ไม่สำเร็จ ลองใหม่อีกครั้ง',
    'Could not save the post. Please try again',
  ],

  // Collections page: the library's posts in a collection.
  colTakeOut: ['เอาออกจากชุด', 'Take out'],
  colTakeOutHint: [
    'เอาโพสต์ออกจากชุดนี้เท่านั้น โพสต์ยังอยู่ในคลังโพสต์ (ลบถาวรที่หน้าคลังโพสต์)',
    'Takes the post out of this collection only. It stays in the post library (delete it for good there)',
  ],
  colInN: ['อยู่ใน {n} ชุด', 'In {n} collections'],
  colInNHint: [
    'โพสต์นี้อยู่ในหลายชุด การแก้ไขมีผลกับทุกชุด',
    'This post sits in several collections: an edit applies to all of them',
  ],
  colPostOff: ['ปิดอยู่', 'Off'],
  colPostOffHint: [
    'โพสต์นี้ปิดอยู่ ตารางโพสต์จะไม่นำไปโพสต์ (เปิดได้ที่หน้าคลังโพสต์)',
    'This post is off: schedules do not send it (switch it on in the post library)',
  ],
  colAddFromLib: ['เพิ่มจากคลังโพสต์', 'Add from the library'],
  colAddFromLibTitle: ['เพิ่มโพสต์จากคลังเข้าชุด', 'Add library posts to the collection'],
  colAddFromLibHint: [
    'เลือกโพสต์ที่มีอยู่แล้วในคลัง โพสต์จะยังอยู่ในชุดอื่นด้วย',
    'Pick posts that are already in the library. They stay in their other collections too',
  ],
  colAddFromLibEmpty: [
    'ไม่มีโพสต์ในคลังที่ยังไม่อยู่ในชุดนี้',
    'There is no library post that is not in this collection yet',
  ],
  colAddFromLibGo: ['เพิ่ม {n} โพสต์', 'Add {n} post(s)'],
  colAddedN: ['เพิ่ม {n} โพสต์เข้าชุดแล้ว', 'Added {n} post(s) to the collection'],
  colPostsShown: [
    'แสดง {n} โพสต์แรก พิมพ์ค้นหาเพื่อกรอง',
    'The first {n} posts are shown; search to narrow them',
  ],
} as const;

registerPack('flow', AP_I18N_FLOW);

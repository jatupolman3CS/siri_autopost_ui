import { registerPack } from './i18n.service';

// Lazy dictionary pack "flow": the strings the design handoff lacks for the Collections -> Link sets ->
// Schedules flow and its neighbours (post editor, calendar, overview additions). Only the lazily loaded pages
// that read t().api.flow import this module, which registers the pack (see registerPack in i18n.service.ts),
// so it stays out of the first bundle. Every file that reads t().api.flow must `import './i18n.flow'`.
//
// How to add a leaf: append `name: ['ไทย', 'English'],` (a [th, en] pair, both languages) below, then read
// it as t().api.flow.name; fill {placeholders} with fmt(). Only the pages of this flow append here, so that
// pack files of different features never collide. A string of the design that is wrong for the real system
// is corrected in i18n.fixes.ts instead, with a comment saying what the design got wrong.
export const AP_I18N_FLOW = {
  // A setting that is saved with the collection, link set or schedule but not applied yet (collection page
  // tags, image shuffle and watermark; schedule auto-delete: the bump IS applied now, see schBump* below).
  // Keep the design's label and add this hint.
  // It says plainly that nothing applies the value (neither the extension nor the server), so a switch that is
  // on does not read as active.
  storedOnly: [
    'บันทึกไว้เท่านั้น ยังไม่มีส่วนใดนำค่านี้ไปใช้',
    'Saved only: nothing applies this setting yet',
  ],
  storedOnlyBadge: ['บันทึกเท่านั้น', 'Saved only'],
  // A control of a plan the owner does not have ({plan} is the plan's name, from t().plans).
  planLocked: ['ใช้ได้ในแผน {plan} ขึ้นไป', 'Available on {plan} and above'],

  // Collections
  // Schedule names are not on the collection (only how many schedules use it), so the page counts them.
  usedInN: ['ใช้ใน {n} ตาราง', 'Used by {n} schedule(s)'],
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
  emptyLinkSetsTitle: ['ยังไม่มีชุดลิงก์', 'No link sets yet'],
  emptyLinkSetsBody: [
    'สร้างชุดลิงก์ แล้ววางลิงก์กลุ่มหรือเพจ Facebook ที่ต้องการโพสต์',
    'Create a link set and paste the Facebook group or page links you post to',
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

  // The overview's panel of paired extensions (a real list from the devices; it replaced the sample accounts).
  ovExtTitle: ['ส่วนขยายที่เชื่อมต่อ', 'Connected extensions'],
  ovExtManage: ['จัดการ', 'Manage'],
  ovExtOffline: ['ออฟไลน์', 'Offline'],
  ovExtPaused: ['พักรับงาน', 'Paused'],
  ovExtAuto: ['หยุดอัตโนมัติ', 'Paused by the engine'],
  ovExtSeen: ['เห็นล่าสุด', 'last seen'],
  ovExtEmptyTitle: ['ยังไม่มีส่วนขยายที่เชื่อมต่อ', 'No extension connected yet'],
  ovExtEmptyBody: [
    'ติดตั้งส่วนขยายใน Chrome ที่ล็อกอิน Facebook ไว้ แล้วผูกเครื่องที่หน้าทีมและเวิร์กสเปซ ส่วนขยายจะโพสต์ให้ตามตารางที่ตั้งไว้',
    'Install the extension in the Chrome where you are signed in to Facebook, then pair it on Team & workspaces. It posts for you on your schedules',
  ],

  // Link sets
  // How many schedules use the set (the API gives a count, not the names; a refused delete names them).
  linkSetUsedBy: ['ใช้ในตารางโพสต์ {n} ตาราง', 'Used by schedules: {n}'],
  // The "post as" select: the extension (a paired browser, shown by its name) that posts the set. Only a browser
  // that is paired can be chosen; the Facebook account it brings is what the API stores.
  postAsAuto: ['อัตโนมัติ: ส่วนขยายแรกที่เชื่อมต่อ', 'Automatic: the first connected extension'],
  postAsHint: [
    'เลือกส่วนขยายที่จะโพสต์ชุดนี้ เลือกได้เฉพาะส่วนขยายที่ผูกเครื่องแล้ว ส่วนขยายนี้โพสต์ลงทุกกลุ่มและเพจในชุด',
    'Choose the extension that posts this set. Only paired extensions can be chosen; it posts to every group and page in the set',
  ],
  postAsMissing: ['ส่วนขยายที่ไม่พบแล้ว', 'Extension no longer exists'],
  // Group or page: the small label of a link row (the server tells them apart by the address).
  linkKindGroup: ['กลุ่ม', 'Group'],
  linkKindPage: ['เพจ', 'Page'],
  linkKindGroupHint: ['ลิงก์กลุ่ม Facebook', 'Facebook group link'],
  linkKindPageHint: ['ลิงก์เพจ Facebook', 'Facebook page link'],
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
    'ไม่มีแถวที่ใช้ได้ แต่ละแถวต้องมีชื่อชุดและลิงก์กลุ่มหรือเพจ Facebook',
    'No usable rows: each row needs a set name and a Facebook group or page link',
  ],

  // Schedules, calendar and overview
  schGoCollections: ['ไปสร้างชุดโพสต์', 'Create a collection'],
  schGoLinkSets: ['ไปสร้างชุดลิงก์', 'Create a link set'],
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
    'ชุดลิงก์นี้ยังไม่มีกลุ่มหรือเพจที่เปิดใช้งานและลิงก์ถูกต้อง',
    'This link set has no enabled group or page with a valid link',
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
    'เมื่อกดสร้าง ระบบจะเริ่มโพสต์รอบแรกทันที โดยเข้าทีละกลุ่มหรือเพจแบบสุ่มลำดับ เว้นระยะห่างแต่ละที่แบบคนเล่น Facebook จากนั้นจึงโพสต์ตามเวลาที่ตั้งไว้ต่อไป',
    'When you press create, the first round starts at once: one group or page at a time in a random order, with a pause between them like a person browsing Facebook. Then the schedule carries on at its times',
  ],
  schStartNowOnceNote: [
    'โพสต์ครั้งเดียวทันทีที่กดสร้าง โดยเข้าทีละกลุ่มหรือเพจแบบสุ่มลำดับ เว้นระยะห่างแต่ละที่แบบคนเล่น Facebook (ไม่ใช้วันและเวลาที่ตั้ง)',
    'One round right when you press create: one group or page at a time in a random order, with a pause between them like a person browsing Facebook (the date and time are not used)',
  ],
  schSummaryNow: [
    'เริ่มทันที: {m} ปลายทาง ทีละที่ เว้น {a}–{b} นาทีระหว่างกัน',
    'Starts now: {m} targets one by one, {a}–{b} min apart',
  ],
  // The schedule makes more Facebook posts a day than the anti-ban daily limit lets out: the server fails the rest (quota).
  schOverLimit: [
    'ตารางนี้โพสต์ Facebook {n} งานต่อวัน แต่เพดานต่อวันของ Facebook ตั้งไว้ {limit} โพสต์ งานที่เกินจะล้มเหลว (ครบโควตา) ปรับเพดานได้ที่หน้ากันแบน (สูงสุด {max})',
    'This schedule makes {n} Facebook posts a day, but the Facebook daily limit is {limit}: the rest fail (quota). Raise it on the anti-ban page (up to {max})',
  ],
  schOverLimitLink: ['ไปหน้ากันแบน', 'Open anti-ban'],

  // Hand-over to the extension: the panel of the schedules page. A schedule hands its posts to the extension one
  // at a time (the extension asks every 30 s) with its text, images and target: what it posts is exactly what the
  // schedule says, and how it behaves while posting is set on the anti-ban page.
  dispTitle: ['การส่งงานให้ส่วนขยาย', 'Hand-over to the extension'],
  dispSub: [
    'ตารางโพสต์ส่งงานให้ส่วนขยายเองทีละโพสต์ พร้อมข้อความและลิงก์กลุ่มหรือเพจ ส่วนขยายมารับงานทุก 30 วินาที ไม่ต้องตั้งชุดโพสต์หรือกลุ่มในส่วนขยายอีก',
    'A schedule hands its posts to the extension one at a time, with the text and the group or page link. The extension asks for work every 30 seconds, so nothing has to be set up in the extension itself',
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
    'ส่วนขยายโพสต์ตรงตามที่ตารางโพสต์ระบุ ทั้งข้อความ รูป และกลุ่มหรือเพจปลายทาง ส่วนพฤติกรรมตอนโพสต์ (พิมพ์ เลื่อนหน้า พักหลังถูกบล็อก) ตั้งที่หน้าความปลอดภัยบัญชี',
    'The extension posts exactly what the schedule says: the text, the images and the target group or page. How it behaves while posting (typing, scrolling, the rest after a block) is set on the account safety page',
  ],
  dispConfigLink: ['ตั้งค่าที่หน้าความปลอดภัยบัญชี', 'Open account safety (anti-ban)'],

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

  // The post editor (features/posts): ONE screen for a new post and for editing one, with the insert toolbar
  // ({{code}}, Spintax, snippets, AI), a live status line under the text, a live preview and the AI panel.
  edClose: ['ปิดตัวแก้ไข', 'Close the editor'],
  edSub: [
    'เขียนโพสต์ แล้วดูตัวอย่างตอนโพสต์จริงได้ทันทีข้างๆ',
    'Write the post and see how it will look when it goes out, right beside it',
  ],
  edPostGone: [
    'ไม่พบโพสต์นี้แล้ว (อาจถูกลบไปแล้ว)',
    'That post no longer exists (it may have been deleted)',
  ],
  edMore: ['ตั้งค่าเพิ่มเติมของโพสต์นี้', 'More options for this post'],
  edMoreHint: [
    'ข้อความท้าย แฮชแท็ก และช่วงเวลาเฉพาะโพสต์นี้ ไม่ตั้งก็ได้',
    'Footer, hashtags and timing for this post only. Optional',
  ],
  edColNew: ['สร้างชุดโพสต์ใหม่', 'New collection'],
  edSavedAnother: [
    'เพิ่มโพสต์แล้ว เขียนโพสต์ถัดไปได้เลย',
    'Post added. Go ahead and write the next one',
  ],
  edMediaOff: ['ไฟล์นี้ปิดอยู่ในคลังสื่อ', 'This file is switched off in the media library'],
  edTooLongInsert: [
    'ใส่ไม่ได้ ข้อความจะยาวเกิน {n} ตัวอักษร',
    'Cannot insert: the text would be longer than {n} characters',
  ],

  // The toolbar above the text.
  edToolbar: ['เครื่องมือแทรกในข้อความ', 'Insert into the text'],
  edSnippetBtn: ['ข้อความสำเร็จรูป', 'Snippet'],
  edSnippetTip: [
    'แทรกข้อความที่บันทึกไว้ในคลัง ตรงตำแหน่งเคอร์เซอร์',
    'Insert a text saved in your library at the cursor',
  ],
  edSnippetNone: [
    'ยังไม่มีข้อความสำเร็จรูปที่เปิดใช้งาน สร้างได้ที่คลังสื่อ',
    'No active snippets yet. Create one in the media library',
  ],
  edSnippetLib: ['เปิดคลังข้อความ', 'Open the snippet library'],
  edHelpBtn: ['วิธีใช้ {{code}} และ Spintax', 'How {{code}} and Spintax work'],

  // Why the AI buttons are off (AiStore.reason), and the AI button itself.
  edAiBtn: ['AI', 'AI'],
  edAiChecking: ['กำลังตรวจสอบว่า AI พร้อมใช้งานหรือไม่…', 'Checking whether AI is available…'],
  edAiStatusFailed: [
    'ตรวจสถานะ AI ไม่สำเร็จ ลองโหลดหน้านี้ใหม่อีกครั้ง',
    'Could not check the AI status. Try reloading the page',
  ],
  edAiNoKey: [
    'ยังใช้ AI ไม่ได้: ผู้ดูแลระบบต้องตั้งค่า AI Key ที่เซิร์ฟเวอร์ก่อน',
    'AI is not available yet: the admin has to set up an AI key on the server first',
  ],
  edAiNoPlan: ['AI ช่วยเขียนใช้ได้ในแผน Pro ขึ้นไป', 'AI writing is available on Pro and above'],
  edAiNoDrafts: [
    'วันนี้ใช้ AI ร่างโพสต์ครบแล้ว ลองใหม่พรุ่งนี้',
    'Today’s AI drafts are used up. Try again tomorrow',
  ],

  // The status line under the text.
  edStatus: ['สถานะของข้อความ', 'What this text does'],
  edCodeOn: ['{{code}} ✓ ระบบแทนด้วยรหัสของแต่ละกลุ่ม', '{{code}} ✓ replaced by each group’s code'],
  edCodeOff: ['ไม่มี {{code}}: รหัสกลุ่มจะอยู่บรรทัดแรก', 'No {{code}}: the code goes on line 1'],
  edSpinOn: ['Spintax: {g} กลุ่มคำ ≈ {v} แบบ', 'Spintax: {g} group(s) ≈ {v} variants'],
  edSpinOff: [
    'ไม่มี Spintax: ทุกกลุ่มได้ข้อความเดียวกัน',
    'No Spintax: every group gets the same text',
  ],
  edVariantsMany: ['มากกว่า {v}', 'over {v}'],
  edLintUnclosed: [
    'มี { ที่ไม่ได้ปิด ใกล้ “{t}” กลุ่มคำนี้จะไม่ถูกสุ่ม',
    'A { is never closed, near “{t}”. This group will not be mixed',
  ],
  edLintUnopened: ['มี } ที่ไม่มี { คู่กัน ใกล้ “{t}”', 'A } has no matching {, near “{t}”'],
  edLintNoPipe: [
    '“{t}” ไม่มีเครื่องหมาย | จึงไม่มีอะไรถูกสุ่ม ใส่คำอย่างน้อย 2 คำแล้วคั่นด้วย |',
    'No | in “{t}”, so nothing is mixed. Put at least two words in and apart them with |',
  ],
  edLintEmpty: [
    'มีตัวเลือกว่างใน “{t}” บางกลุ่มจะไม่ได้คำตรงนั้น',
    'An empty option in “{t}”: some groups will get nothing there',
  ],
  edLintCodeIn: [
    '{{code}} อยู่ใน Spintax “{t}” กลุ่มคำนี้จะไม่ถูกสุ่ม ย้าย {{code}} ออกมานอกปีกกา',
    '{{code}} is inside the Spintax “{t}”, which is then not mixed. Move {{code}} outside the braces',
  ],
  edLintMore: ['และอีก {n} จุด', 'and {n} more'],

  // The "?" help.
  edHelpTitle: ['{{code}} และ Spintax ใช้ยังไง', 'How {{code}} and Spintax work'],
  edHelpCodeH: ['{{code}} = รหัสกลุ่ม', '{{code}} = the group code'],
  edHelpCodeB: [
    'กลุ่มแต่ละกลุ่มในชุดลิงก์มี “รหัส” ของตัวเอง (ช่องรหัสในหน้าชุดลิงก์กลุ่ม) ตอนโพสต์ ระบบแทน {{code}} ด้วยรหัสของกลุ่มนั้น ถ้าไม่ใส่ {{code}} ระบบจะเขียนรหัสไว้บรรทัดแรกให้เอง',
    'Every group in a link set has its own “code” (the code column of the Link sets page). When the post goes out, {{code}} is replaced by that group’s code. Without {{code}} the code goes on line 1 by itself',
  ],
  edHelpSpinH: ['Spintax = สุ่มคำ', 'Spintax = mix the words'],
  edHelpSpinB: [
    'เขียนตัวเลือกในปีกกา คั่นด้วย | เช่น {สวัสดี|หวัดดี} แต่ละกลุ่มจะได้คำที่ไม่เหมือนกัน ข้อความจึงต่างกันทุกกลุ่ม ไม่ดูเหมือนโพสต์ซ้ำ',
    'Write the options in braces, apart with |, like {Hello|Hi}. Every group gets a different pick, so the text is different for every group and does not look like a repeated post',
  ],
  edHelpSets: ['ดูรหัสของแต่ละกลุ่ม', 'See each group’s code'],
  edHelpExamples: ['ตัวอย่าง', 'Examples'],
  edHelpInsert: ['ใส่ตัวอย่างนี้', 'Insert this example'],
  edEx1Title: ['ใส่รหัสกลุ่ม', 'Group code'],
  edEx1Text: [
    '{{code}}\nขายคอนโดใกล้ BTS ทักแชทได้เลย',
    '{{code}}\nCondo for sale near the BTS, message us anytime',
  ],
  edEx1Result: [
    'กลุ่มที่มีรหัส A12 ได้ “A12” ขึ้นบรรทัดแรก แล้วตามด้วยข้อความ',
    'A group with code A12 gets “A12” on the first line, then the text',
  ],
  edEx2Title: ['สุ่มคำทักทาย', 'Mix the greeting'],
  edEx2Text: [
    '{สวัสดีค่ะ|หวัดดีค่ะ|ทักทายค่ะ} วันนี้มีของใหม่',
    '{Hello|Hi|Hey} we have new arrivals today',
  ],
  edEx2Result: [
    'กลุ่มหนึ่งได้ “หวัดดีค่ะ วันนี้มีของใหม่” อีกกลุ่มได้ “สวัสดีค่ะ วันนี้มีของใหม่”',
    'One group gets “Hi we have new arrivals today”, another “Hello we have new arrivals today”',
  ],
  edEx3Title: ['ใช้ทั้งสองอย่าง', 'Both together'],
  edEx3Text: [
    '{{code}}\n{โปรแรง|ดีลพิเศษ} วันนี้ {ส่งฟรี|ผ่อน 0%}',
    '{{code}}\n{Big sale|Special deal} today, {free shipping|0% installments}',
  ],
  edEx3Result: [
    'ทุกกลุ่มได้รหัสของตัวเอง และได้ข้อความที่สุ่มคำต่างกัน',
    'Every group gets its own code and a differently mixed text',
  ],

  // The Spintax popover.
  edSpinIntro: [
    'เลือกชุดคำสำเร็จรูป หรือสร้างเอง ระบบจะสุ่มเลือก 1 คำต่อกลุ่มตอนโพสต์',
    'Pick a ready-made set or build your own. One option is picked at random for each group when the post goes out',
  ],
  edSpinWrap: [
    'ทำข้อความที่เลือก “{t}” เป็น Spintax แล้วพิมพ์คำอื่นต่อ',
    'Turn the selected “{t}” into a Spintax group and type the other words',
  ],
  edSpinReady: ['ชุดคำสำเร็จรูป', 'Ready-made sets'],
  edSetGreet: ['คำทักทาย', 'Greetings'],
  edSetGreetText: ['{สวัสดีค่ะ|หวัดดีค่ะ|ทักทายค่ะ}', '{Hello|Hi|Hey}'],
  edSetClose: ['ปิดท้าย', 'Closings'],
  edSetCloseText: [
    '{สนใจทักแชทได้เลยนะคะ|ทักมาคุยกันได้เลยค่ะ|สอบถามได้ทางแชทค่ะ}',
    '{Message us anytime|Feel free to DM us|Ask us in chat}',
  ],
  edSetCta: ['ชวนให้ซื้อ', 'Call to action'],
  edSetCtaText: ['{สั่งเลย|ทักเลย|ดูรายละเอียดเลย}', '{Order now|Message us now|See the details}'],
  edSpinCustom: ['สร้างเอง', 'Build your own'],
  edOptionN: ['ตัวเลือกที่ {n}', 'Option {n}'],
  edOptionPh: ['พิมพ์คำหรือประโยค', 'A word or a phrase'],
  edAddOption: ['เพิ่มตัวเลือก', 'Add option'],
  edRemoveOption: ['เอาตัวเลือกนี้ออก', 'Remove this option'],
  edSpinResult: ['ผลลัพธ์', 'Result'],
  edSpinInsert: ['แทรก', 'Insert'],
  edSpinNeed2: ['ใส่อย่างน้อย 2 ตัวเลือก', 'Fill in at least 2 options'],
  edSpinNoBraces: [
    'ไม่ต้องพิมพ์ { } หรือ | ในตัวเลือก ระบบใส่ให้เอง',
    'No need to type { } or | in an option: they are added for you',
  ],

  // The preview.
  edPvAs: ['ดูตัวอย่างเหมือนอยู่ในชุด', 'Preview as collection'],
  edPvOneCol: [
    'ข้อความท้ายและแฮชแท็กจากชุด “{c}”',
    'Footer and hashtags from the collection “{c}”',
  ],
  edPvNoCol: [
    'ยังไม่ได้เลือกชุดโพสต์ จึงใช้เฉพาะข้อความท้ายและแฮชแท็กของโพสต์นี้เอง',
    'No collection chosen, so only this post’s own footer and hashtags are used',
  ],
  edPvGroup: ['ดูตัวอย่างกับกลุ่ม', 'Preview with group'],
  edPvCode: ['รหัสกลุ่มนี้: {c}', 'This group’s code: {c}'],
  edPvNoCode: [
    'กลุ่มนี้ยังไม่มีรหัส ตั้งได้ที่หน้าชุดลิงก์กลุ่ม',
    'This group has no code yet. Set it on the Link sets page',
  ],
  edPvVariants: ['ดู 3 แบบ', 'Show 3 variants'],
  edPvSingle: ['ดูแบบเดียว', 'Show one'],
  edPvVariantN: ['แบบที่ {n}', 'Variant {n}'],
  edPvSpunHint: ['คำที่ไฮไลต์คือคำที่ Spintax สุ่มได้', 'Highlighted words were picked by Spintax'],
  edPvLen: [
    'ความยาวเมื่อโพสต์จริง {n} / {max} ตัวอักษร',
    'Length as posted: {n} / {max} characters',
  ],
  edPvTooLong: [
    'ยาวเกิน {max} ตัวอักษร ระบบจะไม่ส่งโพสต์นี้ ลดข้อความ ข้อความท้าย หรือแฮชแท็ก',
    'Over {max} characters: this post would be refused. Shorten the text, the footer or the hashtags',
  ],

  // The AI panel (the buttons are off, with the reason, until AiStore says it can write).
  edAiSub: [
    'บอกว่าจะโพสต์เรื่องอะไร AI จะร่างให้ ร่างที่เลือกจะไปอยู่ในช่องข้อความให้คุณแก้ และยังไม่บันทึกจนกว่าคุณจะกดบันทึกโพสต์',
    'Tell it what the post is about. The draft you pick goes into the text box for you to edit, and nothing is saved until you press Save',
  ],
  edAiLeft: ['วันนี้เหลืออีก {n} ร่าง', '{n} drafts left today'],
  edAiPointRemove: ['เอาจุดขายนี้ออก', 'Remove this selling point'],
  edAiPointsMax: ['ใส่จุดขายได้ไม่เกิน {n} ข้อ', 'At most {n} selling points'],
  edAiToneShort: ['สั้นกระชับ', 'Short'],
  edAiWriting: ['AI กำลังเขียน…', 'AI is writing…'],
  edAiRegenerate: ['เขียนใหม่', 'Regenerate'],
  edAiDraftN: ['ร่างที่ {n}', 'Draft {n}'],
  edAiUse: ['ใช้ร่างนี้', 'Use this'],
  edAiUseTip: ['แทนที่ข้อความในช่องด้วยร่างนี้', 'Replaces the text in the box with this draft'],
  edAiAppend: ['ต่อท้าย', 'Append'],
  edAiAppendTip: ['ต่อท้ายข้อความที่มีอยู่', 'Adds this draft after the text you have'],
  edAiSeparate: ['เพิ่มเป็นอีกโพสต์', 'Add as a separate post'],
  edAiSeparateTip: [
    'บันทึกร่างนี้เป็นโพสต์ใหม่แยกอีกโพสต์ (ปิดไว้ก่อน จนกว่าคุณจะเปิดใช้งาน)',
    'Saves this draft as another post of its own (switched off until you switch it on)',
  ],
  edAiUsed: ['ใส่ร่างในช่องข้อความแล้ว', 'Draft put in the text box'],
  edAiAppended: ['ต่อท้ายข้อความแล้ว', 'Draft added after the text'],
  edAiAdded: [
    'เพิ่มเป็นโพสต์ใหม่แล้ว (ปิดอยู่ จนกว่าคุณจะเปิดใช้งาน)',
    'Added as a new post (switched off until you switch it on)',
  ],
  edAiFailed: ['AI เขียนไม่สำเร็จ ลองใหม่อีกครั้ง', 'The AI could not write. Please try again'],
  edAiCheck: [
    'AI อาจเขียนผิดพลาดได้ ตรวจและแก้ก่อนโพสต์จริง',
    'AI can make mistakes. Read and edit the draft before it goes out',
  ],
  edAiClose: ['ปิดแผง AI', 'Close the AI panel'],

  // Schedules: the bump section of the builder (a Premium function: after a post goes out the extension opens
  // its link and comments on it, so it comes back to the top). {plan} is the name of the top plan.
  schBumpTitle: ['ดันโพสต์ ({plan})', 'Bump posts ({plan})'],
  schBumpIntro: [
    'หลังโพสต์ลงกลุ่มแล้ว ส่วนขยายจะเปิดลิงก์โพสต์นั้นและคอมเมนต์ใต้โพสต์ เพื่อให้โพสต์กลับขึ้นมาอยู่บนสุด',
    'After a post goes out, the extension opens its link and comments on it, so it comes back to the top',
  ],
  schBumpSwitch: ['ดันโพสต์อัตโนมัติ', 'Bump posts automatically'],
  schBumpAfter: ['ดันหลังโพสต์', 'Bump after the post'],
  schBumpAfterOpt: ['{h} ชั่วโมง', '{h} hour(s)'],
  schBumpRounds: ['ดันกี่ครั้ง', 'How many bumps'],
  schBumpRoundsOpt: ['{n} ครั้ง', '{n} time(s)'],
  schBumpRoundsHint: [
    'ดันครั้งถัดไปห่างจากครั้งก่อนตามชั่วโมงที่เลือก',
    'Each next bump comes that many hours after the one before',
  ],
  schBumpText: ['ข้อความที่ใช้ดัน', 'Bump comment'],
  schBumpTextPh: [
    'เว้นว่างไว้เพื่อใช้ข้อความสั้นๆ ที่ระบบเตรียมให้',
    'Leave blank to use a short default phrase',
  ],
  schBumpTextHint: [
    'ใช้ spintax ได้ เช่น {ขึ้นๆ ค่ะ|ดันหน่อยค่ะ|ยังมีของนะคะ} ระบบสุ่มหนึ่งแบบต่อการดันหนึ่งครั้ง',
    'Spintax works, e.g. {Up we go|Bump|Still in stock}: one option is picked at random for each bump',
  ],
  schBumpImages: ['รูปที่ใช้ดัน', 'Images for the bump'],
  schBumpPick: ['เลือกรูปจากคลัง', 'Pick from the library'],
  schBumpPickHide: ['ซ่อนรายการรูป', 'Hide the images'],
  schBumpImagesSel: ['เลือกแล้ว {n} / {max} รูป', '{n} / {max} images chosen'],
  schBumpImagesNone: [
    'ยังไม่ได้เลือกรูป จะดันด้วยข้อความอย่างเดียว',
    'No image chosen: the bump is text only',
  ],
  schBumpNoLibrary: [
    'ยังไม่มีรูปในคลัง อัปโหลดรูปที่หน้าคลังสื่อก่อน',
    'No image in the library yet. Upload some on the library page first',
  ],
  schBumpMax: [
    'เลือกรูปสำหรับดันได้ไม่เกิน {n} รูป',
    'At most {n} images can be chosen for bumping',
  ],
  schBumpEach: ['จำนวนรูปต่อการดัน', 'Images per bump'],
  schBumpEachOpt: ['{n} รูป', '{n} image(s)'],
  schBumpEachHint: [
    'สุ่มจากรูปที่เลือกไว้ (ไม่ซ้ำกันในการดันครั้งเดียว) เลือกรูปก่อนจึงตั้งค่านี้ได้',
    'Drawn at random from the chosen images (no repeats within one bump). Choose images first to set this',
  ],
  schBumpHead1: ['ดัน 1 ครั้ง หลังโพสต์ {h} ชม.', 'Bump once, {h} h after the post'],
  schBumpHeadN: ['ดัน {n} ครั้ง ห่างกัน {h} ชม.', 'Bump {n} times, {h} h apart'],
  schBumpTailImg: ['ครั้งละ {k} รูป', '{k} image(s) each time'],
  schBumpTailText: ['ข้อความอย่างเดียว', 'text only'],
  schBumpNote: [
    'การดันคอมเมนต์จากเบราว์เซอร์เดียวกับที่โพสต์ และไม่นับรวมในจำนวนโพสต์ต่อวัน',
    'A bump is commented from the same browser that posted, and does not count toward the daily post limit',
  ],
  schBumpLockedTitle: [
    'การดันโพสต์ใช้ได้ในแผน {plan}',
    'Bumping posts is available on the {plan} plan',
  ],
  schBumpLockedBody: [
    'แผนของเจ้าของเวิร์กสเปซนี้ยังไม่รวมการดันโพสต์ อัปเกรดเป็น {plan} เพื่อเปิดใช้',
    'The owner of this workspace is not on a plan with bumping. Upgrade to {plan} to switch it on',
  ],
  // The schedule list's bump line, e.g. "bump 2h × 2" (every {h} hours, {n} times).
  schBumpLine: ['ดัน {h} ชม. × {n}', 'bump {h}h × {n}'],
  schBumpLineImg: ['{k} รูป/ครั้ง', '{k} image(s) each'],

  // Post window (timeline, schedule dots): the details of ONE post, "post now" and edit.
  pdTitle: ['รายละเอียดโพสต์', 'Post details'],
  pdTarget: ['ปลายทาง', 'Target'],
  pdSchedule: ['ตารางโพสต์', 'Schedule'],
  pdSet: ['ชุดโพสต์ → ชุดลิงก์', 'Collection → link set'],
  pdWhen: ['กำหนดโพสต์', 'Planned for'],
  pdPublished: ['โพสต์เมื่อ', 'Posted at'],
  pdExtension: ['โพสต์ผ่านเครื่อง', 'Posted by browser'],
  pdMedia: ['{n} รูป/ไฟล์', '{n} image(s)/file(s)'],
  pdText: ['ข้อความที่จะโพสต์', 'Text to post'],
  pdNoText: ['(ไม่มีข้อความ)', '(no text)'],
  pdRunNow: ['โพสต์เดี๋ยวนี้', 'Post now'],
  pdRerun: ['ลองใหม่เดี๋ยวนี้', 'Retry now'],
  pdEdit: ['แก้ไขโพสต์', 'Edit post'],
  pdWorking: ['กำลังส่ง…', 'Sending…'],
  pdRushed: [
    'ลัดคิวแล้ว รอส่วนขยายรับงาน',
    'Moved to the front: waiting for the browser to take it',
  ],
  pdOverdue: [
    'เลยเวลาแล้วแต่ส่วนขยายยังไม่รับงาน (เครื่องออฟไลน์ ถูกหยุดชั่วคราว หรืออยู่ในช่วงพักระหว่างโพสต์)',
    'Past its time, but no browser has taken it yet (offline, paused, or resting between posts)',
  ],
  pdRunHint: [
    'โพสต์จะออกจากรอบเดิมแล้วเป็นงานถัดไปของส่วนขยาย โดยยังเว้นช่วงห่างระหว่างโพสต์ตามค่าความปลอดภัยบัญชี',
    "The post leaves its slot and becomes the browser's next job; the pause between posts still applies",
  ],
  pdCannotRun: [
    'โพสต์นี้ส่งซ้ำไม่ได้ (โพสต์ไปแล้ว กำลังโพสต์ หรือรอแอดมินกลุ่มอนุมัติ)',
    'This post cannot be sent again (it went out, is being posted, or waits for the group admin)',
  ],
  pdUnbound: [
    'เครื่องที่ใช้โพสต์ถูกยกเลิกการผูกแล้ว จึงสั่งโพสต์ไม่ได้ ผูกเครื่องใหม่ที่หน้าทีมก่อน',
    'The browser that posts for it was unbound, so it cannot be sent. Pair a browser on the team page first',
  ],
  pdNoEdit: [
    'โพสต์นี้ไม่ได้มาจากคลังโพสต์ จึงแก้ไขไม่ได้',
    'This post did not come from the post library, so it cannot be edited',
  ],
  runNowDone: [
    'ส่งเข้าคิวแล้ว ส่วนขยายจะโพสต์เป็นงานถัดไป โพสต์จะย้ายจากรอบเดิมมาเป็นตอนนี้',
    'Sent to the front of the queue: the browser posts it next, and it moves from its old slot to now',
  ],
  rerunDone: [
    'นำโพสต์ที่ล้มเหลวกลับมารันเดี๋ยวนี้แล้ว ส่วนขยายจะโพสต์เป็นงานถัดไป',
    'The failed post was put back to run now: the browser posts it next',
  ],

  // Timeline page
  tlTitle: ['ไทม์ไลน์โพสต์', 'Post timeline'],
  tlSub: [
    'ดูโพสต์ของทุกชุดเรียงตามเวลาเป็นรายนาที เส้นแดงคือเวลาตอนนี้ จุดที่ใกล้ถึงเวลาจะมีวงเรืองแสง คลิกที่จุดเพื่อแก้ไขหรือสั่งโพสต์เดี๋ยวนี้',
    "Every collection's posts by the minute. The red line is now, the next post glows. Click a dot to edit it or post it now",
  ],
  tlRefresh: ['รีเฟรช', 'Refresh'],
  tlPrevDay: ['วันก่อนหน้า', 'Previous day'],
  tlNextDay: ['วันถัดไป', 'Next day'],
  tlDate: ['วันที่', 'Date'],
  tlKAll: ['โพสต์ทั้งหมดของวัน', 'Posts of the day'],
  tlKAllNote: ['ในตารางที่เลือก', 'In the chosen schedule(s)'],
  tlKQueued: ['รอโพสต์', 'Waiting'],
  tlKQueuedNote: ['รวมที่รอส่วนขยายรับงาน', 'Including those waiting for the browser'],
  tlKPosting: ['กำลังโพสต์', 'Posting now'],
  tlKPostingNote: ['ส่วนขยายกำลังทำงานอยู่', 'A browser is on it'],
  tlKDone: ['โพสต์แล้ว', 'Posted'],
  tlKDoneNote: ['จุดสีเขียว', 'Green dots'],
  tlKFailed: ['ล้มเหลว', 'Failed'],
  tlKFailedNote: ['คลิกจุดแดงเพื่อสั่งรันใหม่', 'Click a red dot to rerun it'],
  tlNextUp: ['โพสต์ถัดไป', 'Next post'],
  tlNextIn: ['อีก {n} นาที', 'in {n} min'],
  tlNextInH: ['อีก {h} ชม. {m} นาที', 'in {h} h {m} min'],
  tlNextNow: ['ถึงเวลาแล้ว', 'due now'],
  tlNextNone: [
    'ไม่มีโพสต์ที่รอคิวต่อจากนี้ในวันนี้',
    'Nothing else is queued for the rest of today',
  ],
  tlNextOtherDay: ['เลือกวันนี้เพื่อดูโพสต์ถัดไป', 'Pick today to see the next post'],
  tlFilterSchedule: ['ตารางโพสต์', 'Schedule'],
  tlFilterScheduleAll: ['ทุกตาราง', 'All schedules'],
  tlFilterStatus: ['สถานะ', 'Status'],
  tlLightAll: ['ทั้งหมด', 'All'],
  tlLightGreen: ['โพสต์แล้ว', 'Posted'],
  tlLightYellow: ['รอ / กำลังโพสต์', 'Waiting / posting'],
  tlLightRed: ['ล้มเหลว', 'Failed'],
  tlLightGrey: ['ข้ามแล้ว', 'Skipped'],
  tlSearch: ['ค้นหากลุ่ม / ข้อความ', 'Search group / text'],
  tlZoom: ['ซูม', 'Zoom'],
  tlZoomOverview: ['ทั้งวัน', 'Whole day'],
  tlZoomNormal: ['ปกติ', 'Normal'],
  tlZoomDetail: ['ละเอียด', 'Detailed'],
  tlZoomMinute: ['รายนาที', 'By the minute'],
  tlGoNow: ['ไปที่ตอนนี้', 'Go to now'],
  tlRowsHead: ['ชุดโพสต์ · ตาราง', 'Collection · schedules'],
  tlRowPosts: ['{n} โพสต์', '{n} post(s)'],
  tlRowDone: ['โพสต์แล้ว {a}/{n}', 'posted {a}/{n}'],
  tlRowOther: ['โพสต์เดี่ยว / ทดสอบ', 'Single / test posts'],
  tlRowOtherNote: ['ไม่ได้มาจากตารางโพสต์', 'Not made by a schedule'],
  tlRowGone: ['ตารางที่ถูกลบแล้ว', 'Deleted schedules'],
  tlRowGoneNote: ['ประวัติของตารางที่ไม่มีแล้ว', 'History of schedules that no longer exist'],
  tlNowLabel: ['ตอนนี้ {t}', 'Now {t}'],
  tlEmptyTitle: ['ไม่มีโพสต์ในวันนี้', 'No posts on this day'],
  tlEmptyFiltered: ['ไม่มีโพสต์ที่ตรงกับตัวกรอง', 'No post matches the filters'],
  tlEmptyBody: [
    'สร้างตารางโพสต์ แล้วโพสต์ของแต่ละรอบจะมาอยู่บนไทม์ไลน์นี้ หรือเลือกวันอื่นด้านบน',
    "Create a schedule and each round's posts show up here, or pick another day above",
  ],
  tlEmptyGo: ['ไปที่ตารางโพสต์', 'Go to the schedules'],
  tlLoading: ['กำลังโหลดโพสต์…', 'Loading posts…'],
  tlLegend: ['สถานะ', 'Legend'],
  tlLegendNext: ['ถัดไป', 'Next up'],
  tlLegendRushed: ['ลัดคิวแล้ว', 'Moved to the front'],
  tlLegendOverdue: ['เลยเวลา รอเครื่อง', 'Overdue, waiting'],
  tlHint: [
    'เลื่อนซ้าย-ขวาเพื่อดูช่วงเวลาอื่น เอาเมาส์ชี้ที่จุดเพื่อดูรายละเอียด คลิกเพื่อแก้ไข สั่งโพสต์เดี๋ยวนี้ หรือรันใหม่',
    'Scroll sideways for other hours, hover a dot for details, click it to edit, post it now or rerun it',
  ],
  tlDot: ['{time} · {target} · {status}', '{time} · {target} · {status}'],
  tlTipSchedule: ['ตาราง', 'Schedule'],
  tlTipTarget: ['กลุ่ม/เพจ', 'Group/page'],
  tlTipCode: ['รหัสกลุ่ม', 'Group code'],
  tlTipReason: ['สาเหตุ', 'Reason'],
  tlTipClick: ['คลิกเพื่อดูรายละเอียดและสั่งงาน', 'Click for details and actions'],

  // Dots of a schedule (schedules page)
  sdToggle: ['จุดโพสต์ของวัน', 'Post dots of the day'],
  sdHide: ['ซ่อนจุดโพสต์', 'Hide the dots'],
  sdShow: ['ดูจุดโพสต์', 'Show the dots'],
  sdDay: ['วัน', 'Day'],
  sdEmpty: ['วันนี้ตารางนี้ไม่มีโพสต์', 'This schedule has no posts on this day'],
  sdLoading: ['กำลังโหลดโพสต์…', 'Loading posts…'],
  sdCounts: ['{a} โพสต์แล้ว · {b} รอ · {c} ล้มเหลว', '{a} posted · {b} waiting · {c} failed'],
  sdSkipped: ['ข้าม {n}', 'skipped {n}'],
  sdHelp: [
    'หนึ่งจุด = หนึ่งโพสต์ เขียว = โพสต์แล้ว เหลือง = รอ/กำลังโพสต์ แดง = ล้มเหลว (คลิกเพื่อรันใหม่เดี๋ยวนี้) เทา = ข้ามแล้ว',
    'One dot = one post. Green = posted, yellow = waiting/posting, red = failed (click to rerun now), grey = skipped',
  ],
  sdOpenTimeline: ['ดูบนไทม์ไลน์', 'See it on the timeline'],

  // Calendar: the day list folds up so the overview of what posts when stays visible.
  calCollapseAll: ['ย่อรายละเอียดทั้งหมด', 'Collapse all details'],
  calExpandAll: ['แสดงรายละเอียดทั้งหมด', 'Expand all details'],
  calRowOpen: ['ดูรายละเอียดโพสต์', "Show the post's details"],
  calRowClose: ['ย่อรายละเอียด', 'Hide the details'],
  calPanelHide: ['ซ่อนรายการของวัน', 'Hide the day list'],
  calPanelShow: ['แสดงรายการของวัน', 'Show the day list'],
  calRunNow: ['โพสต์เดี๋ยวนี้', 'Post now'],
  calOpenTimeline: ['ดูบนไทม์ไลน์', 'See it on the timeline'],
} as const;

registerPack('flow', AP_I18N_FLOW);

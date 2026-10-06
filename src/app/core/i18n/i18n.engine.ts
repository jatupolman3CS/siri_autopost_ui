import { registerPack } from './i18n.service';

// Lazy dictionary pack "engine": the strings the design handoff lacks for the engine pages (test post,
// notifications, auto-reply, reports, anti-ban additions, backup and restore). Only the lazily loaded pages
// that read t().api.engine import this module, which registers the pack (see registerPack in
// i18n.service.ts), so it stays out of the first bundle. Every file that reads t().api.engine must
// `import './i18n.engine'`.
//
// How to add a leaf: append `name: ['ไทย', 'English'],` (a [th, en] pair, both languages) below, then read
// it as t().api.engine.name; fill {placeholders} with fmt(). Only the engine pages append here, so that pack
// files of different features never collide. A string of the design that is wrong for the real system is
// corrected in i18n.fixes.ts instead, with a comment saying what the design got wrong.
export const AP_I18N_ENGINE = {
  // A setting that is saved but not applied yet (notification screenshots and offline alerts, page tags...). The
  // anti-ban page has none left: the focus window and the rest after a block are applied by the extension, shuffle
  // by the server. Keep the design's label and add this hint. It says plainly that nothing applies the value (neither
  // the extension nor the server), so a switch that is on does not read as active.
  storedOnly: [
    'บันทึกไว้เท่านั้น ยังไม่มีส่วนใดนำค่านี้ไปใช้',
    'Saved only: nothing applies this setting yet',
  ],
  storedOnlyBadge: ['บันทึกเท่านั้น', 'Saved only'],
  // A control of a plan the owner does not have ({plan} is the plan's name, from t().plans).
  planLocked: ['ใช้ได้ในแผน {plan} ขึ้นไป', 'Available on {plan} and above'],

  // Notifications, auto-reply and reports
  // Notifications: tokens are write-only, so the field says what is stored and how to remove it.
  notifyRemoveToken: ['ลบโทเค็นที่บันทึกไว้', 'Remove the saved token'],
  notifyKeepToken: ['เก็บโทเค็นที่บันทึกไว้', 'Keep the saved token'],
  notifyTokenRemoves: [
    'โทเค็นที่บันทึกไว้จะถูกลบเมื่อกดบันทึก',
    'The saved token is removed when you save',
  ],
  notifyChatsPick: ['พบแชทเหล่านี้ เลือกแชทที่ต้องการ', 'Chats found. Pick the one to use'],
  notifyChatsNone: [
    'ยังไม่พบแชท ลองส่งข้อความหาบอทสักข้อความ แล้วค้นหาใหม่',
    'No chats found yet. Message the bot once, then search again',
  ],
  notifyNoSets: [
    'ยังไม่มีชุดลิงก์ เพิ่มกลุ่มในหน้า “ชุดลิงก์กลุ่ม” แล้วกลับมาตั้งการแจ้งเตือนรายชุดและรายกลุ่ม',
    'No link sets yet. Add groups on the Link sets page, then come back to set alerts per set and per group',
  ],
  notifyNoGroups: ['ชุดนี้ยังไม่มีกลุ่มที่เปิดใช้', 'This set has no enabled groups'],
  notifyNotReady: [
    '{ch} ยังไม่พร้อม (ต้องเปิดใช้และกรอกโทเค็นกับผู้รับ) จึงยังไม่มีข้อความส่งผ่านช่องทางนี้',
    '{ch} is not ready (it needs to be on, with a token and a recipient), so nothing is sent through it yet',
  ],

  // Auto-reply
  engageRuleCount: ['{n} กฎ · เปิดอยู่ {m}', '{n} rules · {m} on'],
  engageNoRules: ['ยังไม่มีกฎ กด “เพิ่มกฎ” เพื่อเริ่ม', 'No rules yet. Press “New rule” to start'],
  engageFeedEmpty: ['ยังไม่มีคอมเมนต์ที่ระบบจัดการ', 'No comments handled yet'],
  engageFull: ['ตั้งกฎได้สูงสุด {n} กฎ', 'You can have up to {n} rules'],
  engageTryNote: [
    'ตรวจในหน้านี้เท่านั้น ไม่มีการตอบคอมเมนต์หรือส่งแชทจริง',
    'This check runs on this page only; nothing is replied or sent',
  ],

  // Reports
  reportsEmpty: ['ยังไม่มีโพสต์ในช่วงนี้', 'No posts in this period'],
  reportsPostsEmpty: [
    'ยังไม่มีโพสต์ที่โพสต์สำเร็จจากชุดโพสต์ในช่วงนี้',
    'No post from a collection went out in this period',
  ],
  reportsScope: [
    'นับเฉพาะโพสต์จริงของส่วนขยายที่ผูกไว้ ไม่รวมโพสต์ทดสอบ',
    'Counts the real posts of the paired extensions only. Test posts are left out',
  ],
  reportsFailed: ['โหลดรายงานไม่สำเร็จ', 'Could not load the report'],
  reportsRetry: ['ลองอีกครั้ง', 'Try again'],
  reportShareLink: ['ลิงก์รายงาน', 'Report link'],
  reportShareOpen: ['เปิดรายงาน', 'Open report'],
  reportSharePrint: ['พิมพ์ / บันทึกเป็น PDF', 'Print / Save as PDF'],
  reportShareCopy: ['คัดลอกลิงก์', 'Copy link'],
  reportShareCopied: ['คัดลอกลิงก์แล้ว', 'Link copied'],
  reportPdfHint: [
    'หน้ารายงานเปิดในแท็บใหม่ เลือก “บันทึกเป็น PDF” ในหน้าต่างพิมพ์',
    'The report opens in a new tab. Choose “Save as PDF” in the print window',
  ],

  // The public report page (route report/:token)
  sharedNotFound: ['ไม่พบรายงานนี้', 'Report not found'],
  sharedNotFoundBody: [
    'ลิงก์อาจหมดอายุหรือพิมพ์ไม่ครบ ขอลิงก์ใหม่จากผู้ส่งรายงาน',
    'The link may have expired or be incomplete. Ask the sender for a new one',
  ],
  sharedFailed: ['โหลดรายงานไม่สำเร็จ ลองอีกครั้ง', 'Could not load the report. Try again'],
  sharedFor: ['เวิร์กสเปซ {w}', 'Workspace {w}'],
  sharedPeriod: ['ช่วงเวลา {a} – {b}', 'Period {a} – {b}'],
  sharedCreated: ['สร้างรายงานเมื่อ {d}', 'Report created {d}'],
  sharedSnapshot: [
    'รายงานนี้สรุปตัวเลข ณ วันที่สร้าง ไม่อัปเดตตามหลัง',
    'This report is a snapshot of the numbers when it was created and does not update',
  ],
  sharedPoweredBy: ['จัดทำด้วย AutoPost', 'Powered by AutoPost'],
  // The one-line summary under the heading of the shared report: {n} posts that went out, in {g} groups.
  sharedSummary: [
    'โพสต์สำเร็จ {n} ครั้งใน {g} กลุ่ม · อัตราสำเร็จ {r}%',
    'Posted {n} time(s) in {g} group(s) · {r}% success rate',
  ],

  // Test post: the post is real, so the page shows its real state instead of the design's simulated steps
  // (t().test.l1 to l7 are not used).
  testQueued: [
    'อยู่ในคิว รอส่วนขยายรับงาน (ปกติไม่เกินประมาณ 30 วินาที)',
    'Queued, waiting for the extension to pick it up (usually within about 30 seconds)',
  ],
  testPosting: ['ส่วนขยายกำลังโพสต์…', 'The extension is posting…'],
  testSuccess: ['ส่วนขยายโพสต์แล้ว', 'The extension posted it'],
  testFailed: ['โพสต์ทดสอบไม่สำเร็จ', 'The test post did not go through'],

  // Notifications: what is saved but not sent yet, and the token rule.
  notifyNotSent: [
    'การแนบภาพหน้าจอและการแจ้งเมื่อส่วนขยายออฟไลน์บันทึกไว้ แต่ยังไม่มีการส่ง',
    'Screenshot attachments and offline alerts are saved, but nothing sends them yet',
  ],
  tokenSaved: [
    'บันทึกโทเค็นไว้แล้ว และจะไม่แสดงอีก เว้นว่างไว้เพื่อใช้ค่าเดิม',
    'Token saved and never shown again. Leave it blank to keep it',
  ],

  // Auto-reply: the rules are saved but nothing reads comments yet.
  engageNoFeed: [
    'รายการคอมเมนต์ที่จัดการแล้วจะว่างอยู่ จนกว่าส่วนขยายจะอ่านคอมเมนต์ได้',
    'The list of handled comments stays empty until the extension can read comments',
  ],

  // Reports: likes and comments are not collected, a shared link is a snapshot.
  reportsNoLikes: ['ยังไม่มีข้อมูลไลก์และคอมเมนต์', 'Likes and comments are not collected yet'],
  reportShareExpires: ['ลิงก์ใช้ได้ถึง {d}', 'The link works until {d}'],
  reportSharesTitle: ['ลิงก์ที่ยังใช้ได้', 'Links in use'],
  reportSharesEmpty: ['ยังไม่มีลิงก์ที่ใช้งานอยู่', 'No link is in use'],
  reportSharesItem: ['{brand} · {period} · ใช้ได้ถึง {d}', '{brand} · {period} · works until {d}'],
  reportSharesRevoke: ['ยกเลิกลิงก์', 'Revoke link'],
  reportSharesRevoked: [
    'ยกเลิกลิงก์แล้ว ใครที่มีลิงก์นี้จะเปิดไม่ได้อีก',
    'Link revoked. Nobody can open it any more',
  ],
  reportSharesHint: [
    'ลิงก์ที่ยกเลิกแล้วใช้ไม่ได้อีก และเว้นที่ให้สร้างลิงก์ใหม่ (สูงสุด 20 ลิงก์)',
    'A revoked link stops working and frees a place for a new one (20 at most)',
  ],
  // The title of the public report page (route report/:token) is api.reportTitle in i18n.extra.ts.

  // Restore: the file is checked first, then its contents are listed and a second click confirms the replacement.
  restoreCheck: ['ตรวจไฟล์', 'Check the file'],
  restorePick: ['เลือกไฟล์ .json', 'Choose a .json file'],
  restoreBack: ['ย้อนกลับ', 'Back'],
  restoreConfirm: ['แทนที่และกู้คืน', 'Replace and restore'],
  restoreIncomplete: [
    'ไฟล์นี้ไม่ใช่ไฟล์สำรองที่สมบูรณ์ ต้องมีชุดโพสต์ ชุดลิงก์ และตารางโพสต์',
    'This is not a complete backup: it needs collections, link sets and schedules',
  ],
  restoreSumTitle: ['ไฟล์นี้มี', 'This file contains'],
  restoreSumCollections: ['{n} ชุดโพสต์ (รวม {p} โพสต์)', '{n} collection(s), {p} post(s) in all'],
  restoreSumLibrary: [
    '{n} โพสต์ในคลังโพสต์ที่ไม่อยู่ในชุดใด',
    '{n} post(s) in the post library that are in no collection',
  ],
  restoreSumLinkSets: ['{n} ชุดลิงก์ (รวม {l} ลิงก์)', '{n} link set(s), {l} link(s) in all'],
  restoreSumSchedules: ['{n} ตารางโพสต์', '{n} schedule(s)'],
  restoreSumAdvanced: ['ค่า anti-ban ขั้นสูง', 'Advanced anti-ban settings'],
  restoreSumNotify: ['กฎแจ้งเตือนของ {n} ชุดลิงก์', 'Notification rules for {n} link set(s)'],
  restoreSumReply: ['กฎตอบกลับอัตโนมัติ {n} กฎ', '{n} auto-reply rule(s)'],
  restoreSumPlan: [
    'ค่าขั้นสูง กฎแจ้งเตือน และกฎตอบกลับอัตโนมัติจะถูกใช้เฉพาะเมื่อแผนของเจ้าของเวิร์กสเปซรองรับ',
    'The advanced settings, notification rules and auto-reply rules are applied only when the workspace owner’s plan includes them',
  ],
  restoreNow: [
    'ตอนนี้เวิร์กสเปซนี้มี {c} ชุดโพสต์ · {s} ชุดลิงก์ · {h} ตาราง',
    'This workspace has {c} collection(s) · {s} link set(s) · {h} schedule(s) right now',
  ],
  restoreReplaces: [
    'ชุดโพสต์ ชุดลิงก์ และตารางโพสต์ทั้งหมดในเวิร์กสเปซนี้จะถูกแทนที่ด้วยข้อมูลในไฟล์ สิ่งที่ไม่อยู่ในไฟล์จะหายไป',
    'Every collection, link set and schedule in this workspace is replaced by what is in the file. Anything that is not in the file is removed',
  ],
  restoreQueued: [
    'โพสต์ที่ตารางเดิมจัดคิวไว้ล่วงหน้าจะถูกลบ แล้วจัดคิวใหม่ตามตารางในไฟล์',
    'Posts the old schedules had queued ahead are deleted, and queued again from the schedules in the file',
  ],
  restoreHistory: [
    'ประวัติโพสต์ที่ส่งไปแล้วยังอยู่ครบ',
    'The history of posts that were already sent stays',
  ],

  // Backup: the file holds no secrets.
  backupNoSecrets: [
    'ไฟล์สำรองไม่มีโทเค็น (Telegram, LINE) ต้องกรอกใหม่หลังกู้คืน',
    'The backup holds no tokens (Telegram, LINE): enter them again after restoring',
  ],

  // Test post: it is a real post to a real group (never a simulation), and the typed text is composed like a
  // scheduled post's ({a|b} spintax, {{code}} and the collection's footer and hashtags).
  testReal: [
    'นี่ไม่ใช่การจำลอง: ระบบจะโพสต์จริง 1 โพสต์ทันทีลงกลุ่มหรือเพจ Facebook ที่เลือก ผ่านส่วนขยายที่เลือก สมาชิกกลุ่มหรือผู้ติดตามเพจมองเห็นได้ และโพสต์นี้นับรวมในเพดานต่อวัน',
    'This is not a simulation: one real post is made right now in the Facebook group or page you choose, through the extension you choose. Members of the group or followers of the page can see it, and it counts toward the daily limit',
  ],
  testOverrideHint: [
    'Spintax {a|b} และ {{code}} (หรือ {{รหัส}}) ถูกแปลงเหมือนโพสต์จากตาราง: สุ่มเลือกคำ ใส่รหัสกลุ่ม และเพิ่มข้อความท้ายกับแฮชแท็กของชุดโพสต์ ตัวอย่างด้านล่างเป็นแค่ตัวอย่างหนึ่ง โพสต์จริงอาจสุ่มได้คำอื่น',
    'Spintax {a|b} and {{code}} (or {{รหัส}}) are resolved just like in a scheduled post: a word is picked at random, the group code is filled in, and the collection’s footer and hashtags are added. The preview below is only one possible result; the real post may pick other words',
  ],

  // Test post, anti-ban and devices
  // The test post's log follows the real post. testQueued/testPosting/testSuccess/testFailed are above; these
  // are the other states it can reach, and the warnings beside the run button.
  testPending: [
    'ส่วนขยายโพสต์แล้ว รอแอดมินกลุ่มอนุมัติก่อนจึงจะแสดงในกลุ่ม',
    'The extension posted it. The group admins must approve it before it shows in the group',
  ],
  testSkipped: ['โพสต์ทดสอบถูกข้าม', 'The test post was skipped'],
  testWaiting: [
    'ส่วนขยายออฟไลน์ โพสต์ทดสอบรอจนกว่าจะกลับมาออนไลน์',
    'The extension is offline: the test post waits until it is back online',
  ],
  testStillWaiting: [
    'ส่วนขยายยังไม่ตอบกลับ โพสต์ทดสอบยังอยู่ในคิวและจะออกไปเมื่อส่วนขยายรับงาน ดูผลได้ในรายการด้านล่าง',
    'The extension has not answered yet. The test post stays queued and goes out when the extension picks it up. See the result in the list below',
  ],
  testPaused: [
    'ส่วนขยายที่เลือกพักรับงานอยู่ (พักเองหรือพักอัตโนมัติ) โพสต์ทดสอบจะรอจนกว่าจะเริ่มรับงานอีกครั้ง',
    'The chosen extension has its jobs paused (by hand or automatically), so the test post waits until it takes jobs again',
  ],

  // Anti-ban: the block pause only runs with the automatic pause switched on; the file could not be saved.
  blockNeedsAuto: [
    'ใช้เมื่อเปิด “หยุดอัตโนมัติเมื่อ Facebook แสดงคำเตือน” ด้านบนเท่านั้น',
    'Applies only while “Pause automatically when Facebook shows a warning” above is on',
  ],
  backupFailed: [
    'ดาวน์โหลดไฟล์สำรองไม่สำเร็จ เบราว์เซอร์ไม่ให้ดาวน์โหลด',
    'The backup could not be saved: the browser did not allow the download',
  ],

  // Devices: the engine paused a browser by itself (a Facebook block, or posts that kept failing).
  // {t} is a time, {r} the reason the API gives (Thai text from the server).
  devAutoPaused: ['พักอัตโนมัติถึง {t}: {r}', 'Paused automatically until {t}: {r}'],
  devAutoPausedNoReason: ['พักอัตโนมัติถึง {t}', 'Paused automatically until {t}'],
  devAutoPausedTag: ['พักอัตโนมัติ', 'Paused automatically'],

  // Anti-ban page: what the extension in the browser uses when it posts (the card at the top), the typing speed,
  // and who applies the focus window and the rest after a block (the extension; they are no longer "saved only").
  abExtTitle: ['ส่วนขยายใช้ค่าเหล่านี้', 'The extension uses these settings'],
  abExtBody: [
    'ตอนที่ส่วนขยายในเบราว์เซอร์ของคุณโพสต์ มันทำตามค่าในหน้านี้:',
    'When the extension in your browser posts, it follows the settings on this page:',
  ],
  abExtTyping: [
    'พิมพ์ข้อความทีละตัวอักษรเหมือนคนพิมพ์ ด้วยความเร็วที่เลือก (ช้า ปกติ เร็ว)',
    'Types the text character by character like a person, at the speed you choose (slow, normal, fast)',
  ],
  abExtScroll: ['เลื่อนดูฟีดสักครู่ก่อนโพสต์', 'Scrolls the feed for a moment before it posts'],
  abExtFocus: [
    'ดึงหน้าต่าง Chrome ขึ้นมาไว้ด้านหน้าขณะโพสต์ (หน้าต่างโฟกัส)',
    'Brings its Chrome window to the front while it posts (focus window)',
  ],
  abExtBlock: [
    'พักตามจำนวนชั่วโมงที่ตั้งไว้หลัง Facebook เตือนหรือบล็อก',
    'Rests for the number of hours you set after Facebook warns or blocks it',
  ],
  abExtPause: [
    'เว้นระยะระหว่างโพสต์ และหยุดพักเองเมื่อโพสต์ล้มเหลวติดกัน',
    'Waits between posts, and pauses itself when posts keep failing',
  ],
  abExtWhatTitle: ['โพสต์อะไร และโพสต์ที่ไหน:', 'What it posts, and where:'],
  abExtWhat: [
    'มาจากตารางโพสต์ ซึ่งผูกข้อความ รูป และกลุ่มหรือเพจปลายทางไว้ครบแล้ว (ชุดโพสต์ + ชุดลิงก์) ส่วนขยายไม่มีชุดโพสต์หรือกลุ่มของตัวเองให้ตั้งอีก',
    'It comes from the schedule, which already ties the text, the images and the target groups or pages together (a collection and a link set). The extension has no posts or groups of its own to set up any more',
  ],
  abExtLinkTeam: ['ส่วนขยายที่เชื่อมต่อ', 'Connected extensions'],
  abTypingSpeed: ['ความเร็วในการพิมพ์', 'Typing speed'],
  abSpeedSlow: ['ช้า', 'Slow'],
  abSpeedNormal: ['ปกติ', 'Normal'],
  abSpeedFast: ['เร็ว', 'Fast'],
  abSpeedHint: [
    'ใช้เมื่อเปิดการจำลองการพิมพ์ ส่วนขยายใช้ความเร็วนี้กับทุกโพสต์ที่รับงานไป',
    'Used while typing simulation is on. The extension applies it to every post it takes',
  ],
  abBlockApplied: [
    'ส่วนขยายในเบราว์เซอร์เป็นผู้พัก โดยสุ่มจำนวนชั่วโมงระหว่างค่าต่ำสุดถึงสูงสุด',
    'The extension in the browser takes this rest, a random number of hours between the shortest and the longest',
  ],
  abFocusApplied: [
    'ส่วนขยายในเบราว์เซอร์เป็นผู้ใช้ค่านี้ทุกครั้งที่โพสต์',
    'The extension in the browser applies this every time it posts',
  ],

  // Test post page: two panels (from a collection, by hand), the extension that receives the test, and what it proves.
  testPanels: ['วิธีทดสอบ', 'How to test'],
  testPanelSet: ['ทดสอบจากชุดโพสต์', 'Test from a collection'],
  testPanelManual: ['ทดสอบเอง', 'Test by hand'],
  testDevice: ['ส่งผ่านส่วนขยาย', 'Send through this extension'],
  testDeviceHint: [
    'มีส่วนขยายหลายเครื่อง เลือกเครื่องที่จะรับงานทดสอบนี้ไปโพสต์',
    'Several extensions are connected: choose the one that takes this test and posts it',
  ],
  testDeviceOne: ['ส่งผ่านส่วนขยาย:', 'Sent through the extension:'],
  testDeviceOnline: ['ออนไลน์', 'Online'],
  testDeviceOffline: ['ออฟไลน์', 'Offline'],
  testDevicePaused: ['พักรับงาน', 'Jobs paused'],
  testNoDevice: [
    'ยังไม่มีส่วนขยายที่เชื่อมต่อ จับคู่เครื่องในหน้าทีมและเวิร์กสเปซก่อนจึงจะทดลองโพสต์ได้',
    'No extension is connected yet. Pair one on the Team & workspaces page before a test post',
  ],
  testNoDeviceLink: ['ไปที่ทีมและเวิร์กสเปซ', 'Go to Team & workspaces'],
  testDeviceDown: [
    'ส่วนขยาย “{d}” ออฟไลน์ เลือกส่วนขยายอื่นที่ออนไลน์ หรือเปิด Chrome ของเครื่องนั้นก่อน',
    'The extension “{d}” is offline. Choose one that is online, or open the Chrome of that machine first',
  ],
  testProves: [
    'การทดสอบนี้พิสูจน์อะไร: ส่งโพสต์จริงไปที่ที่เลือกตอนนี้เลย ผ่านส่วนขยายที่เลือก ถ้าออกได้ แปลว่างานของตารางโพสต์ก็ออกได้เช่นกัน',
    'What this proves: it sends a real post to the place you pick right now, through the extension you pick. If it goes out, the jobs of a schedule can go out too',
  ],
  testProvesLink: ['ไปที่ตารางโพสต์', 'Go to the schedules'],

  // Test post, by hand: a group or page link, a text and images, without any collection or link set.
  testKindGroup: ['กลุ่ม', 'Group'],
  testKindPage: ['เพจ', 'Page'],
  testManualUrl: ['ลิงก์กลุ่มหรือเพจ Facebook', 'Facebook group or page link'],
  testManualUrlPh: [
    'https://www.facebook.com/groups/ชื่อกลุ่ม',
    'https://www.facebook.com/groups/group-name',
  ],
  testManualUrlHint: [
    'วางที่อยู่ของกลุ่มหรือเพจที่ต้องการทดสอบ ระบบจะแปลงเป็นรูปแบบมาตรฐานให้',
    'Paste the address of the group or page to test. It is turned into the standard form for you',
  ],
  testManualBadUrl: [
    'ไม่ใช่ลิงก์กลุ่มหรือเพจ Facebook เช่น https://www.facebook.com/groups/ชื่อกลุ่ม',
    'Not a Facebook group or page link, e.g. https://www.facebook.com/groups/group-name',
  ],
  testManualWillPost: ['จะโพสต์ที่', 'Will post to'],
  testManualText: ['ข้อความที่จะโพสต์', 'Text to post'],
  testManualTextPh: ['พิมพ์ข้อความทดสอบ', 'Type the test text'],
  testManualTextHint: [
    'ใส่ Spintax {a|b} ได้ (สุ่มเลือกคำหนึ่งคำ) ส่วน {{code}} จะว่างไว้เพราะไม่มีรหัสกลุ่ม และไม่มีข้อความท้ายหรือแฮชแท็กเพิ่มให้ ยาวได้ไม่เกิน {n} ตัวอักษร',
    'Spintax {a|b} works (one word is picked at random). {{code}} stays empty because there is no group code, and no footer or hashtags are added. Up to {n} characters',
  ],
  testManualNeedText: ['ใส่ข้อความที่ต้องการทดสอบ', 'Type the text to test'],
  testManualNeedUrl: [
    'ใส่ลิงก์กลุ่มหรือเพจที่ต้องการทดสอบ',
    'Enter the group or page link to test',
  ],
  testManualImages: ['รูปภาพ (ไม่บังคับ)', 'Images (optional)'],
  testManualImagesHint: [
    'เลือกจากคลังสื่อ หรืออัปโหลดจากเครื่อง (รูปที่อัปโหลดเข้าคลังและนับรวมในจำนวนรูปที่แผนของคุณเก็บได้) แนบได้ไม่เกิน {n} รูป',
    'Pick from the media library, or upload from your computer (an uploaded image goes into the library and counts toward the images your plan can keep). At most {n} images',
  ],
  testManualPicked: ['เลือกแล้ว {n}/{m} รูป', '{n} of {m} images picked'],
  testManualUpload: ['อัปโหลดจากเครื่อง', 'Upload from my computer'],
  testManualUploadRefused: ['อัปโหลดไม่สำเร็จ: {r}', 'Upload did not go through: {r}'],
  testManualNoImages: [
    'ยังไม่มีรูปในคลัง อัปโหลดจากเครื่องได้ที่ปุ่มด้านบน',
    'The library has no images yet. Upload some with the button above',
  ],
  testManualSend: ['ส่งตอนนี้', 'Send now'],
  testManualPickOpen: ['เลือกจากคลังสื่อ', 'Pick from the library'],
  testManualPickClose: ['ซ่อนคลังสื่อ', 'Hide the library'],
  testManualGone: ['ไฟล์ถูกลบจากคลังแล้ว', 'File was deleted from the library'],

  // Pairing and renaming extensions: names are unique in a workspace, the connect link works from any browser.
  pairCopy: ['คัดลอกลิงก์เชื่อมต่อ', 'Copy connect link'],
  pairCopyHint: [
    'ลิงก์นี้ใช้ได้ครั้งเดียวและมีอายุ 10 นาที ส่งให้เครื่องที่จะโพสต์ แล้วเปิดใน Chrome ที่ติดตั้งส่วนขยาย',
    'The link works once and for 10 minutes. Send it to the machine that will post and open it in the Chrome that has the extension',
  ],
  pairNameHint: [
    'ชื่อต้องไม่ซ้ำกับส่วนขยายอื่นในเวิร์กสเปซนี้ ถ้าซ้ำ ระบบจะเติม (2) (3) ต่อท้ายให้เอง',
    'The name must be unique among the extensions of this workspace. If it is taken, (2), (3)… is added for you',
  ],
  pairNameTaken: [
    'ชื่อนี้มีส่วนขยายอื่นใช้อยู่แล้ว ส่วนขยายนี้จะได้ชื่อ “{d}”',
    'Another extension already has this name. This one will be named “{d}”',
  ],
  pairedRenamed: [
    'จับคู่แล้วในชื่อ “{d}” เพราะชื่อ “{w}” มีส่วนขยายอื่นใช้อยู่แล้ว',
    'Paired as “{d}” because another extension already uses “{w}”',
  ],
  connectNoLogin: [
    'Chrome นี้ไม่ต้องล็อกอิน AutoPost ส่วนขยายจะแสดงแค่ “เชื่อมต่อสำเร็จ”',
    'This Chrome does not need to be signed in to AutoPost. The extension only shows “connected successfully”',
  ],
  renameHint: [
    'ชื่อต้องไม่ซ้ำกับส่วนขยายอื่นในเวิร์กสเปซนี้ (ตัวพิมพ์เล็กใหญ่ถือว่าเหมือนกัน)',
    'The name must differ from the other extensions of this workspace (upper and lower case count as the same)',
  ],
} as const;

registerPack('engine', AP_I18N_ENGINE);

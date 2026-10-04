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
  // A setting that is saved but not applied yet (anti-ban image shuffle and "bring the window to the front",
  // notification screenshots and offline alerts). Keep the design's label and add this hint. It says plainly that
  // nothing applies the value (neither the extension nor the server), so a switch that is on does not read as active.
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
    'นับเฉพาะโพสต์จริงของบัญชีที่ผูกกับส่วนขยาย ไม่รวมโพสต์ทดสอบและบัญชีตัวอย่าง',
    'Counts real posts of accounts paired with the extension only. Test posts and sample accounts are left out',
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
  restoreBack: ['ย้อนกลับ', 'Back'],
  restoreConfirm: ['แทนที่และกู้คืน', 'Replace and restore'],
  restoreIncomplete: [
    'ไฟล์นี้ไม่ใช่ไฟล์สำรองที่สมบูรณ์ ต้องมีชุดโพสต์ ชุดลิงก์ และตารางโพสต์',
    'This is not a complete backup: it needs collections, link sets and schedules',
  ],
  restoreSumTitle: ['ไฟล์นี้มี', 'This file contains'],
  restoreSumCollections: ['{n} ชุดโพสต์ (รวม {p} โพสต์)', '{n} collection(s), {p} post(s) in all'],
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
    'นี่ไม่ใช่การจำลอง: ระบบจะโพสต์จริง 1 โพสต์ลงกลุ่ม Facebook ที่เลือกด้วยบัญชีของคุณ สมาชิกกลุ่มมองเห็นได้ และโพสต์นี้นับรวมในเพดานต่อวันของกลุ่ม',
    'This is not a simulation: one real post is made in the Facebook group you choose, from your account. The group’s members can see it, and it counts toward the group’s daily limit',
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
    'เครื่องที่ผูกไว้พักรับงานอยู่ (พักเองหรือพักอัตโนมัติ) โพสต์ทดสอบจะรอจนกว่าจะเริ่มรับงานอีกครั้ง',
    'The paired browser has its jobs paused (by hand or automatically), so the test post waits until it takes jobs again',
  ],
  testNoAccount: [
    'ยังไม่มีบัญชี Facebook ที่ผูกกับเครื่อง จับคู่เครื่องในหน้าทีมก่อนจึงจะทดลองโพสต์ได้',
    'No Facebook account is bound to a browser yet. Pair a computer on the Team page before a test post',
  ],

  // Anti-ban: the block pause only runs with the automatic pause switched on; the file could not be saved.
  blockNeedsAuto: [
    'ใช้เมื่อเปิด “หยุดอัตโนมัติเมื่อแพลตฟอร์มแสดงคำเตือน” ด้านบนเท่านั้น',
    'Applies only while “Pause automatically when the platform shows a warning” above is on',
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
} as const;

registerPack('engine', AP_I18N_ENGINE);

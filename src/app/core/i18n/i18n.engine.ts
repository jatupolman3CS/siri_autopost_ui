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
  // A setting that is saved but not applied yet (anti-ban "bring the window to the front", notification
  // screenshots and offline alerts). Keep the design's label and add this hint.
  storedOnly: [
    'บันทึกไว้ แต่ส่วนขยายยังไม่ใช้ค่านี้',
    'Saved, but the extension does not apply this yet',
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
  // The title of the public report page (route report/:token) is api.reportTitle in i18n.extra.ts.

  // Backup: the file holds no secrets.
  backupNoSecrets: [
    'ไฟล์สำรองไม่มีโทเค็น (Telegram, LINE) ต้องกรอกใหม่หลังกู้คืน',
    'The backup holds no tokens (Telegram, LINE): enter them again after restoring',
  ],
} as const;

registerPack('engine', AP_I18N_ENGINE);

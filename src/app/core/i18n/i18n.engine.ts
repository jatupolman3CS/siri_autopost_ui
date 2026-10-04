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

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
} as const;

registerPack('flow', AP_I18N_FLOW);

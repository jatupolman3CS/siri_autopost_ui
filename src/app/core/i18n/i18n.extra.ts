// Strings the design handoff does not have, added when the app moved to the real API.
// Merged into the dictionary as t().api; same [th, en] pair shape as i18n.data.ts.
export const AP_I18N_EXTRA = {
  authInvalid: ['อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'Wrong email or password'],
  // Google sign-in: the design handoff of 2026-10 dropped these, the real app has the button.
  googleLogin: ['เข้าสู่ระบบด้วย Google', 'Sign in with Google'],
  googleSignup: ['สมัครด้วย Google', 'Sign up with Google'],
  googleOff: [
    'ยังไม่ได้ตั้งค่า Google (ผู้ดูแลต้องตั้ง Google__ClientId ที่ API)',
    'Google sign-in is not set up yet (the admin must set Google__ClientId on the API)',
  ],
  googleFailed: ['เข้าสู่ระบบด้วย Google ไม่สำเร็จ', 'Google sign-in failed'],
  or: ['หรือ', 'or'],

  // The public page of a shared client report (route report/:token).
  reportTitle: ['รายงานผลการโพสต์', 'Posting report'],
  emailTaken: [
    'อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน',
    'This email already has an account. Try logging in.',
  ],
  passwordMin: ['รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร', 'Password must be at least 8 characters'],
  serverDown: [
    'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง',
    'Cannot reach the server. Please try again.',
  ],
  loading: ['กำลังโหลด…', 'Loading…'],
  saving: ['กำลังบันทึก…', 'Saving…'],
  saved: ['บันทึกแล้ว', 'Saved'],
  save: ['บันทึกการตั้งค่า', 'Save settings'],
  unsaved: ['มีการเปลี่ยนแปลงที่ยังไม่บันทึก', 'You have unsaved changes'],
  uploadFailed: [
    'อัปโหลดไม่สำเร็จ: รองรับเฉพาะรูปภาพหรือวิดีโอ ขนาดไม่เกิน 100 MB',
    'Upload failed: images or videos up to 100 MB only',
  ],
  uploading: ['กำลังอัปโหลด {n} ไฟล์…', 'Uploading {n} file(s)…'],
  uploaded: ['อัปโหลดแล้ว {n} ไฟล์', 'Uploaded {n} file(s)'],
  offlineSince: ['ส่วนขยายออฟไลน์ตั้งแต่ {t}', 'Extension offline since {t}'],
  noMedia: ['ยังไม่มีสื่อ อัปโหลดได้ที่หน้าคลังสื่อ', 'No media yet. Upload some in the library.'],

  // Devices and pairing (Phase 3)
  addDevice: ['เพิ่มอุปกรณ์', 'Add device'],
  pairTitle: ['เชื่อมต่อ Chrome กับเวิร์กสเปซนี้', 'Connect a Chrome to this workspace'],
  pairStep1: [
    'ทำในหน้านี้บน Chrome ที่จะใช้โพสต์: ติดตั้งส่วนขยาย AutoPost และล็อกอิน Facebook ไว้แล้ว',
    'Do this on the Chrome that will post: the AutoPost extension installed and Facebook logged in',
  ],
  pairStep2: [
    'กด “เชื่อมต่อ Chrome เครื่องนี้” แล้วกด “อนุญาต” ในหน้าของส่วนขยายที่เปิดขึ้นมา',
    'Press “Connect this Chrome”, then “Allow” on the extension page that opens',
  ],
  pairStep3: [
    'คอมเครื่องอื่น: เข้าเว็บนี้จากเครื่องนั้น แล้วกด “เพิ่มอุปกรณ์” ที่นั่น การตั้งค่าทั้งหมดทำที่เว็บ ส่วนขยายแสดงแค่สถานะ',
    'Another computer: open this site there and press “Add device” on it. All settings live on the web; the extension only shows its status.',
  ],
  pairName: ['ชื่อเครื่อง', 'Device name'],
  pairNamePh: ['เช่น คอมที่ร้าน', 'e.g. Shop PC'],
  pairConnect: ['เชื่อมต่อ Chrome เครื่องนี้', 'Connect this Chrome'],
  pairCode: ['รหัสจับคู่', 'Pairing code'],
  pairExpires: ['ใช้ได้ครั้งเดียว ถึง {t} น.', 'Single use, valid until {t}'],
  pairWaiting: [
    'รอการอนุญาตในหน้าของส่วนขยาย (แท็บใหม่)…',
    'Waiting for “Allow” on the extension page (new tab)…',
  ],
  connectTitle: ['กำลังส่งคำขอไปที่ส่วนขยาย AutoPost…', 'Handing over to the AutoPost extension…'],
  connectMissing: [
    'ไม่พบส่วนขยาย AutoPost ในเบราว์เซอร์นี้ (หรือยังเป็นเวอร์ชันเก่ากว่า 2.2)',
    'The AutoPost extension was not found in this browser (or it is older than 2.2)',
  ],
  connectHelp: [
    'ติดตั้งหรืออัปเดตส่วนขยาย แล้วกลับไปที่ ทีมและเวิร์กสเปซ > เพิ่มอุปกรณ์ แล้วกดเชื่อมต่ออีกครั้ง',
    'Install or update the extension, then go back to Team & workspaces > Add device and connect again.',
  ],
  connectClose: ['ปิดหน้านี้', 'Close this page'],
  extDownload: ['ดาวน์โหลดส่วนขยาย (.zip)', 'Download the extension (.zip)'],
  extInstallHelp: [
    'แตกไฟล์ zip แล้วเปิด chrome://extensions เปิด “โหมดนักพัฒนาซอฟต์แวร์” กด “โหลดส่วนขยายที่แตกไฟล์แล้ว” และเลือกโฟลเดอร์ autopost-extension',
    'Unzip it, open chrome://extensions, turn on Developer mode, click “Load unpacked” and pick the autopost-extension folder',
  ],
  rename: ['เปลี่ยนชื่อ', 'Rename'],
  renamePrompt: ['ชื่อเครื่องใหม่', 'New device name'],
  renamed: ['เปลี่ยนชื่อเป็น “{d}” แล้ว', 'Renamed to “{d}”'],
  jobsPause: ['พักรับงาน', 'Pause jobs'],
  jobsResume: ['รับงานต่อ', 'Resume jobs'],
  jobsPausedTag: ['พักรับงานอยู่', 'Jobs paused'],
  jobsPausedNote: [
    'พักรับงานแล้ว: เครื่องนี้จะไม่โพสต์งานที่ตั้งเวลาจากเว็บ (สถานะและการตั้งค่ายังซิงก์)',
    'Jobs paused: this browser takes no posts scheduled on the web (state and settings still sync).',
  ],
  jobsResumedNote: ['เครื่องนี้รับงานโพสต์จากเว็บต่อแล้ว', 'This browser takes web posts again.'],
  manageCampaigns: ['ชุดโพสต์', 'Campaigns'],
  pairExpired: ['รหัสหมดอายุแล้ว สร้างรหัสใหม่ได้', 'The code expired. Create a new one.'],
  pairNew: ['สร้างรหัสใหม่', 'New code'],
  paired: ['จับคู่ “{d}” แล้ว', 'Paired “{d}”'],
  copy: ['คัดลอก', 'Copy'],
  copied: ['คัดลอกแล้ว', 'Copied'],
  done: ['เสร็จ', 'Done'],
  noDevices: [
    'ยังไม่มีอุปกรณ์ที่ผูกไว้ กด “เพิ่มอุปกรณ์” เพื่อให้ส่วนขยายโพสต์ตามเวลาที่ตั้งไว้',
    'No paired devices yet. Press “Add device” so the extension posts on schedule.',
  ],
  deviceOnline: ['ออนไลน์อยู่', 'Online'],
  deviceNever: ['ยังไม่เคยเชื่อมต่อ', 'Never connected'],
  extUnpaired: ['ยังไม่ได้เชื่อมส่วนขยาย', 'Extension not paired'],
  realOffline: [
    'ไม่มีเครื่องที่ผูกไว้ออนไลน์ เปิด Chrome ที่ติดตั้งส่วนขยายไว้ แล้วโพสต์จะเดินต่อ',
    'No paired device is online. Open the Chrome with the extension and posting resumes.',
  ],
  demoAccount: ['ตัวอย่าง', 'Sample'],
  demoHint: [
    'บัญชีตัวอย่าง: โพสต์ที่ตั้งให้บัญชีนี้จะไม่ถูกส่งจริง เชื่อมบัญชีจริงด้วย “เพิ่มอุปกรณ์” ในหน้าทีมและเวิร์กสเปซ',
    'Sample account: posts for it are never sent. Connect a real one with “Add device” in Team & workspaces.',
  ],

  // Platform admin, billing and team (Phase 4)
  never: ['ยังไม่เคยใช้งาน', 'never'],
  minutesAgo: ['{n} นาทีที่แล้ว', '{n} min ago'],
  hoursAgo: ['{n} ชม. ที่แล้ว', '{n} h ago'],
  daysAgo: ['{n} วันที่แล้ว', '{n} days ago'],
  blocked: [
    'บัญชีนี้ถูกระงับการใช้งาน ติดต่อผู้ดูแลแพลตฟอร์ม',
    'This account is suspended. Contact the platform admin.',
  ],
  promoCode: ['โค้ดส่วนลด (ถ้ามี)', 'Promo code (optional)'],
  // Billing through Stripe
  goPay: ['ไปหน้าชำระเงิน', 'Go to payment'],
  checkoutBody: [
    'คุณจะถูกพาไปชำระเงินที่ Stripe โดยตรง (ข้อมูลบัตรไม่ผ่านระบบของเรา) แผนจะเริ่มใช้เมื่อชำระเงินสำเร็จ',
    'You will be taken to Stripe to pay (card details never touch our system). The plan starts once the payment goes through.',
  ],
  changeBody: [
    'เปลี่ยนแผนทันที Stripe คิดส่วนต่างตามจำนวนวันที่เหลือของรอบบิลและเรียกเก็บจากบัตรที่ผูกไว้ตอนนี้',
    'The plan changes immediately. Stripe prorates the difference for the rest of the billing period and charges your card on file now.',
  ],
  cancelBody: [
    'แผนปัจจุบันใช้งานได้ถึง {date} จากนั้นจะกลับไปเป็น Free และไม่มีการเรียกเก็บเงินอีก',
    'Your current plan keeps working until {date}, then moves to Free with no further charges.',
  ],
  freeBody: ['ย้ายไปแผน Free ทันที', 'Move to the Free plan now.'],
  resumeBody: [
    'ยกเลิกการสิ้นสุดแผน แผนจะต่ออายุตามปกติ',
    'Cancel the scheduled end: the plan renews as usual.',
  ],
  downgradeNote: [
    'บัญชีและอุปกรณ์ที่เกินโควต้าของแผนใหม่จะยังอยู่ แต่เพิ่มใหม่ไม่ได้จนกว่าจะอยู่ในโควต้า',
    'Accounts and devices over the new plan’s limits stay, but you cannot add more until you are within them.',
  ],
  promoFirstOnly: [
    'โค้ดส่วนลดใช้กับใบแจ้งหนี้ใบแรกเท่านั้น',
    'A promo code applies to the first invoice only',
  ],
  renewsOn: ['ต่ออายุอัตโนมัติ {date}', 'Renews automatically on {date}'],
  endsOn: ['ยกเลิกแล้ว สิ้นสุด {date}', 'Cancelled, ends on {date}'],
  noCharge: [
    'แผนนี้ผู้ดูแลแพลตฟอร์มมอบให้ ไม่มีการเรียกเก็บเงิน',
    'This plan was granted by the platform admin. No charges.',
  ],
  freeForever: ['ไม่มีค่าใช้จ่าย ไม่ต้องใช้บัตร', 'No cost, no card needed'],
  freeNoRenewal: [
    'แผน Free ไม่มีค่าใช้จ่ายและไม่มีวันหมดอายุ',
    'The Free plan costs nothing and does not expire.',
  ],
  keepPlan: ['ต่ออายุแผนนี้', 'Keep this plan'],
  noCard: ['ยังไม่มีบัตรที่ผูกไว้', 'No card on file'],
  cardExpiringSoon: [
    'บัตรใกล้หมดอายุ กรุณาอัปเดตก่อนวันต่ออายุเพื่อไม่ให้บริการสะดุด',
    'Your card is about to expire. Update it before the renewal to avoid interruption.',
  ],
  managePayment: ['จัดการบัตรและใบแจ้งหนี้ที่ Stripe', 'Manage card and invoices at Stripe'],
  paymentsOff: [
    'ระบบชำระเงิน (Stripe) ยังไม่เปิดใช้งาน จึงยังซื้อแผนที่มีค่าใช้จ่ายไม่ได้',
    'Payments (Stripe) are not switched on yet, so paid plans cannot be bought.',
  ],
  pastDue: [
    'ตัดบัตรครั้งล่าสุดไม่สำเร็จ Stripe จะลองใหม่ให้อัตโนมัติ อัปเดตบัตรเพื่อไม่ให้แผนถูกยกเลิก',
    'The last card payment failed. Stripe will retry automatically; update your card so the plan is not cancelled.',
  ],
  checkoutDone: [
    'ชำระเงินสำเร็จ เปลี่ยนเป็นแผน {plan} แล้ว',
    'Payment received. You are now on {plan}.',
  ],
  checkoutCancelled: [
    'ยกเลิกการชำระเงิน ยังไม่มีการเปลี่ยนแผน',
    'Payment cancelled. Your plan has not changed.',
  ],
  cancelScheduled: [
    'จะยกเลิกแผนเมื่อสิ้นรอบบิล ({date})',
    'The plan will be cancelled at the end of the period ({date})',
  ],
  resumed: ['ต่ออายุแผนตามปกติแล้ว', 'The plan will renew as usual'],
  viewInvoice: ['ดูใบแจ้งหนี้', 'View invoice'],
  auditSystem: ['ระบบ (Stripe)', 'System (Stripe)'],
  paysViaStripe: [
    'ลูกค้ารายนี้จ่ายผ่าน Stripe จึงเปลี่ยนแผนได้เฉพาะฝั่งลูกค้า (หรือให้ยกเลิกการสมัครก่อน)',
    'This customer pays through Stripe, so only they can change plan (or cancel the subscription first).',
  ],
  noInvoices: ['ยังไม่มีใบแจ้งหนี้', 'No invoices yet'],
  removeMember: ['นำออกจากทีม', 'Remove'],
  leaveTeam: ['ออกจากทีม', 'Leave'],
  removed: ['นำ {e} ออกจากทีมแล้ว', 'Removed {e}'],
  invitePending: ['รอสมัครสมาชิก', 'Invitation pending'],
  roleHere: ['สิทธิ์ของคุณ: {r}', 'Your role: {r}'],

  // Assist mode, live platform figures and the activity log (Phase 5)
  assistTitle: ['กำลังดูในฐานะ {e} (ถึง {t} น.)', 'Viewing as {e} (until {t})'],
  assistBody: [
    'โหมดช่วยเหลือดูได้อย่างเดียว การแก้ไขข้อมูลแทนลูกค้าจะถูกปฏิเสธ',
    'Assist mode is read-only: changes in the customer’s name are refused.',
  ],
  assistExit: ['กลับไปหน้าแอดมิน', 'Back to admin'],
  assistStarted: [
    'เปิดแดชบอร์ดของ {c} แบบดูอย่างเดียว 1 ชั่วโมง',
    'Opened {c}’s dashboard read-only for 1 hour',
  ],
  vs30: ['{d} เทียบ 30 วันก่อน', '{d} vs 30 days ago'],
  churnVs: ['{d} จุด เทียบ 30 วันก่อนหน้า', '{d} pt vs the 30 days before'],
  devicesActive: [
    '{n} จาก {total} เครื่องที่ผูกไว้ ใช้งานใน 24 ชม.',
    '{n} of {total} paired, active in 24 h',
  ],
  tsrVs: ['7 วันล่าสุด · ก่อนหน้า {p}', 'Last 7 days · before: {p}'],
  noData: ['ยังไม่มีข้อมูล', 'No data yet'],
  hApi: ['API latency (p95, {n} คำขอล่าสุด)', 'API latency (p95, last {n} requests)'],
  hDb: ['ฐานข้อมูลตอบสนอง', 'Database round trip'],
  hLive: [
    'สตรีมสด: หน้าเว็บที่เปิดอยู่ · เครื่องที่รอคำสั่ง',
    'Live streams: pages open · devices waiting for commands',
  ],
  hQueue: ['คิวที่ถึงเวลาแล้ว · 24 ชม. ข้างหน้า', 'Queue due now · next 24 h'],
  hExt: ['ส่วนขยายเวอร์ชันล่าสุด ({v})', 'Extensions on latest ({v})'],
  hErr: ['อัตราข้อผิดพลาด 24 ชม.', 'Task error rate, 24 h'],
  hPay: ['ระบบตัดบัตร', 'Card payments'],
  payNone: ['ยังไม่เชื่อม', 'Not connected'],
  audit: ['ประวัติการดำเนินการ', 'Activity log'],
  noAudit: ['ยังไม่มีรายการ', 'Nothing yet'],
  auditBy: ['โดย {e}', 'by {e}'],
  actions: {
    plan_changed: ['เปลี่ยนแผน', 'Plan changed'],
    status_changed: ['เปลี่ยนสถานะ', 'Status changed'],
    pause_changed: ['หยุด/เริ่มงานโพสต์', 'Jobs paused/resumed'],
    limits_changed: ['ตั้งข้อจำกัดเฉพาะลูกค้า', 'Limits changed'],
    note_changed: ['แก้หมายเหตุ', 'Note changed'],
    device_revoked: ['ยกเลิกการผูกอุปกรณ์', 'Device unbound'],
    failed_retried: ['ลองงานที่ล้มเหลวใหม่', 'Failed posts retried'],
    refunded: ['คืนเงิน', 'Refunded'],
    payment_recorded: ['บันทึกว่าชำระแล้ว', 'Payment recorded'],
    payment_retried: ['เรียกเก็บเงินซ้ำผ่าน Stripe', 'Charge retried through Stripe'],
    plan_settings_changed: ['แก้ราคา/ข้อจำกัดของแผน', 'Plan settings changed'],
    promo_created: ['สร้างโค้ดส่วนลด', 'Promo code created'],
    promo_toggled: ['เปิด/ปิดโค้ดส่วนลด', 'Promo code toggled'],
    impersonated: ['เปิดโหมดช่วยเหลือ', 'Assist mode opened'],
  },

  // Permissions, live data and copy that says only what the system does (the audit fixes)
  permEdit: [
    'บทบาทของคุณคือผู้ชม: ดูได้อย่างเดียว แก้ไขอะไรที่นี่ไม่ได้',
    'Your role is Viewer: you can look, but not change anything here',
  ],
  permAdmin: [
    'เฉพาะผู้ดูแลหรือเจ้าของเวิร์กสเปซที่แก้ส่วนนี้ได้',
    'Only an admin or the owner of the workspace can change this',
  ],
  permAssist: [
    'โหมดช่วยเหลือดูได้อย่างเดียว แก้ไขอะไรไม่ได้',
    'Assist mode is read-only: nothing can be changed',
  ],
  notYet: ['ยังไม่รองรับ', 'Not supported yet'],
  dismissToast: ['ปิดการแจ้งเตือนนี้', 'Dismiss this notification'],
  simEndedOffline: [
    'เลิกจำลองออฟไลน์แล้ว แต่ยังไม่มีเครื่องที่ผูกไว้ออนไลน์ โพสต์จะเดินต่อเมื่อมีเครื่องออนไลน์',
    'Simulation ended, but no paired device is online yet. Posting resumes when one is.',
  ],
  restoreFailed: [
    'ตรวจสอบการเข้าสู่ระบบไม่ได้เพราะเซิร์ฟเวอร์ไม่ตอบ ระบบเก็บการเข้าสู่ระบบเดิมไว้ ลองรีโหลดหน้านี้อีกครั้ง',
    'Your sign-in could not be checked because the server did not answer. It is kept: reload the page to try again.',
  ],
  bannerNotYet: [
    '“เก็บไว้รอโพสต์” และ “ส่งแจ้งเตือน” ยังไม่รองรับ โพสต์ที่ค้างถูกเก็บไว้ในคิวอยู่แล้ว และไม่มีการส่งแจ้งเตือน',
    '“Keep in queue” and “reminder” are not supported yet: waiting posts are already held in the queue and no reminder is sent.',
  ],
  channelsNotYet: [
    'ยังไม่มีช่องทางแจ้งเตือนที่ใช้งานได้ ตัวเลือกเหล่านี้ยังไม่มีผล',
    'No notification channel works yet; these choices have no effect.',
  ],
  limitsFbOnly: [
    'ตอนนี้ส่วนขยายโพสต์ผ่าน Facebook เท่านั้น เพดานของแพลตฟอร์มอื่นเก็บไว้ใช้เมื่อเชื่อมต่อได้',
    'Only Facebook is posted through the extension today; the other platforms’ limits are kept for when they can be connected.',
  ],
  noDispatch: [
    'ยังไม่มีโพสต์ที่รอส่งจากบัญชีที่เชื่อมผ่านส่วนขยาย',
    'No queued posts for an account connected through the extension.',
  ],
  prevMonth: ['เดือนก่อนหน้า', 'Previous month'],
  nextMonth: ['เดือนถัดไป', 'Next month'],
  mediaMax: ['แนบสื่อได้ไม่เกิน {n} ไฟล์ต่อโพสต์', 'A post takes at most {n} media files'],
  noGroupsYet: [
    'บัญชีนี้ยังไม่มีกลุ่ม: เปิดส่วนขยายแล้วเพิ่มกลุ่มในชุดโพสต์ก่อน',
    'This account has no groups yet: open the extension and add groups to a campaign first',
  ],
  unboundAccount: ['ยกเลิกการผูก', 'Unbound'],
  unboundHint: [
    'เครื่องของบัญชีนี้ถูกยกเลิกการผูกแล้ว ประวัติยังอยู่ แต่จะโพสต์ไม่ได้จนกว่าจะจับคู่เครื่องใหม่',
    'The browser of this account was unbound. Its history stays, but it cannot post until a browser is paired again.',
  ],
  seatsFull: [
    'ที่นั่งเต็มแล้ว: แผนมี {n} ที่นั่ง (นับรวมเจ้าของและคำเชิญที่รออยู่)',
    'All {n} seats are taken (owner and pending invitations included)',
  ],
  devicesFull: [
    'จับคู่อุปกรณ์ครบ {n} เครื่องตามแผนแล้ว ยกเลิกการผูกเครื่องเดิมหรืออัปเกรดแผนเพื่อเพิ่ม',
    'All {n} devices of the plan are paired. Unbind one or upgrade the plan to add another.',
  ],
  renameEmpty: ['กรุณาใส่ชื่อเครื่อง', 'Please enter a device name'],
  sampleLog: ['ตัวอย่าง', 'sample'],
  authTryGoogle: [
    'ถ้าสมัครด้วย Google ให้เข้าสู่ระบบด้วยปุ่ม Google',
    'If you signed up with Google, use the Google button.',
  ],
  // Plan card lines: the numbers come from /api/plans
  planAccounts: ['บัญชีโซเชียล: {n}', 'Social accounts: {n}'],
  planPosts: ['โพสต์ต่อ 24 ชม.: {n}', 'Posts per 24 h: {n}'],
  planDevices: ['อุปกรณ์: {n}', 'Devices: {n}'],
  planSeats: ['ที่นั่งทีม: {n}', 'Team seats: {n}'],
  planAntiBan: ['Anti-ban ขั้นสูง', 'Advanced anti-ban'],
  // Platform admin
  savesAsYouGo: ['การเปลี่ยนแต่ละช่องบันทึกอัตโนมัติ', 'Each change saves as you make it'],
  rate24Note: ['24 ชั่วโมงล่าสุด · เป้าหมาย ≥ 95%', 'Last 24 h · target ≥ 95%'],
  pauseBlocked: [
    'ลูกค้าถูกระงับอยู่ คืนสถานะก่อนจึงจะให้งานทำต่อได้',
    'The customer is suspended. Restore them before resuming jobs.',
  ],
  usedOfPerWs: [
    'ใช้ {n} จาก {m} (รวม {w} เวิร์กสเปซ ขีดจำกัดนับแยกแต่ละเวิร์กสเปซ)',
    '{n} of {m} used (across {w} workspaces; the limit applies to each one)',
  ],
  promoOff: ['ปิดโค้ด', 'Switch off'],
  promoOn: ['เปิดโค้ด', 'Switch on'],
  promoSwitchedOff: ['ปิดโค้ด {c} แล้ว', 'Code {c} switched off'],
  promoSwitchedOn: ['เปิดโค้ด {c} แล้ว', 'Code {c} switched on'],
  promoInactive: ['ปิดอยู่', 'Off'],
  errPromoChars: [
    'โค้ดเป็นตัวอักษรหรือตัวเลข {min}–{max} ตัว ไม่มีช่องว่างหรือเครื่องหมาย',
    'Letters and digits only, {min}–{max} characters, no spaces or symbols',
  ],
  planAudit: ['การเปลี่ยนแปลงแผนและโค้ดส่วนลด', 'Plan and promo code changes'],
  extNav: ['ชุดโพสต์ (ส่วนขยาย)', 'Campaigns (extension)'],
  nothingToRetry: ['ไม่มีงานที่ล้มเหลวให้ลองใหม่', 'No failed jobs to retry'],
} as const;

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
    'ติดตั้งส่วนขยาย AutoPost ใน Chrome ที่จะใช้โพสต์ (เครื่องไหนก็ได้) และล็อกอิน Facebook ไว้ในนั้นแล้ว',
    'Install the AutoPost extension in the Chrome that will post (any machine) and log in to Facebook there',
  ],
  pairStep2: [
    'ถ้าเป็น Chrome เครื่องนี้: กด “เชื่อมต่อ Chrome เครื่องนี้” แล้วกด “อนุญาต” ในหน้าของส่วนขยายที่เปิดขึ้นมา',
    'If it is this Chrome: press “Connect this Chrome”, then “Allow” on the extension page that opens',
  ],
  pairStep3: [
    'ถ้าเป็นเครื่องอื่นหรือโปรไฟล์ Chrome อื่น: กด “คัดลอกลิงก์เชื่อมต่อ” แล้วเปิดลิงก์ใน Chrome ตัวนั้น ไม่ต้องล็อกอิน AutoPost ที่นั่น (หรือล็อกอินเป็นคนละบัญชีก็ได้) ส่วนขยายจะแสดงแค่ “เชื่อมต่อสำเร็จ”',
    'If it is another computer or Chrome profile: press “Copy connect link” and open it in that Chrome. It does not need to be signed in to AutoPost (or it may be signed in as someone else); the extension only shows “connected successfully”',
  ],
  pairName: ['ชื่อเครื่อง', 'Device name'],
  pairNamePh: ['เช่น คอมที่ร้าน', 'e.g. Shop PC'],
  pairConnect: ['เชื่อมต่อ Chrome เครื่องนี้', 'Connect this Chrome'],
  pairCode: ['รหัสจับคู่', 'Pairing code'],
  pairExpires: ['ใช้ได้ครั้งเดียว ถึง {t} น.', 'Single use, valid until {t}'],
  pairWaiting: ['รอการอนุญาตในหน้าของส่วนขยาย…', 'Waiting for “Allow” on the extension page…'],
  connectTitle: ['กำลังส่งคำขอไปที่ส่วนขยาย AutoPost…', 'Handing over to the AutoPost extension…'],
  connectMissing: [
    'ไม่พบส่วนขยาย AutoPost ในเบราว์เซอร์นี้ (หรือยังเป็นเวอร์ชันเก่ากว่า 2.2)',
    'The AutoPost extension was not found in this browser (or it is older than 2.2)',
  ],
  connectHelp: [
    'ติดตั้งหรืออัปเดตส่วนขยายใน Chrome นี้ แล้วเปิดลิงก์เชื่อมต่อใหม่อีกครั้ง (สร้างลิงก์ใหม่ได้ที่ ทีมและเวิร์กสเปซ > เพิ่มอุปกรณ์ > คัดลอกลิงก์เชื่อมต่อ)',
    'Install or update the extension in this Chrome, then open the connect link again (make a new one at Team & workspaces > Add device > Copy connect link).',
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
  // The top bar with several extensions: how many are online right now.
  extCount: ['ส่วนขยายออนไลน์ {n}/{m}', '{n}/{m} extensions online'],
  extCountHint: [
    'จำนวนส่วนขยายที่ออนไลน์ ดูรายเครื่องได้ในหน้าทีมและเวิร์กสเปซ',
    'Extensions that are online right now. See each one on the Team & workspaces page',
  ],
  realOffline: [
    'ไม่มีเครื่องที่ผูกไว้ออนไลน์ เปิด Chrome ที่ติดตั้งส่วนขยายไว้ แล้วโพสต์จะเดินต่อ',
    'No paired device is online. Open the Chrome with the extension and posting resumes.',
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
    payment_override_changed: ['แก้ยอดทดสอบการชำระเงิน', 'Payment test amount changed'],
    payment_override_used: ['เรียกเก็บด้วยยอดทดสอบ', 'Charged the test amount'],
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
  // Packages (plans): the seven numbers and the functions of each plan, in the plan cards, the comparison table,
  // the billing page's usage bars and the admin pages. The numbers come from /api/plans (null = unlimited) and
  // the functions from its `features` list; the labels are keyed like them.
  planLimit: {
    groups: ['กลุ่มและเพจ Facebook', 'Facebook groups and pages'],
    images: ['คลังรูป', 'Image library'],
    libraryPosts: ['คลังโพสต์', 'Post library'],
    posts: ['โพสต์ต่อวัน (24 ชม.)', 'Posts per day (24 h)'],
    devices: ['ส่วนขยาย (เบราว์เซอร์)', 'Extensions (browsers)'],
    seats: ['ที่นั่งทีม', 'Team seats'],
    accounts: ['บัญชี Facebook', 'Facebook accounts'],
  },
  planFeature: {
    ai: ['AI ช่วยเขียนโพสต์', 'AI post drafts'],
    advanced_anti_ban: ['Anti-ban ขั้นสูง', 'Advanced anti-ban'],
    notifications: ['แจ้งเตือน Telegram / LINE', 'Notifications (Telegram / LINE)'],
    auto_reply: ['ตอบกลับอัตโนมัติ', 'Auto-reply'],
    bump: ['ดันโพสต์อัตโนมัติ', 'Auto bump'],
    client_reports: ['รายงานส่งลูกค้า', 'Client reports'],
  },
  planIncluded: ['รวมอยู่ในแผนนี้', 'Included'],
  planNotIncluded: ['ไม่รวมอยู่ในแผนนี้', 'Not included'],
  planCompareCaption: [
    'เปรียบเทียบจำนวนที่ใช้ได้และฟังก์ชันของแต่ละแผน',
    'Limits and functions of each plan',
  ],
  planCompareRowHead: ['รายการ', 'What'],
  planCompareLimits: ['จำนวนที่ใช้ได้', 'Limits'],
  planCompareFeatures: ['ฟังก์ชัน', 'Functions'],
  planYours: ['แผนของคุณ', 'Your plan'],
  // The billing page's usage bars: a number that has reached its limit says so and points at the plans.
  usageFull: ['ใช้ครบแล้ว', 'Limit reached'],
  usageOver: ['เกินขีดจำกัด', 'Over the limit'],
  usageUpgrade: ['อัปเกรดแผนเพื่อเพิ่ม', 'Upgrade to get more'],
  // Platform admin: the plan editor's function list and the customer page's rows without a count.
  planFeaturesAdmin: [
    'ฟังก์ชันที่รวมในแผน (ตั้งที่เซิร์ฟเวอร์)',
    'Functions in the plan (set on the server)',
  ],
  planFeaturesNone: ['ไม่มีฟังก์ชันเสริม', 'No extra functions'],
  limitInForce: ['ใช้อยู่ตอนนี้: {m}', 'In force: {m}'],
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
  nothingToRetry: ['ไม่มีงานที่ล้มเหลวให้ลองใหม่', 'No failed jobs to retry'],

  // Rename / delete / switch on-off of the items in the lists (library, collections, link sets, schedules).
  itemActive: ['เปิดใช้งาน', 'Active'],
  itemInactive: ['ปิดใช้งาน', 'Inactive'],
  itemRename: ['เปลี่ยนชื่อ', 'Rename'],
  itemEdit: ['แก้ไข', 'Edit'],
  itemDelete: ['ลบ', 'Delete'],
  itemName: ['ชื่อ', 'Name'],
  itemErrName: ['กรุณาใส่ชื่อ', 'Please enter a name'],
  itemSaveFailed: [
    'บันทึกไม่ได้ (ชื่ออาจยาวเกินไปหรือซ้ำกับรายการอื่น)',
    'Could not save (the name may be too long or taken)',
  ],
  itemActionFailed: ['ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง', 'That did not work. Please try again.'],
  itemRenamed: ['เปลี่ยนชื่อแล้ว', 'Renamed'],
  itemDeleted: ['ลบแล้ว', 'Deleted'],
  itemSwitchedOn: ['เปิดใช้งานแล้ว', 'Switched on'],
  itemSwitchedOff: ['ปิดใช้งานแล้ว', 'Switched off'],
  itemOffUnusable: [
    'ปิดใช้งานอยู่ เปิดก่อนจึงจะใช้ได้',
    'It is switched off. Switch it on to use it.',
  ],
  mediaRename: ['เปลี่ยนชื่อไฟล์', 'Rename file'],
  mediaDelete: ['ลบไฟล์', 'Delete file'],
  mediaDeleteBody: [
    'ลบไฟล์ “{name}” ออกจากคลัง? รูปนี้จะถูกถอดออกจากโพสต์ในชุดโพสต์ที่ใช้อยู่ ข้อความของโพสต์ยังอยู่ ลบแล้วกู้คืนไม่ได้',
    'Delete “{name}” from the library? It is taken off the collection posts that use it (their text stays). This cannot be undone.',
  ],
  mediaDeleteManyBody: [
    'ลบ {n} ไฟล์ที่เลือกออกจากคลัง? ไฟล์จะถูกถอดออกจากโพสต์ในชุดโพสต์ที่ใช้อยู่ ลบแล้วกู้คืนไม่ได้',
    'Delete the {n} selected files from the library? They are taken off the collection posts that use them. This cannot be undone.',
  ],
  mediaDeletedN: ['ลบแล้ว {n} ไฟล์', 'Deleted {n} file(s)'],
  mediaSwitchedN: ['อัปเดต {n} ไฟล์แล้ว', 'Updated {n} file(s)'],
  mediaDeleteSel: ['ลบที่เลือก', 'Delete selected'],
  mediaOnSel: ['เปิดที่เลือก', 'Switch selected on'],
  mediaOffSel: ['ปิดที่เลือก', 'Switch selected off'],
  snippetEdit: ['แก้ไขข้อความ', 'Edit snippet'],
  snippetDelete: ['ลบข้อความ', 'Delete snippet'],
  snippetDeleteBody: [
    'ลบข้อความ “{name}”? ลบแล้วกู้คืนไม่ได้ (โพสต์ที่เคยใช้ข้อความนี้ไม่ได้รับผลกระทบ)',
    'Delete the snippet “{name}”? This cannot be undone (posts that used it are not affected).',
  ],
  colRename: ['เปลี่ยนชื่อชุดโพสต์', 'Rename collection'],
  colDelete: ['ลบชุดโพสต์', 'Delete collection'],
  colDeleteBody: [
    'ลบชุดโพสต์ “{name}”? โพสต์ในชุดไม่ถูกลบ ยังอยู่ในคลังโพสต์ ลบชุดไม่ได้ถ้ายังมีตารางโพสต์ใช้อยู่',
    'Delete the collection “{name}”? Its posts are not deleted: they stay in the post library. Not possible while a schedule uses it.',
  ],
  colOffHint: [
    'ปิดอยู่: ตารางที่ใช้ชุดนี้จะไม่สร้างโพสต์ใหม่จนกว่าจะเปิด',
    'Off: schedules that use it queue nothing until it is switched on',
  ],
  setRename: ['เปลี่ยนชื่อชุดลิงก์', 'Rename link set'],
  setOffHint: [
    'ปิดอยู่: ตารางที่ใช้ชุดนี้จะไม่โพสต์ไปกลุ่มเหล่านี้จนกว่าจะเปิด',
    'Off: schedules that use it post to none of these groups until it is switched on',
  ],
  schRename: ['เปลี่ยนชื่อตาราง', 'Rename schedule'],

  // The post library (step 1 of the flow): the sidebar item, the route title and the stepper.
  postsNav: ['คลังโพสต์', 'Post library'],
  tlNav: ['ไทม์ไลน์โพสต์', 'Post timeline'],
  flowPosts: ['เขียนและจัดการโพสต์', 'Write and manage posts'],
  flowPostsB: ['เปิด/ปิด ตั้งเวลาเอง ดูผลทีละโพสต์', 'On/off, own timing, results post by post'],
  nextToCollections: ['จัดโพสต์เข้าชุดโพสต์', 'Put the posts into a collection'],

  // The in-app checkout (billing page): five ways to pay, paid through Stripe.js on the page.
  checkoutBodyInApp: [
    'เลือกวิธีชำระเงินในขั้นตอนถัดไป ข้อมูลบัตรกรอกในช่องของ Stripe โดยตรง ไม่ผ่านระบบของเรา แผนจะเริ่มใช้เมื่อชำระเงินสำเร็จ',
    'Pick how to pay in the next step. Card details are typed into Stripe’s own fields and never touch our system. The plan starts once the payment goes through.',
  ],
  payMethods: ['เลือกวิธีชำระเงิน', 'Choose how to pay'],
  pmCard: ['บัตร', 'Card'],
  pmCardHint: ['บัตรเครดิต / เดบิต', 'Credit / debit card'],
  pmApplePayHint: ['จ่ายด้วย Face ID / Touch ID', 'Pay with Face ID / Touch ID'],
  pmGooglePayHint: ['จ่ายด้วยบัตรใน Google', 'Pay with a card saved in Google'],
  pmLinkHint: ['จ่ายเร็วด้วยบัญชี Link', 'Pay fast with your Link account'],
  pmPromptPayHint: ['สแกน QR ด้วยแอปธนาคาร', 'Scan a QR with your banking app'],
  payAmount: ['ชำระ {amt}', 'Pay {amt}'],
  payTotal: ['ยอดที่ต้องชำระ', 'Total to pay'],
  payPreparing: ['กำลังเตรียมการชำระเงิน…', 'Preparing the payment…'],
  payRetry: ['ลองอีกครั้ง', 'Try again'],
  // Without a publishable key the way to pay is picked here and paid on Stripe's own page.
  payGoStripe: ['ไปชำระด้วย {m} ที่ Stripe', 'Pay with {m} at Stripe'],
  payHostedCard: [
    'กดปุ่มด้านล่างเพื่อไปกรอกบัตรที่หน้าชำระเงินของ Stripe ข้อมูลบัตรไม่ผ่านระบบของเรา',
    'The button below takes you to Stripe’s payment page to enter your card. Card details never touch our system.',
  ],
  payHostedLink: [
    'กดปุ่มด้านล่างเพื่อไปหน้าชำระเงินของ Stripe แล้วจ่ายเร็วด้วยบัญชี Link ของคุณ',
    'The button below takes you to Stripe’s payment page, where you pay fast with your Link account.',
  ],
  payHostedPromptPay: [
    'กดปุ่มด้านล่างเพื่อไปหน้า Stripe ที่แสดง QR ของ PromptPay แล้วสแกนด้วยแอปธนาคาร แผนเริ่มใช้ทันทีที่ธนาคารยืนยัน',
    'The button below takes you to Stripe’s page with the PromptPay QR. Scan it with your banking app; the plan starts as soon as the bank confirms.',
  ],
  payRenewMonth: [
    'ต่ออายุอัตโนมัติทุกเดือน ยกเลิกได้ทุกเมื่อที่หน้านี้',
    'Renews automatically every month. Cancel any time on this page.',
  ],
  payRenewYear: [
    'ต่ออายุอัตโนมัติทุกปี ยกเลิกได้ทุกเมื่อที่หน้านี้',
    'Renews automatically every year. Cancel any time on this page.',
  ],
  payOnceMonth: [
    'จ่ายครั้งเดียวสำหรับ 1 เดือน ไม่ต่ออายุอัตโนมัติ (PromptPay ตัดซ้ำอัตโนมัติไม่ได้) ต่ออายุเองเมื่อครบกำหนด',
    'One payment for 1 month, no automatic renewal (PromptPay cannot be charged again by itself). Renew when it runs out.',
  ],
  payOnceYear: [
    'จ่ายครั้งเดียวสำหรับ 1 ปี ไม่ต่ออายุอัตโนมัติ (PromptPay ตัดซ้ำอัตโนมัติไม่ได้) ต่ออายุเองเมื่อครบกำหนด',
    'One payment for 1 year, no automatic renewal (PromptPay cannot be charged again by itself). Renew when it runs out.',
  ],
  payEmail: ['ใบเสร็จส่งไปที่', 'Receipt goes to'],
  payPromptPaySteps: [
    'กดปุ่มด้านล่างเพื่อแสดง QR แล้วสแกนด้วยแอปธนาคาร แผนเริ่มใช้ทันทีที่ธนาคารยืนยัน',
    'Press the button below to show the QR, then scan it with your banking app. The plan starts as soon as the bank confirms.',
  ],
  payWithPromptPay: ['ชำระด้วย PromptPay', 'Pay with PromptPay'],
  payWalletLink: [
    'กดปุ่ม Link แล้วทำตามหน้าต่างที่เปิดขึ้น (กรอกอีเมลและรหัสยืนยัน)',
    'Press the Link button and follow the window that opens (email and a code).',
  ],
  payWalletApple: [
    'Apple Pay ใช้ได้บน Safari ใน iPhone, iPad หรือ Mac ที่เพิ่มบัตรใน Wallet แล้ว',
    'Apple Pay works in Safari on an iPhone, iPad or Mac that has a card in Wallet.',
  ],
  payWalletGoogle: [
    'Google Pay ใช้ได้บน Chrome ที่ลงชื่อเข้าใช้ Google และบันทึกบัตรไว้',
    'Google Pay works in Chrome signed in to Google with a saved card.',
  ],
  payWalletOff: [
    'อุปกรณ์หรือเบราว์เซอร์นี้ยังใช้วิธีนี้ไม่ได้ เลือกวิธีอื่นด้านบน',
    'This device or browser cannot use this way to pay yet. Pick another one above.',
  ],
  payWaiting: [
    'กำลังยืนยันการชำระเงินกับธนาคาร… กรุณาอย่าปิดหน้านี้',
    'Confirming the payment with the bank… please keep this page open.',
  ],
  payDone: ['ชำระเงินสำเร็จ แผนของคุณพร้อมใช้งานแล้ว', 'Payment received. Your plan is ready.'],
  payFailed: [
    'ชำระเงินไม่สำเร็จ ลองอีกครั้งหรือเลือกวิธีอื่น',
    'The payment did not go through. Try again or pick another way to pay.',
  ],
  payPending: [
    'ยังไม่ได้รับการยืนยันจากธนาคาร ระบบจะเปลี่ยนแผนให้เองเมื่อชำระสำเร็จ ปิดหน้านี้ได้',
    'The bank has not confirmed yet. The plan switches by itself once it is paid; you can close this.',
  ],
  payNoStripe: [
    'โหลดระบบชำระเงินของ Stripe ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
    'Stripe’s payment form did not load. Check your connection and try again.',
  ],
  prepaidUntil: ['ชำระล่วงหน้า ใช้ได้ถึง {date}', 'Prepaid, valid until {date}'],

  // Admin: real payment test (route admin/payment-test): a small amount replaces the plan price for listed customers.
  ptestNav: ['ทดสอบการชำระเงินจริง', 'Real payment test'],
  ptestSub: [
    'ตั้งยอดที่เรียกเก็บจริงแทนราคาแผน เพื่อทดลองโอนเงินผ่าน Stripe ด้วยยอดน้อย ๆ',
    'Charge a small real amount instead of the plan price to try a real Stripe payment',
  ],
  ptestWarnTitle: [
    'เงินจริงจะถูกตัดจากบัตร/บัญชีของผู้ทดสอบ',
    'Real money is taken from the tester',
  ],
  ptestWarnBody: [
    'เมื่อเปิดใช้ ลูกค้าที่อยู่ในรายชื่อจะถูกเรียกเก็บยอดนี้แทนราคาแผน ผ่าน Stripe จริง แผนที่ได้ยังเป็นแผนที่เลือก (เช่น Pro) ลูกค้าคนอื่นจ่ายราคาแผนตามปกติ',
    'While on, the listed customers are charged this amount instead of the plan price, through the real Stripe. They still get the plan they pick (e.g. Pro). Everyone else pays the normal price.',
  ],
  ptestNoStripe: [
    'ยังไม่ได้ตั้งค่า Stripe ที่ API (Stripe__SecretKey) จึงชำระเงินไม่ได้ ไม่ว่าจะตั้งยอดเท่าไร',
    'Stripe is not set up on the API (Stripe__SecretKey), so nothing can be paid whatever the amount',
  ],
  ptestOn: ['เปิดใช้ยอดทดสอบ', 'Use the test amount'],
  ptestAmount: ['ยอดที่เรียกเก็บจริงต่อรอบบิล (บาท)', 'Amount charged per billing period (baht)'],
  ptestAmountHint: [
    'ขั้นต่ำ {min} บาท (Stripe เรียกเก็บต่ำกว่านี้ไม่ได้) แผนรายปีจะเรียกเก็บยอดนี้ปีละครั้ง',
    'At least {min} baht (Stripe cannot charge less). A yearly plan is charged this once a year.',
  ],
  ptestEmails: ['อีเมลลูกค้าที่ใช้ยอดทดสอบ', 'Customer emails that pay the test amount'],
  ptestEmailsHint: [
    'หนึ่งอีเมลต่อบรรทัด (หรือคั่นด้วยจุลภาค) ได้สูงสุด {max} บัญชี ใส่อีเมลที่คุณใช้ทดสอบเอง',
    'One email per line (or comma separated), up to {max}. Use the account you test with.',
  ],
  ptestEmailsPh: ['tester@example.com', 'tester@example.com'],
  ptestStateOn: [
    'เปิดอยู่: {n} บัญชีจ่ายยอด {amount} แทนราคาแผน',
    'On: {n} account(s) pay {amount} instead of the plan price',
  ],
  ptestStateOff: ['ปิดอยู่: ทุกคนจ่ายราคาแผนตามปกติ', 'Off: everyone pays the normal plan price'],
  ptestUpdated: ['แก้ไขล่าสุด {t}', 'Last changed {t}'],
  ptestNotesTitle: ['ควรรู้ก่อนทดสอบ', 'Good to know'],
  ptestNote1: [
    'การต่ออายุรอบถัดไปของ subscription นี้จะเรียกเก็บยอดทดสอบเดิมต่อไป จนกว่าจะยกเลิกหรือเปลี่ยนแผน',
    'Renewals of that subscription keep charging the test amount until it is cancelled or changed.',
  ],
  ptestNote2: [
    'ใช้โค้ดส่วนลดพร้อมกันไม่ได้ ระบบจะปฏิเสธโค้ดของบัญชีที่อยู่ในโหมดทดสอบ',
    'Promo codes cannot be combined: they are refused for a customer in test mode.',
  ],
  ptestNote3: [
    'คืนเงินยอดที่ทดสอบได้ที่หน้าการเงิน (ปุ่มคืนเงินของรายการนั้น) และตัวเลข MRR ยังคิดจากราคาแผน ไม่ใช่ยอดทดสอบ',
    'Refund a test charge from the Finance page. MRR still counts the plan price, not the test amount.',
  ],
  ptestNote4: [
    'ปิดโหมดนี้เมื่อทดสอบเสร็จ การเปิด ปิด และการเรียกเก็บด้วยยอดทดสอบทุกครั้งอยู่ในประวัติด้านล่าง',
    'Switch it off when you are done. Every change and every charge made with it is in the log below.',
  ],
  ptestEmailsNeeded: [
    'ใส่อีเมลอย่างน้อย 1 บัญชีก่อนเปิดใช้ เพื่อไม่ให้ลูกค้าจริงโดนเรียกเก็บยอดนี้',
    'Add at least one email before turning it on, so real customers are never charged this',
  ],
  ptestEmailsTooMany: ['ระบุอีเมลได้ไม่เกิน {max} บัญชี', 'No more than {max} emails'],
  ptestEmailBad: ['อีเมลไม่ถูกต้อง: {e}', 'Not a valid email: {e}'],
  ptestAmountBad: [
    'ยอดต้องเป็นจำนวนเต็มระหว่าง {min} ถึง {max} บาท',
    'The amount must be a whole number from {min} to {max} baht',
  ],
  ptestSaved: ['บันทึกการตั้งค่าทดสอบการชำระเงินแล้ว', 'Payment test settings saved'],
  ptestLog: ['ประวัติการตั้งค่าและการเรียกเก็บด้วยยอดทดสอบ', 'Test amount settings and charges'],
  ptestOnShort: ['เปิด', 'on'],
  ptestOffShort: ['ปิด', 'off'],
  ptestAccounts: ['{n} บัญชี', '{n} account(s)'],

  // Error page: retry many failed posts at once
  errSelectPage: ['เลือกทั้งหน้านี้', 'Select this page'],
  errSelectOne: ['เลือกโพสต์นี้', 'Select this post'],
  errReadyLine: ['ลองใหม่เป็นชุดได้ {n} โพสต์', '{n} post(s) can be retried together'],
  errUnboundLine: [
    'อีก {n} โพสต์ลองใหม่ไม่ได้ เพราะเครื่องที่ใช้โพสต์ถูกยกเลิกการผูกแล้ว',
    '{n} more cannot be retried: the browser that posts for them was unbound',
  ],
  errBulkSelected: ['เลือกแล้ว {n} โพสต์', '{n} post(s) selected'],
  errBulkRetry: ['ลองใหม่ที่เลือก ({n})', 'Retry selected ({n})'],
  errBulkRetrying: ['กำลังนำกลับเข้าคิว…', 'Putting back in the queue…'],
  errSelectAll: ['เลือกทั้งหมด {n} โพสต์', 'Select all {n}'],
  errClearSelection: ['ไม่เลือกเลย', 'Clear selection'],
  errBulkDone: [
    'นำ {n} โพสต์กลับเข้าคิวแล้ว จะโพสต์ใน 15 นาที',
    '{n} post(s) added back to the queue for 15 minutes from now',
  ],
  errBulkNone: ['ไม่มีโพสต์ที่นำกลับเข้าคิวได้', 'No post could be put back in the queue'],
  errBulkUnbound: [
    'ข้าม {n} โพสต์ เพราะเครื่องที่ใช้โพสต์ถูกยกเลิกการผูกแล้ว ต้องจับคู่เครื่องใหม่ก่อน',
    'Left {n} post(s) as they were: their browser was unbound and has to be paired again first',
  ],
  errBulkGone: [
    '{n} โพสต์ไม่ได้อยู่ในสถานะล้มเหลวแล้ว จึงไม่ถูกแตะต้อง',
    '{n} post(s) were no longer failed and were not touched',
  ],
} as const;

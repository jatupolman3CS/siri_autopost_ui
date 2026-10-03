// Strings the design handoff does not have, added when the app moved to the real API.
// Merged into the dictionary as t().api; same [th, en] pair shape as i18n.data.ts.
export const AP_I18N_EXTRA = {
  authInvalid: ['อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'Wrong email or password'],
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
  noWorkspace: ['ยังไม่มีเวิร์กสเปซ', 'No workspace yet'],

  // Devices and pairing (Phase 3)
  addDevice: ['เพิ่มอุปกรณ์', 'Add device'],
  pairTitle: ['จับคู่ส่วนขยายกับเวิร์กสเปซนี้', 'Pair the extension with this workspace'],
  pairStep1: [
    'ติดตั้งส่วนขยาย AutoPost ใน Chrome ที่ล็อกอิน Facebook ไว้',
    'Install the AutoPost extension in the Chrome that is logged in to Facebook',
  ],
  pairStep2: [
    'เปิดหน้าตั้งค่าส่วนขยาย ไปที่การ์ด “เชื่อมต่อเว็บ AutoPost”',
    'Open the extension settings, card “Connect to AutoPost web”',
  ],
  pairStep3: [
    'ใส่ URL และรหัสด้านล่าง แล้วกด “จับคู่”',
    'Enter the URL and the code below, then press “Pair”',
  ],
  pairUrl: ['URL', 'URL'],
  pairCode: ['รหัสจับคู่', 'Pairing code'],
  pairExpires: ['ใช้ได้ครั้งเดียว ถึง {t} น.', 'Single use, valid until {t}'],
  pairWaiting: ['รอส่วนขยายจับคู่…', 'Waiting for the extension…'],
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
  recordedCharge: [
    'ระบบบันทึกยอด {amt} ไว้ในใบแจ้งหนี้ (ยังไม่ได้เชื่อมระบบตัดบัตร)',
    '{amt} recorded on your invoices (card payments are not connected yet)',
  ],
  noInvoices: ['ยังไม่มีใบแจ้งหนี้', 'No invoices yet'],
  inviteRole: ['บทบาท', 'Role'],
  removeMember: ['นำออกจากทีม', 'Remove'],
  leaveTeam: ['ออกจากทีม', 'Leave'],
  removed: ['นำ {e} ออกจากทีมแล้ว', 'Removed {e}'],
  invitePending: ['รอสมัครสมาชิก', 'Invitation pending'],
  roleHere: ['สิทธิ์ของคุณ: {r}', 'Your role: {r}'],
  noJobs: ['ยังไม่มีงานโพสต์จากส่วนขยาย', 'No posts from the extension yet'],
  impersonateNote: [
    'ยังเข้าสู่ระบบแทนลูกค้าไม่ได้ ระบบบันทึกเฉพาะหมายเหตุ',
    'Signing in as the customer is not available; only the note is saved.',
  ],
} as const;

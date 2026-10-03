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
} as const;

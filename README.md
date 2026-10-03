# AutoPost UI (Angular)

Frontend ของ **AutoPost** สร้างตามดีไซน์ "AutoPost Dashboard" จาก Claude Design handoff ด้วย **Angular 22** (standalone, zoneless, signals) รองรับภาษาไทย/อังกฤษ และโหมดสว่าง/มืด

> หน้าเว็บเดิม (Vite + ไฟล์ dashboard ของส่วนขยาย) อยู่ที่ [`legacy/`](legacy/README.md) และยังรันได้เหมือนเดิม

## หน้าจอที่มี

| กลุ่ม | หน้า |
|---|---|
| สาธารณะ | หน้าแรก (landing + ราคา), เข้าสู่ระบบ, สมัครทดลองใช้ |
| เวิร์กสเปซ | ภาพรวม, ปฏิทินโพสต์, เขียนโพสต์, คลังสื่อและข้อความ |
| ระบบโพสต์อัตโนมัติ | ความปลอดภัยบัญชี (anti-ban), เมื่อออฟไลน์, รายงานข้อผิดพลาด |
| บัญชีผู้ใช้ | แผนและการชำระเงิน, ทีมและเวิร์กสเปซ |
| เจ้าของแพลตฟอร์ม (admin) | ภาพรวมแพลตฟอร์ม, ลูกค้า + รายละเอียดลูกค้า, การเงิน, แผนและโค้ดส่วนลด, งานที่กำลังรัน |
| ตัวอย่าง | หน้าต่างส่วนขยาย (popup) |

**สถานะข้อมูล:** ตอนนี้ทุกหน้าใช้ข้อมูลตัวอย่างจากดีไซน์ (เก็บในหน่วยความจำของเบราว์เซอร์ รีเฟรชแล้วรีเซ็ต) ยกเว้นการเข้าสู่ระบบ/แผน ภาษา และธีมที่จำไว้ใน localStorage
การเข้าสู่ระบบยังไม่ต่อ backend: ใส่อีเมลใดก็ได้ แล้วเลือก "ผู้ใช้งาน (ร้านค้า)" หรือ "ผู้ดูแลแพลตฟอร์ม" (เหมือนต้นแบบในดีไซน์)

## เริ่มพัฒนา

ต้องใช้ Node.js **22.22.3+** หรือ **24.15+**

```bash
npm install
npm start          # http://localhost:4200
npm test           # unit test (Vitest)
npm run build      # -> dist/siri-autopost-ui/browser
```

## โครงสร้าง

```text
src/app/
├── core/
│   ├── data/        # store ของแต่ละโดเมน (posts, settings, library, team, admin, extension, session, draft) + ข้อมูลตัวอย่าง
│   ├── i18n/        # พจนานุกรม TH/EN (สร้างจากดีไซน์), I18nService, ตัวจัดรูปแบบวันที่/เงิน
│   ├── auth/        # route guards
│   ├── http/        # interceptor + type ของ API (สำหรับเฟสต่อ backend)
│   └── services/    # ThemeService, NotificationService (toast)
├── shared/components/  # ชิ้นส่วนของ design system: modal, input, select, checkbox, empty state, plan cards
├── layouts/         # public-layout (header หน้าสาธารณะ), app-layout (sidebar + top bar + แถบออฟไลน์)
└── features/        # หนึ่งโฟลเดอร์ต่อหน้าจอ (public, overview, calendar, composer, ..., admin)
src/styles/          # tokens (สี/ระยะ/เงา), CSS ของ design system, layout utilities
```

## อัปเดตข้อความหรือข้อมูลตัวอย่างจากดีไซน์ใหม่

```bash
npm run import:design -- path/to/autopost-data.js
```

สร้าง `src/app/core/i18n/i18n.data.ts` และ `src/app/core/data/seed.data.ts` ใหม่จากไฟล์ของ handoff

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

**สถานะข้อมูล:** หน้าเวิร์กสเปซและระบบโพสต์อัตโนมัติใช้ข้อมูลจริงจาก `SIRIAUTOPOST.Api` (repo `siri_autopost_backend`):
สมัคร/เข้าสู่ระบบ (JWT), เวิร์กสเปซ, บัญชีโซเชียล, ตั้งเวลาโพสต์/แก้/ลบ, ปฏิทิน, รายงานข้อผิดพลาด (ลองใหม่/ข้าม/เชื่อมต่อใหม่), อัปโหลดสื่อและข้อความสำเร็จรูป, ตั้งค่า anti-ban และเมื่อออฟไลน์, จำลองส่วนขยายออฟไลน์, เปลี่ยนแผน และ **อุปกรณ์**: จับคู่ส่วนขยายด้วยรหัส (หน้าทีมและเวิร์กสเปซ > เพิ่มอุปกรณ์) แล้วส่วนขยายในเครื่องนั้นจะโพสต์ลงกลุ่ม Facebook ตามเวลาที่ตั้งไว้ และส่งผลกลับมาที่ปฏิทิน/รายงานข้อผิดพลาด

ตั้งแต่ Phase 4 ใช้ข้อมูลจริงเพิ่ม: **ทีม** (เชิญสมาชิกด้วยอีเมล, บทบาทผู้ชม/ผู้แก้ไข/ผู้ดูแล, นำออก/ออกจากทีม), **แผนและใบแจ้งหนี้** (ราคาและข้อจำกัดจากเซิร์ฟเวอร์, โค้ดส่วนลด, รายปีลด 20%) และ **หน้าเจ้าของแพลตฟอร์ม** ทั้งหมด (ลูกค้า, ระงับ/แบน/หยุดงาน, ข้อจำกัดรายลูกค้า, คืนเงิน, รายได้, แผนและโค้ดส่วนลด, งานที่กำลังรัน)

Phase 5: ภาพรวมแพลตฟอร์มใช้ **ตัวเลขจริง** (MRR เทียบ 30 วันก่อน, churn, ส่วนขยายที่ใช้งาน, อัตราสำเร็จ, latency ของ API, ฐานข้อมูล, คิว, อัตราข้อผิดพลาด), หน้าลูกค้ามี **ประวัติการดำเนินการ** และปุ่ม "ช่วยเหลือ" เปิดแดชบอร์ดของลูกค้า **แบบดูอย่างเดียว** 1 ชั่วโมง (มีแถบด้านบนให้กลับไปหน้าแอดมิน)

ยังเป็น **ข้อมูลตัวอย่าง**: บัตรเครดิตและการตัดเงินจริง (ยังไม่ได้เชื่อม payment gateway การเปลี่ยนแผนจึงแค่บันทึกยอด), ตัวอย่างหน้าต่างส่วนขยาย และภาพตัวอย่างบนหน้าแรก
เวิร์กสเปซใหม่จะมีบัญชีโซเชียลและประวัติโพสต์ตัวอย่างให้ลองใช้ (ป้าย "ตัวอย่าง") โพสต์ของบัญชีตัวอย่างไม่ถูกส่งจริง ส่วนขยายโพสต์ได้เฉพาะบัญชี "Facebook · ชื่อเครื่อง" ที่ได้จากการจับคู่ และเฉพาะโพสต์ลงกลุ่ม

## เริ่มพัฒนา

ต้องใช้ Node.js **22.22.3+** หรือ **24.15+**

ต้องรัน API ก่อน (ดู README ของ `siri_autopost_backend`: `cd src/SIRIAUTOPOST.Api && dotnet run` ที่ http://localhost:5100) แล้ว:

```bash
npm install
npm start          # http://localhost:4200 (ส่ง /api ไปที่ http://localhost:5100)
npm test           # unit test (Vitest)
npm run build      # -> dist/siri-autopost-ui/browser
npm run gen:api    # สร้าง type ของ API ใหม่จาก openapi.snapshot.json
```

รันทั้งระบบด้วย Docker (PostgreSQL + API + หน้าเว็บนี้ผ่าน nginx): ดู `docker-compose.saas.yml` ใน `siri_autopost_backend` (`Dockerfile` และ `nginx.conf` ของ repo นี้คือคอนเทนเนอร์ `web`)

บัญชีผู้ดูแลตอนพัฒนา: `admin@autopost.local` / `admin1234` หรือสมัครบัญชีใหม่ได้ที่ `/signup` (รหัสผ่านอย่างน้อย 8 ตัวอักษร)

## โครงสร้าง

```text
src/app/
├── core/
│   ├── data/        # store ของแต่ละโดเมน (session, workspace, accounts, posts, settings, library, extension, draft, team, admin) + ข้อมูลตัวอย่าง
│   ├── i18n/        # พจนานุกรม TH/EN (สร้างจากดีไซน์), I18nService, ตัวจัดรูปแบบวันที่/เงิน
│   ├── auth/        # route guards, token, auth interceptor
│   ├── http/        # ApiService, error interceptor, type ของ API (api-schema.ts)
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

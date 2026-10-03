# SIRI.AUTOPOST UI (Angular)

Frontend ของระบบ SIRI.AUTOPOST เขียนด้วย **Angular 22** (standalone components, zoneless, signals) ใช้คู่กับ `SIRIAUTOPOST.Api` ใน repo `siri_autopost_backend`

> หน้าเว็บเดิม (Vite + ไฟล์ dashboard ของส่วนขยาย) ย้ายไปอยู่ที่ [`legacy/`](legacy/README.md) และยังรันได้เหมือนเดิม

---

## โครงสร้าง

```text
siri_autopost_ui/
├── src/
│   ├── app/
│   │   ├── core/          # ใช้ทั้งแอป (ห้าม import จาก features)
│   │   │   ├── auth/      # AuthStore (signals), authGuard, TokenStorageService
│   │   │   ├── http/      # interceptors (แนบ token, แจ้ง error), ProblemDetails, api-schema.ts (generated)
│   │   │   └── services/  # ThemeService, NotificationService
│   │   ├── shared/        # components / directives / pipes ที่ใช้ซ้ำ (dumb)
│   │   ├── layouts/       # main-layout (sidebar + header), auth-layout (หน้า login)
│   │   ├── features/      # ฟีเจอร์หลัก โหลดแบบ lazy ผ่าน *.routes.ts
│   │   │   ├── auto-post/ # ตัวอย่างครบชุด: components, pages, services, state, models
│   │   │   ├── settings/
│   │   │   └── auth/      # หน้า login
│   │   ├── app.component.ts
│   │   ├── app.config.ts
│   │   └── app.routes.ts
│   ├── assets/
│   ├── styles/            # design tokens (CSS variables) + base styles
│   └── environments/
├── openapi.snapshot.json  # สัญญา API จาก backend ใช้สร้าง src/app/core/http/api-schema.ts
├── proxy.conf.json        # ng serve ส่ง /api ไปที่ backend (http://localhost:5100)
├── angular.json
├── package.json
└── legacy/                # หน้าเว็บเดิม (Vite)
```

## เริ่มพัฒนา

ต้องใช้ Node.js **22.22.3+** หรือ **24.15+** (ตามที่ Angular CLI 22 กำหนด)

```bash
npm install
npm start               # http://localhost:4200 (ต้องรัน SIRIAUTOPOST.Api ที่พอร์ต 5100 ด้วย)
npm test                # unit test (Vitest)
npm run build           # -> dist/siri-autopost-ui/browser
```

## อัปเดต type ของ API

เมื่อ backend เปลี่ยน API:

```bash
curl http://localhost:5100/openapi/v1.json -o openapi.snapshot.json
npm run gen:api         # สร้าง src/app/core/http/api-schema.ts ใหม่
```

model ของแต่ละฟีเจอร์ (เช่น `features/auto-post/models/post.model.ts`) อ้างอิง type จากไฟล์นี้ จึงเห็น error ตอน build ทันทีถ้าสัญญา API เปลี่ยน

## การเข้าสู่ระบบ

`core/auth` มีครบทั้ง AuthStore, guard และ interceptor แล้ว แต่ `SIRIAUTOPOST.Api` ยังไม่มี endpoint `/api/auth/login` จึงปิดไว้ด้วย `authEnabled: false` ใน `src/environments/` เมื่อ backend มี auth แล้วให้เปลี่ยนเป็น `true`

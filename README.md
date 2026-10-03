# Siri AutoPost UI (Frontend Web)

เว็บแอปพลิเคชัน Frontend สำหรับจัดการระบบ **FB AutoPost Online**
ใช้สำหรับจัดการชุดโพสต์ (Profiles), จัดการเครื่องรันบอท (Devices), ออกคีย์เชื่อมต่อ และแก้ไขชุดการตั้งค่าผ่านหน้า Dashboard แบบออนไลน์

---

## ฟังก์ชันการทำงาน
- **Admin Portal (`index.html`)**: จัดการ Config โพสต์ และเครื่องรัน (คอมพิวเตอร์ที่ติดตั้ง Extension)
- **Login Portal (`login.html`)**: หน้าเข้าสู่ระบบสำหรับผู้ดูแล
- **Campaign Dashboard (`dashboard.html`)**: เครื่องมือตั้งค่าแคมเปญโพสต์ Facebook (สุ่มคำ, สุ่มเวลา, สุ่มรูปภาพ, จัดการกลุ่ม, Telegram แจ้งเตือน)
- **Shim (`web/shim.js`)**: เลเยอร์เชื่อมต่อ Chrome Storage API กับ Backend Server REST API แบบโปร่งใส

---

## การติดตั้งและการเริ่มพัฒนา (Development)

1. ติดตั้ง Dependencies:
   ```bash
   npm install
   ```

2. กำหนด URL ของ Backend Server ในไฟล์ `.env` (ค่าเริ่มต้นคือ `http://localhost:8080`):
   ```bash
   cp .env.example .env
   ```

3. รัน Dev Server:
   ```bash
   npm run dev
   ```
   เข้าใช้งานผ่านเบราว์เซอร์ที่: `http://localhost:5173` (ระบบมี Vite Proxy จัดการส่ง `/api` ไปยัง Backend Server อัตโนมัติ)

---

## การ Build สำหรับ Production

```bash
npm run build
```
ไฟล์พร้อม Deploy จะอยู่ที่โฟลเดอร์ `dist/`

---

## การรันด้วย Docker

```bash
docker build -t siri-autopost-ui .
docker run -d -p 80:80 siri-autopost-ui
```

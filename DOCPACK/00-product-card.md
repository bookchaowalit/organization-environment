---
title: NODAL — Organization Environment — Product Card
doc_id: CARD-organization-environment
doc_type: product-card
verdict: showcase
version: 0.1
date: 2026-10-08
status: ร่างเพื่อพิจารณา
owner: Product owner (Book Dev)
---

# NODAL — Organization Environment — Product Card

## 1. สรุปคุณค่าในหนึ่งประโยค

ต้นแบบสำนักงานเสมือนในเครื่อง ที่ให้ทีมเล็กเดินในห้อง เห็น presence คุยและโทรผ่าน LiveKit และดูการตัดสินใจทางวิศวกรรมในมุมมองปกติ/เชิงพื้นที่/กราฟ

## 2. ปัญหาและผู้ใช้เป้าหมาย

- ทีมวิศวกรรม/AI แยกบริบทไว้หลายเครื่องมือ (ประชุม, GitHub, Linear, แชท) ทำให้การตัดสินใจหายระหว่างทาง (ตาม `PRODUCT.md`)
- ผู้ใช้แรกตาม `PRODUCT.md`: ทีมวิศวกรรม/AI ขนาดเล็ก **[สมมติฐาน]** ไม่มีหลักฐานผู้ใช้

## 3. สิ่งที่ทำได้จริงตอนนี้

- Next.js + Drizzle: บัญชีและคำเชิญใช้ครั้งเดียว ห้อง การเดินด้วยคลิก/ปุ่มลูกศร presence และข้อความ (poll ทุก 2 วินาที)
- โทรเสียง/วิดีโอผ่าน LiveKit Docker ที่ bind loopback พร้อม proximity audio ฝั่ง client
- API routes 3 ตัว (`decisions`, `workspace`, `office/[action]`); owner อนุมัติ decision ได้ แต่การเขียนไป GitHub/Linear ถูกปิด
- test 4 ไฟล์ และ Playwright config

## 4. หลักฐานสถานะ

- Stack: Next.js, React
- Commits: 1 (แรก 2026-09-09 → ล่าสุด 2026-09-09), branch `main`; working tree สะอาด
- Source: 43 ไฟล์ / 2,896 บรรทัด; test 4 ไฟล์
- CI: 0 workflow (ไม่มี CI)
- Deploy config: ไม่มี
- Live URL: ไม่พบใน repo

## 5. คุณค่าและจุดต่าง

- แนวคิดผูก 'การตัดสินใจ → งาน → การยืนยัน' กับพื้นที่เสมือนน่าสนใจ
- คู่แข่งตรง (Gather, Teams, Slack huddles + Linear) แข็งแรงมาก; จุดต่างยังเป็นเพียงคำสัญญาใน `PRODUCT.md`
- มุมรายได้: SaaS สำหรับทีม AI **[สมมติฐาน]** ยังไม่มีการสัมภาษณ์ผู้ใช้

## 6. ช่องว่างสำคัญ

- commit เดียว ไม่มี CI และไม่มี deploy
- ส่วน engineering signals ใช้ fixture; integration จริงทั้งหมดยังปิด
- presence ใช้ polling ไม่ใช่ realtime ที่ขยายได้

## 7. คำตัดสิน

**showcase** — เป็น demo ที่ทำงานได้และแสดงทักษะ full-stack + realtime media แต่ยังไม่มีหลักฐานปัญหาหรือผู้ใช้ และตลาดแข่งขันสูง

จะเป็น `invest` เมื่อมีทีมจริงอย่างน้อย 1 ทีมใช้ต่อเนื่องและยืนยันว่าส่วน decision-to-task ช่วยได้; ถ้าไม่มีการแตะใน 3 เดือนให้ `archive`

## 8. ขั้นต่อไป

1. เพิ่ม CI ขั้นต่ำ (lint, test)
2. ทดลองใช้กับทีมเล็กหนึ่งทีมและบันทึกผล
3. บันทึกวิดีโอ demo สำหรับ portfolio

## การอนุมัติ

| บทบาท | สถานะ | วันที่ | ลงนาม |
|---|---|---|---|
| Product owner (Book Dev) | รอพิจารณา | — | ________ |

## แหล่งข้อมูล

- `README.md`
- `PRODUCT.md`
- `app/`
- `app/api/`

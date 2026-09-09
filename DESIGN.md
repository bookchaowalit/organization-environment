# NODAL visual system — Signal Garden

## World

**Signal Garden** คือสนามปฏิบัติการที่ work, people และ agents ไหลผ่านเส้นทาง
เดียวกัน ห้องเป็น habitat, event เป็น pulse และ incident เป็นแรงโน้มถ่วงที่
ดึงทุกคนเข้าสู่ War room ทิศทางนี้ทำให้ spatial metaphor มี utility โดยไม่
กลายเป็นเกมหรือ decoration

## First surface

หน้า Engineering Room ต้องตอบให้ได้ในไม่กี่วินาทีว่าอะไร live, ใครกำลังทำอะไร,
agent ไหนกำลังรอ และ decision ใดต่อไปได้ทันที โครงสร้างคือ sidebar route rail →
signal strip → execution terrain → context rail → decision ledger

## Visual rules

- deep forest/graphite เป็นพื้นผิวหลัก เพื่ออ่านได้ในห้องทำงานและช่วง incident
- acid lime = selection/healthy/primary action; amber = review; coral = incident
- hairline borders และ filled surfaces แบ่งชั้นข้อมูล; ไม่ใช้ gradient หรือ glass
- UI ใช้ system sans + Noto Sans Thai; codes/timestamps ใช้ monospace
- icons ต้องเป็น consistent stroke SVG ไม่ใช้ emoji เป็น icon
- ใช้ rows, timeline และ terrain เป็นโครงสร้างหลัก ไม่ใช้ card grid ซ้ำ ๆ

## Signature interaction

`Open war room` เปลี่ยนทั้ง terrain ให้เป็น incident mode: path pulse เปลี่ยน
เป็น coral, SENTRY เปลี่ยน state เป็น `Investigating`, focus item โหลด incident
context และ next handoff เปลี่ยนตาม การเปลี่ยนต้องอ่านได้แม้ปิด motion

## Required states

- default: production healthy, normal flow
- active: selected room/view และ decision proposal
- pending: approval request กำลังประมวลผล
- success: decision approved แต่ external write ยัง disabled
- error: API/approval ล้มเหลวพร้อม recovery message
- empty: memory search ไม่พบผล
- reduced motion: ปิด path animation แต่คงสี, label และ state

## Responsive

Shared Office extends Signal Garden with a room rail, shared floor, explicit
call controls and a room-message column. Real human presence is separated from
the engineering fixture actors. Entry forms cover owner setup, login and
invite redemption; invitations can be hidden after copying. The floor supports
click and arrow-key movement; mobile stacks the floor and chat below rooms.
Connection state, durable local storage and unconfigured media are explicit.
Calls start with camera/mic off. There are no emoji icons or gradients.

- desktop: sidebar + terrain + context rail
- tablet: context rail ลงด้านล่าง terrain และ detail grid เป็นคอลัมน์เดียว
- mobile: sidebar กลายเป็น horizontal route rail, terrain เป็น stacked nodes
- target การกดอย่างน้อย 44px และ icon button ทุกตัวมี accessible label

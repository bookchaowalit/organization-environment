import { RoomShell } from "@/src/components/room-shell";
import { getWorkspaceRepository } from "@/src/persistence/runtime";
import { officeEnabled } from "@/src/office/database";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (officeEnabled()) redirect("/office");
  try {
    const repository = await getWorkspaceRepository();
    return <><div style={{ padding: 12 }}><a href="/office">เปิด Shared Office</a></div><RoomShell initialRoom={await repository.room()} /></>;
  } catch {
    return <main className="workspace-unavailable"><h1>โหลด workspace ไม่สำเร็จ</h1>
      <p>ฐานข้อมูลที่ตั้งค่าไว้ไม่พร้อม หรือยังไม่ได้ migrate/seed ไม่มีการเปลี่ยนเป็น fixture อัตโนมัติ</p>
      <a href="/">ลองโหลดอีกครั้ง</a></main>;
  }
}

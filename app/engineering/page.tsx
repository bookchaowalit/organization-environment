import { RoomShell } from "@/src/components/room-shell";
import { engineeringContext } from "@/src/office/engineering";
export const dynamic = "force-dynamic";
export default async function EngineeringPage() {
  try {
    const { repository, canApprove, authenticated } = await engineeringContext();
    const room = await repository.room();
    if (authenticated) room.approvalAvailable = Boolean(canApprove);
    return <><div style={{ padding: 12 }}><a href="/office">กลับ Shared Office</a></div><RoomShell initialRoom={room} /></>;
  } catch {
    return <main className="workspace-unavailable"><h1>เข้าสู่ระบบเพื่อเปิด Engineering signals</h1><a href="/office">เปิด Shared Office</a></main>;
  }
}

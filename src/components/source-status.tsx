import type { Citation, EngineeringRoom } from "../domain/types";

export function Citations({ citations }: { citations?: Citation[] }) {
  return <span className="citation-list">{citations?.map((citation) => (
    <a key={citation.sourceId} className="source-citation" href={`#source-${citation.sourceId}`}
      title={citation.excerpt}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2" />
      </svg>{citation.label}
    </a>
  ))}</span>;
}

const labels = { fresh: "ข้อมูลล่าสุด", stale: "ข้อมูลล้าสมัย", failed: "นำเข้าล้มเหลว",
  fixture: "ข้อมูลจำลอง", simulator: "ข้อมูลจำลอง", not_configured: "ยังไม่เคยนำเข้า" };

export function PilotStatus({ room }: { room: EngineeringRoom }) {
  return <section className="pilot-status" aria-label="โหมดข้อมูลและสถานะแหล่งข้อมูล">
    <div className="pilot-mode"><strong>{room.mode === "fixture" ? "Fixture mode · ไม่บันทึกถาวร" : "Connected-read-only · Postgres"}</strong>
      <p>{room.mode === "fixture"
        ? "การอนุมัติเป็น simulation และจะรีเซ็ตเมื่อ refresh ข้อมูลนี้ไม่ใช่สถานะระบบจริง"
        : "ข้อมูลบันทึกถาวร · GitHub/Linear ยังใช้ local payloads · เฉพาะเจ้าของทีมที่เข้าสู่ระบบสามารถอนุมัติได้"}</p>
      <small>External write: disabled · terrain, incidents และ agents เป็นแบบจำลอง · verification ยังรอหลักฐาน</small>
    </div>
    <ul className="source-health">{room.integrations.map((integration) => <li key={integration.provider} data-status={integration.status}>
      <strong>{integration.provider} <span>{labels[integration.status]}</span></strong>
      <span>นำเข้าสำเร็จล่าสุด: {integration.lastSuccessfulSync ?? "ยังไม่มี"}</span>
      <span>Source updated: {integration.sourceUpdatedAt ?? "ไม่ทราบ"}</span>
      {integration.status === "failed" ? <span>ตรวจรูปแบบ local payload แล้วนำเข้าใหม่ · ข้อมูลสำเร็จเดิมยังอยู่</span> : null}
      {integration.status === "stale" ? <span>ข้อมูลหรือการนำเข้าเก่ากว่า 30 นาที · ตรวจ source ก่อนตัดสินใจ</span> : null}
      <small>Local fixture payload · ไม่มีการเชื่อมต่อ provider จริง</small>
    </li>)}</ul>
    <details className="source-register"><summary>หลักฐานต้นทาง ({room.sources?.length ?? 0})</summary>
      {room.sources?.map((source) => <article key={source.id} id={`source-${source.id}`} tabIndex={-1}>
        <strong>{source.label}</strong><p>{source.provider} · {source.externalId} · {source.updatedAt}</p>
        <small>local_fixture · sample reference</small>
        {source.url ? <a href={source.url} target="_blank" rel="noreferrer">เปิด source URL ตัวอย่าง</a> : null}
      </article>)}
    </details>
  </section>;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Location, OfficeMember, OfficeSnapshot } from "../office/contracts";
import { proximityVolumes } from "../office/proximity";

const OfficeCall = dynamic(() => import("./office-call").then((module) => module.OfficeCall), { ssr: false });
type SessionPayload = { configured: boolean; initialized: boolean; member?: unknown; bootstrapAvailable?: boolean };
type InvitePayload = { invite: string };
type MediaPayload = { token: string; url: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isLocation(value: unknown): value is Location {
  return isRecord(value) && typeof value.roomId === "string" && Number.isInteger(value.x) &&
    Number.isInteger(value.y) && ["available", "focus", "away"].includes(String(value.status));
}
function isMember(value: unknown): value is OfficeMember {
  return isRecord(value) && typeof value.id === "string" && typeof value.tenantId === "string" &&
    typeof value.name === "string" && (value.role === "owner" || value.role === "member");
}
function isSessionPayload(value: unknown): value is SessionPayload {
  if (!isRecord(value) || typeof value.configured !== "boolean" || typeof value.initialized !== "boolean" ||
    (!Object.hasOwn(value, "bootstrapAvailable") || typeof value.bootstrapAvailable === "boolean")) return false;
  return !value.configured || (Object.hasOwn(value, "member") && (value.member === null || isMember(value.member)));
}
function isOfficeSnapshot(value: unknown): value is OfficeSnapshot {
  if (!isRecord(value) || !isMember(value.me) || (!isLocation(value.savedLocation) && value.savedLocation !== null) ||
    !Array.isArray(value.rooms) || !Array.isArray(value.people) || !Array.isArray(value.messages) ||
    typeof value.mediaConfigured !== "boolean" || !["local-postgres", "postgres"].includes(String(value.storage))) return false;
  const rooms = value.rooms.every((room) => isRecord(room) && typeof room.id === "string" &&
    typeof room.name === "string" && typeof room.description === "string");
  const people = value.people.every((person) => isRecord(person) && typeof person.id === "string" &&
    typeof person.name === "string" && typeof person.roomId === "string" && typeof person.x === "number" &&
    typeof person.y === "number" && typeof person.status === "string");
  const messages = value.messages.every((message) => isRecord(message) && typeof message.id === "string" &&
    typeof message.memberId === "string" && typeof message.roomId === "string" && typeof message.body === "string" &&
    typeof message.name === "string" && typeof message.createdAt === "string");
  return rooms && people && messages;
}
function isInvitePayload(value: unknown): value is InvitePayload {
  return isRecord(value) && typeof value.invite === "string" && value.invite.length > 0;
}
function isMediaPayload(value: unknown): value is MediaPayload {
  return isRecord(value) && typeof value.token === "string" && typeof value.url === "string";
}

async function api<T = Record<string, unknown>>(action: string, body?: object, guard?: (value: unknown) => value is T): Promise<T> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`/api/office/${action}`, body ? {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      signal: controller.signal,
    } : { cache: "no-store", signal: controller.signal });
    const data: unknown = await response.json().catch(() => ({ error: "office_unavailable" }));
    const error = isRecord(data) && typeof data.error === "string" ? data.error : "office_unavailable";
    if (!response.ok || (isRecord(data) && Object.hasOwn(data, "error"))) {
      throw new Error(error);
    }
    if (!isRecord(data) || (guard && !guard(data))) throw new Error("office_unavailable");
    return data as T;
  } catch (error) {
    if ((error as Error).name === "AbortError") throw new Error("network_timeout");
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
function newMessageRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `message-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
const errors: Record<string, string> = {
  invalid_credentials: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", invite_required: "ต้องใช้รหัสเชิญจากเจ้าของทีม",
  invite_invalid_or_expired: "รหัสเชิญหมดอายุหรือถูกใช้แล้ว", username_unavailable: "ชื่อผู้ใช้นี้ถูกใช้แล้ว",
  invalid_request: "ตรวจชื่อผู้ใช้และรหัสผ่าน (อย่างน้อย 12 ตัวอักษร)",
  office_unavailable: "เชื่อมต่อพื้นที่ทำงานไม่ได้ ตรวจฐานข้อมูลแล้วลองใหม่",
  network_timeout: "เครือข่ายตอบสนองช้าเกินไป ระบบจะลองเชื่อมต่อใหม่อัตโนมัติ",
  forbidden: "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้", invalid_origin: "คำขอนี้มาจากแหล่งที่ไม่อนุญาต",
  room_not_found: "ไม่พบห้องนี้ กรุณาเลือกห้องอื่น", request_too_large: "คำขอยาวเกินขนาดที่อนุญาต",
  copy_failed: "คัดลอกรหัสเชิญไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง",
  media_not_configured: "ยังไม่ได้ตั้งค่า media server", unauthorized: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่",
  rate_limited: "ส่งคำขอถี่เกินไป กรุณารอสักครู่", join_room_first: "รอการเข้าห้องสำเร็จแล้วลองอีกครั้ง",
};
function Symbol({ kind }: { kind: "room" | "people" | "call" }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    {kind === "room" ? <><path d="M4 21V4h16v17M2 21h20M14 4v17" /><circle cx="11" cy="12" r=".6" /></> :
      kind === "people" ? <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3" /></> :
        <><rect x="3" y="6" width="12" height="12" rx="3" /><path d="m15 10 6-4v12l-6-4" /></>}
  </svg>;
}

export function OfficeShell() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [state, setState] = useState<OfficeSnapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [register, setRegister] = useState(false);
  const [invite, setInvite] = useState("");
  const [call, setCall] = useState<{ token: string; url: string; roomId: string } | null>(null);
  const [connected, setConnected] = useState(false);
  const [secureContext, setSecureContext] = useState(true);
  const pendingMessage = useRef<{ requestId: string; body: string; roomId: string } | null>(null);
  const presenceQueue = useRef<Promise<unknown>>(Promise.resolve());
  const sendPresence = useCallback((location: Location) => {
    const request = presenceQueue.current.catch(() => undefined).then(() => api("presence", location));
    presenceQueue.current = request;
    return request;
  }, []);
  const point = useRef<Location>({ roomId: "room-engineering", x: 50, y: 50, status: "available" });
  const [place, setPlace] = useState(point.current);
  const refreshSession = useCallback(async () => {
    try {
      setSession(await api<SessionPayload>("session", undefined, isSessionPayload));
      setError("");
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void refreshSession(); }, [refreshSession]);
  useEffect(() => { setSecureContext(window.isSecureContext); }, []);

  useEffect(() => {
    if (!session?.member) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function update() {
      try {
        await sendPresence(point.current);
        const snapshot = await api<OfficeSnapshot>("state", undefined, isOfficeSnapshot);
        if (!stopped) { setState(snapshot); setConnected(true); }
      } catch (e) {
        if (!stopped) { setConnected(false); setError((e as Error).message); setCall(null); }
        if (!stopped && (e as Error).message === "unauthorized") { setState(null); void refreshSession(); }
      }
      if (!stopped) timer = setTimeout(update, 2000);
    }
    void (async () => {
      try {
        const initial = await api<OfficeSnapshot>("state", undefined, isOfficeSnapshot);
        if (stopped) return;
        if (initial.savedLocation) { point.current = initial.savedLocation; setPlace(initial.savedLocation); }
        setState(initial);
      } catch (e) { if (!stopped) setError((e as Error).message); }
      if (!stopped) void update();
    })();
    return () => { stopped = true; clearTimeout(timer); };
  }, [session, refreshSession, sendPresence]);

  function move(next: Location) {
    point.current = next;
    setPlace(next);
    if (call && call.roomId !== next.roomId) setCall(null);
    void sendPresence(next).catch((e) => setError(e.message));
  }
  async function action(run: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError("");
    try { await run(); } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const notice = error ? <p className="office-error" role="alert">{errors[error] ?? "ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง"}</p> : null;
  if (!session) return <main className="office-entry"><h1>NODAL Shared Office</h1>{notice ?? <p>กำลังเปิดพื้นที่ทำงาน...</p>}
    {error ? <button onClick={refreshSession}>ลองอีกครั้ง</button> : null}</main>;
  if (!session.configured) return <main className="office-entry"><h1>เปิดพื้นที่ร่วมกัน</h1><p>เริ่มโหมดบันทึกข้อมูลบนเครื่องเพื่อสร้างทีมและทดลองร่วมกันหลาย browser</p>
    <pre>pnpm office:dev</pre><p>จากนั้นเปิด /office · fixture เดิมยังดูได้ที่หน้าแรก</p><a href="/">กลับ Engineering demo</a></main>;
  if (!session.member && !session.initialized && session.bootstrapAvailable === false) return <main className="office-entry"><h1>ต้องสร้าง owner จากเครื่อง host</h1>
    <p>พื้นที่นี้เปิดด้วยโหมด LAN หรือ hosted mode ซึ่งปิด first-owner bootstrap ไว้</p><pre>pnpm office:dev</pre>
    <p>สร้างบัญชีแรกจากเครื่อง host ก่อน แล้วค่อยเปิด LAN URL ให้ทีมเข้าร่วมด้วย invite</p></main>;
  if (!session.member) return <main className="office-entry"><a href="/">NODAL</a><h1>{!session.initialized ? "สร้างพื้นที่ทำงานของทีม" : register ? "เข้าร่วมทีม" : "กลับเข้าสู่พื้นที่ทำงาน"}</h1>
    <p>ห้องเดียวกัน คนละ browser · ข้อมูลบันทึกถาวร · ไมค์และกล้องเริ่มต้นปิด</p>
    <form onSubmit={(event) => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      void action(async () => {
        const create = register || !session.initialized;
        await api(create ? "register" : "login", {
          username: values.get("username"), password: values.get("password"),
          ...(create ? { name: values.get("name"), ...(session.initialized ? { invite: values.get("invite") } : {}) } : {}),
        });
        await refreshSession();
      });
    }}>
      {(register || !session.initialized) ? <label>ชื่อที่แสดง<input name="name" required maxLength={60} autoComplete="name" /></label> : null}
      <label>ชื่อผู้ใช้<input name="username" required pattern="[a-zA-Z0-9_-]{3,40}" autoComplete="username" placeholder="ใช้ a-z, 0-9, _ หรือ -" /></label>
      <label>รหัสผ่าน<input name="password" type="password" required minLength={12} maxLength={128} autoComplete={register || !session.initialized ? "new-password" : "current-password"} /></label>
      {register && session.initialized ? <label>รหัสเชิญ<input name="invite" required autoComplete="off" /></label> : null}
      <button className="office-primary" disabled={busy}>{busy ? "กำลังดำเนินการ..." : !session.initialized ? "สร้างบัญชีเจ้าของทีม" : register ? "เข้าร่วมทีม" : "เข้าสู่ระบบ"}</button>
    </form>{notice}{session.initialized ? <button onClick={() => { setRegister(!register); setError(""); }}>{register ? "มีบัญชีแล้ว" : "มีรหัสเชิญเข้าทีม"}</button> : <p>บัญชีแรกเป็นเจ้าของทีมและสามารถสร้างรหัสเชิญได้</p>}</main>;
  if (!state) return <main className="office-entry"><h1>กำลังเข้าห้อง...</h1>{notice}<button onClick={refreshSession}>ลองอีกครั้ง</button></main>;
  const room = state.rooms.find((r) => r.id === place.roomId);
  const people = [...state.people.filter((person) => person.roomId === place.roomId && person.id !== state.me.id),
    { id: state.me.id, name: state.me.name, ...place }];
  const proximity = proximityVolumes(place, people);
  return <main className="office">
    <header className="office-header"><div><a href="/">NODAL</a><h1>Shared Office</h1></div>
      <span className={connected ? "office-online" : "office-offline"}>{connected ? "เชื่อมต่อ · อัปเดตทุก 2 วินาที" : "การเชื่อมต่อขาดหาย"}</span>
      <span>{state.me.name}</span><button disabled={busy} onClick={() => void action(async () => {
        setCall(null); await api("logout", {}); setState(null); await refreshSession();
      })}>ออกจากระบบ</button></header>
    <div className="office-layout"><aside className="office-sidebar"><h2><Symbol kind="room" />ห้องของทีม</h2>
      <nav aria-label="ห้องร่วมกัน">{state.rooms.map((r) => <button key={r.id} aria-current={r.id === place.roomId ? "page" : undefined}
        onClick={() => move({ ...point.current, roomId: r.id, x: 50, y: 50 })}>
        <span>{r.name}</span><small>{state.people.filter((p) => p.roomId === r.id).length} คน</small></button>)}</nav>
      <label>สถานะของคุณ<select value={place.status} onChange={(e) => move({ ...point.current, status: e.target.value as Location["status"] })}>
        <option value="available">พร้อมคุย</option><option value="focus">กำลังโฟกัส</option><option value="away">ไม่อยู่</option>
      </select></label>
      {state.me.role === "owner" ? <><button disabled={busy} onClick={() => void action(async () => setInvite((await api<InvitePayload>("invite", {}, isInvitePayload)).invite))}>
        <Symbol kind="people" />สร้างรหัสเชิญ</button>{invite ? <div className="office-invite"><label>ใช้ได้ครั้งเดียว ภายใน 24 ชม.<textarea readOnly value={invite} /></label>
          <button onClick={() => void navigator.clipboard.writeText(invite).catch(() => setError("copy_failed"))}>คัดลอกรหัส</button><button onClick={() => setInvite("")}>ซ่อนรหัส</button></div> : null}</> : null}
      <a href="/engineering">เปิด Engineering signals</a><p>{state.storage === "local-postgres" ? "บันทึกบนเครื่องนี้" : "บันทึกใน Postgres"} · GitHub/Linear write ปิดอยู่</p>
    </aside>
    <section className="office-main"><div className="office-room-heading"><div><h2>{room?.name}</h2><p>คลิกพื้นห้องหรือใช้ปุ่มลูกศรเพื่อย้ายตำแหน่ง · กดเข้าร่วมเพื่อเริ่มสนทนา</p></div><span>{people.length} คนในห้อง</span></div>
      {notice}
      <div className="office-map" role="group" aria-label="แผนผังห้อง ใช้ปุ่มลูกศรเพื่อย้ายตำแหน่ง" tabIndex={0}
        onClick={(event) => { const box = event.currentTarget.getBoundingClientRect(); move({ ...point.current,
          x: Math.max(5, Math.min(95, Math.round((event.clientX - box.left) / box.width * 100))),
          y: Math.max(5, Math.min(95, Math.round((event.clientY - box.top) / box.height * 100))) }); }}
        onKeyDown={(event) => {
          const offsets: Record<string, [number, number]> = { ArrowUp: [0, -5], ArrowDown: [0, 5], ArrowLeft: [-5, 0], ArrowRight: [5, 0] };
          const delta = offsets[event.key]; if (!delta) return; event.preventDefault();
          move({ ...point.current, x: Math.max(5, Math.min(95, point.current.x + delta[0])), y: Math.max(5, Math.min(95, point.current.y + delta[1])) });
        }}>
        <div className="office-table" aria-hidden="true">NODAL / {room?.name}</div>
        {people.map((person) => <div key={person.id} className={`office-person ${person.id === state.me.id ? "is-self" : ""}`}
          style={{ left: `${person.id === state.me.id ? place.x : person.x}%`, top: `${person.id === state.me.id ? place.y : person.y}%` }}>
          <span>{person.name.slice(0, 2).toUpperCase()}</span><strong>{person.name}</strong><small>{person.status === "focus" ? "กำลังโฟกัส" : person.status === "away" ? "ไม่อยู่" : "พร้อมคุย"}</small>
        </div>)}
      </div>
      <section className="office-conversation"><h2><Symbol kind="call" />สนทนาในห้อง</h2>
        {call ? <OfficeCall key={call.roomId} token={call.token} url={call.url} proximity={proximity} onLeave={() => setCall(null)} /> :
          <><p>{state.mediaConfigured && !secureContext ? "media server พร้อม แต่ browser ต้องเปิดหน้านี้ผ่าน HTTPS ก่อนจึงจะใช้ไมค์หรือกล้องได้" : state.mediaConfigured ? "เข้าแบบปิดไมค์และกล้องก่อน แล้วเลือกเปิดหรือแชร์หน้าจอได้" : "ยังไม่ได้ตั้งค่า LiveKit · ตอนนี้ใช้ห้อง ตำแหน่ง และแชตได้"}</p>
            <button className="office-primary" disabled={!state.mediaConfigured || !secureContext || busy || !connected} onClick={() => void action(async () => {
              await sendPresence(point.current);
              const result = await api<MediaPayload>("media", { roomId: place.roomId }, isMediaPayload);
              setCall({ ...result, roomId: place.roomId });
            })}>เข้าร่วมเสียง / วิดีโอ</button></>}
      </section>
    </section><aside className="office-chat"><h2>ข้อความในห้อง</h2><p>สมาชิกในทีมอ่านประวัติได้ · บันทึกถาวร</p>
      <div className="office-messages" role="log" aria-live="polite">{state.messages.filter((m) => m.roomId === place.roomId).map((message) =>
        <article key={message.id}><strong>{message.name}</strong><time>{new Date(message.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</time><p>{message.body}</p></article>)}
        {!state.messages.some((m) => m.roomId === place.roomId) ? <p>เริ่มทักทายคนในห้องนี้</p> : null}</div>
      <form onSubmit={(event) => {
        event.preventDefault(); const form = event.currentTarget; const body = new FormData(form).get("body");
        if (typeof body !== "string" || !body.trim()) return;
        const pending = pendingMessage.current?.body === body && pendingMessage.current.roomId === place.roomId
          ? pendingMessage.current : { requestId: newMessageRequestId(), body, roomId: place.roomId };
        pendingMessage.current = pending;
        void action(async () => { await api("message", { roomId: pending.roomId, body, requestId: pending.requestId }); pendingMessage.current = null; form.reset(); });
      }}><label className="sr-only" htmlFor="office-message">ข้อความ</label><textarea id="office-message" name="body" required maxLength={2000} placeholder="พิมพ์ข้อความถึงคนในห้อง..." />
        <button disabled={busy || !connected}>ส่งข้อความ</button></form></aside></div>
  </main>;
}

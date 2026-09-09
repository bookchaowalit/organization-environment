"use client";

import { useState } from "react";

import type { ActivityEvent, Actor, DecisionTask, EngineeringRoom, WorkItem } from "@/src/domain/types";

import { GraphView } from "./graph-view";
import { SpatialView } from "./spatial-view";
import { PilotStatus, Citations } from "./source-status";

type View = "overview" | "spatial" | "graph" | "decisions" | "memory" | "agents";
type IconName = "terrain" | "check-square" | "search" | "bot" | "bell" | "check" | "arrow" | "arrow-up" | "plus" | "alert" | "clock" | "x" | "chevron-down" | "more" | "database" | "lock" | "user-plus" | "activity" | "rocket" | "hash";

interface ApprovalResponse {
  schemaVersion: string;
  ok: true;
  mode: EngineeringRoom["mode"];
  workspace: EngineeringRoom;
  externalWrite: "disabled";
  decision: EngineeringRoom["decision"];
}


function Icon({ name, size = 17 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "terrain":
      return <svg {...common}><path d="M3 17.5 8.5 12l4 3 4.5-5.5L21 13" /><path d="M3 20.5h18" /><circle cx="8.5" cy="7" r="2" /></svg>;
    case "check-square":
      return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m7.5 12 3 3 6-6" /></svg>;
    case "search":
      return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>;
    case "bot":
      return <svg {...common}><rect x="4" y="6.5" width="16" height="13" rx="3" /><path d="M12 3.5v3M8 12h.01M16 12h.01M8 16h8" /></svg>;
    case "bell":
      return <svg {...common}><path d="M18 9.5a6 6 0 0 0-12 0c0 7-3 7-3 8.5h18c0-1.5-3-1.5-3-8.5ZM10 21h4" /></svg>;
    case "check":
      return <svg {...common}><path d="m4 12 5 5L20 6" /></svg>;
    case "arrow":
      return <svg {...common}><path d="M5 19 19 5M8 5h11v11" /></svg>;
    case "arrow-up":
      return <svg {...common}><path d="M12 19V5M6 11l6-6 6 6" /></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "alert":
      return <svg {...common}><path d="M12 3 2.8 19a1.4 1.4 0 0 0 1.2 2h16a1.4 1.4 0 0 0 1.2-2L12 3Z" /><path d="M12 9v4M12 17h.01" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></svg>;
    case "x":
      return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case "chevron-down":
      return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>;
    case "more":
      return <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></svg>;
    case "database":
      return <svg {...common}><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" /></svg>;
    case "lock":
      return <svg {...common}><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
    case "user-plus":
      return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 20c.6-3.1 2.6-5 6-5s5.4 1.9 6 5M19 8v6M16 11h6" /></svg>;
    case "activity":
      return <svg {...common}><path d="M3 12h4l2.2-6 4.2 12 2.1-6H21" /></svg>;
    case "rocket":
      return <svg {...common}><path d="M14.5 4.2c2.3-.7 4-.7 5.3-.5.2 1.3.2 3-.5 5.3l-5.5 5.5-4.8-4.8 5.5-5.5Z" /><path d="m9 10-4 1-2 4 5-1M14 15l-1 4-4 2 1-5" /><circle cx="15.5" cy="8.5" r="1" /></svg>;
    case "hash":
      return <svg {...common}><path d="M10 3 8 21M16 3l-2 18M4 9h17M3 15h17" /></svg>;
  }
}

function actorById(room: EngineeringRoom, actorId: string): Actor | undefined {
  return room.actors.find((actor) => actor.id === actorId);
}

function StatusPill({ label, tone }: { label: string; tone: "lime" | "amber" | "slate" | "cyan" | "coral" }) {
  return <span className={`status-pill status-pill-${tone}`}><i aria-hidden="true" />{label}</span>;
}

function Avatar({ label, tone = "cyan" }: { label: string; tone?: Actor["accent"] }) {
  return <span className={`avatar avatar-${tone}`} aria-hidden="true">{label.slice(0, 2).toUpperCase()}</span>;
}

function ActorBadge({ actor }: { actor: Actor | undefined }) {
  if (!actor) return <span className="actor-badge">ไม่ทราบ actor</span>;
  return <span className={`actor-badge actor-badge-${actor.type}`}><span className={`mini-orb orb-${actor.accent}`}>{actor.type === "agent" ? <Icon name="bot" size={11} /> : actor.name.slice(0, 1)}</span>{actor.name}</span>;
}

function kindLabel(item: WorkItem) {
  if (item.kind === "pull_request") return "PULL REQUEST";
  if (item.kind === "deployment") return "DEPLOYMENT";
  return "WORK ITEM";
}

function WorkItemRow({ item, room }: { item: WorkItem; room: EngineeringRoom }) {
  const statusLabel = item.status.replace("_", " ");
  const iconName: IconName = item.kind === "pull_request" ? "arrow" : item.kind === "deployment" ? "rocket" : "hash";
  return <article className="work-item-row"><div className={`work-icon work-icon-${item.kind}`}><Icon name={iconName} size={15} /></div><div className="work-item-copy"><div className="work-item-meta"><span>{kindLabel(item)}</span><strong>{item.externalKey}</strong></div><h3>{item.title}</h3><ActorBadge actor={actorById(room, item.ownerId)} /><Citations citations={item.citations} /></div><StatusPill label={statusLabel} tone={item.status === "review" ? "amber" : item.status === "ready" ? "cyan" : "lime"} /></article>;
}

function DecisionTaskRow({ task, room }: { task: DecisionTask; room: EngineeringRoom }) {
  return <div className="decision-task-row"><span className={`task-check task-check-${task.status}`} aria-hidden="true">{task.status === "proposed" ? null : <Icon name="check" size={11} />}</span><div className="decision-task-copy"><strong>{task.title}</strong><small>{task.status} · verification: {task.verification?.status ?? "pending"}</small><Citations citations={task.citations} /><span>{task.externalKey} · depends on {task.dependsOn.join(", ")}</span></div><ActorBadge actor={actorById(room, task.ownerId)} /></div>;
}

function ActivityRow({ event, room }: { event: ActivityEvent; room: EngineeringRoom }) {
  return <div className="activity-row"><span className={`activity-marker activity-marker-${event.kind}`} aria-hidden="true" /><div><p>{event.text}</p><Citations citations={event.citations} /><span><ActorBadge actor={actorById(room, event.actorId)} /> <time>{event.at}</time></span></div></div>;
}

function SignalStrip({ room, incidentMode }: { room: EngineeringRoom; incidentMode: boolean }) {
  return <div className="signal-strip" aria-label="สรุปสถานะ workspace"><div className="signal-item"><span className="signal-value">4</span><span className="signal-label">rooms live</span></div><div className="signal-item"><span className="signal-value is-lime">{room.actors.filter((actor) => actor.status !== "away").length}</span><span className="signal-label">actors online</span></div><div className="signal-item"><span className="signal-value is-warm">{room.decision.tasks.length}</span><span className="signal-label">tasks from meeting</span></div><div className="signal-item"><span className={`signal-value ${incidentMode ? "is-alert" : "is-lime"}`}>{incidentMode ? "1" : "0"}</span><span className="signal-label">active incidents</span></div></div>;
}

function ExecutionTerrain({ room, incidentMode, onRoom, onToggleWarRoom }: { room: EngineeringRoom; incidentMode: boolean; onRoom: (label: string) => void; onToggleWarRoom: () => void }) {
  return <section className={`panel terrain-panel ${incidentMode ? "is-alert" : ""}`} aria-labelledby="terrain-title"><div className="panel-header"><div><h2 id="terrain-title">Execution terrain</h2><p>{incidentMode ? "state transition · war room engaged" : "live relationship map · NORTHSTAR"}</p></div><span className="panel-meta">SIMULATED TERRAIN</span></div><div className="terrain"><svg className="terrain-lines" viewBox="0 0 1000 500" preserveAspectRatio="none" role="img" aria-label="เส้นทางการส่งต่องานระหว่างห้อง"><path className={`flow-line ${incidentMode ? "path-alert" : ""}`} d="M164 145 C275 130 307 184 405 222 S565 296 690 152" /><path className={`flow-line delay ${incidentMode ? "path-alert" : ""}`} d="M206 363 C292 320 327 255 409 226 S566 198 710 356" /><path className="flow-line slow" d="M410 226 C470 178 530 178 590 226 S705 292 803 348" /><path className="flow-line delay" d="M409 226 C462 274 519 300 590 276 S708 215 811 153" /><circle cx="405" cy="222" r="4" /><circle cx="690" cy="152" r="3" className={incidentMode ? "alert" : ""} /><circle cx="710" cy="356" r="3" className={incidentMode ? "alert" : ""} /></svg><div className="terrain-label">ROOMS / ACTIVE WORK / ACTORS</div><div className="terrain-legend" aria-label="คำอธิบายสถานะ"><span className="legend-item"><span className="legend-marker" />healthy</span><span className="legend-item"><span className="legend-marker warm" />review</span><span className="legend-item"><span className="legend-marker alert" />incident</span></div>{incidentMode ? <div className="terrain-alert"><Icon name="alert" size={12} />INCIDENT #2041 / INVESTIGATION ACTIVE</div> : null}<button className="terrain-node node-product" type="button" onClick={() => onRoom("Product room")}><span className="node-orb warm" /><span className="node-copy"><strong>Product room</strong><small>2 people · 1 agent</small></span></button><button className="terrain-node node-engineering is-selected" type="button" onClick={() => onRoom("Engineering room")}><span className="node-orb" /><span className="node-copy"><strong>Engineering room</strong><small>3 people · 2 agents</small></span></button><button className={`terrain-node node-war ${incidentMode ? "is-incident" : ""}`} type="button" onClick={onToggleWarRoom}><span className="node-orb alert" /><span className="node-copy"><strong>War room</strong><small>{incidentMode ? "Incident #2041 · live" : "standby · 0 incidents"}</small></span></button><button className="terrain-node node-release" type="button" onClick={() => onRoom("Release train")}><span className="node-orb sky" /><span className="node-copy"><strong>Release train</strong><small>v0.9.4 · Thursday</small></span></button><article className={`focus-card ${incidentMode ? "is-incident" : ""}`} aria-label="งานที่กำลังโฟกัส"><div className="focus-card-top"><span className="focus-card-code">{incidentMode ? "INC-2041" : "PAY-142"}</span><StatusPill label={incidentMode ? "investigating" : "in progress"} tone={incidentMode ? "coral" : "lime"} /></div><h3>{incidentMode ? "Checkout webhook latency spike" : "Checkout v2 / payment flow"}</h3><p className="focus-card-copy">{incidentMode ? "SENTRY detected p95 latency above threshold. The room is gathering evidence before any rollback." : "Event-driven payment flow is ready for staging. QA Agent is waiting for the decision owner to confirm the handoff."}</p><div className="focus-card-foot"><div className="avatar-stack"><Avatar label="BK" tone="cyan" /><Avatar label={incidentMode ? "S" : "QA"} tone={incidentMode ? "amber" : "violet"} /><Avatar label="F" tone="lime" /></div><span className="focus-card-foot-copy">{incidentMode ? "SENTRY + Book + FORGE\ntracking now" : "Book + QA Agent + FORGE\nupdated 4m ago"}</span></div></article></div></section>;
}

function DecisionStream({ room, onViewDecisions }: { room: EngineeringRoom; onViewDecisions: () => void }) {
  const decisionRows = [{ id: room.decision.id, title: room.decision.title, context: room.decision.source.label, owner: "Book", tone: "cyan" as const, age: room.decision.status }];
  return <section className="panel decision-stream" aria-labelledby="decision-stream-title"><div className="panel-header"><div><h2 id="decision-stream-title">Decision stream</h2><p>cited decision context</p></div><button className="panel-link" type="button" onClick={onViewDecisions}>ดูทั้งหมด <Icon name="arrow" size={13} /></button></div><div className="decision-list">{decisionRows.map((decision) => <div className="decision-row" key={decision.id}><span className="decision-code">{decision.id}</span><span className="decision-copy"><strong>{decision.title}</strong><small>{decision.context}</small><Citations citations={room.decision.citations} /></span><span className="decision-owner"><Avatar label={decision.owner} tone={decision.tone} /><span>{decision.age}</span></span></div>)}</div></section>;
}

function MemoryBridge({ onOpen }: { onOpen: () => void }) {
  return <section className="panel memory-bridge" aria-labelledby="memory-bridge-title"><h2 id="memory-bridge-title">ถาม workspace ว่า <em>“ทำไม?”</em></h2><p>คำตอบที่ดีต้องพากลับไปหา decision, source และเหตุผล ไม่ใช่สร้างคำตอบใหม่จากความจำลอย ๆ</p><div className="memory-quote"><small>RECENT MEMORY</small><strong>ทำไมเราใช้ PostgreSQL สำหรับ Payment Ledger?</strong><span>ADR-018 · 3 reasons · 2 rejected options</span></div><button className="button button-quiet" type="button" onClick={onOpen}>ค้นหาใน memory <Icon name="arrow" size={14} /></button></section>;
}

function ContextRail({ room, incidentMode, onCaptureDecision, onResolveIncident }: { room: EngineeringRoom; incidentMode: boolean; onCaptureDecision: () => void; onResolveIncident: () => void }) {
  const agents = room.actors.filter((actor) => actor.type === "agent");
  return <aside className="context-rail" aria-label="บริบทของ workspace"><section className="panel rail-panel" aria-labelledby="agent-citizens-title"><div className="panel-header"><div><h2 id="agent-citizens-title">Agent citizens</h2><p>identity · capability · state</p></div><span className="panel-link">{agents.length} ตัว <Icon name="arrow" size={12} /></span></div><ul className="agent-list">{agents.map((agent) => <li className="agent-row" key={agent.id}><Avatar label={agent.name} tone={agent.accent} /><span className="agent-row-copy"><strong>{agent.name}</strong><small>{agent.role}</small></span><span className={`agent-state is-${incidentMode && agent.name === "Incident Agent" ? "alert" : agent.status === "observing" ? "active" : "warm"}`}><span className="legend-marker" />{incidentMode && agent.name === "Incident Agent" ? "Investigating" : agent.status === "observing" ? "Listening" : "Waiting"}</span></li>)}</ul></section><section className="panel rail-panel" aria-labelledby="handoff-title"><div className="panel-header"><div><h2 id="handoff-title">Next handoff</h2><p>from signal to action</p></div></div><div className="handoff-list"><div className="handoff-row is-current"><span className="handoff-index">1</span><span><strong>{incidentMode ? "Collect incident evidence" : "Confirm decision owner"}</strong><small>{incidentMode ? "SENTRY · logs + traces" : "Book · PAY-142"}</small></span></div><div className="handoff-row"><span className="handoff-index">2</span><span><strong>{incidentMode ? "Propose rollback or fix" : "Verify on staging"}</strong><small>{incidentMode ? "Book · approval required" : "QA Agent · blocked"}</small></span></div><div className="handoff-row"><span className="handoff-index">3</span><span><strong>{incidentMode ? "Write postmortem" : "Update release train"}</strong><small>{incidentMode ? "NOVA · after resolve" : "FORGE · Thursday"}</small></span></div></div></section>{incidentMode ? <section className="panel incident-panel" aria-labelledby="incident-title"><div className="panel-header"><div><h2 id="incident-title">Live incident</h2><p>auto-created war room</p></div><span className="panel-meta">now</span></div><div className="incident-body"><div className="incident-title"><Icon name="alert" size={15} /><span>Webhook latency above threshold</span></div><p>Environment changed because the system needs a shared decision. No deployment or rollback has been executed.</p><div className="incident-actions"><button className="button button-warm" type="button" onClick={onResolveIncident}>mark resolved</button><button className="button button-quiet" type="button" onClick={onCaptureDecision}>capture decision</button></div></div></section> : null}</aside>;
}

function WorkspaceView({ room, view, incidentMode, onRoom, onToggleWarRoom, onCaptureDecision, onResolveIncident, onViewDecisions, onOpenMemory, onApprove }: { onApprove: () => void; room: EngineeringRoom; view: "overview" | "spatial" | "graph"; incidentMode: boolean; onRoom: (label: string) => void; onToggleWarRoom: () => void; onCaptureDecision: () => void; onResolveIncident: () => void; onViewDecisions: () => void; onOpenMemory: () => void }) {
  return <><SignalStrip room={room} incidentMode={incidentMode} /><div className="space-layout"><div><ExecutionTerrain room={room} incidentMode={incidentMode} onRoom={onRoom} onToggleWarRoom={onToggleWarRoom} /><div className="ledger-grid"><DecisionStream room={room} onViewDecisions={onViewDecisions} /><MemoryBridge onOpen={onOpenMemory} /></div></div><ContextRail room={room} incidentMode={incidentMode} onCaptureDecision={onCaptureDecision} onResolveIncident={onResolveIncident} /></div><nav className="view-tabs" aria-label="มุมมอง workspace"><button className={view === "overview" ? "view-tab view-tab-active" : "view-tab"} onClick={() => onRoom("Execution overview")} type="button">Execution overview</button><button className={view === "spatial" ? "view-tab view-tab-active" : "view-tab"} onClick={() => onRoom("Spatial room")} type="button">Spatial room</button><button className={view === "graph" ? "view-tab view-tab-active" : "view-tab"} onClick={() => onRoom("Organization graph")} type="button">Organization graph</button><span className="view-tab-note">same data · different interface</span></nav>{view === "spatial" ? <SpatialView room={room} /> : view === "graph" ? <GraphView room={room} /> : <div className="execution-grid"><section className="decision-card panel"><div className="panel-heading"><div><span className="eyebrow">MEETING → DECISION</span><h2>{room.decision.title}</h2></div><StatusPill label={room.decision.status !== "proposed" ? "approved_for_sync" : "needs approval"} tone={room.decision.status !== "proposed" ? "lime" : "amber"} /></div><div className="decision-source"><span className="source-icon"><Icon name="activity" size={15} /></span><div><small>SOURCE MEETING</small><strong>{room.decision.source.label}</strong></div><span className="source-time">{room.decision.proposedAt}</span></div><p className="decision-context">{room.decision.context}</p><Citations citations={room.decision.citations} /><div className="decision-divider"><span>PROPOSED ACTIONS</span><span>{room.decision.tasks.length} tasks · {room.decision.dependencies.length} dependencies</span></div><div className="decision-tasks">{room.decision.tasks.map((task) => <DecisionTaskRow key={task.id} task={task} room={room} />)}</div><ApprovalBar room={room} onApprove={onApprove} /></section><section className="work-panel panel"><div className="panel-heading"><div><span className="eyebrow">LIVE WORK</span><h2>What the room knows</h2></div><span className="panel-link">view all <Icon name="arrow" size={13} /></span></div><div className="work-list">{room.workItems.map((item) => <WorkItemRow key={item.id} item={item} room={room} />)}</div></section><section className="activity-panel panel"><div className="panel-heading"><div><span className="eyebrow">ACTIVITY STREAM</span><h2>Recent observations</h2></div><span className="quiet-label">cited activity feed</span></div><div className="activity-list">{room.activity.slice(0, 4).map((event) => <ActivityRow key={event.id} event={event} room={room} />)}</div></section><AgentBoundary room={room} /></div>}</>;
}

function ApprovalBar({ room, onApprove }: { room: EngineeringRoom; onApprove: (() => void) | undefined }) {
  const approve = onApprove;
  return <div className="approval-bar"><div><span className="approval-lock"><Icon name="lock" size={14} /></span><div><strong>Human approval required</strong><small>Agent เสนอได้ แต่ external sync ต้องผ่านคำสั่งที่อนุมัติแล้ว</small></div></div><button className="approve-button" disabled={!room.approvalAvailable || !approve || room.decision.status !== "proposed"} onClick={approve} type="button">{room.decision.status !== "proposed" ? "Approved for sync" : room.mode === "fixture" ? "Simulate approval" : room.approvalAvailable ? "Approve decision" : "Owner approval required"}</button></div>;
}

function AgentBoundary({ room }: { room: EngineeringRoom }) {
  const agent = actorById(room, "agent-engineering");
  return <section className="agent-panel panel"><div className="agent-panel-head"><div className="agent-identity"><span className="agent-orb"><Icon name="bot" size={16} /></span><div><span className="eyebrow">AI CITIZEN</span><h2>Engineering Agent</h2></div></div><StatusPill label="observing" tone="lime" /></div><p>Agent identity อยู่ใน workspace graph เดียวกับคน งานของมันคือ observe, remember และ propose bounded actions</p><div className="agent-capabilities">{(agent?.capabilities ?? []).map((capability) => <span key={capability}>{capability}</span>)}</div><div className="agent-boundary"><span><Icon name="lock" size={15} /></span><div><strong>Permission boundary</strong><small>read GitHub fixture · propose tasks · no external write</small></div></div></section>;
}

function MemoryView({ room }: { room: EngineeringRoom }) {
  const [query, setQuery] = useState("");
  const records = [{ source: room.decision.id, title: room.decision.title, body: room.decision.context, meta: room.decision.source.label },
    ...room.workItems.map((item) => ({ source: item.id, title: item.title, body: item.citations?.map((citation) => citation.excerpt).join(" · ") ?? "ไม่มีหลักฐานเพิ่มเติม", meta: item.externalKey }))];
  const filtered = query.trim() ? records.filter((record) => `${record.title} ${record.body} ${record.source}`.toLowerCase().includes(query.toLowerCase())) : records;
  return <section className="section-page" aria-labelledby="memory-title"><div className="page-intro"><div><h1 id="memory-title">Organizational memory <em>ที่มีหลักฐาน</em></h1><p>ค้นหาเหตุผลเบื้องหลัง decision โดย trace กลับไปหา source ที่ทีมตรวจสอบได้</p></div><div className="page-intro-meta"><span className="pulse-dot" />{records.length} cited records</div></div><div className="panel search-panel"><Icon name="search" size={17} /><label className="sr-only" htmlFor="memory-search">ค้นหา memory</label><input id="memory-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="เช่น PostgreSQL, webhook, Checkout..." /><button className="button" type="button" onClick={() => setQuery(query.trim())}>ค้นหา</button></div><section className="panel memory-results" aria-live="polite"><div className="panel-header"><div><h2>Source-linked results</h2><p>{query ? `${filtered.length} results for “${query}”` : "เรียงตาม relevance และความใหม่"}</p></div><span className="panel-meta">MEMORY / V1</span></div>{filtered.length ? filtered.map((record) => <article className="memory-result" key={record.source}><span className="memory-result-source">{record.source}</span><div><h3>{record.title}</h3><p>{record.body}</p></div><span className="memory-result-meta">{record.meta}</span></article>) : <div className="empty-state"><strong>ยังไม่พบ memory นี้</strong><p>ลองใช้คำว่า PostgreSQL, Checkout หรือ webhook</p></div>}</section></section>;
}

function AgentFleetView({ room, onDecision }: { room: EngineeringRoom; onDecision: () => void }) {
  return <section className="section-page" aria-labelledby="agents-title"><div className="page-intro"><div><h1 id="agents-title">Agent fleet <em>ที่ทีมมองเห็นได้</em></h1><p>AI citizen แต่ละตัวต้องมี identity, capability, state และขอบเขตการกระทำที่ชัดเจน</p></div><div className="page-intro-meta"><span className="pulse-dot" />{room.actors.filter((actor) => actor.type === "agent").length} agents online</div></div><section className="panel agent-fleet" aria-label="รายชื่อ agents"><div className="panel-header"><div><h2>Active agents</h2><p>same workspace, different authority</p></div><span className="panel-meta">SIMULATED ACTORS</span></div>{room.actors.filter((actor) => actor.type === "agent").map((agent) => <div className="fleet-row" key={agent.id}><span className="fleet-identity"><Avatar label={agent.name} tone={agent.accent} /><span><strong>{agent.name}</strong><small>{agent.role}</small></span></span><span className="fleet-capability">{agent.id === "agent-engineering" ? "สกัด signal และเสนอ decision/task ที่มี source" : "เฝ้าดูงานในขอบเขตที่ได้รับอนุญาต"}</span><span className={`agent-state is-${agent.status === "observing" ? "active" : "warm"}`}><span className="legend-marker" />{agent.status === "observing" ? "Observing" : "Ready"}</span><span className="fleet-last">sample actor state</span></div>)}</section><section className="panel memory-bridge"><h2>Agent action ต้องเริ่มจาก <em>proposal</em></h2><p>รอบแรกให้ agent observe, remember, reason และ report ก่อน เมื่อมี approval record แล้วจึงค่อยเพิ่ม act ใน integration ที่จำเป็น</p><button className="button button-quiet" type="button" onClick={onDecision}>เปิด approval-shaped decision <Icon name="arrow" size={14} /></button></section></section>;
}

function DecisionLedger({ room, onApprove }: { room: EngineeringRoom; onApprove: () => void }) {
  return <section className="section-page" aria-labelledby="decisions-title"><div className="page-intro"><div><h1 id="decisions-title">Decision ledger <em>ที่ย้อนกลับได้</em></h1><p>สิ่งที่ทีมตกลงต้องมี owner, source และ next task อยู่ใน record เดียวกัน</p></div><StatusPill label={room.decision.status !== "proposed" ? "approved_for_sync" : "awaiting approval"} tone={room.decision.status !== "proposed" ? "lime" : "amber"} /></div><section className="panel full-list" aria-label="รายการ decisions"><div className="panel-header"><div><h2>{room.decision.title}</h2><p>{room.decision.source.label} · {room.decision.tasks.length} proposed tasks</p></div><button className="button button-primary" disabled={!room.approvalAvailable || room.decision.status !== "proposed"} type="button" onClick={onApprove}>{room.decision.status !== "proposed" ? "Approved for sync" : room.mode === "fixture" ? "Simulate approval" : room.approvalAvailable ? "Approve decision" : "Owner approval required"}</button></div><div className="decision-ledger-detail"><div className="decision-source"><span className="source-icon"><Icon name="activity" size={15} /></span><div><small>SOURCE MEETING</small><strong>{room.decision.source.label}</strong></div><span className="source-time">{room.decision.proposedAt}</span></div><p className="decision-context">{room.decision.context}</p><Citations citations={room.decision.citations} />{room.decision.tasks.map((task) => <DecisionTaskRow key={task.id} task={task} room={room} />)}</div></section><section className="panel memory-bridge"><h2>Decision ไม่ใช่บทสรุปของ meeting แต่คือ <em>จุดเริ่มของ execution</em></h2><p>ทุก record ที่อนุมัติแล้วควรสร้างงานที่ติดตามได้ และทุกงานควรย้อนกลับมาหาเหตุผลที่ทำให้เกิดขึ้น</p></section></section>;
}

export function RoomShell({ initialRoom }: { initialRoom: EngineeringRoom }) {
  const [room, setRoom] = useState(initialRoom);
  const [view, setView] = useState<View>("overview");
  const [incidentMode, setIncidentMode] = useState(false);
  const [approvalState, setApprovalState] = useState<"idle" | "pending" | "approved" | "error">("idle");
  const [approvalMessage, setApprovalMessage] = useState("");
  const [notice, setNotice] = useState("");

  function announce(message: string) { setNotice(message); }

  async function handleApprove() {
    if (approvalState === "pending" || !room.approvalAvailable) return;
    setApprovalState("pending");
    setApprovalMessage("กำลังตรวจสอบคำขออนุมัติ...");
    try {
      const response = await fetch("/api/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve", decisionId: room.decision.id, approvalNote: "Approved in the local demo" }) });
      const payload = (await response.json()) as Partial<ApprovalResponse> & { error?: string };
      if (!response.ok || !payload.decision || !payload.workspace) throw new Error(payload.error ?? "approval_failed");
      setRoom(payload.workspace as EngineeringRoom);
      setApprovalState("approved");
      setApprovalMessage(room.mode === "fixture" ? "อนุมัติแบบจำลองแล้ว · ไม่บันทึกถาวร และจะรีเซ็ตเมื่อ refresh · external write ปิดอยู่" : "บันทึกการอนุมัติของคุณแล้ว · external write ยังคงปิดอยู่");
      announce("Decision approved · 3 task proposals พร้อมสำหรับ sync ภายหลัง");
    } catch (error) {
      const message = error instanceof Error ? error.message : "approval_failed";
      setApprovalState("error");
      setApprovalMessage(`อนุมัติไม่สำเร็จ · ${message}`);
      announce("Approval ล้มเหลว · ตรวจสอบ API แล้วลองอีกครั้ง");
    }
  }

  function toggleWarRoom() { const next = !incidentMode; setIncidentMode(next); setView("overview"); announce(next ? "เปิด War room แล้ว · SENTRY กำลังรวบรวมหลักฐาน" : "กลับสู่ normal flow แล้ว"); }
  function openDecision() { setView("decisions"); announce("เปิด Decision ledger แล้ว · approval ยังคงต้องมาจากมนุษย์"); }
  function openMemory() { setView("memory"); announce("เปิด Organizational memory แล้ว · ทุกผลลัพธ์ต้องมี source"); }
  function openAgents() { setView("agents"); announce("เปิด Agent fleet แล้ว · แสดง authority ของแต่ละ actor"); }
  function selectRoom(label: string) { if (label === "Organization graph") setView("graph"); else if (label === "Spatial room") setView("spatial"); else if (label === "Execution overview") setView("overview"); else announce(`${label} · shared context พร้อมแล้ว`); }
  function resolveIncident() { setIncidentMode(false); announce("Incident ถูก mark resolved · postmortem เป็น next task"); }

  const workspaceView = view === "overview" || view === "spatial" || view === "graph";
  const displayedRoom = { ...room, approvalAvailable: room.approvalAvailable && approvalState !== "pending" };

  return <div className="app-frame"><aside className="sidebar" aria-label="เมนูหลัก"><div className="brand-block"><button className="brand" type="button" onClick={() => { setView("overview"); setIncidentMode(false); }} aria-label="NODAL หน้าหลัก"><span className="brand-mark">N</span><span><strong>NODAL</strong><small>WORK / SIGNAL / MEMORY</small></span></button><button className="workspace-switcher" type="button" onClick={() => announce("Pilot นี้มี workspace เดียว")} aria-label="เปลี่ยน workspace"><span className="workspace-avatar">N</span><span className="workspace-switcher-copy"><strong>{room.organization.name}</strong><small>Product engineering</small></span><span className="chevron"><Icon name="chevron-down" size={15} /></span></button></div><div className="nav-section-label">WORKSPACE</div><nav className="primary-nav" aria-label="พื้นที่ทำงาน"><button className={`nav-item ${workspaceView && !incidentMode ? "is-active" : ""}`} type="button" onClick={() => { setView("overview"); setIncidentMode(false); }} aria-current={workspaceView && !incidentMode ? "page" : undefined}><span className="nav-icon"><Icon name="terrain" /></span><span>Space</span><span className="nav-count">4</span></button><button className={`nav-item ${view === "decisions" ? "is-active" : ""}`} type="button" onClick={openDecision} aria-current={view === "decisions" ? "page" : undefined}><span className="nav-icon"><Icon name="check-square" /></span><span>Decisions</span><span className="nav-count is-warm">{room.decision.tasks.length}</span></button><button className={`nav-item ${view === "memory" ? "is-active" : ""}`} type="button" onClick={openMemory} aria-current={view === "memory" ? "page" : undefined}><span className="nav-icon"><Icon name="search" /></span><span>Memory</span></button><button className={`nav-item ${view === "agents" ? "is-active" : ""}`} type="button" onClick={openAgents} aria-current={view === "agents" ? "page" : undefined}><span className="nav-icon"><Icon name="bot" /></span><span>Agent fleet</span><span className="nav-count is-live">{room.actors.filter((actor) => actor.type === "agent").length}</span></button></nav><div className="nav-section-label nav-section-label-spaced">SOURCE FIXTURES</div><div className="source-list" aria-label="แหล่งข้อมูลจำลอง">{room.integrations.map((source) => <div className="source-item" key={source.provider}><span className="source-mark"><Icon name="database" size={14} /></span><span>{source.provider} · fixture</span></div>)}</div><div className="sidebar-footer"><div className="sync-line"><span className={`pulse-dot ${incidentMode ? "is-alert" : ""}`} /><span>manual local imports only</span></div><button className="profile-button" type="button" onClick={() => announce("Book · Owner · local fixture")} aria-label="เปิดโปรไฟล์ Book"><Avatar label="BK" tone="cyan" /><span><strong>Book</strong><small>Owner</small></span><span className="more-icon"><Icon name="more" size={17} /></span></button></div></aside><div className="main-shell"><header className="topbar"><div className="breadcrumb"><span className="breadcrumb-root">{room.organization.name}</span><span className="breadcrumb-separator">/</span><span>Product engineering</span></div><div className="topbar-actions"><span className={`system-state ${incidentMode ? "is-alert" : ""}`}><span className="pulse-dot" />{incidentMode ? "Incident active" : "Simulated system signals"}</span><button className="topbar-button" type="button" onClick={openMemory} aria-label="เปิด Organizational memory"><Icon name="search" size={15} /><span className="search-label">ค้นหา</span><kbd>CMD K</kbd></button><button className="topbar-button icon-button" type="button" onClick={() => announce("ไม่มี notification ใหม่ที่ต้องตัดสินใจ")} aria-label="เปิด notifications"><Icon name="bell" size={16} /><span className="notification-dot" /></button></div></header><main className="content" tabIndex={-1}><PilotStatus room={room} />{view === "memory" ? <MemoryView room={displayedRoom} /> : view === "agents" ? <AgentFleetView room={displayedRoom} onDecision={openDecision} /> : view === "decisions" ? <DecisionLedger room={displayedRoom} onApprove={handleApprove} /> : <><section className="page-intro" aria-labelledby="space-title"><div><h1 id="space-title">งานกำลังไหลต่อ <em>โดยไม่หลุดบริบท</em></h1><p>พื้นที่เดียวสำหรับเห็นว่าใครกำลังทำอะไร, agent ไหนกำลังรอ และ decision ใดต้องปิดวันนี้</p></div><div><div className="heading-actions"><button className="button button-quiet" type="button" onClick={() => announce("Invite flow จะเปิดใน hosted slice หลังมี identity provider")}><Icon name="user-plus" size={15} />ชวน actor</button><button className={`button ${incidentMode ? "button-warm" : "button-primary"}`} type="button" onClick={toggleWarRoom}><Icon name={incidentMode ? "x" : "alert"} size={15} />{incidentMode ? "ปิด war room" : "เปิด war room"}</button></div><div className="page-intro-meta"><span className={`pulse-dot ${incidentMode ? "is-alert" : ""}`} />{incidentMode ? "incident mode · live" : "no live provider sync"}</div></div></section><WorkspaceView room={displayedRoom} view={view as "overview" | "spatial" | "graph"} incidentMode={incidentMode} onRoom={selectRoom} onToggleWarRoom={toggleWarRoom} onCaptureDecision={openDecision} onResolveIncident={resolveIncident} onViewDecisions={openDecision} onOpenMemory={openMemory} onApprove={handleApprove} /></>} {approvalMessage ? <div className={`approval-message approval-message-${approvalState}`} role="status"><span>{approvalMessage}</span></div> : null}<div className={`live-notice ${notice ? "is-visible" : ""}`} role="status" aria-live="polite">{notice}</div><footer className="page-footer"><span>NODAL / ORGANIZATION ENVIRONMENT</span><span>schema: {room.schemaVersion} · mode: {room.mode} · external writes: disabled</span></footer></main></div></div>;
}

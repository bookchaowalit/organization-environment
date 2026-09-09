# NODAL — product plan และ technical direction

## Product thesis

NODAL ไม่ใช่ “Gather ที่มี feature มากกว่า” แต่เป็นพื้นที่ปฏิบัติการที่ทำให้
คนและ AI เห็นบริบทเดียวกัน แล้วเปลี่ยนบทสนทนาให้เป็น execution ที่ตรวจสอบได้

**Wedge:** engineering/AI teams ขนาด 5–50 คน ที่สลับระหว่าง Slack/Zoom,
GitHub, Linear/Jira, docs และ observability ทุกวัน

## MVP vertical slice

```text
เข้า workspace → อ่าน signal → เปิด war room → capture decision → approve task
```

ต้องมี:

- Engineering Room ที่รวม production, deployment, work items, actors และ agents
- `Execution terrain` ที่แสดง rooms และ state transition โดยไม่ผูกกับ pixel art
- meeting → decision → task proposals พร้อม source, owner, dependency และ approval
- standard, spatial และ graph projections ที่อ่านจาก domain object เดียวกัน
- append-only activity feed และ organizational memory ที่ cite source ได้
- external writes ปิดไว้ใน local fixture; provider action เป็น simulation เท่านั้น

ขอบเขต V1 เดิม: ไม่สร้าง SFU/video เอง, auto-deploy/merge, auth จริง, billing,
AR/VR, mobile native และ vector database ที่ยังไม่มี evaluation corpus

## Roadmap

### Shared Office — current local pilot

The follow-up request expands the earlier V1 exclusion of auth/media:
NODAL now includes first-owner setup, invite-only membership, password/session
authentication, four shared rooms, click/keyboard positions, expiring presence,
durable room chat and optional LiveKit voice/video/screen-sharing controls.
The local launcher supports a loopback-only LiveKit Docker service with
generated private credentials. Standard/spatial/graph engineering projections
remain available behind member authentication; owners can persist approval.

Presence polls every two seconds. Calls require explicit join and start with
camera/mic off; changing rooms disconnects the old call. Remote call volume now
follows shared floor distance by default, with a per-call opt-out. This remains
a room-based pilot, not an avatar/map editor or server-enforced proximity SFU.
The following Pilot V1 section is the historical foundation; current setup
and remaining hosted-deployment gaps are documented in README.md.

### Pilot V1 — Persistent Engineering Signals (implemented locally)

- Drizzle/Postgres schema and tenant-scoped repository are implemented, with
  explicit ephemeral fixture fallback when DATABASE_URL is absent.
- GitHub/Linear adapters normalize local fixture metadata only; no provider
  calls, credentials, webhook endpoint or external write executor exists.
- Standard, spatial and graph views read the same canonical projection.
  UI/API distinguish connected-read-only Postgres from simulated sources.
- Source citations, last successful import, freshness and failed/stale states
  are implemented. Duplicate deliveries are transactionally idempotent.
- Human-approved decision/task transitions stop at approved_for_sync.
  Connected HTTP approval fails closed until authenticated human identity is
  available; fixture approval remains an explicitly ephemeral simulation.
- Verification remains pending; terrain, presence, incidents, meeting extraction
  and agent behavior remain simulated.
- Offline verification runs the same repository contract against memory and
  PGlite with real migrations. This does not establish live Neon readiness.

This completes the persistence foundation, not the real-team V1 rollout below.
The next smallest step is one local, synthetic-data team walkthrough on an
isolated Postgres database: import twice, refresh, and trace source → owner →
pending decision → verification. Authentication/membership and immutable source
archive must precede private team data or live read-only connector ingestion.

| ระยะ | ผลลัพธ์ | เกณฑ์ผ่าน |
|---|---|---|
| V0 | local vertical slice | ผู้ใช้เข้าใจ engineering state ใน 1 นาที |
| V1 | pilot กับ 1 team + GitHub/Linear read-only | 8/10 clear decisions กลายเป็น accepted task proposals ใน 3 นาที |
| V2 | bounded integrations + cited memory | ทุก external write มี approval + idempotency key |
| V3 | Meeting/Incident/Project Agents | agent proposal acceptance, latency และ cost วัดซ้ำได้ |
| V4 | org graph + durable workflows + enterprise controls | audit completeness และ tenant isolation ผ่าน |

## Production tech stack

- **Web:** Next.js App Router + React + TypeScript; server-first read models,
  client components สำหรับ realtime และ interactive controls
- **UI:** Tailwind/shadcn primitives หรือ local token system; spatial renderer
  แยกเป็น adapter ไม่ให้ renderer เป็น source of truth
- **Realtime media/presence:** LiveKit สำหรับ audio/video/data/presence
- **Operational DB:** Neon Postgres + Drizzle; relational entities + typed
  `entity_links` ก่อนตัดสินใจใช้ graph database
- **Memory:** PostgreSQL full-text search ก่อน แล้วค่อยเพิ่ม `pgvector` เมื่อ
  evaluation แสดงว่าการค้นหาแบบ semantic ชนะ keyword search
- **Durable source:** Cloudflare R2/S3-compatible object storage สำหรับ raw
  integration events, artifacts, transcripts และ Parquet manifests
- **Workflow:** Trigger.dev ใน next slice; Temporal เมื่อมี workflow ที่ต้อง
  resume/replay ข้ามวันหรือข้ามระบบจริง
- **AI:** Vercel AI SDK หลัง `ModelGateway`/Central AI Gateway พร้อม Zod schemas,
  allowlisted tools และ approval boundary
- **Identity:** OIDC/Clerk Organizations adapter; capability/tenant scopes อยู่
  ใน application DB ไม่ผูกกับ UI
- **Quality:** Vitest, Playwright, axe, contract fixtures และ evaluation set

## Canonical event model

```text
Room → Presence → Actor(human | agent | service)
Meeting → Decision → Commitment → Task
Task → Project / Service / PullRequest / Incident
Event → MemoryItem → SourceEntity → Citation
```

Event ต้อง versioned, idempotent และแยก `proposed`, `approved_for_sync`,
`synced` ออกจากกันเสมอ ตัว model มีสิทธิ์ propose; deterministic validator
และ permission check เป็นผู้ตัดสิน side effect

## Safety / rollout

- local fixture ไม่เก็บ credentials และไม่เรียก provider จริง
- external write ต้องมี human approval, least-privilege scope และ idempotency key
- raw source ถูก archive ก่อนกลายเป็น projection; transcript มี privacy class
  และ retention policy แยกจาก decision record
- ทุก agent run เก็บ model/latency/token metadata โดยไม่เก็บ raw prompt/response
- rollback คือหยุด run และ replay เฉพาะ event ที่ปลอดภัย ไม่ลบ source evidence

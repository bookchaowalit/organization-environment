# NODAL — Shared Office architecture

## Shared Office extension (current)

The follow-up office request adds /office, /engineering and /api/office/[action].
When DATABASE_URL or explicit local-office mode is enabled, authenticated
sessions are required for engineering reads and approval. Identity is resolved on the server, never from client actor/tenant fields.

Five additional tenant-scoped tables (18 total): office_members, office_sessions,
office_invites, office_presence and office_messages. Passwords use salted scrypt;
session/invitation values are random and only SHA-256 hashes are stored.
Sessions expire after eight hours; invitations are one-use and expire after
24 hours. Invitation claim/member/actor creation is transactional. Each member
maps to a human domain actor; only owners receive approval capability.
Mutation routes enforce Origin, bounded bodies and local rate limits.

Local office mode is explicit: PGlite persists to .nodal/office, applies
migrations at startup and requires one Node process. This is distinct from
the request-scoped V1 fixture. Postgres remains the hosted storage adapter.
Production owner setup is an explicit office:bootstrap command.

Rooms are tenant-scoped. Presence carries room/position/status, is refreshed
every two seconds, and expires after 30 seconds. Room chat is durable; the
snapshot returns at most 100 recent messages across the team's rooms.
All rooms are shared with the whole team; there is no private-room ACL.
The browser office client bounds each API request to eight seconds, validates
session/state/invite/media response shapes, treats a
malformed responses as unavailable, and keeps polling after a failed request
so the visible connection state can recover without a page refresh. This is a
single-client resilience boundary, not a durable queue or offline write cache.

LiveKit runs separately from Next.js. The media endpoint authenticates session
and current room presence before issuing a five-minute tenant/room-scoped join
token with no room-admin grants. Only explicitly joined calls connect, with
camera/mic initially off. Changing rooms unmounts and disconnects the call.
No recording, autonomous execution or provider write exists. When LiveKit is
enabled, the browser applies an explicit client-side proximity-volume curve to
remote audio using the latest tenant-scoped room coordinates; disabling that
control restores room-wide audio. The media server does not make engineering
decisions or receive external write authority.

office:media can run the pinned public LiveKit Docker image locally, binding
ports only to loopback and generating credentials outside Git. The explicit
`office:lan`/`office:media:lan` preview binds to the trusted local network and
requires `NODAL_MEDIA_HOST` so remote browsers receive a reachable WebSocket
URL; first-owner bootstrap is disabled by the LAN launcher and must happen on
loopback first. The HTTPS LAN launcher terminates TLS for the Next app and
LiveKit signaling, while the generated certificate remains a development
artifact that each pilot device must trust. The HTTPS proxy binds the same
explicit host as the launcher, so local mode remains loopback-only. The UI checks
`window.isSecureContext` before enabling device capture. Hosted WSS,
HTTPS, NAT/TURN and physical-device verification remain deployment work.
The sections below describe the canonical engineering repository and its relationship to the shared office.

## Runtime boundary

```text
Next.js server page / GET workspace
  → WorkspaceRepository (fixed server-side pilot tenant)
    → MemoryStore, request-scoped when DATABASE_URL is absent
    → PostgresStore via Drizzle + node-postgres when configured
  → EngineeringRoom projection
    → standard / spatial / graph
```

`EngineeringRoom` remains a versioned read model, never the persistence unit.
The page is dynamic and the API uses no-store. A configured database error is
an error, not a mode switch. The hosted app creates no schema or seed data during reads. Explicit local-office mode initializes its embedded database at startup.
Pool limits/timeouts are bounded and connection details are never returned.

## Schema

Canonical engineering tables: `organizations`, `rooms`, `actors`, `work_items`,
`meetings`, `decisions`, `tasks`, `activity_events`, `source_entities`,
`entity_links`, `sync_runs`, plus `entities` and `citations`.

Every row has `tenant_id`; entity primary keys are `(tenant_id, id)`.
Organizations use their own ID as tenant identity. Typed JSONB preserves domain
fields; generated relational columns expose task/decision state, owner,
meeting, decision and activity actor references without two writable copies.

Composite foreign keys enforce tenant-local entity registry, source citations,
links, owners, meeting → source, decision → meeting and task → decision.
State checks accept only `proposed | approved_for_sync | synced`; the application
permits only the first transition in V1. Registry IDs are unique within a tenant.
Citations retain source ID, label, optional validated URL and excerpt; the
citation table enforces source/entity membership. Payload citations are the
projection record; citation rows preserve their first captured excerpt.

Repository validation additionally checks all canonical references before
commit. Tenant identity is supplied to the repository by server composition,
not inferred from source text, JSON payloads or client-selected tenant headers.
The pilot currently serves one team, `org-solo-labs`, through authenticated office sessions. Multi-organization selection and database RLS remain future work.

## Atomicity and idempotency

Every mutation obtains a transaction-scoped Postgres advisory lock per tenant,
loads canonical tables, validates the next aggregate and commits atomically.
Reads use repeatable-read transactions. The memory implementation follows the
same contract and clones data so callers cannot mutate stored records.

Source identity is unique by `tenant + provider + externalId`.
Successful delivery identity is unique by `tenant + provider + eventId`.
Domain work IDs derive from provider/source entity identity, while activity IDs
derive from a SHA-256 of the provider/event tuple. Concurrent duplicate imports
produce one work item, source record, import event and sync run. Replays do not
advance last-successful time. Different events can update one work item; older
or equal source timestamps cannot overwrite a newer projection.

Invalid payloads record only a safe failure code in a separate failed run;
raw input and parser diagnostics are not retained. No domain import is partially
committed. Activity and sync rows are append-only through this repository.
Direct SQL administrator access is outside that audit guarantee.

For this bounded one-room pilot, writes upsert the aggregate's canonical tables.
There is no deletion API. Pagination, incremental SQL updates and a durable
ingestion queue remain scale-up work.

## Source adapters and health

`GitHubAdapter` and `LinearAdapter` implement typed parse/normalize contracts,
not network clients. Fixture schemas are bounded local metadata contracts, not
complete webhook formats. Unknown owner becomes an explicit unassigned service
actor; no human identity is guessed. External source URLs are HTTPS and host
allowlisted. Payload text stays data and cannot change capabilities.

Manual `db:import-fixtures` is the development import entrypoint. There is no
public webhook or unauthenticated import endpoint. All source records retain
`origin: local_fixture`, including when stored in Postgres.

Freshness is derived on read from last successful import and source timestamp;
either older than 30 minutes is stale. A newer failed run shows failed while
preserving the last successful import. No success means never imported.

## Approval and verification

A trusted internal human principal must match tenant and a human actor with
`approve` capability. Decision and proposed tasks move atomically to
`approved_for_sync` with a cited approval event. Repeat approval and agent,
missing, cross-tenant or unprivileged identities fail closed.

Connected HTTP approval requires a valid owner session mapped to a human actor. Missing identity and ordinary member approval fail closed. Same-origin fixture simulation still uses a fixed sample principal and says ephemeral/simulation.

No legal V1 command reaches `synced`. Verification is a separate pending
status with a future evidence reference. Source issue completion never implies
NODAL approval or verification. No external-write executor exists.

## Migration and production limits

`src/persistence/schema.ts` and generated `drizzle/` migrations are the source
of schema truth. `db:migrate` requires a direct `DATABASE_URL_UNPOOLED`;
runtime/seed/import use `DATABASE_URL`. Tests apply migrations in PGlite and
run the same repository contract as memory; hosted Neon/TLS is not exercised.

R2 archive, webhook authentication, durable workers, private-room authorization, RLS,
retention, consent, encrypted connector configuration, backup/restore,
pagination, monitoring and live verification ingestion are not implemented.
The unarchived import path is explicitly for synthetic fixtures. Real ingress
must land in an immutable archive before projection. Media is optional through LiveKit; search, billing and autonomous execution are not implemented.

# Pilot V1 implementation handoff

## Files changed in this implementation

The checkout already contained untracked application files. No commit, push,
reset or staging operation was performed.

| Area | Files |
|---|---|
| Domain | src/domain/types.ts, src/domain/commands.ts, src/domain/workspace.ts |
| Persistence | src/persistence/schema.ts, src/persistence/store.ts, src/persistence/postgres-store.ts, src/persistence/repository.ts, src/persistence/runtime.ts |
| Sources | src/adapters/sources.ts, src/adapters/fixtures/github.json, src/adapters/fixtures/linear.json |
| Schema tooling | drizzle.config.ts, scripts/database.ts, drizzle/0000_curvy_phalanx.sql, drizzle/0001_marvelous_cable.sql, drizzle/0002_lying_moonstone.sql, drizzle/meta/0000_snapshot.json, drizzle/meta/0001_snapshot.json, drizzle/meta/0002_snapshot.json, drizzle/meta/_journal.json |
| Server | app/page.tsx, app/api/workspace/route.ts, app/api/decisions/route.ts, src/server/approval.ts |
| UI | src/components/room-shell.tsx, src/components/source-status.tsx, src/components/graph-view.tsx, src/components/spatial-view.tsx, app/globals.css |
| Dependencies | package.json, pnpm-lock.yaml |
| Tests | tests/domain/commands.test.ts, tests/domain/persistence.test.ts |
| Documentation | README.md, PRODUCT-PLAN.md, docs/ARCHITECTURE.md, docs/AI-WORKFLOW.md, docs/PILOT-V1-HANDOFF.md |

## Schema and repository

13 Drizzle tables with tenant composite keys, generated reference columns,
composite foreign keys, state checks and unique source/delivery identities.
Canonical records are projected into EngineeringRoom; no room snapshot is
stored as the database unit. Per-tenant transaction locks serialize imports
and approvals. Memory and Postgres implement the same repository contract.

See [architecture](ARCHITECTURE.md) for design tradeoffs and
[README](../README.md) for explicit migrate/seed/import commands.

## Verification results

- pnpm typecheck: passed.
- pnpm test: 27 tests passed, including actual migrations in PGlite.
- pnpm build: passed; page and API routes remain dynamic.
- pnpm exec drizzle-kit check: passed.
- Production server started locally without DATABASE_URL.
- Browser: desktop 1440px and mobile 390px inspected; final mobile document
  width equals viewport width (390px). No browser errors reported.
- Browser: fixture approval reaches approved_for_sync; refresh restores proposed
  with the persistence warning visible. Source citation opens its source record.
  Spatial and graph switches work; graph renders 12 domain-derived nodes.
- The design detector found an existing layout-transition warning; the
  max-height/padding transition was removed, retaining opacity.

No live Neon database, provider API, external deployment or external write was
used. PostgreSQL testing used PGlite locally. The parent Solo Empire infra test
suites were not run because implementation is confined to this independent
product repository.

## Production gaps and smallest pilot

This is a persistence foundation with synthetic sources. Connected-mode HTTP
approval returns 403 until authenticated human identity exists. Reads are
currently local and unauthenticated; do not use private team data in a public
deployment. Live read-only ingestion, source archive, durable retries,
ownership mapping, verification evidence, role/RLS hardening, backups/restore
and load validation remain open.

Start with one team locally on an isolated database: import the two synthetic
source fixtures twice, refresh, and trace one meeting decision to an owner,
citation and pending verification task. Add authenticated membership before
bringing in real private team data. Keep external writes disabled.

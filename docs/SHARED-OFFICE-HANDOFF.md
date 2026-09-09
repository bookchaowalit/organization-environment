# Shared Office delivery

## Implemented

- Owner setup, invite-only membership, login/logout, hashed password/session/
  invitation storage, session expiration and same-origin mutation checks.
- Four shared rooms, click/keyboard movement, saved location, available/focus/
  away states, two-second polling and stale-presence expiry.
- Persistent room messages, visible to authenticated members of the same team.
- Optional LiveKit voice/video and screen-share controls; explicit join,
  mic/camera off by default, disconnect on room change.
- Client-side proximity audio based on the shared room coordinates, with an
  explicit room-wide override.
- Loopback local media launcher with generated private runtime configuration.
- Explicit LAN preview launchers (`office:lan`, `office:media:lan`) with a
  required advertised media host for cross-device calls.
- HTTPS LAN launchers (`office:lan:https`, `office:media:lan:https`) that use a
  generated or supplied certificate and proxy LiveKit signaling as WSS.
- Loopback-only owner bootstrap is enforced by the launcher; LAN mode cannot
  create the first owner. Room messages use a tenant/member request id so a
  retried request does not duplicate the message.
- Browser API calls abort after eight seconds, validate session/state/invite/
  media response shapes, and surface an offline state while polling retries.
  The E2E flow deliberately drops `/api/office/state`, serves wrong-shape JSON
  and HTML with HTTP 200, and verifies recovery to online.
- Protected engineering reads and persistent owner-only human approval.
- Original fixture demo retained when shared-office storage is not enabled.

## Main changed files

- src/office/: contracts, database runtime, service, HTTP controls and engineering identity bridge.
- src/persistence/schema.ts and drizzle/0004_silly_hulk.sql plus generated metadata.
- src/components/office-shell.tsx, office-call.tsx, room-shell.tsx and source-status.tsx.
- app/office/, app/office.css, app/engineering/, app/page.tsx.
- app/api/office/[action]/route.ts, app/api/workspace/route.ts and app/api/decisions/route.ts.
- src/server/approval.ts, scripts/office-dev.ts, scripts/office-bootstrap.ts and scripts/database.ts.
- tests/domain/office.test.ts, tests/e2e/office.spec.ts, playwright.config.ts.
- package.json, pnpm-lock.yaml, .gitignore, README.md, PRODUCT-PLAN.md, DESIGN.md,
  docs/ARCHITECTURE.md, docs/AI-WORKFLOW.md and this handoff.

The checkout's existing files were already untracked. No commit/push/staging
or unrelated repository reset was performed.

## Evidence

- pnpm typecheck: passed.
- pnpm test: 38 tests passed against real Drizzle migrations in local PGlite.
- pnpm build: passed.
- drizzle-kit check: passed.
- Playwright with a real local LiveKit Docker server: passed one complete
  two-browser workflow covering signup/invite, shared presence and chat, joining
  the same media room, fake mic/camera activation, refresh persistence,
  member-denied/owner-allowed engineering approval, and anonymous read rejection.
- Playwright HTTPS variant: passed the same two-browser workflow through the
  generated TLS proxy, including WSS LiveKit signaling.
- Playwright network-resilience check: passed a simulated state API failure and
  automatic online recovery before continuing through chat/media flows.
- Desktop/mobile screenshots inspected; no horizontal overflow at 390px.
- Design detector: no findings in the new office components/styles.

Browser tests use isolated .nodal/e2e-* databases and generated test credentials.
The user's default .nodal/office has no seeded test account. Startup media
configuration is private/ignored, never checked into Git. Test runs can emit
benign SDK first-run user-choice and terminal color warnings.

## Use and limits

Run pnpm office:media (Docker required) or pnpm office:dev without calls. For a
trusted local network, create the owner on loopback first, then use
`pnpm office:lan`; add `NODAL_MEDIA_HOST=<LAN-IP> pnpm office:media:lan` when
cross-device calls are needed.
Open /office and create the first owner. Share a generated invitation manually;
no invitation email or external message is sent by this implementation.

This is a local room-based office pilot, not full Gather parity. Internet
deployment, HTTPS/WSS/TURN, physical-device testing, map editing,
moderation/member removal, recovery/SSO and operational hardening remain.
The LAN call controls require HTTPS on the browser origin; plain HTTP LAN is
intentionally shown as media-unavailable. The generated certificate must be
trusted on each pilot device.
The README documents hosted configuration and explicit first-owner bootstrap.
External engineering writes remain disabled.

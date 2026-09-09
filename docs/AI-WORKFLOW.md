# NODAL — AI and approval contract

## Current Shared Office identity extension

The follow-up office request introduces authenticated human members and
optional LiveKit communication. An owner session resolves to its tenant and
human actor on the server; that actor may approve engineering proposals.
Ordinary members can read engineering context but lack approval capability.
Connected read and approval APIs reject missing/expired sessions.
Only the owner role carries the engineering approval capability.

Office media tokens only join a tenant-scoped communication room; they confer
no engineering action authority. Chat is human-authored data, not an instruction
channel to an agent. No meeting recording, automatic transcription, model call,
GitHub/Linear write, deploy, merge or rollback has been enabled.
LiveKit is now an optional human communication feature; autonomous agents,
vector search, billing and AR/VR remain outside this implementation.

## Implemented loop

```text
sample meeting source → cited proposed decision → proposed owned tasks
  → bounded human approval → approved_for_sync → verification pending
```

Meeting extraction and agent activity remain fixture-authored. No LLM is called.
GitHub/Linear local payloads normalize work items and cited observations; they
cannot create approval authority, approve decisions, execute tasks or mark
verification passed.

## Deterministic controls

- Strict Zod local input contracts, source IDs, tenant-scoped repositories and
  HTTPS source URL allowlists.
- Source/event idempotency inside a transaction; duplicate events never create
  additional domain entities or activity. Older source versions do not rewind work.
- Source citations retained on decisions, tasks, work items and activity.
- Separate `proposed`, `approved_for_sync`, `synced` states for decisions/tasks.
- Approval requires a trusted server-side human identity, tenant match, human
  actor type and approval capability. Agent capabilities never satisfy this.
- Decision/tasks and the approval event commit together. Repeated or invalid
  transitions fail closed. No transition to `synced` is enabled in V1.
- `externalWrite: "disabled"` always. No GitHub, Linear, deployment, merge or
  rollback executor is installed, even after approval.

Connected-mode HTTP approval requires an authenticated owner session. Request body or headers cannot select the human principal. The same-origin fixture button is a simulation with a fixed
sample human; its data resets on the next page load/API request.

## Source trust

Provider text is untrusted data. It does not become instructions, arbitrary
URLs to fetch or a new tool capability. Adapters have no HTTP client and accept
only bundled/synthetic local metadata. The repository records safe failed-run
codes without raw payloads, secrets or parser diagnostics.

All current source records say `origin: local_fixture`. The UI separately
shows database persistence and provider simulation, and displays source age,
last successful import and failed/stale state. Approval does not make stale
evidence fresh. Missing owner is visibly unassigned, never guessed.

## Future model policy (not implemented)

| Field | Planned limit |
|---|---|
| Input | consented meeting notes and bounded GitHub/Linear metadata |
| Context | maximum 12,000 input tokens; tenant and source IDs mandatory |
| Output | one cited Decision plus 0–10 task proposals |
| Model | balanced slot behind provider-neutral ModelGateway/Central AI Gateway |
| Generation | maximum 2,000 output tokens and three tool steps |
| Tools | read_room_context, read_work_items, propose_decision_tasks |
| Retry | source event ID plus workflow version |
| Telemetry | model/latency/token metadata; no raw prompts or answers |
| Language | Thai-first human-facing output via Central AI Gateway policy |
| Fallback | unknown/needs_review for missing evidence |
| Verification | explicit human-reviewed evidence, never inferred from approval |

Existing `evals/meeting-decision.v1.json` is a future evaluation fixture, not
proof of a working AI pipeline. Current executable tests cover normalization,
citations, isolation, duplicate/concurrent imports, state transitions, failure
rollback, freshness, origin checks and fail-closed identity.

## Before a real team pilot

Authenticated reads and invite-only membership now exist. Next archive consented
source events before projection, verify webhook signatures or use bounded
read-only fetches, map real owners, add durable replay and ingest verification
evidence. External writes remain disabled in that next pilot step.
LiveKit is available for human communication; autonomous agents, vector search, billing and AR/VR remain out of scope.

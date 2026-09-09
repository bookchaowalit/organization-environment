import { approveDecisionRequestSchema } from "../domain/commands";
import type { ApprovalPrincipal } from "../domain/commands";
import type { WorkspaceRepository } from "../persistence/repository";

export async function handleApproval(request: Request, repository: WorkspaceRepository, identity: ApprovalPrincipal | null = null) {
  const reply = (body: object, status = 200) => Response.json({
    schemaVersion: "organization-environment.command-result.v1",
    mode: repository.mode, externalWrite: "disabled",
    persistence: repository.mode === "fixture" ? "ephemeral" : "postgres", ...body,
  }, { status, headers: { "Cache-Control": "no-store" } });
  let body: unknown;
  try { body = await request.json(); } catch { return reply({ error: "invalid_json" }, 400); }
  const parsed = approveDecisionRequestSchema.safeParse(body);
  if (!parsed.success) return reply({ error: "invalid_request" }, 400);
  // Identity is deliberately absent. Never trust actor/tenant headers, body fields or an env approval bypass.
  if (repository.mode !== "fixture" && !identity) return reply({ error: "human_identity_not_configured" }, 403);
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  // Next may construct an internal request URL using localhost; compare against the browser-facing Host.
  let sameOrigin = false;
  try {
    const parsedOrigin = new URL(origin ?? "");
    sameOrigin = parsedOrigin.host === host && ["http:", "https:"].includes(parsedOrigin.protocol) &&
      request.headers.get("sec-fetch-site") !== "cross-site";
  } catch { /* Missing or invalid origin remains denied. */ }
  if (!sameOrigin) return reply({ error: "invalid_origin" }, 403);
  const principal = repository.mode === "fixture" ? { tenantId: repository.tenantId, actorId: "actor-book", verifiedHuman: true as const } : identity;
  const result = await repository.approve(parsed.data, principal);
  if (!result.ok) return reply({ error: result.reason }, result.reason === "decision_not_found" ? 404 : 409);
  const workspace = await repository.room();
  workspace.approvalAvailable = true;
  return reply({ ok: true, simulation: repository.mode === "fixture", decision: result.decision, workspace });
}

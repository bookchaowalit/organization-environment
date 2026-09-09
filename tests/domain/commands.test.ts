import { describe, expect, it } from "vitest";

import { approveDecision, approveDecisionRequestSchema } from "../../src/domain/commands";
import { createEngineeringRoom } from "../../src/domain/engineering-room";

const sample = createEngineeringRoom();
const authority = { tenantId: sample.organization.id, principal: { tenantId: sample.organization.id, actorId: "actor-book", verifiedHuman: true as const }, actor: sample.actors[0] };

describe("decision approval command", () => {
  it("validates the bounded approval request", () => {
    expect(
      approveDecisionRequestSchema.safeParse({
        action: "approve",
        decisionId: "decision-checkout-staging",
        approvalNote: "approved",
      }).success,
    ).toBe(true);

    expect(approveDecisionRequestSchema.safeParse({ action: "approve", decisionId: "" }).success).toBe(false);
    expect(approveDecisionRequestSchema.safeParse({ action: "approve", decisionId: "ok", extra: "blocked" }).success).toBe(false);
  });

  it("turns proposed tasks into approved-for-sync simulations without external writes", () => {
    const room = createEngineeringRoom();
    const result = approveDecision(room.decision, {
      action: "approve",
      decisionId: room.decision.id,
    }, authority);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.externalWrite).toBe("disabled");
    expect(result.decision.status).toBe("approved_for_sync");
    expect(result.decision.tasks.every((task) => task.status === "approved_for_sync")).toBe(true);
    expect(result.simulatedActions).toHaveLength(3);
  });

  it("refuses to approve an already processed decision", () => {
    const room = createEngineeringRoom();
    const first = approveDecision(room.decision, {
      action: "approve",
      decisionId: room.decision.id,
    }, authority);

    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = approveDecision(first.decision, {
      action: "approve",
      decisionId: room.decision.id,
    }, authority);
    expect(second).toEqual({ ok: false, reason: "decision_not_pending" });
  });
});

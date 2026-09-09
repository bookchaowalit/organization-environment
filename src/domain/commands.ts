import { z } from "zod";

import type { Actor, Decision, DecisionTask, DecisionTaskStatus } from "./types";

export interface ApprovalPrincipal { tenantId: string; actorId: string; verifiedHuman: true }

export function canTransition(current: DecisionTaskStatus, next: DecisionTaskStatus, humanApproved: boolean) {
  return current === "proposed" && next === "approved_for_sync" && humanApproved;
}

export const approveDecisionRequestSchema = z
  .object({
    action: z.literal("approve"),
    decisionId: z.string().trim().min(1).max(100),
    approvalNote: z.string().trim().max(500).optional(),
  })
  .strict();

export type ApproveDecisionRequest = z.infer<typeof approveDecisionRequestSchema>;

export type ApprovalResult =
  | {
      ok: true;
      mode: "simulation";
      externalWrite: "disabled";
      decision: Decision;
      simulatedActions: Array<{
        taskId: string;
        provider: "linear";
        action: "create_task";
        state: "not_executed";
        idempotencyKey: string;
      }>;
    }
  | {
      ok: false;
      reason: "decision_not_pending" | "human_approval_required" | "decision_mismatch" | "task_not_pending";
    };

export function approveDecision(decision: Decision, request: ApproveDecisionRequest,
  authority?: { tenantId: string; principal: ApprovalPrincipal | null; actor: Actor | undefined }): ApprovalResult {
  if (authority?.principal?.verifiedHuman !== true || authority.principal.tenantId !== authority.tenantId ||
    authority.actor?.id !== authority.principal.actorId || authority.actor.type !== "human" ||
    !authority.actor.capabilities.includes("approve")) return { ok: false, reason: "human_approval_required" };
  if (request.decisionId !== decision.id) return { ok: false, reason: "decision_mismatch" };
  if (decision.status !== "proposed") {
    return { ok: false, reason: "decision_not_pending" };
  }

  if (decision.tasks.some((task) => !canTransition(task.status, "approved_for_sync", true))) {
    return { ok: false, reason: "task_not_pending" };
  }

  const tasks: DecisionTask[] = decision.tasks.map((task) => ({
    ...task,
    status: "approved_for_sync",
  }));

  return {
    ok: true,
    mode: "simulation",
    externalWrite: "disabled",
    decision: {
      ...decision,
      status: "approved_for_sync",
      tasks,
    },
    simulatedActions: tasks.map((task) => ({
      taskId: task.id,
      provider: "linear" as const,
      action: "create_task" as const,
      state: "not_executed" as const,
      idempotencyKey: `simulation:${authority.tenantId}:${request.decisionId}:${task.id}`,
    })),
  };
}

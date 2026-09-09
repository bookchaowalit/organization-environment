import { getWorkspaceRepository } from "../persistence/runtime";
import { PostgresStore } from "../persistence/postgres-store";
import { WorkspaceRepository } from "../persistence/repository";
import { officeDatabase, officeEnabled } from "./database";
import { officeContext } from "./http";
import { OfficeError } from "./service";

export async function engineeringContext() {
  if (!officeEnabled()) return { repository: await getWorkspaceRepository(), principal: null, authenticated: false };
  const { member } = await officeContext();
  if (!member) throw new OfficeError("unauthorized", 401);
  return { repository: new WorkspaceRepository(new PostgresStore(await officeDatabase()), member.tenantId, "connected-read-only"),
    principal: { tenantId: member.tenantId, actorId: member.id, verifiedHuman: true as const },
    authenticated: true, canApprove: member.role === "owner" };
}

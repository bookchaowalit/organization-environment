import type { WorkspaceRecords } from "../domain/types";
import { validateRecords } from "../domain/workspace";

export interface WorkspaceStore {
  read(tenantId: string): Promise<WorkspaceRecords | null>;
  transaction<T>(tenantId: string, change: (records: WorkspaceRecords | null) =>
    { records: WorkspaceRecords; result: T }): Promise<T>;
}

/** Request-scoped in fixture mode. Never exported as a global singleton. */
export class MemoryStore implements WorkspaceStore {
  private records = new Map<string, WorkspaceRecords>();
  async read(tenantId: string) {
    return structuredClone(this.records.get(tenantId) ?? null);
  }
  async transaction<T>(tenantId: string, change: (records: WorkspaceRecords | null) =>
    { records: WorkspaceRecords; result: T }): Promise<T> {
    // No await between read and commit: atomic for this in-process adapter.
    const next = change(structuredClone(this.records.get(tenantId) ?? null));
    validateRecords(tenantId, next.records);
    this.records.set(tenantId, structuredClone(next.records));
    return structuredClone(next.result);
  }
}

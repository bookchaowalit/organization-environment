import { z } from "zod";
import type { SourceEntity, WorkItem } from "../domain/types";

const id = z.string().trim().min(1).max(200);
const title = z.string().trim().min(1).max(500);
const timestamp = z.iso.datetime({ offset: true });
const safeUrl = (host: string) => z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && url.hostname === host && !url.username && !url.password && !url.port;
}, "unsupported_source_url");

// These are bounded local import contracts, not full provider webhook contracts.
export const githubPayloadSchema = z.object({
  eventId: id, updatedAt: timestamp, pullRequest: z.object({
    id, number: z.number().int().positive(), title, url: safeUrl("github.com"),
    state: z.enum(["open", "closed", "merged"]), draft: z.boolean(),
  }).strict(),
}).strict();
export const linearPayloadSchema = z.object({
  eventId: id, updatedAt: timestamp, issue: z.object({
    id, identifier: id, title, url: safeUrl("linear.app"),
    state: z.enum(["backlog", "started", "review", "blocked", "completed"]),
  }).strict(),
}).strict();
export type GitHubPayload = z.infer<typeof githubPayloadSchema>;
export type LinearPayload = z.infer<typeof linearPayloadSchema>;
export interface NormalizedSignal { eventId: string; source: SourceEntity; workItem: WorkItem }
export interface ReadOnlySourceAdapter<P> {
  readonly provider: "github" | "linear";
  readonly externalWrite: "disabled";
  parse(payload: unknown): P;
  normalize(payload: P): NormalizedSignal;
}
export interface GitHubAdapter extends ReadOnlySourceAdapter<GitHubPayload> { readonly provider: "github" }
export interface LinearAdapter extends ReadOnlySourceAdapter<LinearPayload> { readonly provider: "linear" }

function signal(provider: "github" | "linear", eventId: string, externalId: string, externalKey: string,
  label: string, url: string, updatedAt: string, status: WorkItem["status"]): NormalizedSignal {
  const sourceId = `source:${provider}:${externalId}`;
  return { eventId,
    source: { id: sourceId, provider, externalId, label, url, updatedAt, origin: "local_fixture" },
    workItem: { id: `work:${provider}:${externalId}`, title: label, externalKey,
      kind: provider === "github" ? "pull_request" : "task", status, source: provider,
      ownerId: "source-unassigned", citations: [{ sourceId, label, url, excerpt: label }] },
  };
}
export const githubAdapter: GitHubAdapter = {
  provider: "github", externalWrite: "disabled", parse: (payload) => githubPayloadSchema.parse(payload),
  normalize(payload) {
    const { pullRequest: pr } = payload;
    return signal("github", payload.eventId, pr.id, `PR #${pr.number}`, pr.title, pr.url, payload.updatedAt,
      pr.state !== "open" ? "done" : pr.draft ? "in_progress" : "review");
  },
};
export const linearAdapter: LinearAdapter = {
  provider: "linear", externalWrite: "disabled", parse: (payload) => linearPayloadSchema.parse(payload),
  normalize(payload) {
    const { issue } = payload;
    const statuses = { backlog: "ready", started: "in_progress", review: "review", blocked: "blocked", completed: "done" } as const;
    return signal("linear", payload.eventId, issue.id, issue.identifier, issue.title, issue.url,
      payload.updatedAt, statuses[issue.state]);
  },
};

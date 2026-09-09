import { z } from "zod";
export const credentials = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{3,40}$/),
  password: z.string().min(12).max(128),
});
export const registration = credentials.extend({
  name: z.string().trim().min(1).max(60), invite: z.string().max(100).optional(),
}).strict();
export const location = z.object({
  roomId: z.string().min(1).max(100),
  x: z.number().int().min(5).max(95),
  y: z.number().int().min(5).max(95),
  status: z.enum(["available", "focus", "away"]),
}).strict();
export type Location = z.infer<typeof location>;
export interface OfficeMember { id: string; name: string; role: "owner" | "member"; tenantId: string }
export interface OfficeSnapshot {
  savedLocation: Location | null;
  me: OfficeMember;
  rooms: Array<{ id: string; name: string; description: string }>;
  people: Array<{ id: string; name: string; roomId: string; x: number; y: number; status: string }>;
  messages: Array<{ id: string; memberId: string; roomId: string; body: string; name: string; createdAt: string }>;
  mediaConfigured: boolean;
  storage: "local-postgres" | "postgres";
}

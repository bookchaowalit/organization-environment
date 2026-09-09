import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, isNull, sql, desc } from "drizzle-orm";
import { z } from "zod";
import * as s from "../persistence/schema";
import { PILOT_TENANT } from "../domain/workspace";
import { PostgresStore } from "../persistence/postgres-store";
import { WorkspaceRepository } from "../persistence/repository";
import { credentials, registration, location, type OfficeMember } from "./contracts";
import type { OfficeDatabase } from "./database";

const derive = promisify(scrypt);
export const digest = (token: string) => createHash("sha256").update(token).digest("hex");
export class OfficeError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const safeMember = (row: typeof s.members.$inferSelect): OfficeMember =>
  ({ id: row.id, tenantId: row.tenantId, name: row.name, role: row.role });

export class OfficeService {
  constructor(readonly db: OfficeDatabase, readonly tenantId = PILOT_TENANT, readonly now = () => new Date()) {}
  async initialized() {
    return (await this.db.select({ id: s.members.id }).from(s.members).where(eq(s.members.tenantId, this.tenantId)).limit(1)).length > 0;
  }
  async register(input: unknown, allowBootstrap = false) {
    const data = registration.parse(input);
    const salt = randomBytes(16).toString("hex");
    const hash = (await derive(data.password, salt, 64)) as Buffer;
    const id = randomUUID();
    // Seed is explicit during account setup, not on workspace reads.
    if (allowBootstrap) await new WorkspaceRepository(new PostgresStore(this.db), this.tenantId, "connected-read-only").seedFixture();
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${this.tenantId}, 0))`);
      const existing = await tx.select({ id: s.members.id }).from(s.members).where(eq(s.members.tenantId, this.tenantId)).limit(1);
      const bootstrap = !existing.length && allowBootstrap;
      if (!bootstrap) {
        if (!data.invite) throw new OfficeError("invite_required", 403);
        const claimed = await tx.update(s.invites).set({ usedAt: this.now() }).where(and(
          eq(s.invites.tenantId, this.tenantId), eq(s.invites.tokenHash, digest(data.invite)),
          isNull(s.invites.usedAt), gt(s.invites.expiresAt, this.now()),
        )).returning();
        if (!claimed.length) throw new OfficeError("invite_invalid_or_expired", 403);
      }
      if ((await tx.select().from(s.members).where(and(eq(s.members.tenantId, this.tenantId),
        eq(s.members.username, data.username))).limit(1)).length) throw new OfficeError("username_unavailable", 409);
      const row = { tenantId: this.tenantId, id, name: data.name, username: data.username,
        passwordHash: `${salt}:${hash.toString("hex")}`, role: bootstrap ? "owner" as const : "member" as const };
      await tx.insert(s.members).values(row);
      await tx.insert(s.entities).values({ tenantId: this.tenantId, id });
      await tx.insert(s.actors).values({ tenantId: this.tenantId, id, data: {
        id, name: data.name, type: "human", role: row.role, status: "active", accent: "lime",
        position: { x: "50%", y: "50%" }, capabilities: bootstrap ? ["approve", "review"] : ["review"],
      } });
      for (const [roomId, name] of [["room-engineering", "Engineering"], ["room-lounge", "Lounge"], ["room-focus", "Focus"], ["room-meeting", "Meeting"]]) {
        await tx.insert(s.entities).values({ tenantId: this.tenantId, id: roomId }).onConflictDoNothing();
        await tx.insert(s.rooms).values({ tenantId: this.tenantId, id: roomId, data: {
          id: roomId, name, description: `${name} shared room`, kind: "room", status: "healthy",
        } }).onConflictDoNothing();
      }
      return safeMember(row);
    });
  }
  async login(input: unknown) {
    const data = credentials.strict().parse(input);
    const [row] = await this.db.select().from(s.members).where(and(eq(s.members.tenantId, this.tenantId),
      eq(s.members.username, data.username))).limit(1);
    const [salt = "missing-account", encoded = ""] = row?.passwordHash.split(":") ?? [];
    const expected = /^[0-9a-f]{128}$/i.test(encoded) ? Buffer.from(encoded, "hex") : Buffer.alloc(64);
    const actual = await derive(data.password, salt, 64) as Buffer;
    if (!row || !timingSafeEqual(actual, expected)) throw new OfficeError("invalid_credentials", 401);
    return safeMember(row);
  }
  async session(member: OfficeMember) {
    if (member.tenantId !== this.tenantId) throw new OfficeError("forbidden", 403);
    const token = randomBytes(32).toString("base64url");
    await this.db.insert(s.sessions).values({ tokenHash: digest(token), tenantId: this.tenantId,
      memberId: member.id, expiresAt: new Date(this.now().getTime() + 8 * 3600000) });
    return token;
  }
  async authenticate(token: string | undefined) {
    if (!token || token.length > 100) return null;
    const [row] = await this.db.select({ member: s.members }).from(s.sessions).innerJoin(s.members,
      and(eq(s.members.tenantId, s.sessions.tenantId), eq(s.members.id, s.sessions.memberId)))
      .where(and(eq(s.sessions.tokenHash, digest(token)), eq(s.sessions.tenantId, this.tenantId), gt(s.sessions.expiresAt, this.now()))).limit(1);
    return row ? safeMember(row.member) : null;
  }
  async logout(token: string) {
    const member = await this.authenticate(token);
    await this.db.delete(s.sessions).where(and(eq(s.sessions.tokenHash, digest(token)), eq(s.sessions.tenantId, this.tenantId)));
    if (member) await this.db.delete(s.presence).where(and(eq(s.presence.tenantId, this.tenantId), eq(s.presence.memberId, member.id)));
  }
  async invite(member: OfficeMember) {
    await this.requireMember(member, true);
    const token = randomBytes(32).toString("base64url");
    await this.db.insert(s.invites).values({ tenantId: this.tenantId, tokenHash: digest(token),
      expiresAt: new Date(this.now().getTime() + 24 * 3600000) });
    return token;
  }
  async requireMember(member: OfficeMember, owner = false) {
    const [row] = await this.db.select().from(s.members).where(and(eq(s.members.tenantId, this.tenantId), eq(s.members.id, member.id))).limit(1);
    if (!row || member.tenantId !== this.tenantId || (owner && row.role !== "owner")) throw new OfficeError("forbidden", 403);
  }
  async heartbeat(member: OfficeMember, input: unknown) {
    await this.requireMember(member);
    const point = location.parse(input);
    const [room] = await this.db.select().from(s.rooms).where(and(eq(s.rooms.tenantId, this.tenantId), eq(s.rooms.id, point.roomId)));
    if (!room) throw new OfficeError("room_not_found", 404);
    await this.db.insert(s.presence).values({ tenantId: this.tenantId, memberId: member.id, ...point, updatedAt: this.now() })
      .onConflictDoUpdate({ target: [s.presence.tenantId, s.presence.memberId], set: { ...point, updatedAt: this.now() } });
  }
  async say(member: OfficeMember, input: unknown) {
    await this.requireMember(member);
    const data = z.object({ roomId: z.string().max(100), body: z.string().trim().min(1).max(2000),
      requestId: z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9._:-]+$/).optional() }).strict().parse(input);
    const [here] = await this.db.select().from(s.presence).where(and(eq(s.presence.tenantId, this.tenantId),
      eq(s.presence.memberId, member.id), eq(s.presence.roomId, data.roomId),
      gt(s.presence.updatedAt, new Date(this.now().getTime() - 30000))));
    if (!here) throw new OfficeError("join_room_first", 409);
    await this.db.insert(s.messages).values({ tenantId: this.tenantId, id: randomUUID(), memberId: member.id,
      roomId: data.roomId, body: data.body, requestId: data.requestId ?? null, createdAt: this.now() })
      .onConflictDoNothing({ target: [s.messages.tenantId, s.messages.memberId, s.messages.requestId] });
  }
  async snapshot(member: OfficeMember) {
    await this.requireMember(member);
    const [saved] = await this.db.select().from(s.presence).where(and(
      eq(s.presence.tenantId, this.tenantId), eq(s.presence.memberId, member.id))).limit(1);
    const rooms = await this.db.select({ data: s.rooms.data }).from(s.rooms).where(eq(s.rooms.tenantId, this.tenantId)).orderBy(s.rooms.id);
    const people = await this.db.select({ id: s.members.id, name: s.members.name, roomId: s.presence.roomId,
      x: s.presence.x, y: s.presence.y, status: s.presence.status }).from(s.presence).innerJoin(s.members,
      and(eq(s.members.tenantId, s.presence.tenantId), eq(s.members.id, s.presence.memberId)))
      .where(and(eq(s.presence.tenantId, this.tenantId), gt(s.presence.updatedAt, new Date(this.now().getTime() - 30000))));
    const messages = await this.db.select({ id: s.messages.id, memberId: s.messages.memberId,
      roomId: s.messages.roomId, body: s.messages.body, createdAt: s.messages.createdAt, name: s.members.name })
      .from(s.messages).innerJoin(s.members, and(eq(s.members.tenantId, s.messages.tenantId), eq(s.members.id, s.messages.memberId)))
      .where(eq(s.messages.tenantId, this.tenantId)).orderBy(desc(s.messages.createdAt)).limit(100);
    return { me: member, savedLocation: saved ? { roomId: saved.roomId, x: saved.x, y: saved.y, status: saved.status } : null,
      rooms: rooms.map((r) => r.data), people,
      messages: messages.reverse().map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })) };
  }
}

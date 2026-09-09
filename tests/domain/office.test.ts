import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, eq } from "drizzle-orm";
import * as schema from "../../src/persistence/schema";
import { OfficeService, digest } from "../../src/office/service";
import { WorkspaceRepository } from "../../src/persistence/repository";
import { PostgresStore } from "../../src/persistence/postgres-store";
import { proximityVolume, proximityVolumes } from "../../src/office/proximity";

const client = new PGlite();
const db = drizzle(client, { schema });
beforeAll(async () => { await migrate(db, { migrationsFolder: "./drizzle" }); }, 30000);
afterAll(async () => { await client.close(); });
let index = 0;
const account = (username: string) => ({ username, name: username, password: randomBytes(24).toString("hex") });
describe("shared office", () => {
  async function setup() {
    let now = new Date("2026-09-07T00:00:00Z");
    const service = new OfficeService(db, `office-test-${++index}`, () => now);
    const credentials = account("owner");
    const owner = await service.register(credentials, true);
    return { service, owner, credentials, tick: (milliseconds: number) => { now = new Date(now.getTime() + milliseconds); } };
  }
  it("creates the first owner only through explicit bootstrap and requires subsequent invitations", async () => {
    const { service } = await setup();
    await expect(service.register(account("stranger"), true)).rejects.toThrow("invite_required");
    const empty = new OfficeService(db, "empty");
    await expect(empty.register(account("owner"))).rejects.toThrow("invite_required");
  });
  it("validates passwords and returns no password hash to the client", async () => {
    const { service, credentials } = await setup();
    expect(await service.login({ username: credentials.username, password: credentials.password })).not.toHaveProperty("passwordHash");
    await expect(service.login({ username: credentials.username, password: randomBytes(24).toString("hex") })).rejects.toThrow("invalid_credentials");
    await expect(service.register({ ...account("short"), password: "short" }, true)).rejects.toThrow();
  });
  it("fails closed when a stored password hash is malformed", async () => {
    const { service, owner, credentials } = await setup();
    await db.update(schema.members).set({ passwordHash: "corrupt" }).where(and(
      eq(schema.members.tenantId, service.tenantId), eq(schema.members.id, owner.id),
    ));
    await expect(service.login({ username: credentials.username, password: credentials.password }))
      .rejects.toThrow("invalid_credentials");
  });
  it("issues hashed sessions, isolates tenants, expires sessions and logs out", async () => {
    const { service, owner, tick } = await setup();
    const token = await service.session(owner);
    expect(await service.authenticate(token)).toEqual(owner);
    const rows = await db.select().from(schema.sessions);
    expect(rows.some((row) => row.tokenHash === digest(token))).toBe(true);
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(await new OfficeService(db, "another").authenticate(token)).toBeNull();
    await service.logout(token);
    expect(await service.authenticate(token)).toBeNull();
    const second = await service.session(owner);
    tick(9 * 3600000);
    expect(await service.authenticate(second)).toBeNull();
  });
  it("consumes a one-use invite atomically and never grants owner role", async () => {
    const { service, owner } = await setup();
    const invite = await service.invite(owner);
    const results = await Promise.allSettled([
      service.register({ ...account("alice"), invite }), service.register({ ...account("bob"), invite }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const joined = results.find((r) => r.status === "fulfilled");
    if (joined?.status !== "fulfilled") throw new Error("missing_member");
    expect(joined.value.role).toBe("member");
    await expect(service.invite(joined.value)).rejects.toThrow("forbidden");
  });
  it("rejects expired and cross-tenant invitations", async () => {
    const { service, owner, tick } = await setup();
    const invite = await service.invite(owner);
    await expect(new OfficeService(db, "wrong").register({ ...account("alice"), invite })).rejects.toThrow("invite_invalid");
    tick(25 * 3600000);
    await expect(service.register({ ...account("alice"), invite })).rejects.toThrow("invite_invalid");
  });
  it("shares room positions across members, expires presence and checks room membership", async () => {
    const { service, owner, tick } = await setup();
    const alice = await service.register({ ...account("alice"), invite: await service.invite(owner) });
    const point = { roomId: "room-lounge", x: 20, y: 30, status: "available" };
    await service.heartbeat(owner, point);
    expect((await service.snapshot(alice)).people).toContainEqual({ id: owner.id, name: owner.name, ...point });
    await expect(service.heartbeat(owner, { ...point, roomId: "nonexistent" })).rejects.toThrow("room_not_found");
    await expect(service.heartbeat(owner, { ...point, x: 1000 })).rejects.toThrow();
    tick(31000);
    expect((await service.snapshot(alice)).people).toHaveLength(0);
    expect((await service.snapshot(owner)).savedLocation).toEqual(point);
  });
  it("persists chat, enforces room presence and isolates another tenant", async () => {
    const { service, owner } = await setup();
    await expect(service.say(owner, { roomId: "room-lounge", body: "hello" })).rejects.toThrow("join_room_first");
    await service.heartbeat(owner, { roomId: "room-lounge", x: 30, y: 40, status: "available" });
    await service.say(owner, { roomId: "room-lounge", body: "hello team" });
    const reloaded = new OfficeService(db, service.tenantId);
    expect((await reloaded.snapshot(owner)).messages[0].body).toBe("hello team");
    const other = await setup();
    expect((await other.service.snapshot(other.owner)).messages).toHaveLength(0);
    await expect(other.service.snapshot(owner)).rejects.toThrow("forbidden");
  });
  it("does not duplicate a retried message with the same request id", async () => {
    const { service, owner } = await setup();
    await service.heartbeat(owner, { roomId: "room-lounge", x: 30, y: 40, status: "available" });
    const requestId = "11111111-1111-4111-8111-111111111111";
    await service.say(owner, { roomId: "room-lounge", body: "retry once", requestId });
    await service.say(owner, { roomId: "room-lounge", body: "retry once", requestId });
    expect((await service.snapshot(owner)).messages.filter((message) => message.body === "retry once")).toHaveLength(1);
  });
  it("maps authenticated owners to human approval and keeps member approval disabled", async () => {
    const { service, owner } = await setup();
    const member = await service.register({ ...account("alice"), invite: await service.invite(owner) });
    const repo = new WorkspaceRepository(new PostgresStore(db), service.tenantId, "connected-read-only");
    const request = { action: "approve" as const, decisionId: "decision-checkout-staging" };
    expect((await repo.approve(request, { tenantId: service.tenantId, actorId: member.id, verifiedHuman: true })).ok).toBe(false);
    expect((await repo.approve(request, { tenantId: service.tenantId, actorId: owner.id, verifiedHuman: true })).ok).toBe(true);
    expect((await repo.room()).externalWrite).toBe("disabled");
  });
  it("scales room audio by distance and never includes another room", () => {
    expect(proximityVolume(0)).toBe(1);
    expect(proximityVolume(58)).toBe(0);
    expect(proximityVolumes({ roomId: "room-lounge", x: 50, y: 50, status: "available" }, [
      { id: "near", roomId: "room-lounge", x: 55, y: 50 },
      { id: "far", roomId: "room-lounge", x: 95, y: 95 },
      { id: "other-room", roomId: "room-focus", x: 50, y: 50 },
    ])).toEqual({ near: 1, far: 0 });
  });
});

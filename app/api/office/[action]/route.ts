import { cookies } from "next/headers";
import { AccessToken } from "livekit-server-sdk";
import { z } from "zod";
import { officeEnabled } from "@/src/office/database";
import { OfficeError } from "@/src/office/service";
import { boundedBody, checkOrigin, COOKIE, failure, officeContext, rateLimit, reply } from "@/src/office/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const mediaConfigured = () => Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);

export async function GET(_request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    const { action } = await context.params;
    if (!officeEnabled()) return reply({ configured: false, initialized: false });
    const { service, member } = await officeContext();
    if (action === "session") return reply({ configured: true, initialized: await service.initialized(), member,
      bootstrapAvailable: process.env.NODAL_BOOTSTRAP_ALLOWED === "1" });
    if (action !== "state") return reply({ error: "not_found" }, 404);
    if (!member) return reply({ error: "unauthorized" }, 401);
    return reply({ ...await service.snapshot(member), mediaConfigured: mediaConfigured(),
      storage: process.env.DATABASE_URL ? "postgres" : "local-postgres" });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    checkOrigin(request);
    const { action } = await context.params;
    if (["register", "login"].includes(action)) rateLimit("authentication", 30);
    const { service, token, member } = await officeContext();
    if (action === "register" || action === "login") {
      const input = await boundedBody(request);
      // First-owner bootstrap is restricted to explicit local mode on the loopback-bound dev server.
      const localHost = new URL(request.headers.get("origin")!).hostname;
      const requestHost = new URL(`http://${request.headers.get("host") ?? new URL(request.url).host}`).hostname;
      const loopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(localHost);
      const bootstrap = process.env.NODAL_LOCAL_PILOT === "1" && process.env.NODAL_BOOTSTRAP_ALLOWED === "1" &&
        loopback && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(requestHost);
      const account = action === "register" ? await service.register(input, bootstrap) : await service.login(input);
      if (token) await service.logout(token);
      const session = await service.session(account);
      (await cookies()).set(COOKIE, session, { httpOnly: true, sameSite: "strict", path: "/", maxAge: 8 * 3600,
        secure: process.env.NODAL_LOCAL_PILOT !== "1" || new URL(request.headers.get("origin")!).protocol === "https:" });
      return reply({ member: account });
    }
    if (!member) throw new OfficeError("unauthorized", 401);
    rateLimit(`member:${member.id}`, 120);
    if (action === "logout") {
      if (token) await service.logout(token);
      (await cookies()).delete(COOKIE);
      return reply({ ok: true });
    }
    if (action === "invite") return reply({ invite: await service.invite(member) });
    if (action === "presence") { await service.heartbeat(member, await boundedBody(request)); return reply({ ok: true }); }
    if (action === "message") { await service.say(member, await boundedBody(request)); return reply({ ok: true }); }
    if (action === "media") {
      if (!mediaConfigured()) throw new OfficeError("media_not_configured", 503);
      const { roomId } = z.object({ roomId: z.string().max(100) }).strict().parse(await boundedBody(request));
      const state = await service.snapshot(member);
      if (!state.people.some((p) => p.id === member.id && p.roomId === roomId)) throw new OfficeError("join_room_first", 409);
      const access = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
        identity: member.id, name: member.name, ttl: "5m",
      });
      access.addGrant({ room: `${member.tenantId}:${roomId}`, roomJoin: true, canPublish: true,
        canSubscribe: true, canPublishData: true, roomAdmin: false });
      return reply({ token: await access.toJwt(), url: process.env.LIVEKIT_URL });
    }
    return reply({ error: "not_found" }, 404);
  } catch (error) { return failure(error); }
}

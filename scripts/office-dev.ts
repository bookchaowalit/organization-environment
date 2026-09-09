import { execFile as execFileCallback, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, unlink, readFile, access } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { connect as tcpConnect, isIP } from "node:net";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const withMedia = process.argv.includes("--media");
const lan = process.argv.includes("--lan");
const httpsMode = process.argv.includes("--https");
const port = process.env.NODAL_PORT ?? "3400";
if (!/^\d{4,5}$/.test(port)) throw new Error("invalid_port");
const bindHost = process.env.NODAL_BIND_HOST ?? (lan ? "0.0.0.0" : "127.0.0.1");
if (!/^[a-zA-Z0-9.:-]+$/.test(bindHost)) throw new Error("invalid_bind_host");
const loopbackBind = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(bindHost);
const internalPort = httpsMode ? (process.env.NODAL_INTERNAL_PORT ?? String(Number(port) + 1)) : port;
if (!/^\d{4,5}$/.test(internalPort) || (httpsMode && internalPort === port)) throw new Error("invalid_internal_port");
const mediaHost = process.env.NODAL_MEDIA_HOST ?? "127.0.0.1";
if (lan && withMedia && mediaHost === "127.0.0.1") {
  throw new Error("NODAL_MEDIA_HOST must be the LAN IP when using --lan --media");
}
if (httpsMode && !lan && !loopbackBind) throw new Error("https_requires_explicit_safe_bind");
const children: ReturnType<typeof spawn>[] = [];
const container = `nodal-pilot-media-${process.pid}`;
const config = resolve(`.nodal/media-${process.pid}.yaml`);
const dockerConfig = resolve(".nodal/docker-public");
const execFile = promisify(execFileCallback);
let tlsProxy: ReturnType<typeof createHttpsServer> | undefined;
let cleaning = false;
function lanAddress() {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) return entry.address;
    }
  }
  return "<LAN-IP>";
}
const displayHost = process.env.NODAL_PUBLIC_HOST ?? (lan ? lanAddress() : "127.0.0.1");
if (httpsMode && (displayHost === "<LAN-IP>" || !/^[a-zA-Z0-9.:[\]-]+$/.test(displayHost))) {
  throw new Error("NODAL_PUBLIC_HOST_required_for_https");
}
const certDirectory = resolve(process.env.NODAL_CERT_DIR ?? ".nodal/certs");
const certPath = resolve(process.env.NODAL_TLS_CERT ?? `${certDirectory}/office.crt`);
const keyPath = resolve(process.env.NODAL_TLS_KEY ?? `${certDirectory}/office.key`);
const hostMarkerPath = resolve(`${certDirectory}/office.host`);
async function ensureTlsMaterial() {
  if (process.env.NODAL_TLS_CERT || process.env.NODAL_TLS_KEY) {
    if (!process.env.NODAL_TLS_CERT || !process.env.NODAL_TLS_KEY) throw new Error("both_NODAL_TLS_CERT_and_NODAL_TLS_KEY_required");
    await access(certPath); await access(keyPath); return;
  }
  await mkdir(certDirectory, { recursive: true, mode: 0o700 });
  let reusable = false;
  try {
    await access(certPath); await access(keyPath);
    reusable = (await readFile(hostMarkerPath, "utf8")).trim() === displayHost;
  } catch { /* generate below */ }
  if (reusable) return;
  await unlink(certPath).catch(() => {}); await unlink(keyPath).catch(() => {});
  const configPath = resolve(`${certDirectory}/openssl.cnf`);
  const san = isIP(displayHost) ? `IP.1 = ${displayHost}\nIP.2 = 127.0.0.1` : `DNS.1 = ${displayHost}\nDNS.2 = localhost\nIP.1 = 127.0.0.1`;
  await writeFile(configPath, `[req]\nprompt = no\ndistinguished_name = subject\nx509_extensions = extensions\n[subject]\ncommonName = ${displayHost}\n[extensions]\nsubjectAltName = @alt_names\n[alt_names]\n${san}\n`, { mode: 0o600 });
  await execFile("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "30",
    "-keyout", keyPath, "-out", certPath, "-config", configPath]);
  await writeFile(hostMarkerPath, displayHost, { mode: 0o600 });
  await unlink(configPath).catch(() => {});
}
async function startTlsProxy() {
  await ensureTlsMaterial();
  const server = createHttpsServer({ key: await readFile(keyPath), cert: await readFile(certPath) }, (request, response) => {
    const upstream = httpRequest({ hostname: "127.0.0.1", port: Number(internalPort), path: request.url, method: request.method,
      headers: { ...request.headers, host: request.headers.host ?? `${displayHost}:${port}`, "x-forwarded-proto": "https" } }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });
    upstream.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end("office_unavailable"); });
    request.pipe(upstream);
  });
  server.on("upgrade", (request, client, head) => {
    const targetPort = request.url?.startsWith("/rtc") ? 7880 : Number(internalPort);
    const upstream = tcpConnect(targetPort, "127.0.0.1", () => {
      upstream.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\n`);
      for (const [name, value] of Object.entries(request.headers)) {
        if (Array.isArray(value)) for (const item of value) upstream.write(`${name}: ${item}\r\n`);
        else if (value) upstream.write(`${name}: ${value}\r\n`);
      }
      upstream.write("\r\n");
      if (head.length) upstream.write(head);
      client.pipe(upstream).pipe(client);
    });
    upstream.on("error", () => client.destroy());
    client.on("error", () => upstream.destroy());
  });
  server.on("clientError", (_error, socket) => socket.destroy());
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(Number(port), bindHost, () => { server.removeListener("error", reject); resolvePromise(); });
  });
  tlsProxy = server;
}
async function cleanup() {
  if (cleaning) return;
  cleaning = true;
  tlsProxy?.close();
  for (const child of children) child.kill("SIGTERM");
  if (withMedia) {
    const stop = spawn("docker", ["--config", dockerConfig, "stop", container], { stdio: "ignore" });
    await new Promise((done) => { stop.on("close", done); stop.on("error", done); });
    await unlink(config).catch(() => {});
  }
}
process.on("SIGINT", () => void cleanup());
process.on("SIGTERM", () => void cleanup());
try {
  const env = { ...process.env, NODAL_LOCAL_PILOT: "1", NODAL_BOOTSTRAP_ALLOWED: loopbackBind && !lan ? "1" : "0" };
  if (withMedia) {
    await mkdir(".nodal", { recursive: true, mode: 0o700 });
    await mkdir(dockerConfig, { recursive: true, mode: 0o700 });
    const key = randomBytes(16).toString("hex");
    const secret = randomBytes(32).toString("hex");
    await writeFile(config, `port: 7880
rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: false
  node_ip: ${mediaHost}
keys:
  ${key}: ${secret}
`, { mode: 0o600, flag: "wx" });
    const published = lan ? [httpsMode ? "127.0.0.1:7880:7880" : "7880:7880", "7881:7881", "7882:7882/udp"] : [
      "127.0.0.1:7880:7880", "127.0.0.1:7881:7881", "127.0.0.1:7882:7882/udp",
    ];
    const media = spawn("docker", ["--config", dockerConfig, "run", "--rm", "--name", container,
      "-p", published[0], "-p", published[1], "-p", published[2],
      "-v", `${config}:/etc/livekit.yaml:ro`, "livekit/livekit-server:v1.13.6", "--config", "/etc/livekit.yaml", "--bind", "0.0.0.0"],
    { stdio: "ignore" });
    children.push(media);
    let failed = false;
    media.on("error", () => { failed = true; });
    media.on("exit", () => { failed = true; if (!cleaning) void cleanup(); });
    console.log("Starting local media server; first run may download the pinned Docker image.");
    // Let a conflicting/stale container report its exit before probing the port.
    await new Promise((done) => setTimeout(done, 300));
    if (failed) throw new Error("media_start_failed");
    let ready = false;
    for (let attempt = 0; attempt < 90 && !failed; attempt++) {
      try { ready = (await fetch("http://127.0.0.1:7880", { signal: AbortSignal.timeout(500) })).ok; } catch { /* starting */ }
      if (ready) break;
      await new Promise((done) => setTimeout(done, 1000));
    }
    if (!ready) throw new Error("media_start_failed");
    Object.assign(env, { LIVEKIT_URL: httpsMode ? `wss://${displayHost}:${port}` : `ws://${mediaHost}:7880`, LIVEKIT_API_KEY: key, LIVEKIT_API_SECRET: secret });
  }
  console.log(`NODAL ${lan ? "LAN" : "local"}${httpsMode ? " HTTPS" : ""} office: ${httpsMode ? "https" : "http"}://${displayHost}:${port}/office · durable local data · media ${withMedia ? "enabled" : "optional"}`);
  if (lan) console.log("LAN mode exposes this development server to the local network; create the owner on loopback before sharing the URL.");
  if (httpsMode) console.log(`TLS certificate: ${certPath} · install this certificate as trusted on each pilot device, or provide NODAL_TLS_CERT/NODAL_TLS_KEY.`);
  const web = spawn("pnpm", ["exec", "next", "dev", "--hostname", httpsMode ? "127.0.0.1" : bindHost, "-p", internalPort], { env, stdio: "inherit" });
  children.push(web);
  web.on("error", () => void cleanup());
  web.on("exit", () => void cleanup());
  if (httpsMode) await startTlsProxy();
} catch {
  console.error("Local office startup failed. Check Docker and available ports 7880–7882, or run pnpm office:dev without media.");
  process.exitCode = 1;
  await cleanup();
}

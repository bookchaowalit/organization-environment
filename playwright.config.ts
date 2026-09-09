import { defineConfig } from "@playwright/test";
const https = process.env.NODAL_TEST_HTTPS === "1";
const media = process.env.NODAL_TEST_MEDIA === "1";
const protocol = https ? "https" : "http";
export default defineConfig({
  testDir: "./tests/e2e", workers: 1, timeout: 90000,
  use: {
    baseURL: `${protocol}://127.0.0.1:3413`, trace: "off", screenshot: "off", ignoreHTTPSErrors: https,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  },
  webServer: {
    command: media ? (https ? "pnpm office:media:https" : "pnpm office:media") : (https ? "pnpm office:https" : "pnpm office:dev"),
    url: `${protocol}://127.0.0.1:3413/office`, timeout: 120000,
    ignoreHTTPSErrors: https,
    env: { NODAL_PORT: "3413", NODAL_INTERNAL_PORT: "3414", NODAL_LOCAL_DATA_DIR: `.nodal/e2e-${process.pid}`, DATABASE_URL: "" },
    gracefulShutdown: { signal: "SIGTERM", timeout: 10000 },
  },
});

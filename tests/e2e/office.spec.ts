import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";

test("two members share a durable office and optional real local media", async ({ page, browser }) => {
  const ignoreHTTPSErrors = process.env.NODAL_TEST_HTTPS === "1";
  const password = randomBytes(24).toString("base64url");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/office");
  await page.getByLabel("ชื่อที่แสดง").fill("Pilot Owner");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("pilot_owner");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await page.getByRole("button", { name: "สร้างบัญชีเจ้าของทีม" }).click();
  await expect(page.getByRole("heading", { name: "Shared Office" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "สร้างรหัสเชิญ" }).click();
  const invite = await page.locator(".office-invite textarea").inputValue();
  await page.getByRole("button", { name: "ซ่อนรหัส" }).click();

  const second = await browser.newContext({ ignoreHTTPSErrors });
  const member = await second.newPage();
  await member.goto("/office");
  await member.getByRole("button", { name: "มีรหัสเชิญเข้าทีม" }).click();
  await member.getByLabel("ชื่อที่แสดง").fill("Pilot Member");
  await member.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("pilot_member");
  await member.getByLabel("รหัสผ่าน", { exact: true }).fill(randomBytes(24).toString("base64url"));
  await member.getByLabel("รหัสเชิญ", { exact: true }).fill(invite);
  await member.getByRole("button", { name: "เข้าร่วมทีม", exact: true }).click();
  await expect(member.getByRole("heading", { name: "Shared Office" })).toBeVisible();
  await expect(page.locator(".office-person")).toHaveCount(2, { timeout: 15000 });
  await expect(member.getByRole("button", { name: "สร้างรหัสเชิญ" })).toHaveCount(0);

  await page.getByRole("button", { name: /^Lounge/ }).click();
  await member.getByRole("button", { name: /^Lounge/ }).click();
  await expect(page.locator(".office-person")).toHaveCount(2, { timeout: 15000 });
  await page.locator(".office-map").focus();
  await page.keyboard.press("ArrowRight");
  await page.getByLabel("ข้อความ", { exact: true }).fill("Shared room message");
  await page.getByRole("button", { name: "ส่งข้อความ" }).click();
  await expect(member.getByText("Shared room message", { exact: true })).toBeVisible({ timeout: 15000 });

  await page.route("**/api/office/state", (route) => route.abort("failed"));
  await expect(page.getByText("การเชื่อมต่อขาดหาย", { exact: true })).toBeVisible({ timeout: 10000 });
  await page.unroute("**/api/office/state");
  await expect(page.getByText("เชื่อมต่อ · อัปเดตทุก 2 วินาที", { exact: true })).toBeVisible({ timeout: 15000 });
  await page.route("**/api/office/state", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }),
  }));
  await expect(page.getByText("การเชื่อมต่อขาดหาย", { exact: true })).toBeVisible({ timeout: 10000 });
  await page.unroute("**/api/office/state");
  await expect(page.getByText("เชื่อมต่อ · อัปเดตทุก 2 วินาที", { exact: true })).toBeVisible({ timeout: 15000 });
  await page.route("**/api/office/state", (route) => route.fulfill({
    status: 200, contentType: "text/html", body: "<html>temporarily unavailable</html>",
  }));
  await expect(page.getByText("การเชื่อมต่อขาดหาย", { exact: true })).toBeVisible({ timeout: 10000 });
  await page.unroute("**/api/office/state");
  await expect(page.getByText("เชื่อมต่อ · อัปเดตทุก 2 วินาที", { exact: true })).toBeVisible({ timeout: 15000 });

  if (process.env.NODAL_TEST_MEDIA === "1") {
    await page.getByRole("button", { name: "เข้าร่วมเสียง / วิดีโอ" }).click();
    await member.getByRole("button", { name: "เข้าร่วมเสียง / วิดีโอ" }).click();
    await expect(page.locator(".office-call-members")).toHaveText("connected · 2 คนในการสนทนา", { timeout: 30000 });
    await expect(member.locator(".office-call-members")).toHaveText("connected · 2 คนในการสนทนา", { timeout: 30000 });
    await page.locator('button[data-lk-source="microphone"]').click();
    await expect(page.locator('button[data-lk-source="microphone"]')).toHaveAttribute("aria-pressed", "true");
    await page.locator('button[data-lk-source="camera"]').click();
    await expect(page.locator('button[data-lk-source="camera"]')).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "ออกจากการสนทนา", exact: true }).click();
    await expect(page.locator(".office-call")).toHaveCount(0);
  }
  await page.reload();
  await expect(page.getByRole("heading", { name: "Shared Office" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lounge", exact: true })).toBeVisible();
  await expect(page.getByText("Shared room message", { exact: true })).toBeVisible({ timeout: 15000 });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "/tmp/nodal-office-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/nodal-office-mobile.png" });
  await member.goto("/engineering");
  await expect(member.getByRole("button", { name: "Owner approval required" })).toBeDisabled();
  await page.goto("/engineering");
  await page.getByRole("button", { name: "Approve decision" }).click();
  await expect(page.getByText("บันทึกการอนุมัติของคุณแล้ว", { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Approved for sync" })).toBeDisabled();
  const guest = await browser.newContext({ ignoreHTTPSErrors });
  expect((await guest.request.get(new URL("/api/workspace", page.url()).toString())).status()).toBe(401);
  await guest.close();
  expect(errors).toEqual([]);
  await second.close();
});

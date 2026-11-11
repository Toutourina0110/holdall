import { expect, test } from "@playwright/test";
import { password, signIn } from "./helpers";



test.describe.configure({ mode: "serial" });

test("first visit sets up the admin account and opens Today", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup$/);
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create the admin account" }).click();
  await page.waitForURL("/");
  await expect(page.getByText("Good to see you, Ada.")).toBeVisible();
});

test("setup is closed once an account exists", async ({ page }) => {
  await page.goto("/setup");
  await expect(page).toHaveURL(/\/login$/);
});

test("pages and API need a session", async ({ page, request }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/);
  const response = await request.get("/api/plugins", { headers: { purpose: "prefetch" } });
  expect(response.status()).toBe(401);
});

test("an invited member cannot open the admin page", async ({ page, browser }) => {
  await signIn(page);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Create invitation link" }).click();
  const link = await page.getByLabel("Invitation link").inputValue();
  const member = await browser.newPage();
  await member.goto(link);
  await member.getByLabel("Name").fill("Bob");
  await member.getByLabel("Email").fill("bob@example.com");
  await member.getByLabel("Password").fill(password);
  await member.getByRole("button", { name: "Create my account" }).click();
  await member.waitForURL("/");
  const response = await member.goto("/admin");
  expect(response?.status()).toBe(404);
  await member.close();
});

test("an admin reset link lets a member choose a new password once", async ({ page, browser }) => {
  await signIn(page);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Reset password" }).click();
  const link = await page.getByLabel("Reset link for Bob").inputValue();
  const member = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await member.goto(link);
  expect(await member.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await member.getByLabel("New password", { exact: true }).fill("bob-new-password-1");
  await member.getByRole("button", { name: "Save the new password" }).click();
  await member.waitForURL("/login?reset=done");
  await member.getByLabel("Email").fill("bob@example.com");
  await member.getByLabel("Password").fill("bob-new-password-1");
  await member.getByRole("button", { name: "Sign in" }).click();
  await member.waitForURL("/");
  await member.goto(link);
  await expect(member.getByText("This reset link is invalid, expired or already used.").first()).toBeVisible();
  await member.close();
});

test("unknown route shows the custom 404", async ({ page }) => {
  await signIn(page);
  const response = await page.goto("/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "This page does not exist" })).toBeVisible();
});

test("no horizontal scroll at 375 px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page);
  for (const path of ["/", "/notes", "/tasks", "/downloads", "/files", "/converter", "/calendar", "/calendar/accounts", "/settings", "/settings/appearance", "/plugins", "/admin", "/login"]) {
    await page.goto(path);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, path).toBeLessThanOrEqual(375);
  }
});

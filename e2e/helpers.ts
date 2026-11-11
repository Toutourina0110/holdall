import type { BrowserContext, Page } from "@playwright/test";

export const password = "correct-horse-battery";

let saved: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;

export async function signIn(page: Page, email = "ada@example.com") {
  if (saved && email === "ada@example.com") {
    await page.context().addCookies(saved.cookies);
    await page.goto("/");
    if (!page.url().includes("/login")) return;
  }
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/");
  if (email === "ada@example.com") saved = await page.context().storageState();
}

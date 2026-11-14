import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";


test("write a note, find it, trash it and restore it", async ({ page }) => {
  await signIn(page);
  await page.goto("/notes");
  await page.getByRole("button", { name: "New note" }).click();
  await page.waitForURL(/\/notes\?id=/);
  const title = `Groceries ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  const editor = page.locator(".ProseMirror");
  await editor.click();
  const contentSaved = page.waitForResponse((response) => response.request().method() === "POST" && (response.request().postData() ?? "").includes("Buy oranges and coffee"));
  await page.keyboard.type("Buy oranges and coffee");
  await contentSaved;
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible({ timeout: 10000 });
  await page.reload();
  await expect(page.locator(".ProseMirror")).toContainText("Buy oranges and coffee");

  const link = page.getByRole("link", { name: new RegExp(title) });
  await page.goto("/notes?q=oranges");
  await expect(link).toBeVisible();
  await link.click();
  await page.getByRole("button", { name: "Move to trash" }).click();
  await page.waitForURL("/notes");
  await page.goto("/notes?view=trash");
  await link.click();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByLabel("Title")).toHaveValue(title);
});

test("add a task for today and complete it", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks?view=today");
  await page.getByLabel("Add task").fill("Call the bank");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Call the bank")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("Call the bank")).toBeVisible();
  await page.goto("/tasks?view=today");
  await page.getByRole("button", { name: "Mark as done" }).first().click();
  await expect(page.getByText("Nothing due today.")).toBeVisible();
  await page.goto("/tasks?view=done");
  await expect(page.getByText("Call the bank")).toBeVisible();
});

test("the downloader refuses a link that is not a web address", async ({ page }) => {
  await signIn(page);
  await page.goto("/downloads");
  await page.getByLabel("Links", { exact: true }).fill("--exec=calc.exe");
  await page.getByRole("button", { name: "Check links" }).click();
  await expect(page.getByText(/is not a link/)).toBeVisible();
});

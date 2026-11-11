import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";


test("write a note, find it, trash it and restore it", async ({ page }) => {
  await signIn(page);
  await page.goto("/notes");
  await page.getByRole("button", { name: "New note" }).click();
  await page.waitForURL(/\/notes\?id=/);
  await page.getByLabel("Title").fill("Groceries");
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await page.keyboard.type("Buy oranges and coffee");
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible({ timeout: 10000 });
  await page.reload();
  await expect(page.locator(".ProseMirror")).toContainText("Buy oranges and coffee");

  await page.goto("/notes?q=oranges");
  await expect(page.getByRole("link", { name: /Groceries/ })).toBeVisible();
  await page.getByRole("link", { name: /Groceries/ }).click();
  await page.getByRole("button", { name: "Move to trash" }).click();
  await page.waitForURL("/notes");
  await page.goto("/notes?view=trash");
  await page.getByRole("link", { name: /Groceries/ }).click();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Groceries");
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

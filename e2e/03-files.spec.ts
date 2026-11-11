import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("upload a file, put it in a folder and delete it", async ({ page }) => {
  await signIn(page);
  await page.goto("/files");
  page.once("dialog", (dialog) => void dialog.accept("Receipts"));
  await page.getByRole("button", { name: "New folder" }).click();
  await expect(page.getByRole("link", { name: "Receipts" })).toBeVisible();

  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload files" }).click();
  await (await chooser).setFiles({ name: "groceries.txt", mimeType: "text/plain", buffer: Buffer.from("milk\nbread\n") });
  await expect(page.getByText("1 files uploaded.")).toBeVisible();
  await expect(page.getByRole("button", { name: "groceries.txt", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Move groceries.txt" }).click();
  await page.getByLabel("Move to").selectOption("Receipts");
  await page.getByRole("button", { name: "Move here" }).click();
  await page.getByRole("link", { name: "Receipts" }).click();
  await expect(page.getByRole("button", { name: "groceries.txt", exact: true })).toBeVisible();

  const raw = await page.request.get("/api/files/raw?root=files&path=Receipts%2Fgroceries.txt");
  expect(await raw.text()).toBe("milk\nbread\n");
  const escape = await page.request.get("/api/files/raw?root=files&path=..%2F..%2Fholdall.db");
  expect(escape.status()).toBe(404);

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete groceries.txt" }).click();
  await expect(page.getByText("This folder is empty.")).toBeVisible();
});

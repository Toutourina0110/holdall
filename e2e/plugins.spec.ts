import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { zipSync } from "fflate";

const password = "correct-horse-battery";

function examplePluginZip(): Buffer {
  const root = path.resolve("examples/plugins/hello-widget");
  const files: Record<string, Uint8Array> = {};
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files[path.relative(root, full).split(path.sep).join("/")] = fs.readFileSync(full);
    }
  };
  walk(root);
  return Buffer.from(zipSync(files));
}

test("an admin installs the example plugin and its widget appears on Today", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/");

  await page.goto("/admin/plugins");
  await page.getByLabel("Plugin archive").setInputFiles({ name: "hello-widget.zip", mimeType: "application/zip", buffer: examplePluginZip() });
  await page.getByRole("button", { name: "Review the plugin" }).click();
  await expect(page.getByText("Third-party plugin. Not made, reviewed or endorsed by the Holdall team.")).toBeVisible();
  await expect(page.getByText("Keep its own private data on this server")).toBeVisible();
  await page.getByRole("button", { name: "Accept and install" }).click();
  await page.waitForURL("/admin/plugins");
  await expect(page.getByText("Hello widget")).toBeVisible();

  await page.goto("/settings/plugins");
  await page.getByRole("button", { name: "On" }).click();
  await page.waitForTimeout(500);

  await page.goto("/");
  const widget = page.frameLocator("iframe[title='Hello']");
  await expect(widget.locator("#count")).toHaveText("1");
});

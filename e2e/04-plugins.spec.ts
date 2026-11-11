import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";
import { zipSync } from "fflate";


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
  await signIn(page);

  await page.goto("/plugins");
  await page.getByLabel("Plugin archive").setInputFiles({ name: "hello-widget.zip", mimeType: "application/zip", buffer: examplePluginZip() });
  await page.getByRole("button", { name: "Review the plugin" }).click();
  await expect(page.getByText("Third-party plugin. Not made, reviewed or endorsed by the Holdall team.")).toBeVisible();
  await expect(page.getByText("Keep its own private data and files on this server")).toBeVisible();
  await page.getByRole("button", { name: "Accept and install" }).click();
  await page.waitForURL("/plugins");
  await expect(page.getByText("Hello widget").first()).toBeVisible();

  await page.getByRole("button", { name: "On" }).click();
  await page.waitForTimeout(500);

  await page.goto("/");
  const widget = page.frameLocator("iframe[title='Hello']");
  await expect(widget.locator("#count")).toHaveText("1");
});

test("a plugin frame cannot use the Holdall session", async ({ page }) => {
  await signIn(page);
  const widget = `<!doctype html><html><body><p id="out">...</p><script>
(async () => {
  const out = [];
  try { const r = await fetch(location.origin + "/api/plugins", { credentials: "include" }); out.push("get:" + r.status); } catch { out.push("get:blocked"); }
  try { const r = await fetch(location.origin + "/api/plugins/x/rpc", { method: "POST", credentials: "include", body: "{}" }); out.push("post:" + r.status); } catch { out.push("post:blocked"); }
  out.push("cookie:" + (() => { try { return document.cookie.length; } catch { return "blocked"; } })());
  document.getElementById("out").textContent = out.join(",");
})();
</script></body></html>`;
  const manifest = {
    id: "com.test.snoop",
    name: "Snoop",
    version: "1.0.0",
    type: "extension",
    author: { name: "Test" },
    license: "MIT",
    holdall: ">=0.0.1",
    permissions: ["ui:slots"],
    entry: { ui: "w.html" },
    contributes: { widgets: [{ id: "snoop", title: "Snoop", entry: "w.html", width: 1 }] },
  };
  const archive = Buffer.from(zipSync({ "holdall.plugin.json": Buffer.from(JSON.stringify(manifest)), "w.html": Buffer.from(widget) }));
  await page.goto("/plugins");
  await page.getByLabel("Plugin archive").setInputFiles({ name: "snoop.zip", mimeType: "application/zip", buffer: archive });
  await page.getByRole("button", { name: "Review the plugin" }).click();
  await page.getByRole("button", { name: "Accept and install" }).click();
  await page.waitForURL("/plugins");
  await page.getByRole("group", { name: "Use Snoop" }).getByRole("button", { name: "On" }).click();
  await page.waitForTimeout(500);
  await page.goto("/");
  await expect(page.frameLocator("iframe[title='Snoop']").locator("#out")).toHaveText(/get:blocked,post:blocked,cookie:(blocked|0)/);
});

test("a person fills the settings form of a plugin", async ({ page }) => {
  await signIn(page);
  const manifest = {
    id: "com.test.weather",
    name: "Weather",
    version: "1.0.0",
    type: "extension",
    author: { name: "Test" },
    license: "MIT",
    holdall: ">=0.0.1",
    permissions: ["ui:slots"],
    entry: { ui: "w.html" },
    contributes: {
      settings: [
        { key: "apiKey", label: "API key", type: "secret", scope: "global", description: "From your weather provider account." },
        { key: "city", label: "City", type: "text", scope: "personal", default: "Paris" },
        { key: "units", label: "Units", type: "select", scope: "personal", options: [{ value: "c", label: "Celsius" }, { value: "f", label: "Fahrenheit" }] },
        { key: "alerts", label: "Show alerts", type: "boolean", scope: "personal" },
      ],
    },
  };
  const archive = Buffer.from(zipSync({ "holdall.plugin.json": Buffer.from(JSON.stringify(manifest)), "w.html": Buffer.from("<p>w</p>") }));
  await page.goto("/plugins");
  await page.getByLabel("Plugin archive").setInputFiles({ name: "weather.zip", mimeType: "application/zip", buffer: archive });
  await page.getByRole("button", { name: "Review the plugin" }).click();
  await page.getByRole("button", { name: "Accept and install" }).click();
  await page.waitForURL("/plugins");
  await page.getByRole("group", { name: "Use Weather" }).getByRole("button", { name: "On" }).click();
  await page.waitForTimeout(500);
  await page.goto("/plugins/com.test.weather/settings");
  await page.getByLabel("City").fill("Lisbon");
  await page.getByLabel("Units").selectOption("c");
  await page.getByRole("button", { name: "Save settings" }).first().click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("City")).toHaveValue("Lisbon");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  const missing = await page.goto("/plugins/com.test.nothing/settings");
  expect(missing?.status()).toBe(404);
});

test("a plugin page has sub pages in the side bar and a shareable address", async ({ page }) => {
  await signIn(page);
  const html = `<!doctype html><html><body><p id="where">...</p><button id="go">Go</button><script>
let next = 0; const waiting = new Map();
addEventListener("message", (event) => {
  const data = event.data;
  if (event.source !== parent || !data) return;
  if (data.type === "holdall:navigate") document.getElementById("where").textContent = "at:" + data.path;
  if (data.type !== "holdall:response") return;
  const call = waiting.get(data.id); waiting.delete(data.id);
  data.error ? call.reject(new Error(data.error)) : call.resolve(data.result);
});
function holdall(method, params) { const id = ++next; return new Promise((resolve, reject) => { waiting.set(id, { resolve, reject }); parent.postMessage({ type: "holdall:request", id, method, params }, "*"); }); }
document.getElementById("where").textContent = "at:" + new URLSearchParams(location.search).get("path");
document.getElementById("go").onclick = () => holdall("page.navigate", { path: "channels/abc" });
</script></body></html>`;
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/></svg>`;
  const manifest = {
    id: "com.test.tv",
    name: "TV",
    version: "1.0.0",
    type: "module",
    author: { name: "Test" },
    license: "MIT",
    holdall: ">=0.0.1",
    permissions: ["ui:slots"],
    entry: { ui: "page.html" },
    contributes: { page: { title: "TV", entry: "page.html", icon: "icon.svg", pages: [{ title: "Live", path: "live" }, { title: "Saved", path: "saved" }] } },
  };
  const archive = Buffer.from(zipSync({ "holdall.plugin.json": Buffer.from(JSON.stringify(manifest)), "page.html": Buffer.from(html), "icon.svg": Buffer.from(icon) }));
  await page.goto("/plugins");
  await page.getByLabel("Plugin archive").setInputFiles({ name: "tv.zip", mimeType: "application/zip", buffer: archive });
  await page.getByRole("button", { name: "Review the plugin" }).click();
  await page.getByRole("button", { name: "Accept and install" }).click();
  await page.waitForURL("/plugins");
  await page.getByRole("group", { name: "Use TV" }).getByRole("button", { name: "On" }).click();
  await page.waitForTimeout(500);
  await page.goto("/p/com.test.tv/live");
  const frame = page.frameLocator("iframe[title='TV']");
  await expect(frame.locator("#where")).toHaveText("at:live");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("link", { name: "Saved" }).click();
  await page.waitForURL("/p/com.test.tv/saved");
  await expect(frame.locator("#where")).toHaveText("at:saved");
  await frame.locator("#go").click();
  await page.waitForURL("/p/com.test.tv/channels/abc");
  const response = await page.goto("/p/com.test.tv/..%2F..%2Fadmin");
  expect(response?.status()).toBe(404);
});

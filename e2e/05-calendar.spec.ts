import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("create, find and delete an event", async ({ page }) => {
  await signIn(page);
  await page.goto("/calendar");
  await page.getByRole("button", { name: "New event", exact: true }).click();
  await page.getByLabel("Title").fill("Dentist");
  await page.getByRole("button", { name: "Save event" }).click();
  await expect(page.getByRole("button", { name: /Dentist/ })).toBeVisible();

  await page.getByRole("button", { name: "Agenda" }).click();
  await page.getByRole("button", { name: /Dentist/ }).click();
  await expect(page.getByRole("form", { name: "Edit event" })).toBeVisible();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete event" }).click();
  await expect(page.getByText("Nothing planned in this period.")).toBeVisible();
});

test("calendar accounts page explains missing providers", async ({ page }) => {
  await signIn(page);
  await page.goto("/calendar/accounts");
  await expect(page.getByRole("heading", { level: 1, name: "Calendar accounts" })).toBeVisible();
  await expect(page.getByText("No account connected.", { exact: false })).toBeVisible();
  await expect(page.getByText("Want Google Calendar or Outlook here?")).toBeVisible();
  await expect(page.getByRole("link", { name: "Step by step guide" })).toHaveAttribute("href", "https://holdall.site/docs/install/calendar-sync/");
});

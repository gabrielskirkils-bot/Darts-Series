import { expect, test } from "@playwright/test";

// SPEC 8.8 (UI side): anonymous users see public pages without any write actions.

test("players page is public and read-only", async ({ page }) => {
  await page.goto("/players");
  await expect(page.getByRole("heading", { name: "Players" })).toBeVisible();
  await expect(page.getByLabel("Search players")).toBeVisible();
  await expect(page.getByRole("button", { name: /Add player/ })).toHaveCount(0);
});

test("settings asks anonymous users to log in", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText("Settings are for organizers")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
  await page.getByRole("link", { name: "Log in" }).last().click();
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings|\/login\?next=\/settings/);
});

test("login page validates the email before sending", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Send login link" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
});

test("an invalid magic link shows a friendly error", async ({ page }) => {
  await page.goto("/auth/callback?code=invalid&next=/settings");
  await expect(page).toHaveURL(/\/login\?error=link/);
  await expect(page.getByText("invalid or has expired")).toBeVisible();
});

test("tournaments list is public and read-only", async ({ page }) => {
  await page.goto("/tournaments");
  await expect(page.getByRole("heading", { name: "Tournaments" })).toBeVisible();
  await expect(page.getByRole("link", { name: /New tournament/ })).toHaveCount(0);
});

test("a tournament page shows no organizer actions", async ({ page }) => {
  await page.goto("/tournaments");
  const first = page.locator('a[href^="/t/"]').first();
  test.skip((await first.count()) === 0, "No tournament to open");
  await first.click();
  await expect(page.getByRole("tab", { name: "Matches" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete tournament" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Enter result|Edit result/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Board 1" })).toHaveCount(0);
});

test("the wizard asks anonymous users to log in", async ({ page }) => {
  await page.goto("/tournaments/new");
  await expect(page.getByText("Creating tournaments is for organizers")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create tournament" })).toHaveCount(0);
});

test("an unknown tournament shows not found", async ({ page }) => {
  await page.goto("/t/00000000-0000-0000-0000-000000000000");
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
});

test("an unknown player shows not found", async ({ page }) => {
  // Streamed inside <Suspense>, so the HTTP status stays 200; check the rendered page.
  await page.goto("/players/00000000-0000-0000-0000-000000000000");
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
});

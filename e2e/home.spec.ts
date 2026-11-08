import { expect, test } from "@playwright/test";

test("home page loads public data without login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ranking" })).toBeVisible();
  // Either the onboarding (no finished tournaments yet) or the ranking itself.
  await expect(page.getByText(/No tournaments yet|All time/).first()).toBeVisible();
  await expect(page.getByText("Couldn't load data")).toHaveCount(0);
});

test("no horizontal scroll", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

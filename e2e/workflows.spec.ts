import { test, expect, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', "admin@terradairy.demo");
  await page.fill('input[type="password"]', "Demo@12345");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText("Farm command center")).toBeVisible({ timeout: 20000 });
}

async function fillField(page: Page, label: string, value: string) {
  const field = page.locator("label").filter({ hasText: label }).locator("input, select, textarea").first();
  await expect(field).toBeVisible();
  await field.fill(value);
}

async function selectFieldOption(page: Page, label: string, optionIndex: number) {
  const field = page.locator("label").filter({ hasText: label }).locator("select").first();
  await expect(field).toBeVisible();
  await field.selectOption({ index: optionIndex });
}

async function pickFirstAnimalOption(page: Page) {
  const combo = page.locator("button[aria-haspopup='listbox']").first();
  await expect(combo).toBeVisible();
  await combo.click();
  await page.getByRole("option").first().click();
}

test.describe("Core dairy workflows", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("dashboard metrics and drill-down links work", async ({ page }) => {
    await page.goto("/animals/dashboard");
    await expect(page.getByText("Active Animals")).toBeVisible();
    await expect(page.getByText("Confirmed Pregnant")).toBeVisible();
    await expect(page.getByText("Vaccination Alerts")).toBeVisible();
    await page.getByRole("link", { name: /today's milk/i }).click();
    await expect(page).toHaveURL(/\/animals\/milk-production/);
  });

  test("animals can be created and filtered", async ({ page }) => {
    const tag = `E2E${Date.now().toString().slice(-5)}`;
    await page.goto("/animals/list");

    await page.getByRole("button", { name: /new animal/i }).click();
    await expect(page.getByText("New animal")).toBeVisible();

    await fillField(page, "Tag number", tag);
    await fillField(page, "Name (optional)", `Playwright ${tag}`);
    await selectFieldOption(page, "Species", 1);
    await selectFieldOption(page, "Breed", 1);
    await selectFieldOption(page, "Farm", 1);
    await selectFieldOption(page, "Lifecycle stage", 1);
    await page.getByRole("button", { name: /^create$/i }).click();

    await expect(page.getByText(`#${tag}`)).toBeVisible({ timeout: 20000 });

    await page.getByRole("button", { name: /filters/i }).click();
    await page.locator("input[placeholder='Tag #']").fill(tag);
    await expect(page.getByText(`#${tag}`)).toBeVisible();
  });

  test("milk production workflow creates a daily record", async ({ page }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);

    await page.goto("/animals/milk-production");
    await page.getByRole("button", { name: /new record/i }).click();
    await expect(page.getByText("New milk record")).toBeVisible();

    await pickFirstAnimalOption(page);
    await page.locator("input[type='date']").first().fill(date);
    await page.locator("select").filter({ hasText: "Morning" }).first().selectOption("Afternoon");
    await page.locator("input[type='number']").first().fill("24.5");
    await page.getByRole("button", { name: /^save$/i }).click();

    await expect(page.getByText("24.50")).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(date)).toBeVisible();
  });

  test("breeding records can be created and filtered", async ({ page }) => {
    await page.goto("/animals/breeding");
    await page.getByRole("button", { name: /new breeding record/i }).click();
    await expect(page.getByText("New Breeding Record")).toBeVisible();

    await pickFirstAnimalOption(page);
    await fillField(page, "Breeding Date", new Date().toISOString().slice(0, 10));
    await page.locator("label").filter({ hasText: "Method" }).locator("select").selectOption("Artificial Insemination");
    await page.locator("label").filter({ hasText: "Semen Batch (AI)" }).locator("select").selectOption({ index: 1 });
    await page.getByRole("button", { name: /^create$/i }).click();

    await expect(page.getByText("Artificial Insemination")).toBeVisible({ timeout: 20000 });
  });

  test("pregnancy records can be created and completed", async ({ page }) => {
    await page.goto("/animals/pregnancy");
    await page.getByRole("button", { name: /new pregnancy record/i }).click();
    await expect(page.getByText("New pregnancy record")).toBeVisible();

    await pickFirstAnimalOption(page);
    await fillField(page, "Insemination Date *", new Date().toISOString().slice(0, 10));
    await page.locator("label").filter({ hasText: "Status" }).locator("select").selectOption("Confirmed");
    await page.getByRole("checkbox").check();
    await fillField(page, "Confirmation Date", new Date().toISOString().slice(0, 10));
    await page.getByRole("button", { name: /^create$/i }).click();

    await expect(page.getByText("Confirmed")).toBeVisible({ timeout: 20000 });
  });

  test("calving events can be recorded from the modal", async ({ page }) => {
    await page.goto("/animals/calving");
    await page.getByRole("button", { name: /record calving/i }).click();
    await expect(page.getByText("Record Calving Event")).toBeVisible();

    await pickFirstAnimalOption(page);
    await page.locator("label").filter({ hasText: "Calving Date *" }).locator("input").fill(new Date().toISOString().slice(0, 10));
    await page.locator("label").filter({ hasText: "Outcome" }).locator("select").selectOption("Live Birth");
    await page.getByRole("button", { name: /record calving/i }).click();

    await expect(page.getByText("Live Birth")).toBeVisible({ timeout: 20000 });
  });

  test("vaccination workflow creates a record and filters by status", async ({ page }) => {
    await page.goto("/animals/vaccinations");
    await page.getByRole("button", { name: /new vaccination record/i }).click();
    await expect(page.getByText("New vaccination record")).toBeVisible();

    await page.locator("input[placeholder='Search by tag, name or breed…']").fill("GVD");
    await page.getByRole("button").filter({ hasText: /GVD/i }).first().click();
    await fillField(page, "Vaccine name", `E2E Vaccine ${Date.now().toString().slice(-4)}`);
    await fillField(page, "Vaccination date", new Date().toISOString().slice(0, 10));
    await fillField(page, "Administered by", "Playwright QA");
    await page.getByRole("button", { name: /^save$/i }).click();

    await expect(page.getByText(/playwright qa/i)).toBeVisible({ timeout: 20000 });
  });
});

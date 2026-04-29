import { expect, test } from "@playwright/test";
import { createSmokeValue, selectOptionContainingText } from "./utils";

function buildKosovoIban(seed: string) {
  const digits = seed.replace(/\D/g, "").slice(-18).padStart(18, "7");
  return `XK${digits}`;
}

test.describe.serial("banking settings smoke", () => {
  test.setTimeout(90_000);

  const seed = createSmokeValue("banking");
  const bankName = `Banking Smoke Bank ${seed}`;
  const bankSwift = "SMOKXKPR";
  const bankAccountName = `Banking Account ${seed}`;
  const cashAccountName = `Banking Cash ${seed}`;
  const iban = buildKosovoIban(seed);

  test("licensed bank plus bank and cash company accounts can be configured", async ({
    page,
  }) => {
    await page.goto("/settings/banking/banks/new");
    await expect(
      page.getByRole("heading", { name: "Add Licensed Bank" })
    ).toBeVisible();
    await page.getByLabel("Bank Name").fill(bankName);
    await page.getByLabel("Country").fill("Kosovo");
    await page.getByLabel("SWIFT / BIC").fill(bankSwift);
    await page.getByRole("button", { name: "Add Bank" }).click();

    await page.waitForURL(/\/settings\/banking$/);
    const bankRegistryRow = page.getByRole("row").filter({ hasText: bankName });
    await expect(bankRegistryRow).toBeVisible();
    await expect(bankRegistryRow).toContainText(bankSwift);
    await expect(bankRegistryRow).toContainText("Kosovo");
    await expect(
      page.getByText("Detection tooling is internal")
    ).toBeVisible();

    await page.goto("/settings/banking/new");
    await expect(
      page.getByRole("heading", { name: "Add Company Account" })
    ).toBeVisible();
    await page.locator('select[name="account_type"]').selectOption("bank");
    await selectOptionContainingText(page.locator('select[name="bank_id"]'), bankName);
    await page.getByLabel("Account Name").fill(bankAccountName);
    await page.getByLabel("Display Bank Name").fill(bankName);
    await page.getByLabel("IBAN").fill(iban);
    await page.getByLabel("SWIFT / BIC").fill(bankSwift);
    const bankAccountForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Add Account" }),
    });
    const bankFormValidity = await bankAccountForm.evaluate((form) => {
      if (!(form instanceof HTMLFormElement)) {
        return [{ name: "form", message: "Not a form element" }];
      }

      return Array.from(form.elements)
        .filter((element) => {
          return (
            element instanceof HTMLInputElement ||
            element instanceof HTMLSelectElement ||
            element instanceof HTMLTextAreaElement
          );
        })
        .filter((element) => !element.checkValidity())
        .map((element) => ({
          name: element.getAttribute("name") || element.id,
          message: element.validationMessage,
          value: element.value,
        }));
    });
    expect(bankFormValidity).toEqual([]);
    await page.getByRole("button", { name: "Add Account" }).click();

    await expect(page.getByRole("button", { name: "Saving..." })).toHaveCount(0);
    await expect(page.getByText("Unable to save bank account")).toHaveCount(0);
    await page.waitForURL(/\/settings\/banking$/);
    const bankAccountRow = page
      .getByRole("row")
      .filter({ hasText: bankAccountName });
    await expect(bankAccountRow).toBeVisible();
    await expect(bankAccountRow).toContainText(bankName);
    await expect(bankAccountRow).toContainText(iban.slice(-4));
    await expect(bankAccountRow).toContainText(bankSwift);
    await expect(bankAccountRow).toContainText("Invoice Visible");

    await page.goto("/settings/banking/new");
    await page.locator('select[name="account_type"]').selectOption("cash");
    await page.getByLabel("Account Name").fill(cashAccountName);
    await page.getByLabel("Display Label").fill(cashAccountName);
    await page.getByRole("button", { name: "Add Account" }).click();

    await expect(page.getByRole("button", { name: "Saving..." })).toHaveCount(0);
    await expect(page.getByText("Unable to save bank account")).toHaveCount(0);
    await page.waitForURL(/\/settings\/banking$/);
    const cashAccountRow = page
      .getByRole("row")
      .filter({ hasText: cashAccountName });
    await expect(cashAccountRow).toBeVisible();
    await expect(cashAccountRow).toContainText("Cash");
    await expect(cashAccountRow).toContainText("Hidden On Invoice");
  });
});

import { expect, type Locator, type Page } from "@playwright/test";

export const AUTH_FILE = "playwright/.auth/user.json";

export function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Add it before running Playwright.`
    );
  }

  return value;
}

export function createSmokeValue(prefix: string) {
  const datePart = new Date().toISOString().replace(/[:.]/g, "-");
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${datePart}-${randomPart}`;
}

export async function selectFirstRealOption(locator: Locator) {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();

  const optionValue = await locator.evaluate((node) => {
    if (!(node instanceof HTMLSelectElement)) {
      throw new Error("Locator is not attached to a select element.");
    }

    const option = Array.from(node.options).find(
      (candidate) => !candidate.disabled && candidate.value
    );

    if (!option) {
      throw new Error("No selectable option is available.");
    }

    return option.value;
  });

  await locator.selectOption(optionValue);
  return optionValue;
}

export async function selectOptionContainingText(
  locator: Locator,
  text: string
) {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();

  const optionValue = await locator.evaluate(
    (node, searchText) => {
      if (!(node instanceof HTMLSelectElement)) {
        throw new Error("Locator is not attached to a select element.");
      }

      const normalizedSearchText = searchText.toLowerCase();
      const option = Array.from(node.options).find((candidate) => {
        return (
          !candidate.disabled &&
          candidate.value &&
          candidate.text.toLowerCase().includes(normalizedSearchText)
        );
      });

      if (!option) {
        throw new Error(`No option contains "${searchText}".`);
      }

      return option.value;
    },
    text
  );

  await locator.selectOption(optionValue);
  return optionValue;
}

export async function selectRadixOption(
  page: Page,
  labelText: string,
  optionText: string
) {
  const field = page
    .locator("div")
    .filter({
      has: page.locator("label", { hasText: labelText }),
    })
    .first();

  await expect(field).toBeVisible();
  await field.getByRole("combobox").click();
  await page.getByRole("option", { name: optionText, exact: true }).click();
}

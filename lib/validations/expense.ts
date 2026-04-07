import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

export function parseAmountToCents(value: string): number {
  const normalized = value.replace(",", ".").trim();

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Amount must be a positive number with up to 2 decimal places.");
  }

  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));

  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error("Amount must be greater than 0.");
  }

  return cents;
}

export const expenseSchema = z.object({
  expense_date: z.string().min(1, "Expense date is required."),
  amount: z.string().trim().min(1, "Amount is required."),
  description: z
    .string()
    .trim()
    .min(1, "Description is required.")
    .max(500, "Description must be 500 characters or fewer."),
  expense_category_id: z.string().uuid("Category is required."),
  vendor_id: z.preprocess(emptyToUndefined, z.string().uuid("Vendor is invalid.").optional()),
  property_id: z.preprocess(emptyToUndefined, z.string().uuid("Property is invalid.").optional()),
  notes: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(1000, "Notes must be 1000 characters or fewer.").optional(),
  ),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
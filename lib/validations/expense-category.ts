import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

export const expenseCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required.")
    .max(100, "Category name must be 100 characters or fewer."),
  description: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(500, "Description must be 500 characters or fewer.").optional(),
  ),
  sort_order: z.coerce
    .number()
    .int("Sort order must be a whole number.")
    .min(0, "Sort order cannot be negative.")
    .max(999999, "Sort order is too large."),
  is_active: z.boolean().default(true),
});

export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>;
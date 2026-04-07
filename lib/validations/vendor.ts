import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

export const vendorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Vendor name is required.")
    .max(150, "Vendor name must be 150 characters or fewer."),
  contact_person: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(150, "Contact person must be 150 characters or fewer.").optional(),
  ),
  email: z.preprocess(
    emptyToUndefined,
    z.string().trim().email("Email is invalid.").max(255, "Email is too long.").optional(),
  ),
  phone: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(50, "Phone must be 50 characters or fewer.").optional(),
  ),
  address: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(500, "Address must be 500 characters or fewer.").optional(),
  ),
  notes: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(1000, "Notes must be 1000 characters or fewer.").optional(),
  ),
  is_active: z.boolean().default(true),
});

export type VendorInput = z.infer<typeof vendorSchema>;
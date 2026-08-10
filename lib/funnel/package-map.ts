/**
 * Maps commercial package keys (from FOUNDING_PACKAGES) to
 * operational package UUIDs in the app's packages table.
 *
 * The canonical package IDs are created by migration
 * 20260810140000_create_canonical_launch_packages.sql.
 */
import { type FoundingPackageKey } from "./definitions";

export const COMMERCIAL_PACKAGE_MAP: Record<
  FoundingPackageKey,
  { packageId: string; serviceId: string }
> = {
  essential_check: {
    packageId: "e0000000-0000-4000-a000-000000000002",
    serviceId: "e0000000-0000-4000-a000-000000000001",
  },
  care_plus: {
    packageId: "e0000000-0000-4000-a000-000000000003",
    serviceId: "e0000000-0000-4000-a000-000000000001",
  },
  arrival_ready: {
    packageId: "e0000000-0000-4000-a000-000000000004",
    serviceId: "e0000000-0000-4000-a000-000000000001",
  },
};

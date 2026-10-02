import type { PrismaClient } from "@prisma/client";

/**
 * Creates `email` as PortalRole.ADMIN if no user exists yet, or promotes an
 * existing user otherwise -- idempotent, safe to re-run. This is the only
 * way to grant ADMIN in this product: an explicit, audited action run once
 * per environment (see prisma/seed.ts), never a standing runtime check like
 * an env-var allowlist or an auto-promoted first sign-in.
 *
 * Promoting an existing user leaves their `tenantId` untouched -- a
 * portal-operator admin isn't required to belong to any tenant (see the
 * nullable `tenantId` note on the `User` model), and a tenant-scoped
 * MEMBER being promoted to also act as an operator shouldn't lose their
 * tenant link.
 */
export async function seedAdmin(prisma: PrismaClient, email: string) {
  // Lowercased, unlike route.ts's ownerEmail handling (which stores
  // whatever case the operator typed): Auth.js's email provider normalizes
  // the identifier to lowercase (@auth/core's default `normalizeIdentifier`,
  // `email.toLowerCase().trim()`) before every `getUserByEmail` lookup at
  // sign-in. A seeded row stored in its original case would never match
  // that lookup -- the admin's magic link would silently create a second,
  // MEMBER-role row instead of signing in as the seeded ADMIN.
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new Error("seedAdmin: email must not be empty");
  }
  return prisma.user.upsert({
    where: { email: normalized },
    create: { email: normalized, role: "ADMIN" },
    update: { role: "ADMIN" },
  });
}

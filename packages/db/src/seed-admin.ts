import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "./password";

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
 * tenant link. Promoting also never overwrites an existing password hash
 * with `password` -- re-running this to re-grant ADMIN must not silently
 * reset a password the user may have already been using.
 */
export async function seedAdmin(prisma: PrismaClient, email: string, password: string) {
  // Lowercased to match apps/web/lib/auth.ts's authorize(), which
  // normalizes the same way before its lookup -- a seeded row stored in
  // its original case would never match that lookup, so the admin's own
  // credentials would silently fail to find this row.
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new Error("seedAdmin: email must not be empty");
  }
  if (!password) {
    throw new Error("seedAdmin: password must not be empty");
  }

  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (!existing) {
    const passwordHash = await hashPassword(password);
    return prisma.user.create({ data: { email: normalized, role: "ADMIN", passwordHash } });
  }

  if (existing.passwordHash) {
    return prisma.user.update({ where: { email: normalized }, data: { role: "ADMIN" } });
  }
  const passwordHash = await hashPassword(password);
  return prisma.user.update({ where: { email: normalized }, data: { role: "ADMIN", passwordHash } });
}

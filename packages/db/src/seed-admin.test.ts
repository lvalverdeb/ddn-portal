import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { verifyPassword } from "./password";
import { seedAdmin } from "./seed-admin";

/**
 * Skipped (not failed) when no disposable database is configured, same
 * convention as apps/web/lib/auth.test.ts. Point
 * AUTH_ADAPTER_TEST_DATABASE_URL at a throwaway Postgres -- this creates
 * and deletes real rows.
 */
describe("seedAdmin", () => {
  const databaseUrl = process.env.AUTH_ADAPTER_TEST_DATABASE_URL;
  const prisma = databaseUrl
    ? new PrismaClient({ datasources: { db: { url: databaseUrl } } })
    : undefined;

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it.skipIf(!databaseUrl)("creates a new user as ADMIN, tenant-less, with a working password", async () => {
    const email = `seed-admin-test-${randomUUID()}@example.com`;
    try {
      const user = await seedAdmin(prisma!, email, "seed-admin-password");
      expect(user.role).toBe("ADMIN");
      expect(user.tenantId).toBeNull();
      expect(await verifyPassword("seed-admin-password", user.passwordHash!)).toBe(true);
    } finally {
      await prisma!.user.deleteMany({ where: { email } });
    }
  });

  it.skipIf(!databaseUrl)(
    "promotes an existing non-admin user to ADMIN without touching their tenant",
    async () => {
      const email = `seed-admin-test-${randomUUID()}@example.com`;
      const slug = `seed-admin-test-${randomUUID()}`;
      try {
        const tenant = await prisma!.tenant.create({
          data: { name: "Seed admin test tenant", slug, ddnBaseUrl: "https://example.com", ddnCustomerId: slug },
        });
        await prisma!.user.create({ data: { email, role: "MEMBER", tenantId: tenant.id } });

        const user = await seedAdmin(prisma!, email, "seed-admin-password");
        expect(user.role).toBe("ADMIN");
        expect(user.tenantId).toBe(tenant.id);
      } finally {
        await prisma!.user.deleteMany({ where: { email } });
        await prisma!.tenant.deleteMany({ where: { slug } });
      }
    },
  );

  it.skipIf(!databaseUrl)(
    "re-running with the same email is idempotent and keeps the original password",
    async () => {
      const email = `seed-admin-test-${randomUUID()}@example.com`;
      try {
        const first = await seedAdmin(prisma!, email, "first-password");
        const second = await seedAdmin(prisma!, email, "second-password");
        expect(second.id).toBe(first.id);
        expect(second.role).toBe("ADMIN");
        // Re-granting ADMIN must not clobber a password already set.
        expect(await verifyPassword("first-password", second.passwordHash!)).toBe(true);
        expect(await verifyPassword("second-password", second.passwordHash!)).toBe(false);
      } finally {
        await prisma!.user.deleteMany({ where: { email } });
      }
    },
  );

  it.skipIf(!databaseUrl)("rejects an empty email", async () => {
    await expect(seedAdmin(prisma!, "   ", "some-password")).rejects.toThrow();
  });

  it.skipIf(!databaseUrl)("rejects an empty password", async () => {
    const email = `seed-admin-test-${randomUUID()}@example.com`;
    await expect(seedAdmin(prisma!, email, "")).rejects.toThrow();
  });

  it.skipIf(!databaseUrl)(
    "normalizes to lowercase, matching the Credentials provider's sign-in lookup",
    async () => {
      const email = `Seed-Admin-Test-${randomUUID()}@Example.com`;
      try {
        const user = await seedAdmin(prisma!, email, "seed-admin-password");
        expect(user.email).toBe(email.trim().toLowerCase());
      } finally {
        await prisma!.user.deleteMany({ where: { email: email.toLowerCase() } });
      }
    },
  );
});

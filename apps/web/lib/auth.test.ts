import { randomUUID } from "node:crypto";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@ddn-portal/db";
import { afterAll, describe, expect, it } from "vitest";

/**
 * @auth/prisma-adapter's implementation hard-codes `prisma.user.*`,
 * `prisma.session.*`, etc. (not visible to tsc -- its .d.ts types the
 * `prisma` parameter generically), so a schema/adapter mismatch only
 * surfaces at runtime. This exercises the exact chain the Nodemailer
 * (magic-link) provider drives with database sessions: a token is issued
 * and consumed before a user even exists, then session lookup runs on
 * every subsequent request.
 *
 * Skipped (not failed) when no disposable database is configured --
 * nothing else in this repo's test suite touches a real database yet.
 * Point AUTH_ADAPTER_TEST_DATABASE_URL at a throwaway Postgres (never a
 * real dev/prod database: this test creates and deletes real rows).
 */
describe("auth adapter wiring", () => {
  const databaseUrl = process.env.AUTH_ADAPTER_TEST_DATABASE_URL;
  const prisma = databaseUrl
    ? new PrismaClient({ datasources: { db: { url: databaseUrl } } })
    : undefined;

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it.skipIf(!databaseUrl)(
    "runs the full magic-link + database-session chain against a real database",
    async () => {
      const adapter = PrismaAdapter(prisma!);
      const email = `adapter-test-${randomUUID()}@example.com`;
      const token = randomUUID();

      try {
        await adapter.createVerificationToken!({
          identifier: email,
          token,
          expires: new Date(Date.now() + 3600_000),
        });

        const used = await adapter.useVerificationToken!({ identifier: email, token });
        expect(used).not.toBeNull();

        expect(await adapter.getUserByEmail!(email)).toBeNull();

        const user = await adapter.createUser!({ email, emailVerified: null } as never);
        expect(user.id).toBeTruthy();
        expect(user.email).toBe(email);

        const session = await adapter.createSession!({
          sessionToken: randomUUID(),
          userId: user.id,
          expires: new Date(Date.now() + 3600_000),
        });

        const got = await adapter.getSessionAndUser!(session.sessionToken);
        expect(got?.user.id).toBe(user.id);
      } finally {
        await prisma!.user.deleteMany({ where: { email } });
      }
    },
  );
});

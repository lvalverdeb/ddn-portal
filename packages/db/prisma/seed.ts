import { prisma } from "../src/index";
import { seedAdmin } from "../src/seed-admin";

/**
 * CLI entrypoint: `pnpm --filter @ddn-portal/db seed` (or `pnpm db:seed`
 * from the repo root), with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`
 * set in the environment. Deliberately not wired into Prisma's `migrate
 * dev`/`migrate reset` auto-seed hook -- granting ADMIN is a
 * run-it-yourself, per-environment action, not something every migration
 * should attempt.
 */
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email) {
    throw new Error(
      "SEED_ADMIN_EMAIL is required -- set it to the email that should become " +
        "PortalRole.ADMIN and re-run `pnpm --filter @ddn-portal/db seed`.",
    );
  }
  if (!password) {
    throw new Error(
      "SEED_ADMIN_PASSWORD is required -- set it to the password that admin should " +
        "sign in with and re-run `pnpm --filter @ddn-portal/db seed`.",
    );
  }
  const admin = await seedAdmin(prisma, email, password);
  console.log(`Seeded admin: ${admin.email} (${admin.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

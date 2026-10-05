import { verifyPassword } from "@ddn-portal/db";
import { prisma } from "./db";

/**
 * Normalizes and checks email/password against the stored hash --
 * kept in its own module, separate from `auth.ts`'s `NextAuth(...)` call,
 * so it can be unit-tested directly: importing `auth.ts` pulls in all of
 * `next-auth`, which in turn imports `next/server` and only resolves
 * inside the Next.js runtime, not under plain vitest.
 *
 * Returns the fields NextAuth needs for the session user, or `null` on
 * any failure (unknown email, no password set yet, wrong password) --
 * deliberately not distinguishing which, so a failed attempt can't be
 * used to enumerate which emails have accounts.
 */
export async function verifyCredentials(
  rawEmail: unknown,
  rawPassword: unknown,
): Promise<{ id: string; email: string; name: string | null } | null> {
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : undefined;
  const password = typeof rawPassword === "string" ? rawPassword : undefined;
  if (!email || !password) return null;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  return { id: user.id, email: user.email, name: user.name };
}

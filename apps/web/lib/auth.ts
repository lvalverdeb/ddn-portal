import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./db";
import { verifyCredentials } from "./verify-credentials";

/**
 * JWT sessions, not database -- Auth.js hard-enforces this for the
 * Credentials provider (it throws `UnsupportedStrategy` otherwise;
 * @auth/core's lib/utils/assert.js). That gives up the previous design's
 * "revoke a row, lose access on the very next request" guarantee for
 * free, since nothing re-checks a JWT against the database on its own.
 *
 * The `jwt` callback below compensates: @auth/core's session() action
 * decodes the JWT and re-invokes `callbacks.jwt` on *every* session read,
 * not just at sign-in, so doing a Prisma lookup there and returning
 * `null` when the user no longer exists reproduces the same per-request
 * revocation latency as a database session, just checked from the JWT
 * path instead of the session-table path.
 *
 * What this does NOT cover (see CLAUDE.md-style call-out, not silently
 * dropped): revoking one session while leaving others valid, and
 * invalidating outstanding tokens on a password change -- a token stays
 * valid until it expires. `maxAge` below bounds that window to 12h, which
 * `session()`'s refresh-on-every-read makes behave as an idle timeout
 * rather than a forced re-login. No login-attempt throttling either.
 *
 * Credentials replaced the v1 magic-link (Nodemailer) provider so sign-in
 * doesn't round-trip through email. `tenant-context.ts` and the admin
 * routes resolve the session by `session.user.email` and re-query Prisma
 * themselves -- they never trusted session claims directly, so none of
 * that needed to change.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: (credentials) => verifyCredentials(credentials?.email, credentials?.password),
    }),
  ],
  callbacks: {
    async jwt({ token }) {
      if (!token.email) return token;
      const user = await prisma.user.findUnique({ where: { email: token.email } });
      if (!user) return null;
      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
});

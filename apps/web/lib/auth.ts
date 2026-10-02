import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Email from "next-auth/providers/email";
import { prisma } from "./db";

/**
 * Database sessions, not JWT: a portal session gates access to a tenant's
 * DDN credential, so revoking a compromised account has to take effect
 * immediately on the next request, not wait for a JWT to expire.
 *
 * Email (magic link) is the v1 provider -- no password to manage, no OAuth
 * app registration needed per customer. Swappable later; nothing else in
 * this repo depends on which provider issued the session, only on the
 * session existing and `tenant-context.ts` resolving a `PortalUser` from it.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    Email({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: "/login",
  },
});

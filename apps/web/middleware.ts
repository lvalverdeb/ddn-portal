import { NextResponse, type NextRequest } from "next/server";

// Auth.js's session-token cookie name (unprefixed on http, `__Secure-`
// prefixed once the request is https) -- confirmed by reading
// node_modules/.pnpm/@auth+core*/node_modules/@auth/core/lib/utils/cookie.js's
// defaultCookies(). Not imported from next-auth: there is no exported
// constant for it.
const SESSION_COOKIE = "authjs.session-token";
const SECURE_SESSION_COOKIE = `__Secure-${SESSION_COOKIE}`;

/**
 * Route guard: everything except /login and the auth/webhook API routes
 * requires a session. This is an optimistic cookie-*presence* check only,
 * not a real session lookup -- deliberately. Database sessions (this app's
 * strategy, see lib/auth.ts) can only be validated with a Prisma query,
 * and middleware runs on the Edge runtime, which can't make one. Importing
 * the full lib/auth.ts here to call its `auth()` wrapper was tried first
 * and crashes at runtime ("The edge runtime does not support Node.js
 * 'stream' module"): that config's Nodemailer provider and PrismaAdapter
 * both pull in Node-only modules, invisible to `tsc`/`next build` because
 * neither executes middleware -- the same class of edge-invisible defect
 * as the original auth-adapter bug.
 *
 * So this only gates the obvious case (no cookie at all). A forged or
 * stale cookie value still fails the real check: `requireTenantContext()`
 * and `requireAdmin()` both do a genuine Prisma lookup in the Node.js
 * runtime on every request, same as if this middleware didn't exist.
 */
export default function middleware(req: NextRequest) {
  const isPublic =
    req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/api/auth");
  if (isPublic) return NextResponse.next();

  const hasSessionCookie =
    req.cookies.has(SESSION_COOKIE) || req.cookies.has(SECURE_SESSION_COOKIE);
  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

import { auth } from "./lib/auth";

/**
 * Route guard: everything except /login and the auth/webhook API routes
 * requires a session. Tenant resolution itself happens per-request in
 * `lib/tenant-context.ts`, not here -- this only gates "is anyone signed
 * in."
 */
export default auth((req) => {
  const isPublic =
    req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/api/auth");
  if (!req.auth && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

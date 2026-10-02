/**
 * Phase 2 builds the real read-only profile view (facilities, priority
 * tiers, assignment rule) from the tenant's cached DDN profile. This
 * placeholder exercises the route/auth structure ahead of that work.
 *
 * middleware.ts only checks that a session cookie is present -- it cannot
 * validate it (database sessions need a Prisma query, impossible on the
 * Edge runtime middleware runs under). Once this page renders real tenant
 * data, it must call requireTenantContext() itself, same as the API routes.
 */
export default function ProfilePage() {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>DDN Profile</h1>
      <p>Read-only profile view ships in phase 2.</p>
    </main>
  );
}

/**
 * Phase 3 builds the real upload UI (file picker, per-batch status, the
 * flagged-row report) against `packages/bridge`. This placeholder exists so
 * phase 0's route structure and auth guard are exercised end-to-end before
 * that work starts.
 *
 * middleware.ts only checks that a session cookie is present -- it cannot
 * validate it (database sessions need a Prisma query, impossible on the
 * Edge runtime middleware runs under). Once this page renders real tenant
 * data, it must call requireTenantContext() itself, same as the API routes.
 */
export default function UploadsPage() {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Uploads</h1>
      <p>Upload UI ships in phase 3.</p>
    </main>
  );
}

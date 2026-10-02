import { redirect } from "next/navigation";
import { ProfileShapeError, parseProfileSummary } from "@ddn-portal/ddn-client";
import { NoTenantError, UnauthenticatedError, requireTenantRecord } from "@/lib/tenant-context";

const th: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #ccc" };
const td: React.CSSProperties = { borderBottom: "1px solid #eee" };

export default async function ProfilePage() {
  let tenant;
  try {
    ({ tenant } = await requireTenantRecord());
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    if (err instanceof NoTenantError) {
      return <main style={{ padding: "2rem" }}>Forbidden -- no tenant is linked to this account.</main>;
    }
    throw err;
  }

  if (!tenant.profileCache) {
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h1>DDN Profile</h1>
        <p>
          No profile has been fetched for this tenant yet. It's refreshed in the
          background after tenant creation and on a schedule -- check back shortly,
          or ask a portal admin to confirm the tenant's Profile ID is set.
        </p>
      </main>
    );
  }

  let profile;
  try {
    profile = parseProfileSummary(tenant.profileCache);
  } catch (err) {
    if (err instanceof ProfileShapeError) {
      return (
        <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
          <h1>DDN Profile</h1>
          <p style={{ color: "crimson" }}>
            The cached profile doesn't match the expected shape: {err.message}. This
            points at a DDN-side contract change -- see{" "}
            <code>tests/contract/ddn-openapi-drift.test.ts</code>.
          </p>
        </main>
      );
    }
    throw err;
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>DDN Profile</h1>
      <p>
        Version {tenant.profileVersion ?? "unknown"}, cached{" "}
        {tenant.profileCachedAt ? tenant.profileCachedAt.toISOString() : "unknown"}. This
        is a read-only cache of DDN's <code>GET /profiles/{"{id}"}</code> -- edits happen
        in DDN, not here (v2 open item).
      </p>

      <h2>Facilities</h2>
      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={th}>ID</th>
            <th style={th}>Name</th>
            <th style={th}>Roles</th>
            <th style={th}>Coords</th>
          </tr>
        </thead>
        <tbody>
          {profile.facilities.map((f) => (
            <tr key={f.id}>
              <td style={td}>{f.id}</td>
              <td style={td}>{f.name}</td>
              <td style={td}>{f.roles.join(", ")}</td>
              <td style={td}>
                {f.coords.lat.toFixed(5)}, {f.coords.lon.toFixed(5)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Assignment rule</h2>
      <p>
        Method: <strong>{profile.assignment_rule.method}</strong>, fallback:{" "}
        <strong>{profile.assignment_rule.fallback}</strong>
      </p>

      <h2>Priority tiers</h2>
      <p>Highest threshold first -- §8.1's tier offsets over the numeric priority score.</p>
      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={th}>Tier</th>
            <th style={th}>Name</th>
            <th style={th}>Low threshold</th>
          </tr>
        </thead>
        <tbody>
          {profile.objective.priority.tiers.map((band) => (
            <tr key={band.name}>
              <td style={td}>{band.tier}</td>
              <td style={td}>{band.name}</td>
              <td style={td}>{band.low.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

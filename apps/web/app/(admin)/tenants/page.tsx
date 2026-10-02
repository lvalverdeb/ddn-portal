import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function TenantsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const admin = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (admin?.role !== "ADMIN") {
    return <main style={{ padding: "2rem" }}>Forbidden -- portal-admin only.</main>;
  }

  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Tenants</h1>
      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Name</th>
            <th>Slug</th>
            <th>DDN customer_id</th>
            <th>DDN base URL</th>
            <th>Credential</th>
            <th>Spec version observed</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => (
            <tr key={t.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{t.name}</td>
              <td>{t.slug}</td>
              <td>{t.ddnCustomerId}</td>
              <td>{t.ddnBaseUrl}</td>
              <td>{t.credentialKind}</td>
              <td>{t.ddnSpecVersion ?? "not yet checked"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { NoTenantError, UnauthenticatedError, requireTenantRecord } from "@/lib/tenant-context";
import { UploadForm } from "./upload-form";

const th: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #ccc" };
const td: React.CSSProperties = { borderBottom: "1px solid #eee" };

export default async function UploadsPage() {
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

  const batches = await prisma.uploadBatch.findMany({
    where: { tenantId: tenant.id },
    orderBy: { receivedAt: "desc" },
    select: { id: true, fileName: true, status: true, receivedAt: true, processedAt: true },
  });

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Uploads</h1>
      <UploadForm />
      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={th}>File</th>
            <th style={th}>Status</th>
            <th style={th}>Received</th>
            <th style={th}>Processed</th>
          </tr>
        </thead>
        <tbody>
          {batches.length === 0 && (
            <tr>
              <td style={td} colSpan={4}>
                No uploads yet.
              </td>
            </tr>
          )}
          {batches.map((b) => (
            <tr key={b.id}>
              <td style={td}>
                <Link href={`/uploads/${b.id}`}>{b.fileName}</Link>
              </td>
              <td style={td}>{b.status}</td>
              <td style={td}>{b.receivedAt.toISOString()}</td>
              <td style={td}>{b.processedAt ? b.processedAt.toISOString() : "pending"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

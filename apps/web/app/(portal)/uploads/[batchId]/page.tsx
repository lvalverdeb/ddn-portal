import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { NoTenantError, UnauthenticatedError, requireTenantRecord } from "@/lib/tenant-context";
import type { Flag, RawEnvelopeRow } from "@ddn-portal/bridge";

const th: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #ccc" };
const td: React.CSSProperties = { borderBottom: "1px solid #eee" };

function describeFlag(flag: Flag): string {
  switch (flag.kind) {
    case "low_confidence_geocode":
      return `low-confidence geocode (confidence: ${flag.confidence})`;
    case "ambiguous_facility_assignment":
      return `ambiguous facility assignment (candidates: ${flag.candidates.join(", ")})`;
    case "unknown_priority_tier":
      return `unknown priority tier "${flag.given}" -- row was not submitted to DDN`;
  }
}

/**
 * Reads the batch and its chunks directly via Prisma rather than calling
 * GET /api/uploads/[batchId] -- same self-HTTP-call avoidance as
 * (portal)/profile/page.tsx.
 */
export default async function UploadBatchPage({ params }: { params: { batchId: string } }) {
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

  const batch = await prisma.uploadBatch.findFirst({
    where: { id: params.batchId, tenantId: tenant.id },
    include: { chunks: true },
  });

  if (!batch) {
    return <main style={{ padding: "2rem" }}>Upload not found.</main>;
  }

  const envelopeChunks = batch.chunks.filter((c) => c.kind === "ENVELOPE");
  // FLAGGED rows were sent to DDN (submittedAt set, ddnPayload populated) --
  // only an advisory caveat needs review. FAILED rows were dropped before
  // ever being sent. Conflating the two here would reproduce, in the UI,
  // the exact defect this phase's writeback fix exists to prevent: telling
  // a customer to "resubmit" a row DDN already holds, which double-submits
  // it.
  const submittedCount = envelopeChunks.filter(
    (c) => c.status === "SUBMITTED" || c.status === "FLAGGED",
  ).length;
  const flaggedChunks = envelopeChunks.filter((c) => c.status === "FLAGGED");
  const failedChunks = envelopeChunks.filter((c) => c.status === "FAILED");

  function flagTable(chunks: typeof envelopeChunks) {
    return (
      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={th}>Package ID</th>
            <th style={th}>Detail</th>
          </tr>
        </thead>
        <tbody>
          {chunks.map((chunk) => {
            const row = chunk.rawRow as unknown as RawEnvelopeRow;
            const flags = (chunk.flags as unknown as Flag[]) ?? [];
            return (
              <tr key={chunk.id}>
                <td style={td}>{row.package_id}</td>
                <td style={td}>
                  {chunk.errorMessage ? <p>{chunk.errorMessage}</p> : null}
                  <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                    {flags.map((flag, i) => (
                      <li key={i}>{describeFlag(flag)}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>{batch.fileName}</h1>
      <p>
        Status: <strong>{batch.status}</strong> &middot; received{" "}
        {batch.receivedAt.toISOString()}
        {batch.processedAt ? ` · processed ${batch.processedAt.toISOString()}` : " · processing"}
      </p>
      <p>
        {submittedCount} of {envelopeChunks.length} envelope rows submitted
        {flaggedChunks.length > 0 ? `, ${flaggedChunks.length} with a flag to review` : ""}
        {failedChunks.length > 0 ? `, ${failedChunks.length} failed and need correction` : ""}.
      </p>
      {batch.errorMessage && <p style={{ color: "crimson" }}>Batch error: {batch.errorMessage}</p>}

      {flaggedChunks.length > 0 && (
        <>
          <h2>Submitted with a flag to review</h2>
          {flagTable(flaggedChunks)}
          <p style={{ fontSize: "0.85rem", color: "#555" }}>
            These rows were accepted by DDN. Review the flag above -- do not
            resubmit them, DDN already has them.
          </p>
        </>
      )}

      {failedChunks.length > 0 && (
        <>
          <h2>Failed -- need correction</h2>
          {flagTable(failedChunks)}
          <p style={{ fontSize: "0.85rem", color: "#555" }}>
            These rows were never sent to DDN. Correct and resubmit them in a
            new file -- re-uploading the whole original file would double-submit
            the rows already accepted.
          </p>
        </>
      )}
    </main>
  );
}

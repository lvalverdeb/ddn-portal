import { createBatchSubmitter } from "@ddn-portal/bridge";
import type { Flag, RawEnvelopeRow, RawMailbagRow } from "@ddn-portal/bridge";
import { DdnClient, resolveTenantCredential, parseProfileSummary } from "@ddn-portal/ddn-client";
import { prisma } from "@ddn-portal/db";

/**
 * Drains one `PENDING` `UploadBatch`: builds the `SubmissionContext` from
 * the tenant's cached profile and credential, runs it through
 * `BridgeSubmitter`, and writes the result back onto the batch's chunks.
 * `UploadChunk`, not DDN's 202, stays the durable record -- see the schema
 * comment and the architecture plan's note on DDN's non-durable `Store`.
 */
export async function processUploadBatch(batchId: string, options: { nominatimUserAgent: string }) {
  const batch = await prisma.uploadBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: { tenant: true, chunks: true },
  });

  if (batch.status !== "PENDING") {
    return;
  }

  await prisma.uploadBatch.update({ where: { id: batch.id }, data: { status: "PROCESSING" } });

  try {
    const tenant = batch.tenant;
    if (!tenant.profileCache || !tenant.profileId) {
      throw new Error(`tenant ${tenant.id} has no cached profile yet -- run onboarding first`);
    }
    const profile = parseProfileSummary(tenant.profileCache);

    const credential = resolveTenantCredential(tenant);
    const ddnClient = new DdnClient({ baseUrl: tenant.ddnBaseUrl, credential });
    const submitter = createBatchSubmitter({ nominatimUserAgent: options.nominatimUserAgent });

    const mailbagChunk = batch.chunks.find((c) => c.kind === "MAILBAG");
    const envelopeChunks = batch.chunks.filter((c) => c.kind === "ENVELOPE");
    if (!mailbagChunk) {
      throw new Error(`batch ${batch.id} has no mailbag chunk`);
    }

    const result = await submitter.submit(
      {
        ddnClient,
        customerId: tenant.ddnCustomerId,
        profile,
        idempotencyKey: batch.idempotencyKey,
      },
      envelopeChunks.map((c) => c.rawRow as unknown as RawEnvelopeRow),
      mailbagChunk.rawRow as unknown as RawMailbagRow,
    );

    const flagsByPackageId = new Map<string, Flag[]>();
    for (const flag of result.flags) {
      const existing = flagsByPackageId.get(flag.package_id) ?? [];
      existing.push(flag);
      flagsByPackageId.set(flag.package_id, existing);
    }
    const envelopesByPackageId = new Map(result.envelopes.map((e) => [e.package_id, e]));

    const now = new Date();
    await prisma.$transaction([
      prisma.uploadChunk.update({
        where: { id: mailbagChunk.id },
        data: { status: "SUBMITTED", submittedAt: now, ddnPayload: result.mailbag as object },
      }),
      ...envelopeChunks.map((chunk) => {
        const row = chunk.rawRow as unknown as RawEnvelopeRow;
        const flags = flagsByPackageId.get(row.package_id) ?? [];
        // A dropped row (unknown_priority_tier) was never built or sent --
        // distinct from a row that was sent with only an advisory flag.
        // Conflating the two here is exactly the defect this writeback
        // exists to fix (see the Phase 3 plan's "Context" section).
        const droppedFlag = flags.find(
          (f): f is Extract<Flag, { kind: "unknown_priority_tier" }> =>
            f.kind === "unknown_priority_tier",
        );
        if (droppedFlag) {
          return prisma.uploadChunk.update({
            where: { id: chunk.id },
            data: {
              status: "FAILED",
              submittedAt: null,
              flags: flags as object[],
              errorMessage: `unknown priority tier "${droppedFlag.given}" -- row was not submitted to DDN`,
            },
          });
        }
        return prisma.uploadChunk.update({
          where: { id: chunk.id },
          data: {
            status: flags.length > 0 ? "FLAGGED" : "SUBMITTED",
            submittedAt: now,
            flags: flags as object[],
            ddnPayload: envelopesByPackageId.get(row.package_id) as object,
          },
        });
      }),
      prisma.uploadBatch.update({
        where: { id: batch.id },
        data: {
          status: result.flags.length > 0 ? "COMPLETED_WITH_FLAGS" : "COMPLETED",
          processedAt: now,
        },
      }),
    ]);
  } catch (err) {
    await prisma.uploadBatch.update({
      where: { id: batch.id },
      data: {
        status: "FAILED",
        processedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

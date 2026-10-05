import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Flag, SubmissionResult } from "@ddn-portal/bridge";

/**
 * Stubs the geocoder/facility-assignment/DdnClient by stubbing the whole
 * bridge submitter and DDN client -- this test exists to prove the
 * writeback logic in `processUploadBatch` itself, not `BridgeSubmitter`'s
 * own geocode/assign/score pipeline (that has its own unit tests).
 *
 * This is the regression this phase's writeback fix exists to catch: a
 * row dropped by `unknown_priority_tier` must land `FAILED` with
 * `submittedAt: null`, never conflated with a row that *was* sent but
 * carries only an advisory flag (`low_confidence_geocode`), which must
 * land `FLAGGED` with `submittedAt` set and `ddnPayload` populated.
 */

const mockFindUniqueOrThrow = vi.fn();
const mockBatchUpdate = vi.fn((args: unknown) => ({ __op: "batchUpdate", args }));
const mockChunkUpdate = vi.fn((args: unknown) => ({ __op: "chunkUpdate", args }));
const mockTransaction = vi.fn(async (ops: unknown[]) => ops);

vi.mock("@ddn-portal/db", () => ({
  prisma: {
    uploadBatch: {
      findUniqueOrThrow: (...args: unknown[]) => mockFindUniqueOrThrow(...args),
      update: (...args: unknown[]) => mockBatchUpdate(args[0]),
    },
    uploadChunk: {
      update: (...args: unknown[]) => mockChunkUpdate(args[0]),
    },
    $transaction: (...args: unknown[]) => mockTransaction(args[0] as unknown[]),
  },
}));

const mockSubmit = vi.fn();
vi.mock("@ddn-portal/bridge", () => ({
  createBatchSubmitter: () => ({ submit: mockSubmit }),
}));

vi.mock("@ddn-portal/ddn-client", () => ({
  DdnClient: vi.fn(),
  resolveTenantCredential: vi.fn(() => ({ kind: "none" })),
  parseProfileSummary: vi.fn(() => ({
    facilities: [],
    assignment_rule: { method: "nearest", fallback: "haversine" },
    objective: { priority: { tiers: [] } },
  })),
}));

const { processUploadBatch } = await import("./process-upload-batch");

function findChunkUpdate(chunkId: string) {
  return mockChunkUpdate.mock.calls
    .map(([args]) => args as { where: { id: string }; data: Record<string, unknown> })
    .find((call) => call.where.id === chunkId);
}

describe("processUploadBatch writeback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks a dropped (unknown_priority_tier) row FAILED and a sent-with-flag row FLAGGED, distinctly", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: "batch-1",
      status: "PENDING",
      idempotencyKey: "idem-1",
      tenant: {
        id: "tenant-1",
        profileCache: {},
        profileId: "profile-1",
        ddnBaseUrl: "https://ddn.example.com",
        ddnCustomerId: "tenant-1",
      },
      chunks: [
        { id: "chunk-mailbag", kind: "MAILBAG", rawRow: { mailbag_id: "mb-1", seal_id: "s1", address: "1 Depot Way" } },
        { id: "chunk-tier", kind: "ENVELOPE", rawRow: { package_id: "pkg-tier", mailbag_id: "mb-1" } },
        { id: "chunk-geo", kind: "ENVELOPE", rawRow: { package_id: "pkg-geo", mailbag_id: "mb-1" } },
      ],
    });

    const flags: Flag[] = [
      { kind: "unknown_priority_tier", package_id: "pkg-tier", given: "bogus-tier" },
      { kind: "low_confidence_geocode", package_id: "pkg-geo", confidence: "low" },
    ];
    const sentEnvelope = { package_id: "pkg-geo", customer_id: "tenant-1" };
    const sentMailbag = { mailbag_id: "mb-1", customer_id: "tenant-1" };
    const result: SubmissionResult = {
      accepted: 1,
      package_ids: ["pkg-geo"],
      mailbag_id: "mb-1",
      flags,
      envelopes: [sentEnvelope] as unknown as SubmissionResult["envelopes"],
      mailbag: sentMailbag as unknown as SubmissionResult["mailbag"],
    };
    mockSubmit.mockResolvedValue(result);

    await processUploadBatch("batch-1", { nominatimUserAgent: "test-agent" });

    // First direct update (before the transaction) flips the batch to
    // PROCESSING -- not part of the writeback under test, just the guard.
    expect(mockBatchUpdate.mock.calls[0][0]).toMatchObject({ data: { status: "PROCESSING" } });

    const tierUpdate = findChunkUpdate("chunk-tier");
    expect(tierUpdate?.data).toMatchObject({ status: "FAILED", submittedAt: null });
    expect(tierUpdate?.data.errorMessage).toMatch(/bogus-tier/);
    expect(tierUpdate?.data).not.toHaveProperty("ddnPayload");
    // The report page's flag detail column reads chunk.flags directly --
    // a writeback that got status/submittedAt right but left flags at the
    // schema default would still render an empty report.
    expect(tierUpdate?.data.flags).toEqual([flags[0]]);

    const geoUpdate = findChunkUpdate("chunk-geo");
    expect(geoUpdate?.data).toMatchObject({ status: "FLAGGED", ddnPayload: sentEnvelope });
    expect(geoUpdate?.data.submittedAt).toBeInstanceOf(Date);
    expect(geoUpdate?.data.flags).toEqual([flags[1]]);

    const mailbagUpdate = findChunkUpdate("chunk-mailbag");
    expect(mailbagUpdate?.data).toMatchObject({ status: "SUBMITTED", ddnPayload: sentMailbag });
    expect(mailbagUpdate?.data.submittedAt).toBeInstanceOf(Date);

    // Batch-level status reflects that at least one row was flagged --
    // the last call in the transaction's op array.
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    const txOps = mockTransaction.mock.calls[0][0] as { __op: string; args: Record<string, unknown> }[];
    const batchOpInTx = txOps.find((op) => op.__op === "batchUpdate");
    expect(batchOpInTx?.args).toMatchObject({ data: { status: "COMPLETED_WITH_FLAGS" } });
  });

  it("marks every row SUBMITTED with ddnPayload set when there are no flags", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: "batch-2",
      status: "PENDING",
      idempotencyKey: "idem-2",
      tenant: {
        id: "tenant-1",
        profileCache: {},
        profileId: "profile-1",
        ddnBaseUrl: "https://ddn.example.com",
        ddnCustomerId: "tenant-1",
      },
      chunks: [
        { id: "chunk-mailbag", kind: "MAILBAG", rawRow: { mailbag_id: "mb-2" } },
        { id: "chunk-clean", kind: "ENVELOPE", rawRow: { package_id: "pkg-clean", mailbag_id: "mb-2" } },
      ],
    });

    const sentEnvelope = { package_id: "pkg-clean" };
    const sentMailbag = { mailbag_id: "mb-2" };
    const result: SubmissionResult = {
      accepted: 1,
      package_ids: ["pkg-clean"],
      mailbag_id: "mb-2",
      flags: [],
      envelopes: [sentEnvelope] as unknown as SubmissionResult["envelopes"],
      mailbag: sentMailbag as unknown as SubmissionResult["mailbag"],
    };
    mockSubmit.mockResolvedValue(result);

    await processUploadBatch("batch-2", { nominatimUserAgent: "test-agent" });

    const cleanUpdate = findChunkUpdate("chunk-clean");
    expect(cleanUpdate?.data).toMatchObject({ status: "SUBMITTED", ddnPayload: sentEnvelope });
    expect(cleanUpdate?.data.submittedAt).toBeInstanceOf(Date);

    const txOps = mockTransaction.mock.calls[0][0] as { __op: string; args: Record<string, unknown> }[];
    const batchOpInTx = txOps.find((op) => op.__op === "batchUpdate");
    expect(batchOpInTx?.args).toMatchObject({ data: { status: "COMPLETED" } });
  });

  it("does nothing for a batch that is not PENDING", async () => {
    mockFindUniqueOrThrow.mockResolvedValue({ id: "batch-3", status: "PROCESSING", chunks: [] });

    await processUploadBatch("batch-3", { nominatimUserAgent: "test-agent" });

    expect(mockBatchUpdate).not.toHaveBeenCalled();
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});

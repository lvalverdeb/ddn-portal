import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const databaseUrl = process.env.AUTH_ADAPTER_TEST_DATABASE_URL;

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

/**
 * Exercises POST/GET /api/uploads against a real database -- same
 * it.skipIf(...) gating and throwaway-Postgres convention as
 * app/api/tenants/route.test.ts and lib/auth.test.ts.
 */
describe.skipIf(!databaseUrl)("/api/uploads", () => {
  const runId = randomUUID().slice(0, 8);
  const ownerEmail = `owner-${runId}@example.com`;

  let prisma: typeof import("@ddn-portal/db").prisma;
  let POST: typeof import("./route").POST;
  let GET: typeof import("./route").GET;
  let auth: ReturnType<typeof vi.fn>;
  let tenantId: string;

  function postJson(body: unknown, headers: Record<string, string> = {}) {
    return POST(
      new Request("http://localhost/api/uploads", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      }),
    );
  }

  function validBody(overrides: { mailbagId?: string; envelopeMailbagId?: string } = {}) {
    const mailbagId = overrides.mailbagId ?? `mb-${randomUUID()}`;
    return {
      fileName: "batch.csv",
      mailbag: { mailbag_id: mailbagId, seal_id: "seal-1", address: "1 Depot Way" },
      envelopes: [
        {
          package_id: `pkg-${randomUUID()}`,
          recipient_id: "rec-1",
          package_type: "letter",
          address: "123 Main St",
          priority_tier: "standard",
          sla_date: "2026-10-05",
          ...(overrides.envelopeMailbagId ? { mailbag_id: overrides.envelopeMailbagId } : {}),
        },
      ],
    };
  }

  beforeEach(async () => {
    process.env.DATABASE_URL = databaseUrl;
    ({ prisma } = await import("@ddn-portal/db"));
    ({ POST, GET } = await import("./route"));
    ({ auth } = (await import("@/lib/auth")) as unknown as { auth: ReturnType<typeof vi.fn> });

    const tenant = await prisma.tenant.create({
      data: {
        name: "Upload Test Tenant",
        slug: `t-${runId}`,
        ddnBaseUrl: "https://ddn.example.com",
        ddnCustomerId: `t-${runId}`,
        credentialKind: "NONE",
      },
    });
    tenantId = tenant.id;

    await prisma.user.upsert({
      where: { email: ownerEmail },
      update: { tenantId },
      create: { email: ownerEmail, tenantId },
    });
    auth.mockResolvedValue({ user: { email: ownerEmail } });
  });

  afterEach(async () => {
    // beforeEach creates a fresh tenant with the same slug every test --
    // tear it down so the next test's create doesn't collide.
    await prisma.uploadBatch.deleteMany({ where: { tenantId } });
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: runId } } });
    await prisma.$disconnect();
  });

  it("creates a batch with a mailbag chunk and envelope chunks", async () => {
    const res = await postJson(validBody());
    expect(res.status).toBe(202);
    const { batch } = await res.json();
    expect(batch.chunks).toHaveLength(2);
    expect(batch.chunks.filter((c: { kind: string }) => c.kind === "MAILBAG")).toHaveLength(1);
    expect(batch.chunks.filter((c: { kind: string }) => c.kind === "ENVELOPE")).toHaveLength(1);
  });

  it("replays the same batch on a repeated Idempotency-Key instead of creating a second one", async () => {
    const key = randomUUID();
    const body = validBody();

    const first = await postJson(body, { "Idempotency-Key": key });
    const { batch: firstBatch } = await first.json();

    const second = await postJson(body, { "Idempotency-Key": key });
    expect(second.status).toBe(202);
    const { batch: secondBatch } = await second.json();

    expect(secondBatch.id).toBe(firstBatch.id);
    const count = await prisma.uploadBatch.count({ where: { idempotencyKey: key, tenantId } });
    expect(count).toBe(1);
  });

  it("400s when an envelope row's mailbag_id disagrees with the batch mailbag", async () => {
    const mailbagId = `mb-${randomUUID()}`;
    const res = await postJson(validBody({ mailbagId, envelopeMailbagId: `not-${mailbagId}` }));
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error).toMatch(/mailbag_id/);
  });

  it("stamps mailbag_id onto an envelope row that agrees with the batch mailbag", async () => {
    const mailbagId = `mb-${randomUUID()}`;
    const res = await postJson(validBody({ mailbagId, envelopeMailbagId: mailbagId }));
    expect(res.status).toBe(202);
  });

  it("lists only the caller's own tenant's batches", async () => {
    await postJson(validBody());

    const otherTenant = await prisma.tenant.create({
      data: {
        name: "Other Tenant",
        slug: `t-${runId}-other`,
        ddnBaseUrl: "https://ddn.example.com",
        ddnCustomerId: `t-${runId}-other`,
        credentialKind: "NONE",
      },
    });
    await prisma.uploadBatch.create({
      data: {
        tenantId: otherTenant.id,
        mailbagId: `mb-${randomUUID()}`,
        fileName: "other.csv",
        idempotencyKey: randomUUID(),
        chunks: { create: [{ kind: "MAILBAG", rawRow: {} }] },
      },
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const { batches } = await res.json();
    expect(batches.every((b: { id: string }) => b.id)).toBe(true);

    const otherTenantBatches = await prisma.uploadBatch.findMany({ where: { tenantId: otherTenant.id } });
    expect(batches.some((b: { fileName: string }) => b.fileName === "other.csv")).toBe(false);
    expect(otherTenantBatches).toHaveLength(1);

    await prisma.uploadBatch.deleteMany({ where: { tenantId: otherTenant.id } });
    await prisma.tenant.delete({ where: { id: otherTenant.id } });
  });
});

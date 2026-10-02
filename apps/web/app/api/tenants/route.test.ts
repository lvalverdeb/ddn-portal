import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const databaseUrl = process.env.AUTH_ADAPTER_TEST_DATABASE_URL;

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

/**
 * Exercises the ownerEmail upsert + conflict path in POST /api/tenants
 * against a real database -- it's a multi-statement transaction (tenant
 * create, user upsert, audit log) a typecheck can't verify. Same
 * it.skipIf(...) gating and throwaway-Postgres convention as
 * lib/auth.test.ts; reuses AUTH_ADAPTER_TEST_DATABASE_URL rather than a
 * second env var for what is, in this repo, the same throwaway database.
 */
describe.skipIf(!databaseUrl)("POST /api/tenants ownerEmail", () => {
  const runId = randomUUID().slice(0, 8);
  const adminEmail = `admin-${runId}@example.com`;

  let prisma: typeof import("@ddn-portal/db").prisma;
  let POST: typeof import("./route").POST;
  let auth: ReturnType<typeof vi.fn>;

  function postJson(body: unknown) {
    return POST(
      new Request("http://localhost/api/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  beforeEach(async () => {
    process.env.DATABASE_URL = databaseUrl;
    ({ prisma } = await import("@ddn-portal/db"));
    ({ POST } = await import("./route"));
    ({ auth } = (await import("@/lib/auth")) as unknown as { auth: ReturnType<typeof vi.fn> });

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { role: "ADMIN" },
      create: { email: adminEmail, role: "ADMIN" },
    });
    auth.mockResolvedValue({ user: { email: adminEmail } });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actor: adminEmail } });
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: `t-${runId}` } } });
    await prisma.user.deleteMany({ where: { email: { contains: runId } } });
    await prisma.$disconnect();
  });

  it("links a brand-new ownerEmail to the created tenant", async () => {
    const ownerEmail = `owner-new-${runId}@example.com`;
    const res = await postJson({
      name: "T1",
      slug: `t-${runId}-1`,
      ddnBaseUrl: "https://ddn.example.com",
      ownerEmail,
    });
    expect(res.status).toBe(201);
    const { tenant } = await res.json();
    const owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
    expect(owner?.tenantId).toBe(tenant.id);
  });

  it("links an existing tenant-less ownerEmail", async () => {
    const ownerEmail = `owner-existing-${runId}@example.com`;
    await prisma.user.create({ data: { email: ownerEmail } });

    const res = await postJson({
      name: "T2",
      slug: `t-${runId}-2`,
      ddnBaseUrl: "https://ddn.example.com",
      ownerEmail,
    });
    expect(res.status).toBe(201);
    const { tenant } = await res.json();
    const owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
    expect(owner?.tenantId).toBe(tenant.id);
  });

  it("409s, and creates no tenant, when ownerEmail already belongs to another tenant", async () => {
    const ownerEmail = `owner-conflict-${runId}@example.com`;
    const otherTenant = await prisma.tenant.create({
      data: {
        name: "Other",
        slug: `t-${runId}-other`,
        ddnBaseUrl: "https://ddn.example.com",
        ddnCustomerId: `t-${runId}-other`,
        credentialKind: "NONE",
      },
    });
    await prisma.user.create({ data: { email: ownerEmail, tenantId: otherTenant.id } });

    const res = await postJson({
      name: "T3",
      slug: `t-${runId}-3`,
      ddnBaseUrl: "https://ddn.example.com",
      ownerEmail,
    });
    expect(res.status).toBe(409);

    const createdTenant = await prisma.tenant.findUnique({ where: { slug: `t-${runId}-3` } });
    expect(createdTenant).toBeNull();
  });
});

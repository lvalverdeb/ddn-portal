import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@ddn-portal/db";
import { prisma } from "@/lib/db";
import { requireTenantContext, UnauthenticatedError, NoTenantError } from "@/lib/tenant-context";

/**
 * Phase 0 scaffold only: accepts rows already parsed client-side (no CSV
 * parsing here yet) and writes the durable `UploadBatch`/`UploadChunk`
 * record. It does not call DDN -- that's phase 3's `BridgeSubmitter`, run
 * by the worker against batches left `PENDING` here. See the architecture
 * plan's note on why `UploadChunk`, not a DDN 202, is the source of truth.
 */
export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireTenantContext();
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (err instanceof NoTenantError) {
      return NextResponse.json({ error: "no tenant for this user" }, { status: 403 });
    }
    throw err;
  }

  const body = await request.json();
  const { fileName, mailbag, envelopes } = body as {
    fileName?: string;
    mailbag?: { mailbag_id?: string; [key: string]: unknown };
    envelopes?: Record<string, unknown>[];
  };

  if (!fileName || !mailbag?.mailbag_id || !Array.isArray(envelopes) || envelopes.length === 0) {
    return NextResponse.json(
      { error: "fileName, mailbag.mailbag_id, and a non-empty envelopes array are required" },
      { status: 400 },
    );
  }

  const batch = await prisma.uploadBatch.create({
    data: {
      tenantId: ctx.tenant.id,
      mailbagId: mailbag.mailbag_id,
      fileName,
      idempotencyKey: randomUUID(),
      chunks: {
        create: [
          { kind: "MAILBAG", rawRow: mailbag as Prisma.InputJsonValue },
          ...envelopes.map((row) => ({
            kind: "ENVELOPE" as const,
            rawRow: row as Prisma.InputJsonValue,
          })),
        ],
      },
    },
    include: { chunks: true },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenant.id,
      actor: ctx.portalUser.email,
      action: "upload:create",
      subject: batch.id,
      detail: { fileName, envelopeCount: envelopes.length },
    },
  });

  return NextResponse.json({ batch }, { status: 202 });
}

export async function GET() {
  let ctx;
  try {
    ctx = await requireTenantContext();
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (err instanceof NoTenantError) {
      return NextResponse.json({ error: "no tenant for this user" }, { status: 403 });
    }
    throw err;
  }

  const batches = await prisma.uploadBatch.findMany({
    where: { tenantId: ctx.tenant.id },
    orderBy: { receivedAt: "desc" },
    select: {
      id: true,
      fileName: true,
      status: true,
      receivedAt: true,
      processedAt: true,
    },
  });

  return NextResponse.json({ batches });
}

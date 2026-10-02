import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantContext, UnauthenticatedError, NoTenantError } from "@/lib/tenant-context";

export async function GET(_request: Request, { params }: { params: { batchId: string } }) {
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

  const batch = await prisma.uploadBatch.findFirst({
    where: { id: params.batchId, tenantId: ctx.tenant.id },
    include: { chunks: true },
  });

  if (!batch) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ batch });
}

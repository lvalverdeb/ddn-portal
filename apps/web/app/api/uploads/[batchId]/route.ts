import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantRecord, UnauthenticatedError, NoTenantError } from "@/lib/tenant-context";

/**
 * The batch report page (`(portal)/uploads/[batchId]/page.tsx`) reads this
 * batch directly via Prisma instead of calling this route -- same
 * self-HTTP-call avoidance as `(portal)/profile/page.tsx`. This route has
 * no in-app consumer as a result; it's BFF surface for a future non-page
 * caller (a CLI, a status webhook), not dead code.
 */
export async function GET(_request: Request, { params }: { params: { batchId: string } }) {
  let ctx;
  try {
    ctx = await requireTenantRecord();
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

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Portal-operator only (not a tenant-scoped resource): creating/listing
 * tenants is how a new customer gets onboarded in the first place, so it
 * can't itself be gated behind `requireTenantContext()`.
 */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const user = await prisma.portalUser.findUnique({ where: { email: session.user.email } });
  return user?.role === "ADMIN" ? user : null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      ddnBaseUrl: true,
      credentialKind: true,
      profileId: true,
      ddnSpecVersion: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ tenants });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json();
  const { name, slug, ddnBaseUrl, profileId } = body as {
    name?: string;
    slug?: string;
    ddnBaseUrl?: string;
    profileId?: string;
  };
  if (!name || !slug || !ddnBaseUrl) {
    return NextResponse.json(
      { error: "name, slug, and ddnBaseUrl are required" },
      { status: 400 },
    );
  }

  const tenant = await prisma.tenant.create({
    data: { name, slug, ddnBaseUrl, profileId, credentialKind: "NONE" },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      actor: admin.email,
      action: "tenant:create",
      subject: tenant.id,
      detail: { name, slug, ddnBaseUrl },
    },
  });

  return NextResponse.json({ tenant }, { status: 201 });
}

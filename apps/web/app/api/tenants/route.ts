import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { refreshTenantProfile } from "@ddn-portal/tenant-ops";

class OwnerConflictError extends Error {}

/**
 * Portal-operator only (not a tenant-scoped resource): creating/listing
 * tenants is how a new customer gets onboarded in the first place, so it
 * can't itself be gated behind `requireTenantContext()`.
 */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
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
      ddnSpecCheckedAt: true,
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
  const { name, slug, ddnBaseUrl, profileId, ddnCustomerId, ownerEmail } = body as {
    name?: string;
    slug?: string;
    ddnBaseUrl?: string;
    profileId?: string;
    ddnCustomerId?: string;
    ownerEmail?: string;
  };
  if (!name || !slug || !ddnBaseUrl) {
    return NextResponse.json(
      { error: "name, slug, and ddnBaseUrl are required" },
      { status: 400 },
    );
  }

  try {
    const { tenant } = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        // ddnCustomerId defaults to slug -- see the field's comment in
        // schema.prisma for why this must never silently become this row's own
        // `id` (a portal-internal cuid DDN has never seen).
        data: { name, slug, ddnBaseUrl, profileId, ddnCustomerId: ddnCustomerId || slug, credentialKind: "NONE" },
      });

      let owner = null;
      if (ownerEmail) {
        // Checked inside the same transaction as the create, not before it:
        // an owner already linked to a *different* tenant must never be
        // silently reassigned. A tenant-less row (self-provisioned via
        // sign-in, or never linked) is fair game to link here -- that's
        // exactly the state this field exists to resolve.
        const existingOwner = await tx.user.findUnique({ where: { email: ownerEmail } });
        if (existingOwner?.tenantId) {
          throw new OwnerConflictError();
        }
        owner = existingOwner
          ? await tx.user.update({ where: { email: ownerEmail }, data: { tenantId: tenant.id } })
          : await tx.user.create({ data: { email: ownerEmail, tenantId: tenant.id } });
      }

      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          actor: admin.email,
          action: "tenant:create",
          subject: tenant.id,
          detail: { name, slug, ddnBaseUrl, ownerEmail: owner?.email },
        },
      });

      return { tenant, owner };
    });

    // Best-effort, inline: a slow or failing DDN instance must never hold up
    // tenant creation's 201. The worker's own poll loop (profileRefreshLoop
    // in apps/worker/src/index.ts) is the reliable path; this is just so the
    // admin table isn't empty for the common case where DDN answers fine.
    refreshTenantProfile(tenant.id).catch((err) => {
      console.error(`inline profile refresh failed for tenant ${tenant.id}:`, err);
    });

    return NextResponse.json({ tenant }, { status: 201 });
  } catch (err) {
    if (err instanceof OwnerConflictError) {
      return NextResponse.json(
        { error: "ownerEmail is already linked to another tenant" },
        { status: 409 },
      );
    }
    throw err;
  }
}

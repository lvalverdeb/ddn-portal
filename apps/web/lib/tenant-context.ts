import { DdnClient, resolveTenantCredential } from "@ddn-portal/ddn-client";
import { auth } from "./auth";
import { prisma } from "./db";

export class UnauthenticatedError extends Error {}
export class NoTenantError extends Error {}

/**
 * The session -> User -> Tenant resolution on its own, with no credential
 * resolution and no DdnClient construction -- for callers (the read-only
 * profile view) that only need the tenant row itself and must not fail just
 * because DDN credential resolution isn't implemented yet for this tenant's
 * `credentialKind` (see resolveTenantCredential). Never trusts a tenant id
 * the client sent.
 */
export async function requireTenantRecord() {
  const session = await auth();
  if (!session?.user?.email) {
    throw new UnauthenticatedError();
  }

  const portalUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { tenant: true },
  });
  if (!portalUser || !portalUser.tenant) {
    throw new NoTenantError();
  }

  return { portalUser, tenant: portalUser.tenant };
}

/**
 * Every Route Handler that needs to call DDN resolves its tenant this way --
 * session -> User -> Tenant -> credential -- never by trusting a
 * tenant id the client sent. The DDN credential this builds a client with
 * never leaves this process.
 */
export async function requireTenantContext() {
  const { portalUser, tenant } = await requireTenantRecord();
  const credential = resolveTenantCredential(tenant);
  const ddnClient = new DdnClient({ baseUrl: tenant.ddnBaseUrl, credential });

  return { portalUser, tenant, ddnClient };
}

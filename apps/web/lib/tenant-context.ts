import { DdnClient, resolveTenantCredential } from "@ddn-portal/ddn-client";
import { auth } from "./auth";
import { prisma } from "./db";

export class UnauthenticatedError extends Error {}
export class NoTenantError extends Error {}

/**
 * Every Route Handler that needs to call DDN resolves its tenant this way --
 * session -> User -> Tenant -> credential -- never by trusting a
 * tenant id the client sent. The DDN credential this builds a client with
 * never leaves this process.
 */
export async function requireTenantContext() {
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

  const tenant = portalUser.tenant;
  const credential = resolveTenantCredential(tenant);
  const ddnClient = new DdnClient({ baseUrl: tenant.ddnBaseUrl, credential });

  return { portalUser, tenant, ddnClient };
}

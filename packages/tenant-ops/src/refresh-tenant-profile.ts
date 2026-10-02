import {
  DdnClient,
  resolveTenantCredential,
  parseProfileSummary,
  parseOpenApiVersion,
} from "@ddn-portal/ddn-client";
import { prisma, type Prisma } from "@ddn-portal/db";

/**
 * Refreshes one tenant's cached DDN profile and observed spec version.
 * Two independent triggers call this -- inline, best-effort, right after
 * tenant creation in `POST /api/tenants` (apps/web), and the poll loop in
 * apps/worker/src/index.ts -- one implementation, so the two paths can't
 * drift apart. Lives in its own package (rather than apps/worker/src/jobs,
 * where it started) because both of those callers need it and apps don't
 * import each other's code. This function always throws on failure rather
 * than swallowing anything; it's each caller's job to decide whether that
 * should fail the request or just be logged. The `POST /api/tenants` caller
 * is fire-and-forget by design, not omission -- it discards this promise's
 * rejection into a log line because the poll loop is the durable path; a
 * future caller that needs the failure to propagate should await and
 * handle it explicitly rather than assume this function reports failure
 * some other way.
 *
 * Skips tenants with no `profileId` -- nothing to fetch yet, not an error.
 */
export async function refreshTenantProfile(tenantId: string) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  if (!tenant.profileId) {
    return;
  }

  const credential = resolveTenantCredential(tenant);
  const ddnClient = new DdnClient({ baseUrl: tenant.ddnBaseUrl, credential });

  const profileResponse = await ddnClient.getLatestProfile(tenant.profileId);
  // Validated, not transformed: the cache stores DDN's own response shape,
  // parseProfileSummary just refuses to cache something packages/bridge
  // couldn't read back out.
  parseProfileSummary(profileResponse.profile);

  const openApiSpec = await ddnClient.getOpenApiSpec();
  const ddnSpecVersion = parseOpenApiVersion(openApiSpec);

  const now = new Date();
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      // Prisma's Json input type can't structurally match
      // Record<string, unknown> (the DdnClient response type), even though
      // any JSON-serializable value is valid at runtime.
      profileCache: profileResponse.profile as Prisma.InputJsonValue,
      profileVersion: profileResponse.version,
      profileCachedAt: now,
      ddnSpecVersion,
      ddnSpecCheckedAt: now,
    },
  });
}

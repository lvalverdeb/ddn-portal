import { prisma } from "@ddn-portal/db";
import { processUploadBatch } from "./jobs/process-upload-batch";
import { refreshTenantProfile } from "@ddn-portal/tenant-ops";

/**
 * Polls for `PENDING` batches rather than using a message queue -- no queue
 * library has been chosen for this repo (unlike DDN's own `[queue library
 * TBD]`, which is a separate, unrelated decision). Revisit if poll latency
 * or Postgres load become a real problem; not worth it at phase-0 volume.
 */
const POLL_INTERVAL_MS = 5_000;

// Profile/spec-version drift moves on the order of days for a given
// tenant, not seconds -- an explicit judgment call, not a spec value (this
// repo has no profile.yaml-style provenance mechanism; that convention is
// specific to the `ddn` repo's own CLAUDE.md). Revisit with real usage.
const PROFILE_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

async function pollOnce(mapboxApiKey: string) {
  const batch = await prisma.uploadBatch.findFirst({
    where: { status: "PENDING" },
    orderBy: { receivedAt: "asc" },
  });
  if (!batch) return;

  try {
    await processUploadBatch(batch.id, { mapboxApiKey });
  } catch (err) {
    console.error(`batch ${batch.id} failed:`, err);
  }
}

async function refreshProfilesOnce() {
  const tenants = await prisma.tenant.findMany({ where: { profileId: { not: null } } });
  for (const tenant of tenants) {
    try {
      await refreshTenantProfile(tenant.id);
    } catch (err) {
      console.error(`profile refresh failed for tenant ${tenant.id}:`, err);
    }
  }
}

async function uploadBatchLoop(mapboxApiKey: string) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await pollOnce(mapboxApiKey);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function profileRefreshLoop() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await refreshProfilesOnce();
    await new Promise((resolve) => setTimeout(resolve, PROFILE_REFRESH_INTERVAL_MS));
  }
}

async function main() {
  const mapboxApiKey = process.env.MAPBOX_API_KEY;
  if (!mapboxApiKey) {
    throw new Error("MAPBOX_API_KEY is required");
  }

  console.log("worker started: polling for pending upload batches and tenant profile refreshes");
  // Two independent loops, not one interleaved loop -- a slow or failing
  // profile refresh must never delay upload-batch draining, and vice versa.
  await Promise.all([uploadBatchLoop(mapboxApiKey), profileRefreshLoop()]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

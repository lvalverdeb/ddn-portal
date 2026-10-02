import { prisma } from "@ddn-portal/db";
import { processUploadBatch } from "./jobs/process-upload-batch";

/**
 * Polls for `PENDING` batches rather than using a message queue -- no queue
 * library has been chosen for this repo (unlike DDN's own `[queue library
 * TBD]`, which is a separate, unrelated decision). Revisit if poll latency
 * or Postgres load become a real problem; not worth it at phase-0 volume.
 */
const POLL_INTERVAL_MS = 5_000;

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

async function main() {
  const mapboxApiKey = process.env.MAPBOX_API_KEY;
  if (!mapboxApiKey) {
    throw new Error("MAPBOX_API_KEY is required");
  }

  console.log("worker started, polling for pending upload batches");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await pollOnce(mapboxApiKey);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

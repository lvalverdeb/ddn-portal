import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SNAPSHOT_PATH = path.resolve(
  __dirname,
  "../../packages/ddn-client/src/contract-snapshot/openapi.json",
);

/**
 * Compares a live DDN instance's /openapi.json against the checked-in
 * snapshot. Skipped (not failed) when no snapshot exists yet or no instance
 * is reachable -- phase 0 has neither wired into CI. Once the snapshot is
 * captured (see contract-snapshot/README.md) this should run for real
 * against a pinned `ddn` instance in CI, and a diff should fail the build
 * rather than pass silently.
 */
describe("ddn openapi contract drift", () => {
  const baseUrl = process.env.DDN_CONTRACT_CHECK_URL;

  it.skipIf(!fs.existsSync(SNAPSHOT_PATH) || !baseUrl)(
    "live /openapi.json matches the checked-in snapshot",
    async () => {
      const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf-8"));
      const res = await fetch(`${baseUrl}/openapi.json`);
      const live = await res.json();
      expect(live).toEqual(snapshot);
    },
  );
});

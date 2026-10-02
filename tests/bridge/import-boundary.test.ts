import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const ISOLATED_DIRS = [
  "packages/bridge/src/geocoding",
  "packages/bridge/src/facility-assignment",
  "packages/bridge/src/priority",
  "packages/bridge/src/assembly-types.ts",
];

function listTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listTsFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

function listAllSourceFiles(): string[] {
  const roots = ["apps/web", "apps/worker", "packages/ddn-client/src", "packages/db/src"];
  return roots.flatMap((root) => {
    const full = path.join(REPO_ROOT, root);
    return fs.existsSync(full) ? listTsFiles(full) : [];
  });
}

/**
 * Phase 4 (swapping to raw intake) is only a contained change if nothing
 * outside `packages/bridge` reaches past its public `index.ts` into the
 * geocoding/facility-assignment/priority internals being retired. This
 * walks every other package/app's source and fails if any of them import
 * from those internal paths directly.
 */
describe("bridge isolation", () => {
  it("nothing outside packages/bridge imports its internals directly", () => {
    const offenders: string[] = [];
    for (const file of listAllSourceFiles()) {
      const content = fs.readFileSync(file, "utf-8");
      for (const isolated of ISOLATED_DIRS) {
        const marker = isolated.replace(/^packages\/bridge\/src\//, "").replace(/\.ts$/, "");
        const pattern = new RegExp(`@ddn-portal/bridge/(src/)?${marker.split("/")[0]}`);
        if (pattern.test(content)) {
          offenders.push(`${path.relative(REPO_ROOT, file)} imports bridge internal "${marker}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

import { defineConfig } from "vitest/config";

/**
 * Covers the root-level `tests/` tree (contract drift, bridge isolation),
 * which spans multiple packages and so isn't owned by any one of them.
 * Each package's own `src`-local tests run via its own `pnpm test` instead.
 */
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});

import { describe, expect, it } from "vitest";
import { requiresAssembly } from "./assembly-types";

describe("requiresAssembly", () => {
  it("matches DDN's own placeholder spelling", () => {
    expect(requiresAssembly("assembly")).toBe(true);
  });

  it("is false for every other package_type", () => {
    expect(requiresAssembly("letter")).toBe(false);
    expect(requiresAssembly("parcel")).toBe(false);
    expect(requiresAssembly("")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { tierScore, UnknownTierError } from "./tier-mapper";

const TIERS = [
  { name: "standard", low: { value: 0, provenance: "measured" }, tier: 0 },
  { name: "express", low: { value: 100, provenance: "measured" }, tier: 1 },
  { name: "overnight", low: { value: 200, provenance: "measured" }, tier: 2 },
];

describe("tierScore", () => {
  it("maps a known tier name to its band's low threshold", () => {
    expect(tierScore(TIERS, "express")).toBe(100);
  });

  it("throws UnknownTierError, listing known tiers, for an unrecognized name", () => {
    try {
      tierScore(TIERS, "same-day");
      expect.fail("expected UnknownTierError");
    } catch (err) {
      expect(err).toBeInstanceOf(UnknownTierError);
      const unknownErr = err as UnknownTierError;
      expect(unknownErr.given).toBe("same-day");
      expect(unknownErr.known).toEqual(["standard", "express", "overnight"]);
    }
  });
});

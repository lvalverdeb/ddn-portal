import { describe, expect, it } from "vitest";
import { tierScore, UnknownTierError } from "./tier-mapper";

const TIERS = [
  { name: "standard", low: 0, tier: 0 },
  { name: "express", low: 100, tier: 1 },
  { name: "overnight", low: 200, tier: 2 },
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

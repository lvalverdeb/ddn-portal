import { describe, expect, it } from "vitest";
import { parseProfileSummary, ProfileShapeError } from "./profile";

const VALID = {
  facilities: [
    {
      id: "hub-1",
      name: "Hub 1",
      roles: ["hub"],
      coords: { lat: 40.7, lon: -74.0, provenance: "measured" },
      route_release: { value: "06:00", provenance: "measured" },
    },
  ],
  assignment_rule: {
    method: "nearest",
    fallback: "haversine",
    coarse_coords_allowed_for_assignment: false,
    coarse_coords_allowed_for_routing: true,
    straddle: { margin_m: { value: 2000, provenance: "invented" }, action: "flag" },
  },
  objective: {
    priority: {
      form: "tiered",
      prize_scale: { value: 1, provenance: "invented" },
      tiers: [{ name: "standard", low: { value: 0, provenance: "measured" }, tier: 0 }],
    },
  },
};

describe("parseProfileSummary", () => {
  it("accepts a profile shaped like the real core/profile/schema.py wire format", () => {
    expect(() => parseProfileSummary(VALID)).not.toThrow();
  });

  it("rejects a non-object", () => {
    expect(() => parseProfileSummary(null)).toThrow(ProfileShapeError);
  });

  it("rejects the old flattened shape (facility_id/lat/lon instead of id/coords)", () => {
    const flattened = {
      ...VALID,
      facilities: [{ facility_id: "hub-1", lat: 40.7, lon: -74.0 }],
    };
    expect(() => parseProfileSummary(flattened)).toThrow(/facilities\[0\]\.id/);
  });

  it("rejects a plain-number tier low instead of a Provenanced<number>", () => {
    const flattenedBand = {
      ...VALID,
      objective: { priority: { ...VALID.objective.priority, tiers: [{ name: "standard", low: 0, tier: 0 }] } },
    };
    expect(() => parseProfileSummary(flattenedBand)).toThrow(/tiers\[0\]\.low/);
  });

  it("rejects a missing assignment_rule", () => {
    const { assignment_rule: _assignment_rule, ...rest } = VALID;
    expect(() => parseProfileSummary(rest)).toThrow(/assignment_rule/);
  });
});

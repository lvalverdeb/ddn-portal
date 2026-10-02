import { describe, expect, it } from "vitest";
import type { Facility } from "@ddn-portal/ddn-client";
import { HaversineFacilityAssignmentProvider } from "./haversine-provider";

const NORTH: Facility = { facility_id: "north", lat: 40.7, lon: -74.0, allowed: "*", overnight_allowed: true };
const SOUTH: Facility = { facility_id: "south", lat: 40.6, lon: -74.0, allowed: "*", overnight_allowed: true };
const FAR: Facility = { facility_id: "far", lat: 41.5, lon: -74.0, allowed: "*", overnight_allowed: true };

describe("HaversineFacilityAssignmentProvider", () => {
  it("assigns the single nearest facility unambiguously when it's far from the runner-up", async () => {
    const provider = new HaversineFacilityAssignmentProvider(2000);
    const result = await provider.assign({ lat: 40.699, lon: -74.0 }, [NORTH, SOUTH, FAR]);
    expect(result.facilityId).toBe("north");
    expect(result.ambiguous).toBe(false);
    expect(result.candidates).toEqual(["north"]);
  });

  it("flags near-equidistant facilities as ambiguous instead of silently picking one", async () => {
    // Midpoint between NORTH and SOUTH, well under the 2000m default margin.
    const provider = new HaversineFacilityAssignmentProvider(2000);
    const result = await provider.assign({ lat: 40.65, lon: -74.0 }, [NORTH, SOUTH, FAR]);
    expect(result.ambiguous).toBe(true);
    expect(result.candidates.sort()).toEqual(["north", "south"]);
  });

  it("throws rather than assign against an empty facility list", async () => {
    const provider = new HaversineFacilityAssignmentProvider();
    await expect(provider.assign({ lat: 0, lon: 0 }, [])).rejects.toThrow(/no facilities/);
  });
});

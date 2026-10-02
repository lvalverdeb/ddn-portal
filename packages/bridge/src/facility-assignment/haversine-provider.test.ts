import { describe, expect, it } from "vitest";
import type { Facility } from "@ddn-portal/ddn-client";
import { HaversineFacilityAssignmentProvider } from "./haversine-provider";

function facility(id: string, lat: number, lon: number): Facility {
  return {
    id,
    name: id,
    roles: ["hub"],
    coords: { lat, lon, provenance: "measured" },
    route_release: { value: "06:00", provenance: "measured" },
  };
}

const NORTH = facility("north", 40.7, -74.0);
const SOUTH = facility("south", 40.6, -74.0);
const FAR = facility("far", 41.5, -74.0);

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

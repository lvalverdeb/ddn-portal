import type { Facility } from "@ddn-portal/ddn-client";
import type { FacilityAssignment, FacilityAssignmentProvider } from "./provider";

const EARTH_RADIUS_M = 6_371_000;

function haversineMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Straight-line nearest-facility assignment. A legitimate fallback, not a
 * shortcut: `core/profile/schema.py`'s `AssignmentRule.fallback` field
 * already names a fallback method as an accepted outcome of §3.3, not an
 * error condition.
 *
 * `marginM` should come from the tenant's own cached profile
 * (`assignment_rule.straddle.margin_m`, §3.3) wherever it's known, so the
 * ambiguity threshold matches what DDN itself would use -- the literal
 * default below is only a fallback for a profile that hasn't cached that
 * value yet.
 */
export class HaversineFacilityAssignmentProvider implements FacilityAssignmentProvider {
  constructor(private readonly marginM = 2000) {}

  async assign(
    point: { lat: number; lon: number },
    facilities: Facility[],
  ): Promise<FacilityAssignment> {
    if (facilities.length === 0) {
      throw new Error("no facilities in the tenant's cached profile to assign against");
    }
    const ranked = facilities
      .map((f) => ({ facility: f, distance: haversineMeters(point, f) }))
      .sort((x, y) => x.distance - y.distance);

    const [nearest, runnerUp] = ranked;
    const ambiguous = runnerUp !== undefined && runnerUp.distance - nearest.distance < this.marginM;

    return {
      facilityId: nearest.facility.facility_id,
      ambiguous,
      candidates: ambiguous
        ? [nearest.facility.facility_id, runnerUp!.facility.facility_id]
        : [nearest.facility.facility_id],
    };
  }
}

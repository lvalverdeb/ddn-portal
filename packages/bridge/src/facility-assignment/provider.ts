import type { Facility } from "@ddn-portal/ddn-client";

export interface FacilityAssignment {
  facilityId: string;
  /** True when the nearest two facilities are close enough that the choice
   * is arguable -- surfaced as a flag, never silently resolved. Mirrors
   * DDN's own `assignment_rule.straddle.margin_m` equidistance check
   * (`core/profile/schema.py`), applied here against distances this
   * provider itself computed, not DDN's. */
  ambiguous: boolean;
  candidates: string[];
}

export interface FacilityAssignmentProvider {
  assign(point: { lat: number; lon: number }, facilities: Facility[]): Promise<FacilityAssignment>;
}

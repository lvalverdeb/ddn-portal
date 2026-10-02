export type { BatchSubmitter, SubmissionContext } from "./batch-submitter";
export { BridgeSubmitter } from "./bridge-submitter";
export { RawIntakeSubmitter } from "./raw-intake-submitter";
export type { Flag, RawEnvelopeRow, RawMailbagRow, SubmissionResult } from "./raw-types";
export { ASSEMBLY_PACKAGE_TYPES, requiresAssembly } from "./assembly-types";
export type { GeocodeResult, GeocodingProvider } from "./geocoding/provider";
export { MapboxGeocodingProvider } from "./geocoding/mapbox-provider";
export type { FacilityAssignment, FacilityAssignmentProvider } from "./facility-assignment/provider";
export { HaversineFacilityAssignmentProvider } from "./facility-assignment/haversine-provider";
export { OsrmFacilityAssignmentProvider } from "./facility-assignment/osrm-provider";
export { tierScore, UnknownTierError } from "./priority/tier-mapper";

/**
 * Today's submitter factory -- this one line is what phase 4 flips once
 * ddn#1 ships a raw-intake endpoint.
 */
import { HaversineFacilityAssignmentProvider } from "./facility-assignment/haversine-provider";
import { MapboxGeocodingProvider } from "./geocoding/mapbox-provider";
import { BridgeSubmitter } from "./bridge-submitter";
import type { BatchSubmitter } from "./batch-submitter";

export function createBatchSubmitter(options: { mapboxApiKey: string; straddleMarginM?: number }): BatchSubmitter {
  return new BridgeSubmitter(
    new MapboxGeocodingProvider(options.mapboxApiKey),
    new HaversineFacilityAssignmentProvider(options.straddleMarginM),
  );
}

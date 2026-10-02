/**
 * Hand-written against `profiles/ddn/api/schemas.py` in the `ddn` repo
 * (verified field-by-field, not generated) as a starting point. Once a live
 * DDN instance is reachable in CI, `contract-snapshot/openapi.json` should
 * be captured from its `/openapi.json` and these types regenerated from it
 * -- see `tests/contract/ddn-openapi-drift.test.ts`, which is what keeps
 * the two from silently diverging afterwards.
 *
 * Only the fields the portal actually sends or reads are modeled here; a
 * field DDN added since the last snapshot and that the portal doesn't yet
 * use won't show up until it's needed.
 */

export type CoordSource = "actual" | "geocoded_address" | "zip_centroid";
export type GeocodeConfidence = "high" | "medium" | "low";
export type EnvelopeStatus =
  | "Requested"
  | "Reconciled"
  | "Assembled"
  | "Sorted"
  | "Ready"
  | "Transfer requested"
  | string; // the full §5.2.6 enum is wider than v1 needs to name exhaustively

export interface Envelope {
  package_id: string;
  customer_id: string;
  recipient_id: string;
  package_type: string;
  mailbag_id: string;
  status: EnvelopeStatus;
  expected_ready_at?: string | null;
  lat: number;
  lon: number;
  coord_source: CoordSource;
  geocode_confidence: GeocodeConfidence;
  facility_id: string;
  /** §8.1: a numeric score; tiers are offsets in it. */
  priority: number;
  weight_g?: number;
  sla_date: string;
  time_window_start?: string | null;
  time_window_end?: string | null;
  service_time_min?: number;
  attempt_number?: number;
  previous_outcome?: string | null;
  locked_vehicle_id?: string | null;
  excluded_by_ops?: boolean;
}

export interface EnvelopeBatch {
  envelopes: Envelope[];
}

export interface Mailbag {
  mailbag_id: string;
  customer_id: string;
  lat: number;
  lon: number;
  requested_at: string;
  envelope_count: number;
  expected_weight_g: number;
  assembly_required_count?: number;
  pickup_window_start?: string | null;
  pickup_window_end?: string | null;
  seal_id: string;
  file_received_at?: string | null;
}

export interface IngestAccepted {
  accepted: number;
  package_ids: string[];
}

export interface PickupRequested {
  mailbag_id: string;
  status: string;
}

export interface Problem {
  title: string;
  detail: string;
  status: number;
  current_state?: string | null;
  package_id?: string | null;
}

/**
 * `core/profile/schema.py`'s `Provenanced[T]`: a value the profile didn't
 * get to invent free-form -- `{value, provenance}`. Several profile fields
 * (`Band.low`, `Facility.route_release`, ...) are wrapped this way on the
 * wire; narrow to `.value` at the point of use, never earlier, so a reader
 * can't silently forget which numbers in a profile are measured/derived vs.
 * invented.
 */
export interface Provenanced<T> {
  value: T;
  provenance: string;
}

/** §9.3: one named `Band` in a profile's priority tiers. */
export interface Band {
  name: string;
  low: Provenanced<number>;
  tier: number;
}

export interface Coords {
  lat: number;
  lon: number;
  provenance: string;
}

export interface Facility {
  id: string;
  name: string;
  roles: string[];
  coords: Coords;
  route_release: Provenanced<string>;
  unload_min?: Provenanced<number> | null;
  transit_from_origin_min?: Provenanced<number> | null;
}

export interface Straddle {
  margin_m: Provenanced<number>;
  action: string;
}

export interface AssignmentRule {
  method: string;
  fallback: string;
  coarse_coords_allowed_for_assignment: boolean;
  coarse_coords_allowed_for_routing: boolean;
  straddle: Straddle;
}

export interface Priority {
  form: string;
  prize_scale: Provenanced<number>;
  /** Highest `low` threshold first -- order is significant (§8.1). */
  tiers: Band[];
}

/**
 * The subset of `core/profile/schema.py`'s `Profile` the portal reads --
 * shaped exactly like that wire format, not flattened. A flattened
 * intermediate is how the previous (wrong) version of this type got
 * invented without being checked against the real schema; narrowing
 * (picking `.value` off a `Provenanced`, reading `.coords.lat`) happens at
 * the point of use in `packages/bridge` instead.
 */
export interface ProfileSummary {
  facilities: Facility[];
  assignment_rule: AssignmentRule;
  objective: { priority: Priority };
}

export interface ProfileResponse {
  profile_id: string;
  version: string;
  profile: Record<string, unknown>;
}

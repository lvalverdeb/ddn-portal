import type { Envelope, Mailbag } from "@ddn-portal/ddn-client";

/**
 * What a customer upload row actually contains -- the other half of the
 * field table in the architecture plan. Everything here is customer-
 * supplied; nothing DDN computes appears on these types.
 */

export interface RawEnvelopeRow {
  package_id: string;
  recipient_id: string;
  /** DDN's own classification string, e.g. "letter" | "parcel" | "assembly".
   * Collected verbatim -- see bridge-submitter.ts for why this is not
   * paired with a separate `requires_assembly` boolean. */
  package_type: string;
  mailbag_id: string;
  address: string;
  /** Tenant's own priority tier name, from `ProfileSummary.objective.priority.tiers`. */
  priority_tier: string;
  sla_date: string;
  weight_g?: number;
}

export interface RawMailbagRow {
  mailbag_id: string;
  seal_id: string;
  address: string;
  pickup_window_start?: string;
  pickup_window_end?: string;
}

export type Flag =
  | { kind: "low_confidence_geocode"; package_id: string; confidence: string }
  | { kind: "ambiguous_facility_assignment"; package_id: string; candidates: string[] }
  | { kind: "unknown_priority_tier"; package_id: string; given: string };

export interface SubmissionResult {
  accepted: number;
  package_ids: string[];
  mailbag_id: string;
  flags: Flag[];
  /** The exact payloads built and sent to DDN -- `UploadChunk.ddnPayload`'s
   * source. A row dropped by a flag (e.g. `unknown_priority_tier`) has no
   * corresponding entry here; nothing was built for it. */
  envelopes: Envelope[];
  mailbag: Mailbag;
}

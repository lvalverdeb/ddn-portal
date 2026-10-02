import type { DdnClient, ProfileSummary } from "@ddn-portal/ddn-client";
import type { Flag, RawEnvelopeRow, RawMailbagRow, SubmissionResult } from "./raw-types";

export interface SubmissionContext {
  ddnClient: DdnClient;
  /** Stamped from the tenant registry -- never free text from the uploader. */
  customerId: string;
  /** The tenant's cached profile (facilities, priority tiers, assignment
   * rule). Read-only here; v1 never writes it back. */
  profile: ProfileSummary;
  /** Minted once per batch by the caller (the worker), reused across the
   * batch/envelope and pickup calls for this submission. */
  idempotencyKey: string;
}

/**
 * The one seam between "what DDN's ingest endpoints require today" and
 * "what a customer upload actually contains". `BridgeSubmitter` is the only
 * implementation in v1; `RawIntakeSubmitter` exists so that swapping to
 * ddn#1 once it ships is a factory change here, not a rewrite of every
 * caller.
 */
export interface BatchSubmitter {
  submit(
    ctx: SubmissionContext,
    rawEnvelopes: RawEnvelopeRow[],
    rawMailbag: RawMailbagRow,
  ): Promise<SubmissionResult>;
}

export type { Flag, RawEnvelopeRow, RawMailbagRow, SubmissionResult };

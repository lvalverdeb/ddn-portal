import type { BatchSubmitter, SubmissionContext } from "./batch-submitter";
import type { RawEnvelopeRow, RawMailbagRow, SubmissionResult } from "./raw-types";

/**
 * Stub for ddn#1 (https://github.com/lvalverdeb/ddn/issues/1). Once DDN
 * accepts customer-supplied fields directly and computes geocoding,
 * facility assignment, and priority itself, this becomes a thin mapping
 * from `RawEnvelopeRow`/`RawMailbagRow` to that endpoint's request shape --
 * no geocoding, facility-assignment, or priority-tier modules needed here
 * at all. Implementing this and flipping the factory in
 * `apps/worker` is phase 4; the upload form also needs a follow-up change
 * (see the architecture plan's phase 4 note) since the tier dropdown and
 * lat/lon fields this form collects today won't apply anymore.
 */
export class RawIntakeSubmitter implements BatchSubmitter {
  async submit(
    _ctx: SubmissionContext,
    _rawEnvelopes: RawEnvelopeRow[],
    _rawMailbag: RawMailbagRow,
  ): Promise<SubmissionResult> {
    throw new Error(
      "RawIntakeSubmitter is not implemented -- blocked on ddn#1 shipping a " +
        "raw-intake endpoint. Use BridgeSubmitter until then.",
    );
  }
}

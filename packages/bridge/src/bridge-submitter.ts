import type { Envelope, EnvelopeBatch, Mailbag } from "@ddn-portal/ddn-client";
import { requiresAssembly } from "./assembly-types";
import type { BatchSubmitter, SubmissionContext } from "./batch-submitter";
import type { FacilityAssignmentProvider } from "./facility-assignment/provider";
import type { GeocodingProvider } from "./geocoding/provider";
import { tierScore, UnknownTierError } from "./priority/tier-mapper";
import type { Flag, RawEnvelopeRow, RawMailbagRow, SubmissionResult } from "./raw-types";

/**
 * §4.1's stated default, duplicated here because `Mailbag.expected_weight_g`
 * has no server-side default to fall back on -- the caller has to compute
 * it before the API will accept anything (ddn#1 is exactly this problem).
 * If DDN ever makes this profile-configurable, source it from the cached
 * profile instead of this constant.
 */
const DEFAULT_WEIGHT_G = 200;

export class BridgeSubmitter implements BatchSubmitter {
  constructor(
    private readonly geocoder: GeocodingProvider,
    private readonly facilityAssignment: FacilityAssignmentProvider,
  ) {}

  async submit(
    ctx: SubmissionContext,
    rawEnvelopes: RawEnvelopeRow[],
    rawMailbag: RawMailbagRow,
  ): Promise<SubmissionResult> {
    const flags: Flag[] = [];
    const now = new Date().toISOString();

    const envelopes: Envelope[] = [];
    for (const row of rawEnvelopes) {
      const geocoded = await this.geocoder.geocode(row.address);
      if (geocoded.confidence === "low") {
        flags.push({
          kind: "low_confidence_geocode",
          package_id: row.package_id,
          confidence: geocoded.confidence,
        });
      }

      const assignment = await this.facilityAssignment.assign(
        geocoded,
        ctx.profile.facilities,
      );
      if (assignment.ambiguous) {
        flags.push({
          kind: "ambiguous_facility_assignment",
          package_id: row.package_id,
          candidates: assignment.candidates,
        });
      }

      let priority: number;
      try {
        priority = tierScore(ctx.profile.priority_tiers, row.priority_tier);
      } catch (err) {
        if (err instanceof UnknownTierError) {
          flags.push({
            kind: "unknown_priority_tier",
            package_id: row.package_id,
            given: row.priority_tier,
          });
          // §8.1's shape has no "no tier" value -- fail the row rather
          // than guess a score; the uploader corrects it and resubmits.
          continue;
        }
        throw err;
      }

      const envelope: Envelope = {
        package_id: row.package_id,
        customer_id: ctx.customerId,
        recipient_id: row.recipient_id,
        package_type: row.package_type,
        mailbag_id: row.mailbag_id,
        status: "Requested",
        lat: geocoded.lat,
        lon: geocoded.lon,
        coord_source: "geocoded_address",
        geocode_confidence: geocoded.confidence,
        facility_id: assignment.facilityId,
        priority,
        sla_date: row.sla_date,
        ...(row.weight_g !== undefined ? { weight_g: row.weight_g } : {}),
      };
      envelopes.push(envelope);
    }

    const batch: EnvelopeBatch = { envelopes };
    const ingestResult = await ctx.ddnClient.submitEnvelopeBatch(batch, ctx.idempotencyKey);

    const totalWeightG = envelopes.reduce((sum, e) => sum + (e.weight_g ?? DEFAULT_WEIGHT_G), 0);
    const assemblyCount = envelopes.filter((e) => requiresAssembly(e.package_type)).length;

    const mailbagGeocoded = await this.geocoder.geocode(rawMailbag.address);
    const mailbag: Mailbag = {
      mailbag_id: rawMailbag.mailbag_id,
      customer_id: ctx.customerId,
      lat: mailbagGeocoded.lat,
      lon: mailbagGeocoded.lon,
      requested_at: now,
      envelope_count: envelopes.length,
      expected_weight_g: totalWeightG,
      assembly_required_count: assemblyCount,
      seal_id: rawMailbag.seal_id,
      file_received_at: now,
      ...(rawMailbag.pickup_window_start ? { pickup_window_start: rawMailbag.pickup_window_start } : {}),
      ...(rawMailbag.pickup_window_end ? { pickup_window_end: rawMailbag.pickup_window_end } : {}),
    };
    await ctx.ddnClient.requestPickup(mailbag, ctx.idempotencyKey);

    return {
      accepted: ingestResult.accepted,
      package_ids: ingestResult.package_ids,
      mailbag_id: mailbag.mailbag_id,
      flags,
    };
  }
}

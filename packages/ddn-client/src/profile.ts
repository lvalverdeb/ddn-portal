import type { ProfileSummary } from "./types";

/**
 * Validates the raw JSON cached from `GET /profiles/{id}`'s `profile` field
 * (`ProfileResponse.profile`, a `Record<string, unknown>` on the wire)
 * narrows to the shape `packages/bridge` actually reads. Throws with a
 * specific missing/malformed path rather than letting a bad cache entry
 * surface as a confusing crash deep inside facility assignment or tier
 * mapping -- a cast here would hide exactly that failure instead of naming
 * it.
 */
export function parseProfileSummary(raw: unknown): ProfileSummary {
  if (typeof raw !== "object" || raw === null) {
    throw new ProfileShapeError("profile", "an object", raw);
  }
  const profile = raw as Record<string, unknown>;

  if (!Array.isArray(profile.facilities)) {
    throw new ProfileShapeError("profile.facilities", "an array", profile.facilities);
  }
  for (const [i, facility] of profile.facilities.entries()) {
    if (typeof facility !== "object" || facility === null) {
      throw new ProfileShapeError(`profile.facilities[${i}]`, "an object", facility);
    }
    const f = facility as Record<string, unknown>;
    if (typeof f.id !== "string") {
      throw new ProfileShapeError(`profile.facilities[${i}].id`, "a string", f.id);
    }
    if (typeof f.coords !== "object" || f.coords === null) {
      throw new ProfileShapeError(`profile.facilities[${i}].coords`, "an object", f.coords);
    }
    const coords = f.coords as Record<string, unknown>;
    if (typeof coords.lat !== "number" || typeof coords.lon !== "number") {
      throw new ProfileShapeError(`profile.facilities[${i}].coords.{lat,lon}`, "numbers", coords);
    }
  }

  const assignmentRule = profile.assignment_rule;
  if (typeof assignmentRule !== "object" || assignmentRule === null) {
    throw new ProfileShapeError("profile.assignment_rule", "an object", assignmentRule);
  }
  if (typeof (assignmentRule as Record<string, unknown>).fallback !== "string") {
    throw new ProfileShapeError("profile.assignment_rule.fallback", "a string", assignmentRule);
  }

  const objective = profile.objective;
  if (typeof objective !== "object" || objective === null) {
    throw new ProfileShapeError("profile.objective", "an object", objective);
  }
  const priority = (objective as Record<string, unknown>).priority;
  if (typeof priority !== "object" || priority === null) {
    throw new ProfileShapeError("profile.objective.priority", "an object", priority);
  }
  const tiers = (priority as Record<string, unknown>).tiers;
  if (!Array.isArray(tiers)) {
    throw new ProfileShapeError("profile.objective.priority.tiers", "an array", tiers);
  }
  for (const [i, band] of tiers.entries()) {
    if (typeof band !== "object" || band === null) {
      throw new ProfileShapeError(`profile.objective.priority.tiers[${i}]`, "an object", band);
    }
    const b = band as Record<string, unknown>;
    if (typeof b.name !== "string") {
      throw new ProfileShapeError(`profile.objective.priority.tiers[${i}].name`, "a string", b.name);
    }
    if (
      typeof b.low !== "object" ||
      b.low === null ||
      typeof (b.low as Record<string, unknown>).value !== "number"
    ) {
      throw new ProfileShapeError(
        `profile.objective.priority.tiers[${i}].low`,
        "a Provenanced<number> ({value, provenance})",
        b.low,
      );
    }
  }

  return profile as unknown as ProfileSummary;
}

export class ProfileShapeError extends Error {
  constructor(
    public readonly path: string,
    public readonly expected: string,
    public readonly actual: unknown,
  ) {
    super(`cached profile is malformed at ${path}: expected ${expected}, got ${JSON.stringify(actual)}`);
  }
}

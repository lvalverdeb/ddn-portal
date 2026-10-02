import type { Band } from "@ddn-portal/ddn-client";

/**
 * §8.1 only defines priority's *shape* (a numeric score with tier offsets);
 * the scoring formula isn't part of the published API, so this does not
 * invent one. A tenant's actual tiers are published data
 * (`core/profile/schema.py`'s `Priority.tiers: list[Band]`, each with a
 * `name` and a `low` threshold) -- this only maps a chosen tier's name to
 * that threshold.
 */
export function tierScore(tiers: Band[], tierName: string): number {
  const band = tiers.find((t) => t.name === tierName);
  if (!band) {
    throw new UnknownTierError(tierName, tiers.map((t) => t.name));
  }
  return band.low;
}

export class UnknownTierError extends Error {
  constructor(
    public readonly given: string,
    public readonly known: string[],
  ) {
    super(`unknown priority tier "${given}" -- known tiers: ${known.join(", ")}`);
  }
}

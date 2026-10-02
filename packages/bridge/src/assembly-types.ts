/**
 * DDN's own hub-readiness step keys assembly off `package_type`
 * (`profiles/ddn/processing/readiness.py`: `ASSEMBLY_TYPES =
 * frozenset({"assembly"})`), flagged there as a placeholder spelling, not
 * published contract. `assembly_required_count` is derived from the same
 * set here, so the two systems' idea of which envelopes need assembly
 * stays in agreement by construction -- a change to DDN's convention is a
 * one-line update to this constant, not a second field to keep in sync.
 */
export const ASSEMBLY_PACKAGE_TYPES = new Set(["assembly"]);

export function requiresAssembly(packageType: string): boolean {
  return ASSEMBLY_PACKAGE_TYPES.has(packageType);
}

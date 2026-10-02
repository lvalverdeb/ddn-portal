import type { Facility } from "@ddn-portal/ddn-client";
import type { FacilityAssignment, FacilityAssignmentProvider } from "./provider";

/**
 * Opt-in, per-tenant: road-distance assignment against the same OSRM
 * service DDN's own `vrp-platform` dependency uses
 * (`osrm-microservice`, pinned in `ddn`'s `pyproject.toml`). Not wired up
 * in phase 0 -- a tenant has to already be running that service for this to
 * apply, so it stays a stub until the first tenant needs it.
 */
export class OsrmFacilityAssignmentProvider implements FacilityAssignmentProvider {
  constructor(private readonly osrmBaseUrl: string) {}

  async assign(
    _point: { lat: number; lon: number },
    _facilities: Facility[],
  ): Promise<FacilityAssignment> {
    throw new Error(
      `OsrmFacilityAssignmentProvider not yet implemented (osrmBaseUrl=${this.osrmBaseUrl}); ` +
        "use HaversineFacilityAssignmentProvider until a tenant needs road-distance assignment",
    );
  }
}

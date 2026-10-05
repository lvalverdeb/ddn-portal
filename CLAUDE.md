# CLAUDE.md — DDN Customer Data-Upload Portal

See `README.md` for layout and the architecture plan for the full phased
roadmap. This file holds standing decisions that aren't obvious from the
code alone.

## Working assumptions

- **Geocoding provider: OpenStreetMap (Nominatim) only. Stay away from
  Mapbox.** This was an explicit decision (2026-10-05), not a cost/coverage
  placeholder to revisit later — `packages/bridge`'s `GeocodingProvider`
  interface exists so providers are swappable in principle, but Mapbox
  specifically is retired, not merely unused. Do not reintroduce a Mapbox
  (or other paid third-party geocoding) provider, an API key for one, or
  env vars named for one. `NominatimGeocodingProvider` is the only
  implementation; Nominatim's usage policy requires a descriptive
  User-Agent (no API key) — see that class's own doc comment.

- **Services `ddn-portal` doesn't own go through the `ddn` backend, never
  direct.** The portal keeps its own Postgres for its own data (tenants,
  upload batches/chunks, sessions) — that's this product's own state and
  stays direct, unrelated to this rule. But for infrastructure that is
  `ddn`'s — its own Postgres/state, and OSRM road-distance lookups — the
  portal must reach it only through `ddn`'s published HTTP API, the same
  way `packages/ddn-client` already does for everything else, never by
  holding its own direct connection or credential to that infrastructure.
  **Known gap, not yet remediated**: `packages/bridge/src/facility-assignment/osrm-provider.ts`
  (`OsrmFacilityAssignmentProvider`) is still an unimplemented stub (it
  throws), but its constructor already takes a direct `osrmBaseUrl` — i.e.
  it's designed to call OSRM directly once implemented. That design is
  inconsistent with this rule; flagged here so whoever implements it
  routes through `ddn` instead, rather than finishing it as drawn.

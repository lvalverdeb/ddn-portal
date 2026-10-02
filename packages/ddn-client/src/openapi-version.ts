/**
 * Validates `GET /openapi.json`'s response far enough to pull out
 * `info.version` -- the per-tenant "observed DDN spec version" the admin
 * table records. Same specific-error-path style as `parseProfileSummary`:
 * a malformed document should name exactly what's wrong, not surface as a
 * cast-hidden `undefined` three calls later.
 */
export function parseOpenApiVersion(raw: unknown): string {
  if (typeof raw !== "object" || raw === null) {
    throw new OpenApiShapeError("$", "an object", raw);
  }
  const info = (raw as Record<string, unknown>).info;
  if (typeof info !== "object" || info === null) {
    throw new OpenApiShapeError("info", "an object", info);
  }
  const version = (info as Record<string, unknown>).version;
  if (typeof version !== "string") {
    throw new OpenApiShapeError("info.version", "a string", version);
  }
  return version;
}

export class OpenApiShapeError extends Error {
  constructor(
    public readonly path: string,
    public readonly expected: string,
    public readonly actual: unknown,
  ) {
    super(`openapi document is malformed at ${path}: expected ${expected}, got ${JSON.stringify(actual)}`);
  }
}

/**
 * DDN has no authentication today. Modeling that as a value -- rather than
 * leaving credential fields absent/optional -- means upstream DDN adding
 * auth is a new variant here and a data migration on `Tenant`, not a schema
 * change plus an `if` scattered through every call site.
 */
export type DdnCredential =
  | { kind: "none" }
  | { kind: "api_key"; headerName: string; value: string }
  | { kind: "bearer"; value: string };

export function applyCredential(
  headers: Record<string, string>,
  credential: DdnCredential,
): Record<string, string> {
  switch (credential.kind) {
    case "none":
      return headers;
    case "api_key":
      return { ...headers, [credential.headerName]: credential.value };
    case "bearer":
      return { ...headers, Authorization: `Bearer ${credential.value}` };
  }
}

/**
 * `Tenant.credentialKind` -> `DdnCredential`. Lives here, not duplicated in
 * `apps/web` and `apps/worker`, so both processes throw on the same
 * unresolved-secret-storage gap instead of silently diverging (one treating
 * a tenant as unauthenticated while the other errors).
 */
export function resolveTenantCredential(tenant: {
  credentialKind: string;
  credentialSecretRef: string | null;
}): DdnCredential {
  switch (tenant.credentialKind) {
    case "NONE":
      return { kind: "none" };
    case "API_KEY":
      // TODO(open item, see architecture plan): resolve credentialSecretRef
      // through the real secrets store once that mechanism is decided.
      // Throwing here rather than silently treating it as unauthenticated.
      throw new Error(
        "API_KEY credential resolution not implemented -- secret storage mechanism is an open item",
      );
    case "BEARER":
      throw new Error(
        "BEARER credential resolution not implemented -- secret storage mechanism is an open item",
      );
    default:
      throw new Error(`unknown credential kind: ${tenant.credentialKind}`);
  }
}

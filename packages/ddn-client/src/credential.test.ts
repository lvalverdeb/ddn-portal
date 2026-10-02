import { describe, expect, it } from "vitest";
import { applyCredential, resolveTenantCredential } from "./credential";

describe("applyCredential", () => {
  it("leaves headers untouched for kind:none", () => {
    expect(applyCredential({ Accept: "application/json" }, { kind: "none" })).toEqual({
      Accept: "application/json",
    });
  });

  it("sets the given header name for kind:api_key", () => {
    const headers = applyCredential(
      {},
      { kind: "api_key", headerName: "X-Api-Key", value: "secret" },
    );
    expect(headers).toEqual({ "X-Api-Key": "secret" });
  });

  it("sets an Authorization: Bearer header for kind:bearer", () => {
    const headers = applyCredential({}, { kind: "bearer", value: "token123" });
    expect(headers).toEqual({ Authorization: "Bearer token123" });
  });
});

describe("resolveTenantCredential", () => {
  it("maps NONE to kind:none", () => {
    expect(resolveTenantCredential({ credentialKind: "NONE", credentialSecretRef: null })).toEqual({
      kind: "none",
    });
  });

  it("throws for API_KEY -- secret storage isn't implemented yet", () => {
    expect(() =>
      resolveTenantCredential({ credentialKind: "API_KEY", credentialSecretRef: "ref-1" }),
    ).toThrow(/secret storage/);
  });

  it("throws for BEARER -- secret storage isn't implemented yet", () => {
    expect(() =>
      resolveTenantCredential({ credentialKind: "BEARER", credentialSecretRef: "ref-1" }),
    ).toThrow(/secret storage/);
  });

  it("throws for an unrecognized credential kind", () => {
    expect(() =>
      resolveTenantCredential({ credentialKind: "OAUTH", credentialSecretRef: null }),
    ).toThrow(/unknown credential kind/);
  });
});

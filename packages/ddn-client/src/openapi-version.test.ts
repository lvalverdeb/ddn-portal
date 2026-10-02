import { describe, expect, it } from "vitest";
import { parseOpenApiVersion, OpenApiShapeError } from "./openapi-version";

describe("parseOpenApiVersion", () => {
  it("extracts info.version", () => {
    expect(parseOpenApiVersion({ openapi: "3.1.0", info: { title: "DDN", version: "0.20.0" } })).toBe(
      "0.20.0",
    );
  });

  it("rejects a non-object", () => {
    expect(() => parseOpenApiVersion(null)).toThrow(OpenApiShapeError);
  });

  it("rejects a missing info", () => {
    expect(() => parseOpenApiVersion({ openapi: "3.1.0" })).toThrow(/^openapi document is malformed at info:/);
  });

  it("rejects a non-string version", () => {
    expect(() => parseOpenApiVersion({ info: { version: 20 } })).toThrow(/info\.version/);
  });
});

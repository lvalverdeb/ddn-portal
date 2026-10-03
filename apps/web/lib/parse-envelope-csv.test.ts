import { describe, expect, it } from "vitest";
import { EnvelopeCsvError, parseEnvelopeCsv } from "./parse-envelope-csv";

const HEADER = "package_id,recipient_id,package_type,address,priority_tier,sla_date,weight_g";

describe("parseEnvelopeCsv", () => {
  it("parses a simple unquoted row", () => {
    const csv = `${HEADER}\npkg-1,rec-1,letter,123 Main St,standard,2026-10-05,150`;
    expect(parseEnvelopeCsv(csv)).toEqual([
      {
        package_id: "pkg-1",
        recipient_id: "rec-1",
        package_type: "letter",
        address: "123 Main St",
        priority_tier: "standard",
        sla_date: "2026-10-05",
        weight_g: 150,
      },
    ]);
  });

  it("omits weight_g when the column is empty", () => {
    const csv = `${HEADER}\npkg-1,rec-1,letter,123 Main St,standard,2026-10-05,`;
    expect(parseEnvelopeCsv(csv)[0]).not.toHaveProperty("weight_g");
  });

  it("handles a quoted address containing a comma", () => {
    const csv = `${HEADER}\npkg-1,rec-1,letter,"123 Main St, Apt 4",standard,2026-10-05,`;
    expect(parseEnvelopeCsv(csv)[0].address).toBe("123 Main St, Apt 4");
  });

  it("handles an escaped double-quote inside a quoted field", () => {
    const csv = `${HEADER}\npkg-1,rec-1,letter,"123 Main St, ""Unit B""",standard,2026-10-05,`;
    expect(parseEnvelopeCsv(csv)[0].address).toBe('123 Main St, "Unit B"');
  });

  it("handles CRLF line endings", () => {
    const csv = `${HEADER}\r\npkg-1,rec-1,letter,123 Main St,standard,2026-10-05,\r\npkg-2,rec-2,parcel,456 Oak Ave,rush,2026-10-06,500\r\n`;
    const rows = parseEnvelopeCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1].package_id).toBe("pkg-2");
    expect(rows[1].weight_g).toBe(500);
  });

  it("parses multiple rows without a trailing newline", () => {
    const csv = `${HEADER}\npkg-1,rec-1,letter,123 Main St,standard,2026-10-05,\npkg-2,rec-2,parcel,456 Oak Ave,rush,2026-10-06,`;
    expect(parseEnvelopeCsv(csv)).toHaveLength(2);
  });

  it("rejects a CSV missing a required column", () => {
    const csv = "package_id,recipient_id,package_type,address,sla_date\npkg-1,rec-1,letter,123 Main St,2026-10-05";
    expect(() => parseEnvelopeCsv(csv)).toThrow(EnvelopeCsvError);
  });

  it("rejects a row missing a required value", () => {
    const csv = `${HEADER}\npkg-1,rec-1,letter,,standard,2026-10-05,`;
    expect(() => parseEnvelopeCsv(csv)).toThrow(/row 2/);
  });

  it("rejects a non-numeric weight_g", () => {
    const csv = `${HEADER}\npkg-1,rec-1,letter,123 Main St,standard,2026-10-05,heavy`;
    expect(() => parseEnvelopeCsv(csv)).toThrow(/not a number/);
  });

  it("rejects an empty CSV", () => {
    expect(() => parseEnvelopeCsv("")).toThrow(EnvelopeCsvError);
  });

  it("rejects a header-only CSV", () => {
    expect(() => parseEnvelopeCsv(HEADER)).toThrow(/no data rows/);
  });
});

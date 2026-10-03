/**
 * Parses the envelope-rows CSV the upload form accepts. Columns match
 * `RawEnvelopeRow` minus `mailbag_id` -- that field is stamped server-side
 * from the batch's mailbag (see `POST /api/uploads`), so the CSV can't
 * disagree with the batch it's submitted under.
 *
 * Hand-rolled rather than a dependency: this repo adds no CSV library
 * elsewhere, and the only real complexity is RFC4180 `"..."` quoting and
 * `""`-escaping, which `address` values realistically need (they contain
 * commas).
 */

export interface ParsedEnvelopeRow {
  package_id: string;
  recipient_id: string;
  package_type: string;
  address: string;
  priority_tier: string;
  sla_date: string;
  weight_g?: number;
}

export class EnvelopeCsvError extends Error {}

const REQUIRED_COLUMNS = [
  "package_id",
  "recipient_id",
  "package_type",
  "address",
  "priority_tier",
  "sla_date",
] as const;

export function parseEnvelopeCsv(text: string): ParsedEnvelopeRow[] {
  const rows = parseCsvRows(text).filter((row) => !(row.length === 1 && row[0] === ""));
  if (rows.length === 0) {
    throw new EnvelopeCsvError("CSV is empty");
  }

  const [header, ...dataRows] = rows;
  for (const column of REQUIRED_COLUMNS) {
    if (!header.includes(column)) {
      throw new EnvelopeCsvError(`missing required column "${column}"`);
    }
  }
  if (dataRows.length === 0) {
    throw new EnvelopeCsvError("CSV has a header row but no data rows");
  }

  return dataRows.map((row, i) => {
    const lineNumber = i + 2; // +1 for the header, +1 for 1-indexing
    const record: Record<string, string> = {};
    header.forEach((column, idx) => {
      record[column] = row[idx] ?? "";
    });

    for (const column of REQUIRED_COLUMNS) {
      if (!record[column]) {
        throw new EnvelopeCsvError(`row ${lineNumber}: missing value for "${column}"`);
      }
    }

    const result: ParsedEnvelopeRow = {
      package_id: record.package_id,
      recipient_id: record.recipient_id,
      package_type: record.package_type,
      address: record.address,
      priority_tier: record.priority_tier,
      sla_date: record.sla_date,
    };

    if (record.weight_g) {
      const weightG = Number(record.weight_g);
      if (Number.isNaN(weightG)) {
        throw new EnvelopeCsvError(`row ${lineNumber}: weight_g "${record.weight_g}" is not a number`);
      }
      result.weight_g = weightG;
    }

    return result;
  });
}

/** RFC4180 row/field split: `,` separates fields, `"..."` quotes a field
 * that may contain commas or newlines, and `""` inside a quoted field is a
 * literal `"`. Handles both `\n` and `\r\n` line endings. */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // swallowed; \n (bare or following \r) ends the row
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

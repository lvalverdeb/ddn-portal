"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EnvelopeCsvError, parseEnvelopeCsv } from "@/lib/parse-envelope-csv";

function str(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * One `UploadBatch` = one mailbag (this form's fields) plus its envelope
 * rows (the CSV file). mailbag_id is not a CSV column -- it's stamped
 * server-side from the mailbag field below, so the file can't disagree
 * with the batch it's submitted under (see POST /api/uploads).
 *
 * v1 has no partial-resubmit: a flagged or failed row is corrected and
 * resubmitted in a new file, never by re-uploading the whole batch again --
 * that would double-submit the rows DDN already has.
 */
export function UploadForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const fileInput = form.elements.namedItem("envelopes") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) {
      setError("choose a CSV file of envelope rows");
      return;
    }

    const mailbag = {
      mailbag_id: str(data.get("mailbag_id")),
      seal_id: str(data.get("seal_id")),
      address: str(data.get("address")),
      pickup_window_start: str(data.get("pickup_window_start")),
      pickup_window_end: str(data.get("pickup_window_end")),
    };
    if (!mailbag.mailbag_id || !mailbag.seal_id || !mailbag.address) {
      setError("mailbag_id, seal_id, and address are required");
      return;
    }

    setPending(true);
    let envelopes;
    try {
      envelopes = parseEnvelopeCsv(await file.text());
    } catch (err) {
      setPending(false);
      setError(err instanceof EnvelopeCsvError ? err.message : "could not parse the CSV file");
      return;
    }

    const res = await fetch("/api/uploads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ fileName: file.name, mailbag, envelopes }),
    });

    setPending(false);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(typeof payload.error === "string" ? payload.error : `Upload failed (${res.status})`);
      return;
    }

    form.reset();
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ marginBottom: "2rem", display: "grid", gap: "0.5rem", maxWidth: 480 }}
    >
      <h2>New upload</h2>
      <label>
        Mailbag ID
        <input name="mailbag_id" required style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Seal ID
        <input name="seal_id" required style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Pickup address
        <input name="address" required style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Pickup window start (optional)
        <input name="pickup_window_start" type="datetime-local" style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Pickup window end (optional)
        <input name="pickup_window_end" type="datetime-local" style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Envelope rows (CSV: package_id, recipient_id, package_type, address,
        priority_tier, sla_date, weight_g)
        <input name="envelopes" type="file" accept=".csv,text/csv" required style={{ display: "block" }} />
      </label>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Uploading..." : "Upload"}
      </button>
      <p style={{ fontSize: "0.85rem", color: "#555" }}>
        If any rows come back flagged or failed, correct and resubmit just those
        rows in a new file -- re-uploading the whole file again would double-submit
        the rows already accepted.
      </p>
    </form>
  );
}

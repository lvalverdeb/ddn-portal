"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function str(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Posts to the existing POST /api/tenants route rather than duplicating
 * tenant-creation logic in a Server Action -- the route already owns
 * validation, the ownerEmail conflict check, and the audit log write.
 */
export function NewTenantForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      name: str(data.get("name")),
      slug: str(data.get("slug")),
      ddnBaseUrl: str(data.get("ddnBaseUrl")),
      ddnCustomerId: str(data.get("ddnCustomerId")),
      profileId: str(data.get("profileId")),
      ownerEmail: str(data.get("ownerEmail")),
    };

    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setPending(false);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(typeof payload.error === "string" ? payload.error : `Request failed (${res.status})`);
      return;
    }

    form.reset();
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ marginBottom: "2rem", display: "grid", gap: "0.5rem", maxWidth: 420 }}
    >
      <h2>New tenant</h2>
      <label>
        Name
        <input name="name" required style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Slug
        <input name="slug" required style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        DDN base URL
        <input name="ddnBaseUrl" required type="url" style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        DDN customer_id (defaults to slug)
        <input name="ddnCustomerId" style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Profile ID
        <input name="profileId" style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Owner email (optional -- links an existing or new portal user to this
        tenant)
        <input name="ownerEmail" type="email" style={{ display: "block", width: "100%" }} />
      </label>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create tenant"}
      </button>
    </form>
  );
}

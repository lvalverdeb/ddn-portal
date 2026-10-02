import { applyCredential, type DdnCredential } from "./credential";
import type {
  Envelope,
  EnvelopeBatch,
  IngestAccepted,
  Mailbag,
  PickupRequested,
  Problem,
  ProfileResponse,
} from "./types";

export class DdnApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: Problem | undefined,
    public readonly bodyText: string,
  ) {
    super(problem?.detail ?? `DDN API error ${status}`);
  }
}

export interface DdnClientOptions {
  baseUrl: string;
  credential: DdnCredential;
  fetchImpl?: typeof fetch;
}

/**
 * Thin, typed wrapper over DDN's HTTP API (`profiles/ddn/api/`). Every
 * method name and path here was checked against the routers in that repo
 * (`routers/envelopes.py`, `routers/pickups.py`, `routers/profiles.py`),
 * not assumed from the spec doc alone.
 *
 * Callers outside `apps/web`'s Route Handlers and `apps/worker` should not
 * exist -- a DDN credential never needs to reach the browser or any other
 * process.
 */
export class DdnClient {
  private readonly baseUrl: string;
  private readonly credential: DdnCredential;
  private readonly fetchImpl: typeof fetch;

  constructor(options: DdnClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.credential = options.credential;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** §13.1: required on every ingest/event call so a retry can't duplicate work. */
  async submitEnvelopeBatch(
    batch: EnvelopeBatch,
    idempotencyKey: string,
  ): Promise<IngestAccepted> {
    return this.request<IngestAccepted>("POST", "/envelopes/batch", batch, idempotencyKey);
  }

  async requestPickup(bag: Mailbag, idempotencyKey: string): Promise<PickupRequested> {
    return this.request<PickupRequested>("POST", "/pickups", bag, idempotencyKey);
  }

  /**
   * Verification, not trust: DDN's idempotency replay cache has a 24h TTL
   * and its store is in-memory, so a 202 from `submitEnvelopeBatch` is not
   * proof the envelope still exists. Callers that need certainty (the
   * worker, after submitting a chunk) should confirm via this.
   */
  async getEnvelope(packageId: string): Promise<Envelope | null> {
    try {
      return await this.request<Envelope>("GET", `/envelopes/${encodeURIComponent(packageId)}`);
    } catch (err) {
      if (err instanceof DdnApiError && err.status === 404) return null;
      throw err;
    }
  }

  async getLatestProfile(profileId: string): Promise<ProfileResponse> {
    return this.request<ProfileResponse>("GET", `/profiles/${encodeURIComponent(profileId)}`);
  }

  async getOpenApiSpec(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", "/openapi.json");
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    let headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    headers = applyCredential(headers, this.credential);

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    if (!res.ok) {
      let problem: Problem | undefined;
      try {
        problem = JSON.parse(text) as Problem;
      } catch {
        // DDN's 400 (missing Idempotency-Key) and validation 422s are not
        // always RFC 9457 shaped -- fall through with the raw text.
      }
      throw new DdnApiError(res.status, problem, text);
    }
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }
}

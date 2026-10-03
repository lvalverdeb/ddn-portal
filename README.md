# DDN Customer Data-Upload Portal

A standalone, multi-tenant portal for customers to upload delivery/pickup
data into a DDN deployment. DDN (`lvalverdeb/ddn`) is consumed only through
its published HTTP API (see `packages/ddn-client`) — this repo never vendors
DDN code. Gaps in that API are filed as issues against `lvalverdeb/ddn`
(e.g. [ddn#1](https://github.com/lvalverdeb/ddn/issues/1)) rather than
worked around silently; see `packages/bridge` for how a temporary workaround
is isolated and tracked back to its upstream issue.

## Layout

- `apps/web` — Next.js app (App Router). Route Handlers under `app/api/*`
  are the BFF: they hold tenant DDN credentials server-side and are the only
  thing that calls `packages/ddn-client`.
- `apps/worker` — background job processor that drains upload batches and
  submits them to DDN via `packages/bridge`.
- `packages/ddn-client` — typed HTTP client for DDN's API, plus a checked-in
  OpenAPI contract snapshot and drift test (`tests/contract`).
- `packages/bridge` — the v1 field-completion workaround for DDN's raw-intake
  gap (ddn#1). One exported interface, `BatchSubmitter`; swapping to raw
  intake once that issue ships is a one-line factory change plus removing
  this package's geocoding/assignment/priority modules.
- `packages/db` — Prisma schema and client.

## Development

```sh
pnpm install
pnpm db:generate
pnpm dev
```

Requires a running DDN instance (see the `ddn` repo's `make bootstrap`) and
`DATABASE_URL` pointed at a local Postgres. Copy `apps/web/.env.example` to
`apps/web/.env.local` and fill in values.

### First-deploy admin bootstrap

There is no self-service path to the first `ADMIN` account — `POST
/api/tenants` (where tenants and their owners get created) is itself gated
behind an existing admin session. Each new environment (including first
local setup) needs one explicit seed step:

```sh
SEED_ADMIN_EMAIL=you@example.com pnpm db:seed
```

Idempotent — safe to re-run. Promotes the row to `ADMIN` if it already
exists, creates a tenant-less admin row if not. Sign in with that email via
the configured `EMAIL_SERVER` (magic link) afterward.

## Status

Phases 0–3 done (scaffold, tenant onboarding, read-only profile view,
upload v1 with the bridge submitter and flagged-row report). Phase 4
(raw-intake swap) is blocked on upstream
[ddn#1](https://github.com/lvalverdeb/ddn/issues/1) — a resolution proposal
is posted [on the issue](https://github.com/lvalverdeb/ddn/issues/1#issuecomment-5969922886),
not yet implemented; phase 5 (config editing) is blocked on a persistence
gap in DDN's own profile store. See the architecture plan for the full
phased roadmap.

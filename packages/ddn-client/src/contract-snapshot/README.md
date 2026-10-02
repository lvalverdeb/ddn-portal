# Contract snapshot

`openapi.json` here is the DDN API's OpenAPI document as captured from a
known-good instance, pinned the way `ddn`'s own `pyproject.toml` pins
`vrp-platform @ git+...@v0.4.0` (`allow-direct-references = true`) — a
versioned external dependency, snapshotted rather than re-fetched live.

Not yet captured (phase 0 has no live DDN instance wired into this repo's
CI). To populate it:

```sh
curl http://localhost:8000/openapi.json > packages/ddn-client/src/contract-snapshot/openapi.json
```

against a `ddn` instance at the git tag this portal is meant to support.
`tests/contract/ddn-openapi-drift.test.ts` diffs a live instance's document
against this file; a failing diff means either the snapshot needs a
deliberate update (and `src/types.ts` reviewed alongside it) or the portal
just found a real upstream break.

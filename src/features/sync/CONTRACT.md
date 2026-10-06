# Cloud workspace integration

Import `useCloudWorkspace` and `clearAccountCache` from `src/features/sync/index.js`.
The hook takes the authenticated user (`user.id`), not a session or email.
It returns exactly these fields:

| Field | Contract |
| --- | --- |
| `workspace` | `{ cards, activeId, theme, horizon }`; starts with one `newCard()`, light theme, horizon 6 for each identity. Never starts from guest data. |
| `setWorkspace(valueOrUpdater)` | Supports a value or React-style updater. All changes are ignored unless `canEdit`; financial changes debounce for 500 ms. Theme, horizon, and selection never enter the cloud payload. Returns a boolean indicating acceptance. |
| `status` | `signed-out`, `loading`, `needs-choice`, `synced`, `saving`, `offline`, `conflict`, or `error`. |
| `error` | Empty string or error message, including `SYNC_CONFLICT`. `INVALID_DRAFT` means an editable, unsaved partial draft, not a failed cloud operation. |
| `canEdit` | True only after a successful cloud fetch/explicit initialization, while online and synced/saving. Guard parent mutation actions and disable editors using this flag. |
| `reload()` | Promise of boolean. Explicitly discards the in-memory draft only after a successful remote read. Parent must confirm discard first when dirty. Also the sole recovery action after error/conflict. |
| `importLocal(includeGuest = true)` | Promise of boolean. Parent confirms the destination/import first. `true` appends validated guest scenarios, regenerating card and purchase IDs; never imports guest preferences or arbitrary state. `false` initializes the one-card empty workspace only in `needs-choice`. Both choices use CAS and await acknowledgement. |
| `importAvailable` | Guest v2 storage contains validated, non-default calculation data not previously imported successfully by this account. Corrupt, incomplete, absent, default-only, or already imported guest data is not importable. |
| `dirty` | Financial draft has changes not yet acknowledged. It remains in memory on conflict, failed save, or offline interruption; never cached. |

## Parent responsibilities

- Keep the existing guest workspace implementation separate. Passing no user yields a disabled empty scope, not the guest calculator.
- Confirm import, reload/discard, and logout with pending edits; close/reset draft editors and other parent-owned state on identity changes.
- On logout, unmount/change the authenticated scope and call `clearAccountCache(oldUser.id)` after pending operations have settled. It removes only that account's confirmed cache, never the guest key. Already-dispatched HTTP writes cannot be undone; the repository checks the authenticated session and current scope immediately before dispatch, and stale responses cannot update state/cache.
- Do not offer force overwrite. Conflict recovery is export/inspect the retained draft, then confirmed `reload()`.
- Current card and purchase DTOs require all known keys and reject unknown keys (including card number, CVV, expiry, and credentials). Serialization-invalid edits are accepted into the in-memory workspace with `dirty: true`, `status: synced`, `error: INVALID_DRAFT`, and `canEdit: true` while online/current. They cancel the debounce timer and are never sent or cached. `flush()` returns false without freezing the draft. Corrections clear the draft error and recompute dirty against the last confirmed serialized payload; only changed valid drafts schedule a save. Statement-only purchases retain their validated fields rather than being dropped by the local normalizer.

## Persistence and refresh

Only `{ cards }` is sent to `save_calculation_workspace` with `p_payload` and
`p_expected_version`. Its canonical single-row response supplies the next version.
Reads use `calculation_workspaces`, filtered by `user_id`, under the existing RLS.
No saves occur before the first successful fetch, and a missing row does not
initialize itself. Writes are serialized; changes during a save wait for its
acknowledgement and use the resulting version.
An acknowledgement advances the confirmed version/cache even if a newer draft
is invalid; that draft stays dirty and editable without an automatic save.

Successful explicit guest imports record checksum-only history under
`calculation-workspace-imported-v1:${encodeURIComponent(user.id)}`. Each marker
is a JSON array of eight-character, non-cryptographic 32-bit checksums of the
serialized guest payload, never financial payloads. Checksums are deduplication
hints, not security identities (collisions are possible). Guest preferences do
not affect the fingerprint. Repeated/concurrent imports are rejected without
appending or saving; changed guest data requires another explicit import.
Markers are written only after successful acknowledgement in the current
account/generation and survive account-cache clearing. Guest storage is never
modified. If storage is unavailable, history is retained only for the mounted
controller and cannot guarantee deduplication after remounting.

Account cache key: `calculation-workspace-confirmed-v1:${encodeURIComponent(user.id)}`.
Only validated, server-confirmed financial rows are cached. Cache is read-only
until a successful fetch; failed reads retain it. A confirmed missing row clears
the old cache. No guest key is ever used as an account cache or modified by import.
Device preferences stay in the mounted hook state, not cloud/account cache.
Guest v1 data is not migrated or uploaded by sync; the existing guest flow may
migrate it into validated v2 data before the parent offers an import.

Refresh uses window focus, online/offline events, and **20-second polling**, not
Realtime. Clean workspaces reload; dirty workspaces check the remote version and
freeze on change/deletion. A dirty draft can resume after reconnect only when
the remote version is unchanged. Refresh waits for any in-flight write before
reading. Errors/conflicts do not retry automatically; parent-confirmed reload is
required. Account scope guards apply during render and every async continuation;
effect generations invalidate old reads/writes during cleanup/StrictMode replay.

## Verification

Run without changing package scripts:

```sh
node --test src/features/sync/*.test.js
```

Tests use an injected/mock repository, fake timers/storage and deferred promises.
They cover DTO round trips/rejection, safe imports, account cache isolation,
editable invalid drafts/recovery, acknowledgements with newer invalid drafts,
checksum import history/account isolation and failed/stale import completions,
initial choice, serialized revisions, CAS conflicts, read/save failures, offline
recovery, stale scope responses, StrictMode-style replay, deletion and RPC args.
They do not exercise real Supabase RLS, Google authentication, or the parent's UI.

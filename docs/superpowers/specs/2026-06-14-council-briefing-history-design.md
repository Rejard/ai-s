# Council Briefing History Design

## Objective

Persist generated 500-candidate council briefing text in SQLite so admin and investment views can immediately show the latest successful analysis instead of temporarily replacing it with an in-progress placeholder.

## Scope

This phase implements:

- a persistent briefing history table for council analysis text;
- explicit generated timestamp metadata for each saved briefing;
- separation between the latest successful briefing and background refresh state;
- reuse of the latest successful briefing while a refresh is running;
- route response metadata so the UI can distinguish `current content` from `refresh in progress`.

This phase does not implement:

- a history browser or list UI;
- diffing between historical briefings;
- manual rollback to an older briefing;
- per-user personalized briefing storage.

## Current Problem

`backend/routes/admin.js` and `backend/routes/investment.js` each keep council briefing text in process memory with `cachedBriefing` and `lastBriefingUpdate`. When the cache is cold, expired, or invalidated by `last_evolution_time`, the code overwrites the visible value with an in-progress message before the new generation completes.

That creates two UX problems:

1. users briefly lose the last known successful analysis even though it still exists conceptually;
2. the placeholder makes it look like the server always re-analyzes on page load.

## Data Model

Add a new table `council_briefing_history` with additive migration in `backend/database.js`.

Columns:

- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `scope TEXT NOT NULL CHECK (scope IN ('ADMIN', 'INVESTMENT'))`
- `briefing_text TEXT NOT NULL`
- `status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'IN_PROGRESS'))`
- `triggered_by TEXT NOT NULL`
- `evolution_time TEXT`
- `model_name TEXT`
- `error_message TEXT`
- `started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `generated_at DATETIME`

Indexes:

- `(scope, status, generated_at DESC)`
- `(scope, started_at DESC)`

Rules:

- Only completed usable briefings are stored as `SUCCESS`.
- `generated_at` is the authoritative analysis timestamp shown to the UI.
- `started_at` exists so failed or long-running refresh attempts can be diagnosed later.
- `evolution_time` records the `platform_settings.last_evolution_time` value that the analysis corresponds to.

## Runtime Model

Keep a small in-memory refresh guard per scope, but stop treating memory as the source of truth for content.

Recommended in-memory state:

- `isRefreshing`
- `lastRefreshStartedAt`

Do not keep the visible briefing body only in memory. The latest visible body should be read from SQLite.

## Read Path

For both `/api/admin/council-stats` and `/api/investment/council-stats`:

1. Load the latest `SUCCESS` row for that scope from `council_briefing_history`.
2. Return that text immediately when it exists.
3. Compute whether a refresh is needed:
   - no successful row exists;
   - latest successful row is older than `BRIEFING_CACHE_DURATION`;
   - latest successful row predates `last_evolution_time`.
4. If refresh is needed and no refresh is already running for that scope, start background generation.
5. Return metadata alongside the current visible briefing:
   - `briefing`
   - `briefingGeneratedAt`
   - `briefingStatus`
   - `briefingRefreshing`

If there is no successful row yet, the route may still return the fallback/generated placeholder text, but only for true first-run conditions.

## Write Path

When a background refresh starts:

1. Mark the scope as refreshing in memory.
2. Insert an `IN_PROGRESS` history row with `started_at`, `triggered_by`, `evolution_time`, and `model_name`.
3. Run `generateCouncilOpinionBriefing(...)`.

On success:

1. Update the in-progress row to `SUCCESS`.
2. Save `briefing_text`.
3. Set `generated_at`.
4. Clear the refresh guard.

On failure:

1. Update the in-progress row to `FAILED`.
2. Save `error_message`.
3. Keep the previous successful briefing visible.
4. Clear the refresh guard.

## UI Contract

The admin page does not need history browsing in this phase. It only needs clearer status display:

- show the latest successful briefing text immediately;
- show `analysis generated at <timestamp>` under the card;
- if `briefingRefreshing = true`, show a small `updating` badge or note;
- do not replace the visible text with an in-progress paragraph once a successful briefing already exists.

The same response contract should be available to the investment route to avoid divergent behavior between admin and user surfaces.

## Failure Handling

- If Gemini fails during refresh, keep serving the most recent `SUCCESS` row.
- If no `SUCCESS` row exists yet, fall back to the existing fallback briefing behavior.
- Migration must be additive and idempotent.
- Duplicate simultaneous refreshes for the same scope must be prevented by the in-memory refresh guard.

## Verification

- Route-level tests prove the latest successful briefing remains visible while refresh is running.
- Tests prove a cold start without any history still returns fallback or placeholder behavior.
- Tests prove a successful refresh writes `generated_at` and subsequent reads return that row.
- Tests prove failed refreshes do not erase the previous successful row.
- Manual verification confirms the admin page shows briefing text immediately after a prior successful run and only adds timestamp/status metadata.

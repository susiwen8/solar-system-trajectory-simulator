# Online JPL Ephemeris With Local Cache Design

> Status: proposed
> Date: 2026-03-20
> Branch: `codex/mission-dynamics-realism`

## Goal

Enable the simulator to use more realistic planetary motion without requiring manually prepared ephemeris files by adding:

- on-demand JPL Horizons fetching
- local file-backed caching
- automatic fallback to the current bundled + keplerian ephemeris model

The change should improve orbital realism while preserving offline usability and existing mission-planning flows.

## User Intent

The user wants the project to stop relying on the current mixed approximation model for normal use, but they do not have a prepared all-planet JPL dataset. They prefer the system to fetch JPL data itself rather than requiring manual CSV exports.

The user does **not** want ephemeris-source details exposed in the UI.

## Problem Summary

Today the running simulator uses a mixed ephemeris model:

- `sun`, `earth`, and `mars` come from a small bundled sample file with linear interpolation
- the remaining planets fall back to analytic keplerian elements
- the effective source is often `mixed`, not a single authoritative high-fidelity source

This is acceptable for demo-scale mission visualization, but not for “more real” planetary motion.

The project already has:

- a file-based JPL ephemeris reader
- a Horizons CSV importer
- a composite ephemeris fallback model

But it does **not** yet have:

- a live JPL fetcher
- a persistent local cache for online-fetched states
- automatic online-first ephemeris assembly

## Non-Goals

This design does not include:

- user-facing ephemeris source selectors
- display of “JPL vs fallback” badges in the browser
- long-term cache eviction policies beyond basic bounded hygiene
- high-frequency direct client-side JPL access from the browser
- replacing all existing bundled and keplerian fallbacks

## Design Principles

1. `Prefer realism when available.` If JPL data can be fetched and cached, use it.
2. `Never block project usability on the network.` When JPL is unavailable, the simulator must still run.
3. `Keep the contract stable.` Existing mission services should continue calling `create_ephemeris(...)` without being rewritten around a new data API.
4. `Cache aggressively.` Online fetches should be amortized across many playback and planning requests.
5. `Hide complexity from users.` This is an infrastructure upgrade, not a new user workflow.

## Existing Architecture Fit

The current ephemeris architecture already has the right seam:

- `factory.py` chooses the concrete ephemeris implementation
- `CompositeEphemeris` already expresses “primary + fallback”
- `JPLFileEphemeris` already knows how to interpolate file-backed state vectors
- mission services only depend on the ephemeris protocol, not on specific storage details

This makes the ephemeris factory the correct insertion point for an online-first JPL provider.

## Proposed Architecture

Introduce a new online-capable ephemeris layer composed of three parts:

### 1. Horizons Client

A small JPL Horizons HTTP client responsible for:

- constructing API requests for heliocentric vector states
- requesting a target body over a bounded time window
- parsing the returned vectors into the existing internal sample structure

This client should be kept narrow:

- no mission logic
- no fallback logic
- no UI awareness

It only translates “body + time window + step” into parsed sample vectors.

### 2. Local Cache Store

A persistent cache layer that stores fetched Horizons data in the same broad shape already used by `JPLFileEphemeris`.

Responsibilities:

- maintain one cache file per body or bounded time range
- answer whether a requested epoch is already covered
- append or merge newly fetched windows
- serve cache-backed state lookups through the same interpolation behavior as file-backed JPL data

This cache should live inside the repo-local data tree, for example:

- `apps/api/data/ephemeris/cache/`

The cache is an internal optimization and resilience layer, not a user-facing artifact.

### 3. Online-Preferred Composite Ephemeris

Extend factory assembly so the ephemeris stack becomes:

`online JPL cache-backed provider -> optional static JPL file -> bundled + keplerian fallback`

In words:

- try the cache-backed online JPL provider first
- if a static imported JPL file exists, it can still participate as a secondary high-quality source
- if neither covers the request, fall back to the current bundled/keplerian behavior

This preserves all current flows while allowing realistic data to appear automatically once fetched.

## Request Strategy

The system should not fetch a single instant at a time.

Instead, it should request bounded windows around the needed epoch.

### Scene Playback

For `/ephemeris/bodies` style requests:

- fetch a short window centered around the requested epoch
- use a relatively fine step size so playback interpolation remains visually smooth

This avoids hitting JPL on every playback slider movement.

### Mission Planning

For transfer planning, tour planning, and launch-window search:

- fetch wider windows because the planners probe multiple epochs
- use a coarser step than scene playback when appropriate

This keeps remote lookups useful for trajectory-solving without requiring an API request per individual epoch.

## Cache Behavior

### Cache Keys

Cache windows should be keyed by at least:

- body id
- time window start
- time window end
- step size

### Cache Reuse

If a requested epoch is already covered by an equal or finer cached window, the provider should reuse the cache rather than re-fetching from JPL.

### Cache Merge

If a new fetch overlaps an existing cached window, the cache layer should merge by epoch key rather than duplicating samples.

### Cache Hygiene

This first version should keep hygiene simple:

- create the cache directory automatically
- keep files readable JSON
- allow repeated runs to reuse prior fetches

Aggressive pruning is out of scope for now.

## Failure And Fallback Behavior

When JPL fetching fails due to:

- timeout
- network unavailability
- invalid response
- unsupported body request

the provider should degrade quietly into fallback ephemeris behavior rather than surfacing a user-facing crash.

Internally, the backend may log:

- fetch failures
- cache misses
- fallback usage

But the browser should still receive body states and mission results if fallback data exists.

## API Impact

No new frontend API surface is required for the first version.

Existing endpoints continue to work:

- `/ephemeris/bodies`
- `/missions/propagate`
- `/missions/plan-tour`
- `/missions/launch-window`
- gravity-assist search

The higher realism comes from the ephemeris layer beneath them.

## Configuration

Add backend configuration for online JPL behavior, for example:

- enable/disable online JPL fetching
- cache directory path
- default fetch window sizes
- default sampling cadence
- request timeout

Recommended behavior:

- online JPL enabled by default when network is available
- fallback remains automatic
- optional environment variables can override paths/timeouts for development

## Data Format Reuse

Reuse the existing JSON structure already supported by `JPLFileEphemeris` and `horizons_import.py`.

That means fetched online data should ultimately land in a shape like:

```json
{
  "metadata": { "source": "jpl-horizons-online-cache" },
  "bodies": {
    "earth": {
      "muKm3PerS2": 398600.435436,
      "samples": {
        "2026-01-01T00:00:00Z": {
          "positionKm": [...],
          "velocityKmPerSec": [...]
        }
      }
    }
  }
}
```

This reduces implementation risk because the parser, interpolator, and file semantics are already familiar to the project.

## Observability

Keep observability internal-only.

Useful backend logging includes:

- JPL fetch start/end
- body + time window requested
- cache hit vs cache miss
- fallback activation reason

Do not add visible end-user controls or banners for source switching in this phase.

## Risks

### Risk: First Request Latency

The first request for a new time window may be noticeably slower than the current approximation-only path.

Mitigation:

- fetch bounded windows instead of single timestamps
- cache results persistently
- keep fallback immediate if the remote request is unavailable

### Risk: API Fragility

JPL Horizons responses can be format-sensitive.

Mitigation:

- isolate parsing in a dedicated client/parser layer
- add fixture-backed tests using representative Horizons text
- fail closed into fallback ephemeris rather than partial corruption

### Risk: Planner Workloads Trigger Too Many Remote Fetches

Launch-window and tour planning evaluate many epochs.

Mitigation:

- prefetch broader planner-oriented windows
- deduplicate repeated epoch access through cache-backed lookup
- avoid single-epoch remote fetches inside tight scoring loops

### Risk: Partial Coverage Causes Hidden Mixed Precision

If only some bodies or only some windows are cached, results may silently mix JPL and fallback states.

Mitigation:

- define clear fetch windows per use case
- keep fallback automatic but structured
- log internal fallback usage for debugging

## Testing Strategy

### Unit Tests

Add tests for:

- Horizons response parsing
- cache write/read/merge behavior
- online provider coverage checks
- online fetch failure fallback behavior
- factory assembly order

### Integration Tests

Add tests showing:

- `/ephemeris/bodies` uses cached JPL results when available
- mission propagation still succeeds when online fetch fails
- launch-window and tour planning continue working under the online-first stack

### Manual Verification

Manual checks should confirm:

- first request for a new epoch window may be slower but succeeds
- repeated requests for the same epoch window are faster
- the system still runs offline after cache priming or via fallback
- planetary motion visibly changes less “analytically” than the current mixed approximation model

## Success Criteria

This work is successful when:

1. no manually prepared all-planet dataset is required to improve realism
2. the backend can fetch and cache JPL state vectors on demand
3. mission and scene endpoints continue working through the existing contracts
4. offline or failed-network conditions do not break the simulator
5. the simulator’s effective planetary motion becomes more realistic during normal use

## Recommended Implementation Order

1. Add a dedicated Horizons client and parser layer.
2. Add a file-backed cache store that reuses the existing JPL JSON shape.
3. Add a cache-backed online ephemeris provider.
4. Extend `create_ephemeris(...)` to assemble online-first fallback chains.
5. Add integration coverage for `/ephemeris/bodies` and mission endpoints under online and fallback scenarios.

# Online JPL Ephemeris With Local Cache Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an online JPL Horizons ephemeris provider with local file-backed caching so the simulator can fetch more realistic planetary states on demand while automatically falling back to the current bundled + keplerian model when the network or remote API is unavailable.

**Architecture:** Extend the current ephemeris subsystem with a dedicated Horizons HTTP client, a reusable cache store that persists fetched vector windows in the existing JPL JSON shape, and an online-first ephemeris provider that plugs into `create_ephemeris(...)`. Existing mission and ephemeris routes should continue using the ephemeris protocol unchanged, gaining better data quality through the factory layer rather than new endpoint contracts.

**Tech Stack:** Python, FastAPI, urllib/request or standard-library HTTP client, JSON file storage, pytest

---

Implementation should follow `@superpowers:test-driven-development` and verify every claim with `@superpowers:verification-before-completion`.

## File Map

### Backend

- Create: `apps/api/app/core/ephemeris/horizons_client.py`
  Purpose: build Horizons requests, fetch remote vector windows, and parse API responses into sample dictionaries.
- Create: `apps/api/app/core/ephemeris/cache_store.py`
  Purpose: persist and merge JPL vector windows in a file-backed cache under `apps/api/data/ephemeris/cache/`.
- Create: `apps/api/app/core/ephemeris/online.py`
  Purpose: expose an online-first cache-backed ephemeris provider that implements the existing ephemeris protocol.
- Modify: `apps/api/app/core/ephemeris/factory.py`
  Purpose: assemble `online -> optional static JPL file -> bundled` ephemeris chains.
- Modify: `apps/api/app/core/ephemeris/__init__.py`
  Purpose: export any new ephemeris-layer types/helpers if the package already surfaces them.
- Create: `apps/api/tests/unit/test_horizons_client.py`
  Purpose: verify request building and response parsing against representative Horizons text fixtures.
- Create: `apps/api/tests/unit/test_ephemeris_cache_store.py`
  Purpose: verify cache read/write/merge and coverage semantics.
- Create: `apps/api/tests/unit/test_online_ephemeris.py`
  Purpose: verify online provider cache hits, cache misses, fetch behavior, and fallback to `KeyError`.
- Modify: `apps/api/tests/unit/test_ephemeris_factory.py`
  Purpose: verify online-first factory assembly and fallback ordering.
- Modify: `apps/api/tests/api/test_ephemeris_bodies.py`
  Purpose: verify `/ephemeris/bodies` works with cached online data and still succeeds when online fetching fails.
- Modify: `apps/api/tests/api/test_missions_propagate.py`
  Purpose: verify mission propagation still succeeds under the online-first ephemeris stack.
- Modify: `apps/api/tests/api/test_missions_plan_tour.py`
  Purpose: verify tour planning continues to work when ephemeris is assembled through the new online-first factory.
- Modify: `apps/api/tests/api/test_missions_launch_window.py`
  Purpose: keep launch-window planning compatible with the online-first ephemeris stack.

## Chunk 1: Horizons Client

### Task 1: Add a focused Horizons HTTP client with parser coverage

**Files:**
- Create: `apps/api/app/core/ephemeris/horizons_client.py`
- Create: `apps/api/tests/unit/test_horizons_client.py`
- Reference: `apps/api/app/core/ephemeris/horizons_import.py`

- [ ] **Step 1: Write the failing parser and request-shape tests**

```python
from app.core.ephemeris.horizons_client import (
    HorizonsRequest,
    build_horizons_vectors_url,
    parse_horizons_vectors_response,
)


def test_build_horizons_vectors_url_includes_body_and_window() -> None:
    request = HorizonsRequest(
        body_id="earth",
        start_epoch="2026-01-01T00:00:00Z",
        stop_epoch="2026-01-03T00:00:00Z",
        step_size="12h",
    )

    url = build_horizons_vectors_url(request)

    assert "COMMAND=399" in url
    assert "EPHEM_TYPE=VECTORS" in url
    assert "STEP_SIZE=12h" in url


def test_parse_horizons_vectors_response_returns_samples() -> None:
    response_text = \"\"\"Target body name: Earth (399)
$$SOE
2457388.500000000, A.D. 2026-Jan-01 00:00:00.0000, -24856124.0, 144936962.0, -6980.0, -29.837, -5.127, 0.0002
2457389.000000000, A.D. 2026-Jan-01 12:00:00.0000, -26137982.0, 144676912.0, -6967.0, -29.782, -5.385, 0.0002
$$EOE
\"\"\"

    samples = parse_horizons_vectors_response(response_text)

    assert "2026-01-01T00:00:00Z" in samples
    assert samples["2026-01-01T12:00:00Z"]["positionKm"][0] == -26137982.0
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_horizons_client.py`

Expected: FAIL because `horizons_client.py` does not exist yet.

- [ ] **Step 3: Implement the minimal client and parser**

Create `apps/api/app/core/ephemeris/horizons_client.py` with:

```python
from dataclasses import dataclass
from urllib.parse import urlencode

from app.core.ephemeris.horizons_import import parse_horizons_vector_csv


@dataclass(frozen=True)
class HorizonsRequest:
    body_id: str
    start_epoch: str
    stop_epoch: str
    step_size: str


BODY_COMMAND_IDS = {
    "mercury": "199",
    "venus": "299",
    "earth": "399",
    "mars": "499",
    "jupiter": "599",
    "saturn": "699",
    "uranus": "799",
    "neptune": "899",
}


def build_horizons_vectors_url(request: HorizonsRequest) -> str:
    query = urlencode(
        {
            "format": "text",
            "EPHEM_TYPE": "VECTORS",
            "CENTER": "500@10",
            "CSV_FORMAT": "YES",
            "COMMAND": BODY_COMMAND_IDS[request.body_id],
            "START_TIME": request.start_epoch,
            "STOP_TIME": request.stop_epoch,
            "STEP_SIZE": request.step_size,
        }
    )
    return f"https://ssd.jpl.nasa.gov/api/horizons.api?{query}"


def parse_horizons_vectors_response(response_text: str) -> dict:
    return parse_horizons_vector_csv(response_text)
```

Do not add network I/O yet; keep this chunk to request construction + parsing.

- [ ] **Step 4: Re-run the focused tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_horizons_client.py`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/core/ephemeris/horizons_client.py \
  apps/api/tests/unit/test_horizons_client.py
git commit -m "feat: add horizons request builder and parser"
```

## Chunk 2: File-Backed Cache Store

### Task 2: Add a reusable cache store for online-fetched JPL vector windows

**Files:**
- Create: `apps/api/app/core/ephemeris/cache_store.py`
- Create: `apps/api/tests/unit/test_ephemeris_cache_store.py`
- Reference: `apps/api/app/core/ephemeris/jpl.py`

- [ ] **Step 1: Write the failing cache read/write/merge tests**

```python
from pathlib import Path

from app.core.ephemeris.cache_store import EphemerisCacheStore


def test_cache_store_persists_and_reads_body_windows(tmp_path: Path) -> None:
    store = EphemerisCacheStore(tmp_path)
    store.write_body_samples(
        body_id="earth",
        mu_km3_per_s2=398600.435436,
        source_name="jpl-horizons-online-cache",
        samples={
            "2026-01-01T00:00:00Z": {
                "positionKm": [1.0, 2.0, 3.0],
                "velocityKmPerSec": [4.0, 5.0, 6.0],
            }
        },
    )

    dataset = store.read_body_dataset("earth")

    assert dataset["samples"]["2026-01-01T00:00:00Z"]["positionKm"][0] == 1.0


def test_cache_store_merges_overlapping_samples(tmp_path: Path) -> None:
    store = EphemerisCacheStore(tmp_path)
    store.write_body_samples(
        body_id="mars",
        mu_km3_per_s2=42828.375816,
        source_name="jpl-horizons-online-cache",
        samples={"2026-01-01T00:00:00Z": {"positionKm": [1, 0, 0], "velocityKmPerSec": [0, 1, 0]}},
    )
    store.write_body_samples(
        body_id="mars",
        mu_km3_per_s2=42828.375816,
        source_name="jpl-horizons-online-cache",
        samples={"2026-01-02T00:00:00Z": {"positionKm": [2, 0, 0], "velocityKmPerSec": [0, 1, 0]}},
    )

    dataset = store.read_body_dataset("mars")

    assert len(dataset["samples"]) == 2
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_ephemeris_cache_store.py`

Expected: FAIL because the cache store does not exist yet.

- [ ] **Step 3: Implement the minimal cache store**

Create `apps/api/app/core/ephemeris/cache_store.py` with:

```python
import json
from pathlib import Path


class EphemerisCacheStore:
    def __init__(self, root: Path) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def body_path(self, body_id: str) -> Path:
        return self.root / f"{body_id}.json"

    def read_body_dataset(self, body_id: str) -> dict | None:
        path = self.body_path(body_id)
        if not path.exists():
            return None
        return json.loads(path.read_text())

    def write_body_samples(self, *, body_id: str, mu_km3_per_s2: float, source_name: str, samples: dict) -> None:
        existing = self.read_body_dataset(body_id) or {
            "metadata": {"source": source_name},
            "bodies": {
                body_id: {
                    "muKm3PerS2": mu_km3_per_s2,
                    "samples": {},
                }
            },
        }
        existing["bodies"][body_id]["samples"].update(samples)
        self.body_path(body_id).write_text(json.dumps(existing, indent=2, sort_keys=True))
```

Keep this first version simple and readable; exact coverage queries come in the next chunk.

- [ ] **Step 4: Re-run the focused tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_ephemeris_cache_store.py`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/core/ephemeris/cache_store.py \
  apps/api/tests/unit/test_ephemeris_cache_store.py
git commit -m "feat: add file-backed JPL ephemeris cache store"
```

## Chunk 3: Online Ephemeris Provider And Factory Assembly

### Task 3: Add an online-first cache-backed ephemeris provider

**Files:**
- Create: `apps/api/app/core/ephemeris/online.py`
- Create: `apps/api/tests/unit/test_online_ephemeris.py`
- Modify: `apps/api/app/core/ephemeris/factory.py`
- Modify: `apps/api/tests/unit/test_ephemeris_factory.py`

- [ ] **Step 1: Write the failing provider and factory tests**

```python
from pathlib import Path

from app.core.ephemeris.online import OnlineCachedEphemeris


class StubHorizonsClient:
    def __init__(self) -> None:
        self.calls = []

    def fetch_vectors(self, *, body_id: str, start_epoch: str, stop_epoch: str, step_size: str) -> dict:
        self.calls.append((body_id, start_epoch, stop_epoch, step_size))
        return {
            "2026-01-01T00:00:00Z": {
                "positionKm": [1.0, 2.0, 3.0],
                "velocityKmPerSec": [4.0, 5.0, 6.0],
            }
        }


def test_online_ephemeris_fetches_and_caches_missing_body_epoch(tmp_path: Path) -> None:
    client = StubHorizonsClient()
    ephemeris = OnlineCachedEphemeris(cache_root=tmp_path, client=client)

    state = ephemeris.get_body_state("earth", "2026-01-01T00:00:00Z")

    assert state.position_km[0] == 1.0
    assert client.calls
    assert (tmp_path / "earth.json").exists()
```

And extend `test_ephemeris_factory.py` with an online-first assembly assertion like:

```python
def test_factory_can_return_online_first_ephemeris(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("SOLAR_SYSTEM_ENABLE_ONLINE_JPL", "1")
    monkeypatch.setenv("SOLAR_SYSTEM_EPHEMERIS_CACHE_DIR", str(tmp_path))

    ephemeris = create_ephemeris(bundle_path)

    assert ephemeris.source_name
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_online_ephemeris.py tests/unit/test_ephemeris_factory.py`

Expected: FAIL because the online ephemeris provider does not exist yet.

- [ ] **Step 3: Implement minimal online provider and factory hooks**

Create `apps/api/app/core/ephemeris/online.py` with:

```python
from pathlib import Path

from app.core.constants import SOLAR_SYSTEM_MU_KM3_PER_S2
from app.core.ephemeris.base import BodyState, MAJOR_BODY_IDS
from app.core.ephemeris.cache_store import EphemerisCacheStore
from app.core.ephemeris.jpl import JPLFileEphemeris


class OnlineCachedEphemeris:
    def __init__(self, *, cache_root: Path, client) -> None:
        self.cache_store = EphemerisCacheStore(cache_root)
        self.client = client

    @property
    def source_name(self) -> str:
        return "jpl-horizons-online-cache"

    def get_body_state(self, body_id: str, epoch: str) -> BodyState:
        path = self.cache_store.body_path(body_id)
        if not path.exists():
            samples = self.client.fetch_vectors(
                body_id=body_id,
                start_epoch=epoch,
                stop_epoch=epoch,
                step_size="1 d",
            )
            self.cache_store.write_body_samples(
                body_id=body_id,
                mu_km3_per_s2=SOLAR_SYSTEM_MU_KM3_PER_S2[body_id],
                source_name=self.source_name,
                samples=samples,
            )
        return JPLFileEphemeris(path).get_body_state(body_id, epoch)

    def get_all_body_states(self, epoch: str) -> list[BodyState]:
        return [self.get_body_state(body_id, epoch) for body_id in MAJOR_BODY_IDS]
```

Then update `factory.py` so it can conditionally assemble:

- `OnlineCachedEphemeris`
- optional `JPLFileEphemeris`
- `BundledEphemeris`

through nested `CompositeEphemeris` instances.

Keep the first version conservative:

- online mode gated by `SOLAR_SYSTEM_ENABLE_ONLINE_JPL=1`
- cache path configurable via `SOLAR_SYSTEM_EPHEMERIS_CACHE_DIR`
- if online setup fails, return the current bundled/static behavior

- [ ] **Step 4: Re-run the focused tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_online_ephemeris.py tests/unit/test_ephemeris_factory.py`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/core/ephemeris/online.py \
  apps/api/app/core/ephemeris/factory.py \
  apps/api/tests/unit/test_online_ephemeris.py \
  apps/api/tests/unit/test_ephemeris_factory.py
git commit -m "feat: add online-first JPL ephemeris provider"
```

## Chunk 4: Integration With Existing Endpoints And Graceful Fallback

### Task 4: Prove endpoint compatibility under cached-online and fallback scenarios

**Files:**
- Modify: `apps/api/tests/api/test_ephemeris_bodies.py`
- Modify: `apps/api/tests/api/test_missions_propagate.py`
- Modify: `apps/api/tests/api/test_missions_plan_tour.py`
- Modify: `apps/api/tests/api/test_missions_launch_window.py`

- [ ] **Step 1: Add failing integration tests for online cache use and fallback**

Add a cache-backed `/ephemeris/bodies` test like:

```python
def test_ephemeris_bodies_uses_cached_online_data(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("SOLAR_SYSTEM_ENABLE_ONLINE_JPL", "1")
    monkeypatch.setenv("SOLAR_SYSTEM_EPHEMERIS_CACHE_DIR", str(tmp_path))

    earth_cache = tmp_path / "earth.json"
    earth_cache.write_text(
        json.dumps(
            {
                "metadata": {"source": "jpl-horizons-online-cache"},
                "bodies": {
                    "earth": {
                        "muKm3PerS2": 398600.435436,
                        "samples": {
                            "2026-01-01T00:00:00Z": {
                                "positionKm": [1.0, 2.0, 3.0],
                                "velocityKmPerSec": [4.0, 5.0, 6.0],
                            }
                        },
                    }
                },
            }
        )
    )

    client = TestClient(app)
    response = client.get("/ephemeris/bodies", params={"epoch": "2026-01-01T00:00:00Z"})

    assert response.status_code == 200
```

Then add mission endpoint tests that verify propagation / tour / launch-window still return `200` with:

- online mode enabled and empty cache
- simulated online failure forcing fallback

- [ ] **Step 2: Run the focused integration tests to verify they fail**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_ephemeris_bodies.py tests/api/test_missions_propagate.py tests/api/test_missions_plan_tour.py tests/api/test_missions_launch_window.py`

Expected: FAIL because the current online provider does not yet handle body-window coverage and graceful fallback well enough.

- [ ] **Step 3: Implement the missing integration behavior**

Refine the online provider and/or factory so that:

- cached body files are read before fetching
- cache-backed single-body failures raise `KeyError` so `CompositeEphemeris` can fall back cleanly
- mission endpoints continue to resolve states even when online fetching is unavailable

If needed, expand `OnlineCachedEphemeris` with:

- coverage checks against cached body samples
- broader fetch windows for missing epochs
- exception wrapping that degrades into `KeyError`

- [ ] **Step 4: Re-run the focused integration tests**

Run: `cd apps/api && uv run --group dev pytest -v tests/api/test_ephemeris_bodies.py tests/api/test_missions_propagate.py tests/api/test_missions_plan_tour.py tests/api/test_missions_launch_window.py`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/tests/api/test_ephemeris_bodies.py \
  apps/api/tests/api/test_missions_propagate.py \
  apps/api/tests/api/test_missions_plan_tour.py \
  apps/api/tests/api/test_missions_launch_window.py \
  apps/api/app/core/ephemeris/factory.py \
  apps/api/app/core/ephemeris/online.py
git commit -m "feat: integrate cached online JPL ephemeris into API flows"
```

## Final Verification

- [ ] **Step 1: Run the complete impacted backend unit and API suites**

Run: `cd apps/api && uv run --group dev pytest -v tests/unit/test_horizons_client.py tests/unit/test_ephemeris_cache_store.py tests/unit/test_online_ephemeris.py tests/unit/test_ephemeris_factory.py tests/api/test_ephemeris_bodies.py tests/api/test_missions_propagate.py tests/api/test_missions_plan_tour.py tests/api/test_missions_launch_window.py`

Expected: PASS

- [ ] **Step 2: Run the full backend suite**

Run: `cd apps/api && uv run --group dev pytest`

Expected: PASS with no new ephemeris regressions.

- [ ] **Step 3: Perform manual service verification**

Run:

```bash
cd apps/api
SOLAR_SYSTEM_ENABLE_ONLINE_JPL=1 \
SOLAR_SYSTEM_EPHEMERIS_CACHE_DIR=./data/ephemeris/cache \
uv run uvicorn app.main:app --reload
```

Check:

- `/ephemeris/bodies?epoch=...` returns successfully with an empty cache directory
- cache files appear under `apps/api/data/ephemeris/cache/`
- repeated requests for the same body/epoch window reuse the cache
- taking the network away still leaves endpoints usable through fallback ephemeris

- [ ] **Step 4: Inspect final git state**

Run:

```bash
git status
git log --oneline -6
```

Expected: only the planned online-JPL feature commits remain for this work.

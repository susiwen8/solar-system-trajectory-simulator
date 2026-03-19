# Solar System Trajectory Simulator

Accuracy-first solar-system mission simulation project with a Python astrodynamics API and a React-based 3D client.

## Local Development

### Backend

```bash
cd apps/api
uv sync --group dev
uv run uvicorn app.main:app --reload
```

The FastAPI service runs on `http://127.0.0.1:8000`.

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

The Vite dev server proxies `/missions` and `/ephemeris` to the backend on port `8000`, so the browser app can talk to the API without changing request URLs.

### Tests

```bash
make api-test
make web-test
```

## Finite-Thrust Corrections

The simulator now supports short automatic finite-thrust correction burns on both single-target missions and multi-planet tours.

### API Request Shape

Add a `propulsionConfig` block to either `POST /missions/propagate` or `POST /missions/plan-tour`:

```json
{
  "departureBody": "earth",
  "targetBody": "mars",
  "launchEpoch": "2026-01-01T00:00:00Z",
  "initialState": {
    "launchFromBody": {
      "mode": "autoTransfer"
    }
  },
  "propulsionConfig": {
    "initialMassKg": 1800,
    "propellantMassKg": 420,
    "maxThrustN": 0.8,
    "ispSeconds": 3200
  }
}
```

When enabled, the backend will:

- solve the normal gravity-first baseline trajectory
- place up to three automatic correction burns
- re-propagate the mission with finite-thrust arcs and mass depletion

### Response Fields

Finite-thrust-enabled results may include:

- `maneuverEvents`
- `finalMassKg`
- `totalPropellantUsedKg`
- `propulsionConfig`
- `samples[].massKg`

The browser UI exposes the same capability through the `启用有限推力修正` toggle in the mission form.

### Importing JPL Horizons Data

If you export heliocentric `VECTORS` tables from JPL Horizons as CSV, you can convert them into the simulator's ephemeris format:

```bash
cd apps/api
uv run python -m app.core.ephemeris.horizons_import \
  --input earth=./earth_vectors.csv \
  --input mars=./mars_vectors.csv \
  --output ./data/ephemeris/jpl_import.json
```

You can also pass plain file paths and let the importer infer the body ids from the Horizons headers:

```bash
uv run python -m app.core.ephemeris.horizons_import \
  --input ./earth_vectors.csv \
  --input ./mars_vectors.csv \
  --output ./data/ephemeris/jpl_import.json
```

Then point the API at the imported file:

```bash
export SOLAR_SYSTEM_JPL_EPHEMERIS_PATH=./data/ephemeris/jpl_import.json
```

The backend will prefer that JPL-derived file and fall back to the bundled/keplerian ephemeris when the imported file does not cover a requested body or epoch.

### First Demo Flow

1. Start the backend with `make api-dev`
2. Start the frontend with `make web-dev`
3. Open the Vite URL shown in the terminal
4. Submit the default Earth-to-Mars mission
5. Use the `Playback Step` slider to scrub through probe samples and refresh the planetary positions for each sampled epoch

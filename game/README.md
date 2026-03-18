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

### First Demo Flow

1. Start the backend with `make api-dev`
2. Start the frontend with `make web-dev`
3. Open the Vite URL shown in the terminal
4. Submit the default Earth-to-Mars mission
5. Use the `Playback Step` slider to scrub through probe samples and refresh the planetary positions for each sampled epoch

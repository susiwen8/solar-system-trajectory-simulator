api-test:
	cd apps/api && uv run --group dev pytest -v

web-test:
	cd apps/web && npm test

api-dev:
	cd apps/api && uv run uvicorn app.main:app --reload

web-dev:
	cd apps/web && npm run dev

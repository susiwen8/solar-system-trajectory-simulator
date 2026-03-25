api-dev:
	cd apps/api && uv run uvicorn app.main:create_app --factory --reload

api-test:
	cd apps/api && uv run pytest

web-dev:
	@if [ -d apps/web ]; then cd apps/web && npm run dev; else echo "apps/web is not bootstrapped yet"; fi

web-test:
	@if [ -d apps/web ]; then cd apps/web && npm run test -- --run; else echo "apps/web is not bootstrapped yet"; fi

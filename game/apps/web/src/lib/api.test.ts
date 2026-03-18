import { createApiUrl } from "./api";

it("keeps relative api paths when no base url is provided", () => {
  expect(createApiUrl("/missions/propagate", "")).toBe("/missions/propagate");
});

it("joins a configured api base url with the request path", () => {
  expect(createApiUrl("/ephemeris/bodies?epoch=2026-01-01T00%3A00%3A00Z", "http://127.0.0.1:8000/")).toBe(
    "http://127.0.0.1:8000/ephemeris/bodies?epoch=2026-01-01T00%3A00%3A00Z",
  );
});

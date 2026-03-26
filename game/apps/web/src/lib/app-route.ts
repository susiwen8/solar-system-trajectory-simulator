export type AppRoute = "simulator" | "spacex-recovery";

const ROOT_PATH = "/";
const SPACEX_RECOVERY_PATH = "/spacex-recovery";

export function resolveAppRoute(pathname: string): AppRoute {
  const normalized = normalizePathname(pathname);

  if (normalized === SPACEX_RECOVERY_PATH) {
    return "spacex-recovery";
  }

  return "simulator";
}

export function appRoutePath(route: AppRoute): string {
  if (route === "spacex-recovery") {
    return SPACEX_RECOVERY_PATH;
  }

  return ROOT_PATH;
}

function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split("?")[0]?.split("#")[0] ?? "";
  const trimmed = withoutQuery.trim();
  return trimmed === ROOT_PATH ? ROOT_PATH : trimmed.replace(/\/+$/, "");
}

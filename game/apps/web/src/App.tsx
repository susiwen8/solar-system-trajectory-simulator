import { useEffect, useState } from "react";

import SolarSystemSimulatorPage from "./features/simulator/components/SolarSystemSimulatorPage";
import SpaceXRecoveryPage from "./features/spacex-recovery/components/SpaceXRecoveryPage";
import { appRoutePath, resolveAppRoute, type AppRoute } from "./lib/app-route";
import { t, type Language } from "./lib/i18n";

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => resolveAppRoute(window.location.pathname));
  const [language, setLanguage] = useState<Language>("zh");
  const copy = t(language);
  const navStyles = {
    position: "fixed",
    top: "1rem",
    right: "1rem",
    zIndex: 20,
    display: "inline-flex",
    gap: "0.5rem",
    padding: "0.4rem",
    border: "1px solid rgba(152, 182, 214, 0.2)",
    borderRadius: "999px",
    background: "rgba(10, 22, 38, 0.82)",
    boxShadow: "0 10px 24px rgba(0, 0, 0, 0.2)",
  } as const;
  const linkStyles = {
    padding: "0.45rem 0.8rem",
    borderRadius: "999px",
    color: "#f3efe6",
    textDecoration: "none",
    fontSize: "0.82rem",
    fontWeight: 600,
    letterSpacing: "0.02em",
  } as const;
  const activeLinkStyles = {
    color: "#08111e",
    background: "linear-gradient(135deg, #f6cf7a, #f1a85e)",
  } as const;

  useEffect(() => {
    function handlePopState() {
      setRoute(resolveAppRoute(window.location.pathname));
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  function handleNavigate(nextRoute: AppRoute) {
    window.history.pushState({}, "", appRoutePath(nextRoute));
    setRoute(nextRoute);
  }

  return (
    <main className="app-shell" data-scroll-mode="viewport-locked">
      <nav aria-label="Page navigation" style={navStyles}>
        <a
          href={appRoutePath("simulator")}
          style={route === "simulator" ? { ...linkStyles, ...activeLinkStyles } : linkStyles}
          aria-current={route === "simulator" ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            handleNavigate("simulator");
          }}
        >
          {copy.simulatorNavLabel}
        </a>
        <a
          href={appRoutePath("spacex-recovery")}
          style={route === "spacex-recovery" ? { ...linkStyles, ...activeLinkStyles } : linkStyles}
          aria-current={route === "spacex-recovery" ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            handleNavigate("spacex-recovery");
          }}
        >
          {copy.recoveryNavLabel}
        </a>
      </nav>

      {route === "simulator" ? (
        <SolarSystemSimulatorPage language={language} onLanguageChange={setLanguage} />
      ) : (
        <SpaceXRecoveryPage language={language} />
      )}
    </main>
  );
}

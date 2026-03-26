import { useEffect, useState } from "react";

import SolarSystemSimulatorPage from "./features/simulator/components/SolarSystemSimulatorPage";
import SpaceXRecoveryPage from "./features/spacex-recovery/components/SpaceXRecoveryPage";
import { appRoutePath, resolveAppRoute, type AppRoute } from "./lib/app-route";
import { t, type Language } from "./lib/i18n";

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => resolveAppRoute(window.location.pathname));
  const [language, setLanguage] = useState<Language>("zh");
  const copy = t(language);

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
    <>
      <nav aria-label={copy.routeNavigation} className="app-route-nav">
        <a
          href={appRoutePath("simulator")}
          className="app-route-nav__link"
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
          className="app-route-nav__link"
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
    </>
  );
}

export const H5_SESSION_KEY = 'sukdo.h5.session';
export const H5_BEST_TIMES_KEY = 'sukdo.h5.best-times';

function noop() {}

export function createJsonStorage(storage = globalThis.localStorage) {
  return {
    read(key) {
      try {
        const raw = storage?.getItem?.(key);

        if (!raw) {
          return null;
        }

        return JSON.parse(raw);
      } catch {
        return null;
      }
    },
    write(key, value) {
      try {
        storage?.setItem?.(key, JSON.stringify(value));
      } catch {}
    }
  };
}

export function buildSolverHref(baseHref, puzzle) {
  return `${baseHref}?puzzle=${encodeURIComponent(puzzle)}`;
}

export function getQueryPuzzle(search = globalThis.location?.search ?? '') {
  const query = typeof search === 'string' ? search : '';
  const params = new URLSearchParams(query.startsWith('?') ? query : `?${query}`);

  return params.get('puzzle') ?? '';
}

export function createGamePlatform(options = {}) {
  const location = options.location ?? globalThis.location;
  const storage = createJsonStorage(options.storage ?? globalThis.localStorage);
  const onData = options.onData ?? noop;
  const solverPath = options.solverPath ?? './solver.html';
  const setTimer = options.setTimer ?? ((handler, intervalMs) => globalThis.setInterval(handler, intervalMs));
  const clearTimer = options.clearTimer ?? ((timerId) => globalThis.clearInterval(timerId));

  return {
    loadSession() {
      return storage.read(H5_SESSION_KEY);
    },
    saveSession(snapshot) {
      storage.write(H5_SESSION_KEY, snapshot);
    },
    loadBestTimes() {
      return storage.read(H5_BEST_TIMES_KEY);
    },
    saveBestTimes(bestTimes) {
      storage.write(H5_BEST_TIMES_KEY, bestTimes);
    },
    navigateToSolver(puzzle) {
      const href = buildSolverHref(solverPath, puzzle);

      if (typeof location?.assign === "function") {
        location.assign(href);
      } else if (location) {
        location.href = href;
      }

      return href;
    },
    syncTimerTick(data) {
      onData(data);
    },
    setTimer,
    clearTimer
  };
}

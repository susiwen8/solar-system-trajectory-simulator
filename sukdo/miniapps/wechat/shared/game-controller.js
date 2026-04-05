const {
  applyHint,
  clearCell,
  createGameState,
  createSnapshot,
  enterDigit,
  locateFirstWrongPrefill,
  resetGame,
  restoreGameState,
  selectCell,
  tickClock,
  toggleNotesMode,
  togglePrefillMode
} = require('./game-state.js');
const { buildGamePageData } = require('./game-view.js');
const { normalizeBestTimes } = require('./storage.js');

function noop() {}

function createGameController(platform = {}) {
  const api = {
    loadSession: platform.loadSession ?? (() => null),
    saveSession: platform.saveSession ?? noop,
    loadBestTimes: platform.loadBestTimes ?? (() => null),
    saveBestTimes: platform.saveBestTimes ?? noop,
    navigateToSolver: platform.navigateToSolver ?? noop,
    syncTimerTick: platform.syncTimerTick ?? noop,
    setTimer: platform.setTimer ?? ((handler, intervalMs) => setInterval(handler, intervalMs)),
    clearTimer: platform.clearTimer ?? ((timerId) => clearInterval(timerId))
  };

  let state = null;
  let bestTimes = normalizeBestTimes(api.loadBestTimes());
  let timerId = null;
  let completionHandled = false;

  function maybeUpdateBestTime() {
    if (!state.completed || completionHandled) {
      return;
    }

    const currentBest = bestTimes[state.difficulty];

    if (currentBest === null || state.elapsedSeconds < currentBest) {
      bestTimes = {
        ...bestTimes,
        [state.difficulty]: state.elapsedSeconds
      };
      api.saveBestTimes(bestTimes);
    }

    completionHandled = true;
  }

  function saveSession() {
    api.saveSession(createSnapshot(state));
  }

  function currentData() {
    return buildGamePageData(state, bestTimes);
  }

  function commit(nextState) {
    state = nextState;

    if (!state.completed) {
      completionHandled = false;
    }

    maybeUpdateBestTime();
    saveSession();
    return currentData();
  }

  function startTimer() {
    if (timerId !== null) {
      return timerId;
    }

    timerId = api.setTimer(() => {
      if (!state || state.completed) {
        return;
      }

      state = tickClock(state, 1);
      saveSession();
      api.syncTimerTick(currentData());
    }, 1000);

    return timerId;
  }

  function stop() {
    if (timerId === null) {
      return;
    }

    api.clearTimer(timerId);
    timerId = null;
  }

  return {
    init() {
      bestTimes = normalizeBestTimes(api.loadBestTimes());
      const restored = restoreGameState(api.loadSession());
      state = restored ?? createGameState({ difficulty: 'medium' });
      completionHandled = false;
      maybeUpdateBestTime();
      saveSession();
      startTimer();
      return currentData();
    },
    getState() {
      return state;
    },
    getData() {
      return currentData();
    },
    startTimer,
    stop,
    selectCell(row, col) {
      return commit(selectCell(state, row, col));
    },
    enterDigit(digit) {
      return commit(enterDigit(state, digit));
    },
    clearCell() {
      return commit(clearCell(state));
    },
    toggleNotesMode() {
      return commit(toggleNotesMode(state));
    },
    togglePrefillMode() {
      return commit(togglePrefillMode(state));
    },
    locateFirstWrongPrefill() {
      return commit(locateFirstWrongPrefill(state));
    },
    applyHint() {
      return commit(applyHint(state));
    },
    startNewGame(difficulty) {
      return commit(createGameState({ difficulty }));
    },
    restartCurrentGame() {
      return commit(createGameState({ difficulty: state?.difficulty ?? 'medium' }));
    },
    resetGame() {
      return commit(resetGame(state));
    },
    openSolver() {
      const data = currentData();
      api.navigateToSolver(data.solverPuzzle);
      return data;
    }
  };
}

module.exports = {
  createGameController
};

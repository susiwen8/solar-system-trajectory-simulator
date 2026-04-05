const { createGameController } = require('../../shared/game-controller.js');
const {
  canConfirmNewGame,
  createClosedNewGameDialogData,
  createNewGameDialogData,
  toggleNewGameDialogAcknowledgement
} = require('../../shared/new-game-flow.js');
const { BEST_TIMES_KEY, SESSION_KEY } = require('../../shared/storage.js');

function createPlatform(page) {
  return {
    loadSession() {
      try {
        return my.getStorageSync({ key: SESSION_KEY }).data || null;
      } catch {
        return null;
      }
    },
    saveSession(snapshot) {
      try {
        my.setStorageSync({ key: SESSION_KEY, data: snapshot });
      } catch {}
    },
    loadBestTimes() {
      try {
        return my.getStorageSync({ key: BEST_TIMES_KEY }).data || null;
      } catch {
        return null;
      }
    },
    saveBestTimes(bestTimes) {
      try {
        my.setStorageSync({ key: BEST_TIMES_KEY, data: bestTimes });
      } catch {}
    },
    navigateToSolver(puzzle) {
      my.navigateTo({
        url: `/pages/solver/index?puzzle=${encodeURIComponent(puzzle)}`
      });
    },
    syncTimerTick(data) {
      syncPage(page, data);
    },
    setTimer(handler, intervalMs) {
      return setInterval(handler, intervalMs);
    },
    clearTimer(timerId) {
      clearInterval(timerId);
    }
  };
}

function syncPage(page, data) {
  page.setData(data);
}

Page({
  data: {
    cells: [],
    keypadDigits: [],
    activeDigit: null,
    timerText: '00:00',
    bestTimeText: '--:--',
    hintCountText: '0',
    difficultyLabel: '中等',
    statusPillText: '继续挑战',
    statusPillCompleted: false,
    message: '',
    notesMode: false,
    prefillMode: false,
    solverPuzzle: '',
    difficultyOptions: [],
    newGameDialogVisible: false,
    newGameDialogAcknowledged: false,
    newGameDialogConfirmEnabled: false,
    newGameDialogTitle: '',
    newGameDialogContent: '',
    newGameDialogSecondaryConfirmText: '',
    newGameDialogConfirmText: '',
    newGameDialogCancelText: ''
  },
  onLoad() {
    this.platform = createPlatform(this);
    this.controller = createGameController(this.platform);
    syncPage(this, this.controller.init());
  },
  onShow() {
    this.controller?.startTimer();
  },
  onHide() {
    this.controller?.stop();
  },
  onUnload() {
    this.controller?.stop();
  },
  handleCellTap(event) {
    const { row, col } = event.currentTarget.dataset;
    syncPage(this, this.controller.selectCell(Number(row), Number(col)));
  },
  handleDigitTap(event) {
    const { digit } = event.currentTarget.dataset;
    syncPage(this, this.controller.enterDigit(Number(digit)));
  },
  handleDifficultyTap(event) {
    const { difficulty } = event.currentTarget.dataset;
    syncPage(this, this.controller.startNewGame(difficulty));
  },
  handleToggleNotes() {
    syncPage(this, this.controller.toggleNotesMode());
  },
  handleTogglePrefill() {
    syncPage(this, this.controller.togglePrefillMode());
  },
  handleLocatePrefill() {
    syncPage(this, this.controller.locateFirstWrongPrefill());
  },
  handleApplyHint() {
    syncPage(this, this.controller.applyHint());
  },
  handleClearCell() {
    syncPage(this, this.controller.clearCell());
  },
  handleResetGame() {
    syncPage(this, this.controller.resetGame());
  },
  handleRefreshGame() {
    syncPage(this, createNewGameDialogData());
  },
  handleCancelNewGame() {
    syncPage(this, createClosedNewGameDialogData());
  },
  handleToggleNewGameConfirm() {
    syncPage(this, createNewGameDialogData({
      acknowledged: toggleNewGameDialogAcknowledgement(this.data.newGameDialogAcknowledged)
    }));
  },
  handleConfirmNewGame() {
    if (!canConfirmNewGame(this.data.newGameDialogAcknowledged)) {
      return;
    }

    syncPage(this, {
      ...this.controller.restartCurrentGame(),
      ...createClosedNewGameDialogData()
    });
  },
  noop() {
  },
  handleOpenRules() {
    my.navigateTo({
      url: '/pages/rules/index'
    });
  },
  handleOpenSolver() {
    this.controller.openSolver();
  }
});

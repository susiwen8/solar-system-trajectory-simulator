import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createGameController } = require('../../miniapps/shared/game-controller.js');

function createSnapshot(overrides = {}) {
  const solution = [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9]
  ];

  return {
    difficulty: 'medium',
    puzzle: Array.from({ length: 9 }, () => Array(9).fill(0)),
    solution,
    board: Array.from({ length: 9 }, () => Array(9).fill(0)),
    notes: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => [])),
    notesMode: false,
    prefillMode: false,
    prefills: Array.from({ length: 9 }, () => Array(9).fill(0)),
    nextPrefillOrder: 1,
    completed: false,
    elapsedSeconds: 0,
    hintsUsed: 0,
    traceCell: null,
    selectedCell: { row: 0, col: 0 },
    ...overrides
  };
}

function createPlatform(overrides = {}) {
  const sessionSaves = [];
  const bestTimeSaves = [];
  const navigations = [];
  const timers = [];
  const clearedTimers = [];
  const timerUpdates = [];

  return {
    sessionSaves,
    bestTimeSaves,
    navigations,
    timers,
    clearedTimers,
    timerUpdates,
    loadSession() {
      return overrides.session ?? null;
    },
    saveSession(snapshot) {
      sessionSaves.push(snapshot);
    },
    loadBestTimes() {
      return overrides.bestTimes ?? null;
    },
    saveBestTimes(bestTimes) {
      bestTimeSaves.push(bestTimes);
    },
    navigateToSolver(puzzle) {
      navigations.push(puzzle);
    },
    syncTimerTick(data) {
      timerUpdates.push(data);
    },
    setTimer(handler, intervalMs) {
      timers.push({ handler, intervalMs });
      return `timer-${timers.length}`;
    },
    clearTimer(timerId) {
      clearedTimers.push(timerId);
    }
  };
}

test('shared game controller restores a stored session before generating a new puzzle', () => {
  const session = createSnapshot({
    board: [
      [5, 0, 0, 0, 0, 0, 0, 0, 0],
      ...Array.from({ length: 8 }, () => Array(9).fill(0))
    ]
  });
  const platform = createPlatform({ session });
  const controller = createGameController(platform);

  controller.init();

  assert.equal(controller.getState().board[0][0], 5);
  assert.equal(platform.timers.length, 1);
  assert.equal(platform.timers[0].intervalMs, 1000);
});

test('shared game controller page data distinguishes fixed, player-entry, same-value, prefill, and trace cells', () => {
  const puzzle = Array.from({ length: 9 }, () => Array(9).fill(0));
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  const prefills = Array.from({ length: 9 }, () => Array(9).fill(0));
  puzzle[0][0] = 5;
  board[0][0] = 5;
  board[2][2] = 5;
  board[1][1] = 6;
  prefills[1][1] = 1;

  const controller = createGameController(
    createPlatform({
      session: createSnapshot({
        puzzle,
        board,
        prefills,
        prefillMode: true,
        traceCell: { row: 1, col: 1 },
        selectedCell: { row: 0, col: 0 }
      })
    })
  );

  const data = controller.init();
  const fixedCell = data.cells.find((cell) => cell.row === 0 && cell.col === 0);
  const sameValueCell = data.cells.find((cell) => cell.row === 2 && cell.col === 2);
  const prefillCell = data.cells.find((cell) => cell.row === 1 && cell.col === 1);

  assert.equal(fixedCell.fixed, true);
  assert.equal(fixedCell.selected, true);
  assert.equal(sameValueCell.playerEntry, true);
  assert.equal(sameValueCell.sameValue, true);
  assert.equal(prefillCell.prefillEntry, true);
  assert.equal(prefillCell.traceOrigin, true);
  assert.equal(data.activeDigit, 5);
  assert.equal(data.statusPillText, '试填模式');
});

test('shared game controller highlights matching digits after keypad input even when the board stays unchanged', () => {
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  board[2][2] = 5;

  const controller = createGameController(
    createPlatform({
      session: createSnapshot({
        board,
        notesMode: true,
        selectedCell: { row: 0, col: 0 }
      })
    })
  );

  controller.init();
  const data = controller.enterDigit(5);
  const sameValueCell = data.cells.find((cell) => cell.row === 2 && cell.col === 2);

  assert.deepEqual(controller.getState().notes[0][0], [5]);
  assert.equal(controller.getState().board[0][0], 0);
  assert.equal(controller.getState().activeDigit, 5);
  assert.equal(sameValueCell.sameValue, true);
});

test('shared game controller openSolver serializes the original puzzle instead of the live board state', () => {
  const puzzle = Array.from({ length: 9 }, () => Array(9).fill(0));
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  puzzle[0][0] = 5;
  puzzle[0][1] = 3;
  board[0][0] = 5;
  board[0][1] = 3;
  board[0][2] = 4;

  const platform = createPlatform({
    session: createSnapshot({
      puzzle,
      board
    })
  });
  const controller = createGameController(platform);

  controller.init();
  controller.openSolver();

  assert.equal(platform.navigations.length, 1);
  assert.match(platform.navigations[0], /^53\./);
  assert.doesNotMatch(platform.navigations[0], /534/);
});

test('shared game controller updates best time when a faster completion finishes', () => {
  const puzzle = [
    [5, 3, 0, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9]
  ];
  const solution = [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9]
  ];
  const platform = createPlatform({
    session: createSnapshot({
      puzzle,
      solution,
      board: puzzle,
      elapsedSeconds: 42,
      selectedCell: { row: 0, col: 2 }
    }),
    bestTimes: {
      easy: null,
      medium: 90,
      hard: null
    }
  });
  const controller = createGameController(platform);

  controller.init();
  controller.enterDigit(4);

  assert.equal(platform.bestTimeSaves.length, 1);
  assert.equal(platform.bestTimeSaves[0].medium, 42);
});

test('shared game controller timer ticks save the updated snapshot until the puzzle is complete', () => {
  const platform = createPlatform({
    session: createSnapshot({
      elapsedSeconds: 5
    })
  });
  const controller = createGameController(platform);

  controller.init();
  const saveCountBeforeTick = platform.sessionSaves.length;

  platform.timers[0].handler();

  assert.equal(controller.getState().elapsedSeconds, 6);
  assert.equal(platform.sessionSaves.length, saveCountBeforeTick + 1);
  assert.equal(platform.timerUpdates.length, 1);
  assert.equal(platform.timerUpdates[0].timerText, '00:06');

  controller.stop();

  assert.deepEqual(platform.clearedTimers, ['timer-1']);
});

test('shared game controller restartCurrentGame creates a fresh puzzle at the same difficulty', () => {
  const platform = createPlatform({
    session: createSnapshot({
      difficulty: 'hard',
      elapsedSeconds: 37,
      hintsUsed: 2,
      notesMode: true,
      prefillMode: true,
      completed: true
    })
  });
  const controller = createGameController(platform);

  controller.init();
  const nextData = controller.restartCurrentGame();

  assert.equal(controller.getState().difficulty, 'hard');
  assert.equal(controller.getState().elapsedSeconds, 0);
  assert.equal(controller.getState().hintsUsed, 0);
  assert.equal(controller.getState().notesMode, false);
  assert.equal(controller.getState().prefillMode, false);
  assert.equal(controller.getState().completed, false);
  assert.equal(Array.isArray(nextData.cells), true);
  assert.equal(nextData.cells.length, 81);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyHint,
  clearCell,
  createSnapshot,
  createGameState,
  enterDigit,
  locateFirstWrongPrefill,
  moveSelection,
  resetGame,
  restoreGameState,
  selectCell,
  tickClock,
  togglePrefillMode,
  toggleNotesMode
} from '../src/game-state.js';

const samplePuzzle = [
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

const sampleSolution = [
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

test('createGameState seeds the current board from the initial puzzle', () => {
  const state = createGameState({
    difficulty: 'easy',
    puzzle: samplePuzzle,
    solution: sampleSolution
  });

  assert.equal(state.difficulty, 'easy');
  assert.equal(state.board[0][2], 0);
  assert.equal(state.board[0][0], 5);
  assert.equal(state.completed, false);
});

test('selectCell moves the active cursor', () => {
  const state = createGameState({
    puzzle: samplePuzzle,
    solution: sampleSolution
  });
  const nextState = selectCell(state, 4, 4);

  assert.deepEqual(nextState.selectedCell, { row: 4, col: 4 });
});

test('enterDigit fills an editable cell when notes mode is off', () => {
  const state = selectCell(
    createGameState({
      puzzle: samplePuzzle,
      solution: sampleSolution
    }),
    0,
    2
  );

  const nextState = enterDigit(state, 4);

  assert.equal(nextState.board[0][2], 4);
  assert.deepEqual(nextState.notes[0][2], []);
});

test('enterDigit toggles notes instead of filling the board when notes mode is on', () => {
  let state = createGameState({
    puzzle: samplePuzzle,
    solution: sampleSolution
  });
  state = selectCell(state, 0, 2);
  state = toggleNotesMode(state);
  state = enterDigit(state, 4);
  state = enterDigit(state, 7);
  state = enterDigit(state, 4);

  assert.equal(state.board[0][2], 0);
  assert.deepEqual(state.notes[0][2], [7]);
});

test('clearCell empties editable values and notes', () => {
  let state = createGameState({
    puzzle: samplePuzzle,
    solution: sampleSolution
  });
  state = selectCell(state, 0, 2);
  state = enterDigit(state, 4);
  state = toggleNotesMode(state);
  state = enterDigit(state, 6);
  state = clearCell(state);

  assert.equal(state.board[0][2], 0);
  assert.deepEqual(state.notes[0][2], []);
});

test('enterDigit marks the game complete when the final correct value is entered', () => {
  const state = selectCell(
    createGameState({
      puzzle: samplePuzzle,
      solution: sampleSolution
    }),
    0,
    2
  );

  const nextState = enterDigit(state, 4);

  assert.equal(nextState.completed, true);
});

test('resetGame restores the original puzzle state', () => {
  let state = createGameState({
    puzzle: samplePuzzle,
    solution: sampleSolution
  });
  state = selectCell(state, 0, 2);
  state = enterDigit(state, 4);
  state = resetGame(state);

  assert.equal(state.board[0][2], 0);
  assert.deepEqual(state.notes[0][2], []);
  assert.equal(state.completed, false);
});

test('moveSelection keeps the cursor inside the board', () => {
  const state = createGameState({
    puzzle: samplePuzzle,
    solution: sampleSolution
  });

  const moved = moveSelection(selectCell(state, 0, 2), -3, 10);

  assert.deepEqual(moved.selectedCell, { row: 0, col: 8 });
});

test('applyHint fills the selected empty cell with the solution value', () => {
  const state = selectCell(
    createGameState({
      puzzle: samplePuzzle,
      solution: sampleSolution
    }),
    0,
    2
  );

  const nextState = applyHint(state);

  assert.equal(nextState.board[0][2], 4);
  assert.equal(nextState.hintsUsed, 1);
});

test('tickClock advances elapsedSeconds until the puzzle is complete', () => {
  const running = tickClock(
    createGameState({
      puzzle: samplePuzzle,
      solution: sampleSolution
    }),
    3
  );
  const finished = tickClock(
    enterDigit(selectCell(running, 0, 2), 4),
    5
  );

  assert.equal(running.elapsedSeconds, 3);
  assert.equal(finished.elapsedSeconds, 3);
});

test('createSnapshot and restoreGameState round-trip a playable session', () => {
  let state = createGameState({
    difficulty: 'hard',
    puzzle: samplePuzzle,
    solution: sampleSolution
  });
  state = selectCell(state, 0, 2);
  state = toggleNotesMode(state);
  state = enterDigit(state, 4);
  state = tickClock(state, 12);

  const restored = restoreGameState(createSnapshot(state));

  assert.equal(restored?.difficulty, 'hard');
  assert.equal(restored?.elapsedSeconds, 12);
  assert.deepEqual(restored?.notes[0][2], [4]);
  assert.deepEqual(restored?.selectedCell, { row: 0, col: 2 });
});

test('prefill mode places a tentative digit without deleting existing notes', () => {
  let state = createGameState({
    puzzle: samplePuzzle,
    solution: sampleSolution
  });
  state = selectCell(state, 0, 2);
  state = toggleNotesMode(state);
  state = enterDigit(state, 4);
  state = enterDigit(state, 7);
  state = togglePrefillMode(state);
  state = enterDigit(state, 6);

  assert.equal(state.notesMode, false);
  assert.equal(state.prefillMode, true);
  assert.equal(state.board[0][2], 6);
  assert.deepEqual(state.notes[0][2], [4, 7]);
  assert.equal(state.prefills[0][2], 1);
});

test('clearCell removes a tentative fill but restores the old notes', () => {
  let state = createGameState({
    puzzle: samplePuzzle,
    solution: sampleSolution
  });
  state = selectCell(state, 0, 2);
  state = toggleNotesMode(state);
  state = enterDigit(state, 4);
  state = enterDigit(state, 7);
  state = togglePrefillMode(state);
  state = enterDigit(state, 6);
  state = clearCell(state);

  assert.equal(state.board[0][2], 0);
  assert.deepEqual(state.notes[0][2], [4, 7]);
  assert.equal(state.prefills[0][2], 0);
});

test('locateFirstWrongPrefill jumps to the earliest incorrect tentative cell', () => {
  const tracingPuzzle = [
    [5, 3, 0, 6, 7, 8, 9, 1, 2],
    [6, 0, 2, 1, 9, 5, 3, 4, 8],
    [0, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9]
  ];

  let state = createGameState({
    puzzle: tracingPuzzle,
    solution: sampleSolution
  });
  state = togglePrefillMode(state);
  state = enterDigit(selectCell(state, 1, 1), 7);
  state = enterDigit(selectCell(state, 2, 0), 2);
  state = enterDigit(selectCell(state, 0, 2), 5);
  state = locateFirstWrongPrefill(state);

  assert.deepEqual(state.selectedCell, { row: 2, col: 0 });
  assert.deepEqual(state.traceCell, { row: 2, col: 0 });
});

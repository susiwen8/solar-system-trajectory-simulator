import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeBoard,
  countSolutions,
  generatePuzzle,
  isValidPlacement,
  parseBoardInput,
  solveBoard,
  validateBoard
} from '../src/sudoku.js';

test('solveBoard fills a nearly complete valid Sudoku grid', () => {
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

  const solved = solveBoard(puzzle);

  assert.equal(solved?.[0]?.[2], 4);
  assert.deepEqual(solved?.[0], [5, 3, 4, 6, 7, 8, 9, 1, 2]);
});

test('isValidPlacement accepts legal moves and rejects row, column, and box conflicts', () => {
  const puzzle = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9]
  ];

  assert.equal(isValidPlacement(puzzle, 0, 2, 4), true);
  assert.equal(isValidPlacement(puzzle, 0, 2, 5), false);
  assert.equal(isValidPlacement(puzzle, 0, 2, 8), false);
  assert.equal(isValidPlacement(puzzle, 0, 2, 9), false);
});

test('countSolutions stops at the provided limit when a puzzle has multiple solutions', () => {
  const boardWithAlternatives = [
    [5, 3, 4, 6, 7, 8, 9, 0, 0],
    [6, 7, 0, 0, 9, 5, 3, 4, 8],
    [0, 9, 8, 3, 4, 0, 5, 6, 7],
    [8, 5, 9, 7, 6, 0, 4, 0, 3],
    [4, 0, 6, 8, 5, 3, 7, 9, 0],
    [7, 0, 3, 9, 0, 4, 8, 5, 6],
    [9, 6, 0, 5, 3, 7, 0, 8, 4],
    [0, 8, 7, 4, 0, 9, 6, 3, 5],
    [3, 4, 5, 0, 8, 6, 0, 7, 9]
  ];

  assert.equal(countSolutions(boardWithAlternatives, 2), 2);
});

test('generatePuzzle creates a unique, solvable game with a difficulty-shaped clue count', () => {
  const game = generatePuzzle('medium');
  const givens = game.puzzle.flat().filter(Boolean).length;

  assert.equal(game.puzzle.length, 9);
  assert.equal(game.solution.length, 9);
  assert.equal(countSolutions(game.puzzle, 2), 1);
  assert.deepEqual(solveBoard(game.puzzle), game.solution);
  assert.equal(givens, 32);
});

test('parseBoardInput converts formatted puzzle text into a 9x9 board', () => {
  const board = parseBoardInput(`
    530070000
    600195000
    098000060
    800060003
    400803001
    700020006
    060000280
    000419005
    000080079
  `);

  assert.equal(board.length, 9);
  assert.deepEqual(board[0], [5, 3, 0, 0, 7, 0, 0, 0, 0]);
  assert.deepEqual(board[8], [0, 0, 0, 0, 8, 0, 0, 7, 9]);
});

test('parseBoardInput rejects malformed puzzle text', () => {
  assert.throws(
    () => parseBoardInput('530070000 600195000 098000060'),
    /81/
  );
  assert.throws(
    () => parseBoardInput('53007x000'.repeat(9)),
    /invalid/i
  );
});

test('validateBoard reports row, column, and box conflicts for all affected cells', () => {
  const invalidBoard = [
    [5, 0, 0, 0, 5, 0, 0, 0, 0],
    [0, 9, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 9, 0, 0, 0, 0, 0, 0],
    [0, 7, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 2, 0],
    [0, 7, 0, 0, 0, 0, 0, 0, 0]
  ];

  const validation = validateBoard(invalidBoard);
  const conflictAt = (row, col) =>
    validation.conflicts.find((cell) => cell.row === row && cell.col === col);

  assert.equal(validation.valid, false);
  assert.deepEqual(conflictAt(0, 0)?.reasons, ['row']);
  assert.deepEqual(conflictAt(0, 4)?.reasons, ['row']);
  assert.deepEqual(conflictAt(1, 1)?.reasons, ['box']);
  assert.deepEqual(conflictAt(2, 2)?.reasons, ['box']);
  assert.deepEqual(conflictAt(3, 1)?.reasons, ['column']);
  assert.deepEqual(conflictAt(8, 1)?.reasons, ['column']);
  assert.deepEqual(conflictAt(6, 6)?.reasons, ['box']);
  assert.deepEqual(conflictAt(7, 7)?.reasons, ['box']);
});

test('analyzeBoard returns the solved board and recorded steps for a unique puzzle', () => {
  const puzzle = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9]
  ];

  const analysis = analyzeBoard(puzzle);
  const firstGuessIndex = analysis.steps.findIndex((step) => step.type === 'guess');
  const firstSingleIndex = analysis.steps.findIndex((step) => step.type === 'single');

  assert.equal(analysis.status, 'solved');
  assert.deepEqual(analysis.solution, solveBoard(puzzle));
  assert.equal(analysis.steps.length > 0, true);
  assert.equal(analysis.steps.some((step) => step.type === 'single'), true);
  if (firstGuessIndex !== -1) {
    assert.equal(firstSingleIndex !== -1 && firstSingleIndex < firstGuessIndex, true);
  }
});

test('analyzeBoard reports an unsolvable status for a valid board with no solution', () => {
  const unsolvableBoard = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8],
    [9, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0]
  ];

  const analysis = analyzeBoard(unsolvableBoard);

  assert.equal(analysis.status, 'unsolvable');
  assert.deepEqual(analysis.solution, null);
  assert.deepEqual(analysis.steps, []);
});

test('analyzeBoard reports when a puzzle has multiple solutions', () => {
  const boardWithAlternatives = [
    [5, 3, 4, 6, 7, 8, 9, 0, 0],
    [6, 7, 0, 0, 9, 5, 3, 4, 8],
    [0, 9, 8, 3, 4, 0, 5, 6, 7],
    [8, 5, 9, 7, 6, 0, 4, 0, 3],
    [4, 0, 6, 8, 5, 3, 7, 9, 0],
    [7, 0, 3, 9, 0, 4, 8, 5, 6],
    [9, 6, 0, 5, 3, 7, 0, 8, 4],
    [0, 8, 7, 4, 0, 9, 6, 3, 5],
    [3, 4, 5, 0, 8, 6, 0, 7, 9]
  ];

  const analysis = analyzeBoard(boardWithAlternatives);

  assert.equal(analysis.status, 'multiple-solutions');
  assert.deepEqual(analysis.solution, null);
  assert.deepEqual(analysis.steps, []);
});

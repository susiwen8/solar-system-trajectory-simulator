import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSolverCells,
  formatSolverStep,
  getSolverMessage
} from '../src/solver-view.js';

function createBoard() {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

test('buildSolverCells marks conflicted cells in the board view model', () => {
  const board = createBoard();
  board[0][0] = 5;
  board[1][1] = 9;

  const cells = buildSolverCells(board, [
    { row: 0, col: 0, reasons: ['row'] },
    { row: 1, col: 1, reasons: ['box', 'column'] }
  ]);

  assert.equal(cells.length, 81);
  assert.deepEqual(cells[0], {
    row: 0,
    col: 0,
    value: 5,
    empty: false,
    conflict: true,
    reasons: ['row']
  });
  assert.deepEqual(cells[10], {
    row: 1,
    col: 1,
    value: 9,
    empty: false,
    conflict: true,
    reasons: ['box', 'column']
  });
  assert.equal(cells[80].conflict, false);
});

test('getSolverMessage maps solve outcomes into user-facing copy', () => {
  assert.equal(getSolverMessage(null), '输入一个题目后，就可以直接求解。');
  assert.equal(
    getSolverMessage({ status: 'invalid' }),
    '当前题目有冲突，请先修正高亮格子。'
  );
  assert.equal(
    getSolverMessage({ status: 'unsolvable' }),
    '这个题目当前无解，无法补出完整答案。'
  );
  assert.equal(
    getSolverMessage({ status: 'multiple-solutions' }),
    '这个题目存在多个解，不能给出唯一答案。'
  );
  assert.equal(
    getSolverMessage({ status: 'solved', steps: [{}, {}, {}] }),
    '已找到唯一解，共记录 3 步。'
  );
});

test('formatSolverStep turns recorded solving events into readable Chinese text', () => {
  assert.equal(
    formatSolverStep({ type: 'single', row: 0, col: 2, value: 4 }, 0),
    '1. 第 1 行第 3 列只能填 4。'
  );
  assert.equal(
    formatSolverStep({ type: 'guess', row: 4, col: 4, value: 7 }, 1),
    '2. 尝试在第 5 行第 5 列填入 7。'
  );
  assert.equal(
    formatSolverStep({ type: 'backtrack', row: 4, col: 4, value: 7 }, 2),
    '3. 第 5 行第 5 列填入 7 后走不通，回退。'
  );
});

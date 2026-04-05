import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSolverController, SAMPLE_PUZZLE_STRING } = require('../../miniapps/shared/solver-controller.js');

test('shared solver controller starts empty when no query puzzle is provided', () => {
  const controller = createSolverController();
  const data = controller.init();

  assert.equal(data.cells.length, 81);
  assert.equal(data.message, '输入一个题目后，就可以直接求解。');
  assert.equal(data.stepCountText, '0');
  assert.equal(data.steps.length, 0);
});

test('shared solver controller preloads a valid query puzzle without auto-solving it', () => {
  const puzzle =
    '530070000' +
    '600195000' +
    '098000060' +
    '800060003' +
    '400803001' +
    '700020006' +
    '060000280' +
    '000419005' +
    '000080079';
  const controller = createSolverController({ queryPuzzle: puzzle });
  const data = controller.init();

  assert.equal(data.inputText, puzzle);
  assert.equal(data.stepCountText, '0');
  assert.equal(data.steps.length, 0);
  assert.equal(data.resultSolved, false);
  assert.match(data.cells[0].displayValue, /5/);
});

test('shared solver controller falls back gracefully when the query puzzle is invalid', () => {
  const controller = createSolverController({ queryPuzzle: '123' });
  const data = controller.init();

  assert.equal(data.inputText, '');
  assert.equal(data.message, '带入题目失败，请重新导入或手动填写。');
  assert.equal(data.stepCountText, '0');
});

test('shared solver controller flags conflicts immediately after importing an invalid puzzle', () => {
  const controller = createSolverController();

  controller.init();
  const data = controller.importText(
    '550000000' +
      '000000000' +
      '000000000' +
      '000000000' +
      '000000000' +
      '000000000' +
      '000000000' +
      '000000000' +
      '000000000'
  );

  assert.equal(data.cells.filter((cell) => cell.conflict).length, 2);
  assert.equal(data.message, '当前题目有冲突，请先修正高亮格子。');
});

test('shared solver controller reports parse errors from malformed import text', () => {
  const controller = createSolverController();

  controller.init();
  const data = controller.importText('53007x000');

  assert.match(data.message, /Invalid character/);
  assert.equal(data.stepCountText, '0');
});

test('shared solver controller can import a recognized board directly', () => {
  const controller = createSolverController();
  const board = [
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

  controller.init();
  controller.solve();
  const data = controller.importRecognizedBoard(board);

  assert.equal(data.resultSolved, false);
  assert.equal(data.stepCountText, '0');
  assert.equal(data.steps.length, 0);
  assert.equal(data.cells[0].displayValue, '5');
  assert.equal(data.cells[2].displayValue, '');
});

test('shared solver controller can load the sample puzzle and solve it', () => {
  const controller = createSolverController();

  controller.init();
  controller.loadSample();
  const data = controller.solve();
  const firstSolvedGap = data.cells.find((cell) => cell.row === 0 && cell.col === 2);

  assert.equal(data.inputText, SAMPLE_PUZZLE_STRING);
  assert.match(data.message, /已找到唯一解/);
  assert.equal(data.resultSolved, true);
  assert.equal(data.cells.length, 81);
  assert.equal(firstSolvedGap.displayValue, '4');
  assert.equal(firstSolvedGap.playerEntry, true);
  assert.equal(data.steps.length > 0, true);
  assert.equal(data.guideAvailable, true);
  assert.equal(data.guideCanGoNext, false);
  assert.equal(data.guideStepIndex, data.steps.length - 1);
  assert.equal(data.guideScrollTargetId, data.steps[data.steps.length - 1].key);
});

test('shared solver controller can replay a solved puzzle step by step for teaching', () => {
  const controller = createSolverController();

  controller.init();
  controller.loadSample();
  controller.solve();

  let data = controller.startGuide();
  const firstStepCell = data.cells.find((cell) => cell.guideFocus);
  const remainingEmptyCells = data.cells.filter((cell) => cell.empty);

  assert.equal(data.guideAvailable, true);
  assert.equal(data.guideStepIndex, 0);
  assert.equal(data.guideCanGoPrev, false);
  assert.equal(data.guideCanGoNext, true);
  assert.match(data.guideProgressText, /1\s*\/\s*\d+/);
  assert.match(data.guideStepDescription, /只能填|候选|试填|回退/);
  assert.equal(data.guideScrollTargetId, data.steps[0].key);
  assert.equal(Boolean(firstStepCell), true);
  assert.notEqual(firstStepCell.displayValue, '');
  assert.equal(firstStepCell.guideFocus, true);
  assert.equal(remainingEmptyCells.length > 0, true);

  data = controller.nextGuideStep();
  assert.equal(data.guideStepIndex, 1);
  assert.equal(data.guideCanGoPrev, true);
  assert.equal(data.guideScrollTargetId, data.steps[1].key);

  data = controller.prevGuideStep();
  assert.equal(data.guideStepIndex, 0);
  assert.equal(data.guideScrollTargetId, data.steps[0].key);

  data = controller.showGuideSolution();
  assert.equal(data.guideCanGoNext, false);
  assert.equal(data.guideStepIndex, data.steps.length - 1);
  assert.equal(data.guideScrollTargetId, data.steps[data.steps.length - 1].key);
});

test('shared solver controller can jump directly to a chosen guide step', () => {
  const controller = createSolverController();

  controller.init();
  controller.loadSample();
  controller.solve();

  const data = controller.jumpToGuideStep(3);
  const focusedCell = data.cells.find((cell) => cell.guideFocus);

  assert.equal(data.guideAvailable, true);
  assert.equal(data.guideStepIndex, 3);
  assert.equal(data.guideStepTitle, '第 4 步 · 唯一候选');
  assert.equal(data.guideProgressText, `4 / ${data.steps.length}`);
  assert.equal(data.guideScrollTargetId, data.steps[3].key);
  assert.equal(data.steps[3].active, true);
  assert.equal(data.steps[0].done, true);
  assert.deepEqual(
    focusedCell && {
      row: focusedCell.row,
      col: focusedCell.col,
      displayValue: focusedCell.displayValue
    },
    {
      row: 4,
      col: 2,
      displayValue: '6'
    }
  );
});

test('shared solver controller reports multiple solutions without returning a solved board', () => {
  const controller = createSolverController();
  const multipleSolutionPuzzle =
    '5346789..' +
    '67..95348' +
    '.9834.567' +
    '85976.4.3' +
    '4.685379.' +
    '7.39.4856' +
    '96.537.84' +
    '.874.9635' +
    '345.86.79';

  controller.init();
  controller.importText(multipleSolutionPuzzle);
  const data = controller.solve();

  assert.equal(data.message, '这个题目存在多个解，不能给出唯一答案。');
  assert.equal(data.resultSolved, false);
  assert.equal(data.steps.length, 0);
});

test('shared solver controller clear resets the board, input, and analysis', () => {
  const controller = createSolverController({ queryPuzzle: SAMPLE_PUZZLE_STRING });

  controller.init();
  controller.solve();
  const data = controller.clear();

  assert.equal(data.inputText, '');
  assert.equal(data.message, '输入一个题目后，就可以直接求解。');
  assert.equal(data.stepCountText, '0');
  assert.equal(data.steps.length, 0);
  assert.equal(data.resultSolved, false);
  assert.equal(data.guideAvailable, false);
  assert.equal(data.guideScrollTargetId, '');
});

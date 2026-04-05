import test from 'node:test';
import assert from 'node:assert/strict';

const domHelpersModule = import(`../src/h5/dom-helpers.js?test=${Date.now()}`);

test('renderGameBoard outputs the expected visual state classes', async () => {
  const { renderGameBoard } = await domHelpersModule;
  const html = renderGameBoard([
    {
      key: '0-0',
      row: 0,
      col: 0,
      displayValue: '5',
      notes: [],
      fixed: true,
      playerEntry: false,
      prefillEntry: false,
      selected: true,
      related: false,
      sameValue: false,
      traceOrigin: false,
      completed: false,
      boxRight: false,
      boxBottom: false
    },
    {
      key: '0-1',
      row: 0,
      col: 1,
      displayValue: '6',
      notes: [],
      fixed: false,
      playerEntry: true,
      prefillEntry: true,
      selected: false,
      related: true,
      sameValue: true,
      traceOrigin: true,
      completed: false,
      boxRight: true,
      boxBottom: true
    }
  ]);

  assert.match(html, /class="cell fixed selected"/);
  assert.match(
    html,
    /class="cell player-entry prefill-entry related same-value trace-origin box-right box-bottom"/
  );
  assert.match(html, /data-row="0"/);
  assert.match(html, /aria-label="第 1 行第 2 列"/);
});

test('renderGameControls marks active difficulty and action states', async () => {
  const { renderGameControls } = await domHelpersModule;
  const html = renderGameControls({
    difficultyOptions: [
      { value: 'easy', label: '简单', active: false },
      { value: 'medium', label: '中等', active: true },
      { value: 'hard', label: '困难', active: false }
    ],
    keypadDigits: [1, 2, 3],
    activeDigit: 2,
    notesMode: true,
    prefillMode: false
  });

  assert.match(html, /data-difficulty="medium"[\s\S]*difficulty-pill active/);
  assert.match(html, /data-digit="2"[\s\S]*keypad-button control-chip subtle active/);
  assert.match(html, /data-digit="3"/);
  assert.match(html, /data-action="notes"[\s\S]*control-chip primary/);
  assert.match(html, /data-action="prefill"[\s\S]*control-chip"/);
});

test('renderSolverSteps marks active and done steps for the H5 guide', async () => {
  const { renderSolverSteps } = await domHelpersModule;
  const html = renderSolverSteps({
    steps: [
      { key: 'step-0', index: 0, text: '1. 第 1 行第 1 列填入 5。', active: false, done: true },
      { key: 'step-1', index: 1, text: '2. 第 1 行第 2 列填入 3。', active: true, done: false }
    ]
  });

  assert.match(html, /id="step-0"/);
  assert.match(html, /class="solver-step done"/);
  assert.match(html, /class="solver-step active"/);
});

test('renderNewGameDialog reflects the enabled confirm state', async () => {
  const { renderNewGameDialog } = await domHelpersModule;

  const closed = renderNewGameDialog({
    newGameDialogVisible: false
  });
  const open = renderNewGameDialog({
    newGameDialogVisible: true,
    newGameDialogAcknowledged: true,
    newGameDialogConfirmEnabled: true,
    newGameDialogTitle: '换一局？',
    newGameDialogContent: '这会放弃当前盘面。',
    newGameDialogSecondaryConfirmText: '我确认放弃当前盘面。',
    newGameDialogConfirmText: '确认换局',
    newGameDialogCancelText: '取消'
  });

  assert.equal(closed, '');
  assert.match(open, /class="new-game-dialog-mask"/);
  assert.match(open, /new-game-confirm-check checked/);
  assert.match(open, /new-game-dialog-button accent"/);
  assert.doesNotMatch(open, /disabled/);
});

test('renderSolverBoard outputs conflict and guide focus states', async () => {
  const { renderSolverBoard } = await domHelpersModule;
  const html = renderSolverBoard([
    {
      key: '0-0',
      row: 0,
      col: 0,
      displayValue: '5',
      fixed: true,
      playerEntry: false,
      conflict: false,
      selected: true,
      guideFocus: false,
      boxRight: false,
      boxBottom: false
    },
    {
      key: '0-1',
      row: 0,
      col: 1,
      displayValue: '3',
      fixed: false,
      playerEntry: true,
      conflict: true,
      selected: false,
      guideFocus: true,
      boxRight: false,
      boxBottom: false
    }
  ]);

  assert.match(html, /class="cell fixed selected"/);
  assert.match(html, /class="cell player-entry conflict guide-focus"/);
});

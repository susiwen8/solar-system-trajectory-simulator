import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  canConfirmNewGame,
  createClosedNewGameDialogData,
  createNewGameDialogData,
  getNewGameDialogStep,
  toggleNewGameDialogAcknowledgement
} = require('../../miniapps/shared/new-game-flow.js');

test('getNewGameDialogStep returns the dialog copy for the single popup flow', () => {
  const step = getNewGameDialogStep();

  assert.match(step.title, /换一局/);
  assert.match(step.confirmText, /确认换局/);
  assert.match(step.cancelText, /取消/);
  assert.match(step.secondaryConfirmText, /确认放弃当前盘面的填写进度/);
});

test('createNewGameDialogData opens a single dialog with second confirmation unset by default', () => {
  const dialogData = createNewGameDialogData();

  assert.equal(dialogData.newGameDialogVisible, true);
  assert.equal(dialogData.newGameDialogAcknowledged, false);
  assert.equal(dialogData.newGameDialogConfirmEnabled, false);
  assert.match(dialogData.newGameDialogSecondaryConfirmText, /确认放弃当前盘面的填写进度/);
});

test('toggleNewGameDialogAcknowledgement flips the in-dialog second confirmation state', () => {
  assert.equal(toggleNewGameDialogAcknowledgement(false), true);
  assert.equal(toggleNewGameDialogAcknowledgement(true), false);
});

test('canConfirmNewGame only allows replacing the puzzle after in-dialog second confirmation', () => {
  assert.equal(canConfirmNewGame(false), false);
  assert.equal(canConfirmNewGame(true), true);
});

test('createClosedNewGameDialogData resets the single dialog state', () => {
  const dialogData = createClosedNewGameDialogData();

  assert.equal(dialogData.newGameDialogVisible, false);
  assert.equal(dialogData.newGameDialogAcknowledged, false);
  assert.equal(dialogData.newGameDialogConfirmEnabled, false);
  assert.equal(dialogData.newGameDialogTitle, '');
});

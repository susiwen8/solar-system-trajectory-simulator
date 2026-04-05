import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('miniapps/wechat');
const sharedRoot = path.resolve('miniapps/shared');
const runtimeSharedFiles = [
  'constants.js',
  'game-controller.js',
  'game-state.js',
  'game-view.js',
  'new-game-flow.js',
  'solver-controller.js',
  'solver-image-import.js',
  'solver-view.js',
  'storage.js',
  'sudoku.js'
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('wechat mini app scaffold exists and registers the required pages', () => {
  assert.equal(fs.existsSync(path.join(root, 'app.js')), true);
  assert.equal(fs.existsSync(path.join(root, 'app.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'app.wxss')), true);
  assert.equal(fs.existsSync(path.join(root, 'pages/game/index.js')), true);
  assert.equal(fs.existsSync(path.join(root, 'pages/game/index.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'pages/game/index.wxml')), true);
  assert.equal(fs.existsSync(path.join(root, 'pages/game/index.wxss')), true);
  assert.equal(fs.existsSync(path.join(root, 'pages/solver/index.js')), true);
  assert.equal(fs.existsSync(path.join(root, 'pages/solver/index.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'pages/solver/index.wxml')), true);
  assert.equal(fs.existsSync(path.join(root, 'pages/solver/index.wxss')), true);
  assert.equal(fs.existsSync(path.join(root, 'pages/rules/index.js')), true);
  assert.equal(fs.existsSync(path.join(root, 'pages/rules/index.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'pages/rules/index.wxml')), true);
  assert.equal(fs.existsSync(path.join(root, 'pages/rules/index.wxss')), true);

  const appConfig = JSON.parse(read('app.json'));
  assert.deepEqual(appConfig.pages, ['pages/game/index', 'pages/solver/index', 'pages/rules/index']);
});

test('wechat game page uses the shared controller and exposes the required UI anchors', () => {
  const script = read('pages/game/index.js');
  const template = read('pages/game/index.wxml');

  assert.match(script, /createGameController/);
  assert.match(script, /\.\.\/\.\.\/shared\/game-controller\.js/);
  assert.doesNotMatch(script, /\.\.\/\.\.\/\.\.\/shared\/game-controller\.js/);
  assert.match(script, /createPlatform\(this\)/);
  assert.match(script, /syncTimerTick\(data\)/);
  assert.match(script, /navigateToSolver/);
  assert.match(script, /onLoad/);
  assert.match(script, /onShow/);
  assert.match(script, /onHide/);
  assert.match(script, /onUnload/);
  assert.match(template, /wx:for="\{\{cells\}\}"/);
  assert.match(template, /wx:for="\{\{keypadDigits\}\}"/);
  assert.match(template, /bindtap="handleCellTap"/);
  assert.match(template, /bindtap="handleDigitTap"/);
  assert.match(template, /bindtap="handleDifficultyTap"/);
  assert.match(template, /bindtap="handleToggleNotes"/);
  assert.match(template, /bindtap="handleTogglePrefill"/);
  assert.match(template, /bindtap="handleLocatePrefill"/);
  assert.match(template, /bindtap="handleApplyHint"/);
  assert.match(template, /bindtap="handleClearCell"/);
  assert.match(template, /bindtap="handleResetGame"/);
  assert.match(template, /bindtap="handleRefreshGame"/);
  assert.match(template, /bindtap="handleConfirmNewGame"/);
  assert.match(template, /bindtap="handleCancelNewGame"/);
  assert.match(template, /bindtap="handleToggleNewGameConfirm"/);
  assert.match(template, /bindtap="handleOpenSolver"/);
  assert.match(template, /bindtap="handleOpenRules"/);
  assert.match(template, /换一局/);
  assert.match(template, /规则/);
  assert.match(template, /timerText/);
  assert.doesNotMatch(template, /bestTimeText/);
  assert.doesNotMatch(template, /hintCountText/);
  assert.doesNotMatch(template, /<view class="section-title">状态<\/view>/);
  assert.doesNotMatch(script, /showModal/);
  assert.match(script, /createNewGameDialogData/);
  assert.match(script, /canConfirmNewGame/);
  assert.match(script, /toggleNewGameDialogAcknowledgement/);
  assert.match(script, /handleRefreshGame/);
  assert.match(script, /handleConfirmNewGame/);
  assert.match(script, /handleCancelNewGame/);
  assert.match(script, /handleToggleNewGameConfirm/);
  assert.match(script, /handleOpenRules/);
  assert.match(script, /navigateTo\(\{\s*url:\s*['"`]\/pages\/rules\/index['"`]/);
  assert.match(script, /newGameDialogVisible/);
  assert.match(script, /newGameDialogAcknowledged/);
  assert.match(template, /new-game-dialog-mask/);
  assert.match(template, /new-game-dialog-card/);
  assert.match(template, /new-game-confirm-check/);
  assert.match(template, /newGameDialogTitle/);
  assert.match(template, /newGameDialogContent/);
  assert.match(template, /newGameDialogConfirmText/);
  assert.match(template, /newGameDialogCancelText/);
  assert.match(template, /newGameDialogSecondaryConfirmText/);
  assert.match(template, /newGameDialogConfirmEnabled/);
});

test('wechat rules page explains how to play sudoku with mobile-friendly sections', () => {
  const script = read('pages/rules/index.js');
  const template = read('pages/rules/index.wxml');
  const styles = read('pages/rules/index.wxss');

  assert.match(script, /Page\(/);
  assert.match(template, /数独怎么玩/);
  assert.match(template, /每一行/);
  assert.match(template, /每一列/);
  assert.match(template, /3×3|3x3/);
  assert.match(template, /规则说明/);
  assert.match(template, /操作提示/);
  assert.match(template, /view class="hero-card"/);
  assert.match(template, /view class="rule-card"/);
  assert.match(styles, /\.hero-card\s*\{/);
  assert.match(styles, /\.rule-card\s*\{/);
  assert.match(styles, /\.rule-list\s*\{/);
});

test('wechat solver page uses the shared controller and exposes image import and step regions', () => {
  const script = read('pages/solver/index.js');
  const template = read('pages/solver/index.wxml');
  const styles = read('pages/solver/index.wxss');

  assert.match(script, /createSolverController/);
  assert.match(script, /recognizeSudokuFromImage/);
  assert.match(script, /\.\.\/\.\.\/shared\/solver-controller\.js/);
  assert.match(script, /\.\.\/\.\.\/shared\/solver-image-import\.js/);
  assert.doesNotMatch(script, /\.\.\/\.\.\/\.\.\/shared\/solver-controller\.js/);
  assert.match(script, /onLoad/);
  assert.match(template, /wx:for="\{\{cells\}\}"/);
  assert.match(template, /wx:for="\{\{steps\}\}"/);
  assert.doesNotMatch(template, /hero-card/);
  assert.doesNotMatch(template, /stat-card/);
  assert.match(template, /bindtap="handleCellTap"/);
  assert.match(template, /bindtap="handleUploadImage"/);
  assert.match(template, /bindtap="handleSolve"/);
  assert.match(template, /bindtap="handleSample"/);
  assert.match(template, /bindtap="handleStartGuide"/);
  assert.match(template, /bindtap="handlePrevGuideStep"/);
  assert.match(template, /bindtap="handleNextGuideStep"/);
  assert.match(template, /bindtap="handleShowGuideSolution"/);
  assert.match(template, /上传图片/);
  assert.match(template, /从头引导/);
  assert.match(template, /上一步/);
  assert.match(template, /下一步/);
  assert.match(template, /最终答案/);
  assert.match(template, /canvas/);
  assert.match(template, /type="2d"/);
  assert.match(template, /solver-upload-canvas/);
  assert.match(template, /message/);
  assert.match(template, /stepCountText/);
  assert.match(template, /guideStepDescription/);
  assert.match(template, /guideProgressText/);
  assert.match(template, /scroll-into-view="\{\{guideScrollTargetId\}\}"/);
  assert.match(template, /id="\{\{item\.key\}\}"/);
  assert.match(template, /bindtap="handleJumpToGuideStep"/);
  assert.match(template, /data-step-index="\{\{item\.index\}\}"/);
  assert.match(script, /guideScrollTargetId/);
  assert.match(script, /handleJumpToGuideStep/);
  assert.doesNotMatch(template, /class="keypad"/);
  assert.doesNotMatch(template, /求解结果/);
  assert.doesNotMatch(template, /textarea/);
  assert.doesNotMatch(template, /移动端分析器/);
  assert.doesNotMatch(template, /SUKDO SOLVER/);
  assert.doesNotMatch(template, /建议上传正视角/);
  assert.doesNotMatch(template, /<view class="section-title">状态<\/view>/);
  assert.doesNotMatch(template, /清空全部/);
  assert.doesNotMatch(script, /handleInputChange/);
  assert.doesNotMatch(script, /handleImport/);
  assert.doesNotMatch(script, /handleDigitTap/);
  assert.doesNotMatch(script, /handleClear/);
  assert.match(script, /handleUploadImage/);
  assert.match(script, /handleStartGuide/);
  assert.match(script, /handlePrevGuideStep/);
  assert.match(script, /handleNextGuideStep/);
  assert.match(script, /handleShowGuideSolution/);
  assert.match(script, /chooseImage/);
  assert.match(script, /createSelectorQuery/);
  assert.match(styles, /\.guide-panel\s*\{/);
  assert.match(styles, /\.guide-controls\s*\{/);
  assert.match(styles, /\.step-item\.active\s*\{/);
  assert.match(styles, /\.upload-canvas\s*\{/);
  assert.doesNotMatch(styles, /\.solver-textarea\s*\{/);
});

test('wechat mini app styles the game and solver pages for mobile-first layouts', () => {
  const gameTemplate = read('pages/game/index.wxml');
  const gameStyles = read('pages/game/index.wxss');
  const solverTemplate = read('pages/solver/index.wxml');
  const solverStyles = read('pages/solver/index.wxss');
  const boardIndex = gameTemplate.indexOf('class="board-shell"');
  const difficultyIndex = gameTemplate.indexOf('class="difficulty-row"');
  const timerIndex = gameTemplate.indexOf('{{timerText}}');
  const actionIndex = gameTemplate.indexOf('class="action-grid"');

  assert.match(gameTemplate, /class="board-shell"/);
  assert.match(gameTemplate, /class="difficulty-pill/);
  assert.doesNotMatch(gameTemplate, /<button[\s\S]*class="cell /);
  assert.equal(boardIndex < difficultyIndex, true);
  assert.equal(timerIndex < boardIndex, true);
  assert.equal(actionIndex > difficultyIndex, true);
  assert.match(gameStyles, /\.cell\s*\{[\s\S]*height:\s*74rpx;/);
  assert.match(gameStyles, /\.top-timer-card\s*\{/);
  assert.match(gameStyles, /\.timer-value\s*\{[\s\S]*font-family:\s*[^;]*monospace;/);
  assert.match(gameStyles, /\.board-panel\s*\{/);
  assert.match(gameStyles, /\.control-chip\s*\{/);
  assert.match(gameStyles, /\.keypad\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(gameStyles, /\.action-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s);
  const solverActionIndex = solverTemplate.indexOf('class="action-grid"');
  const solverBoardIndex = solverTemplate.indexOf('class="board-shell"');
  const solverStepsIndex = solverTemplate.indexOf('class="steps"');

  assert.equal(solverActionIndex < solverBoardIndex, true);
  assert.equal(solverBoardIndex < solverStepsIndex, true);
  assert.match(solverTemplate, /scroll-view class="steps"/);
  assert.doesNotMatch(solverTemplate, /<button[\s\S]*class="cell /);
  assert.match(solverStyles, /\.cell\s*\{[\s\S]*height:\s*58rpx;/);
  assert.match(solverStyles, /\.steps\s*\{[\s\S]*max-height:\s*220rpx;/);
  assert.match(solverStyles, /\.compact-toolbar\s*\{/);
});

test('wechat mini app includes shared runtime modules inside the project root', () => {
  for (const file of runtimeSharedFiles) {
    const canonical = fs.readFileSync(path.join(sharedRoot, file), 'utf8');
    const runtimePath = path.join(root, 'shared', file);

    assert.equal(fs.existsSync(runtimePath), true, `${file} should exist in miniapps/wechat/shared`);
    assert.equal(fs.readFileSync(runtimePath, 'utf8'), canonical, `${file} should match miniapps/shared/${file}`);
  }
});

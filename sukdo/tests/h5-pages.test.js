import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const desktopIndexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const desktopSolverHtml = readFileSync(new URL('../solver.html', import.meta.url), 'utf8');
const h5Styles = readFileSync(new URL('../h5/styles.css', import.meta.url), 'utf8');
const h5GamePageSource = readFileSync(new URL('../src/h5/game-page.js', import.meta.url), 'utf8');
const h5SolverPageSource = readFileSync(new URL('../src/h5/solver-page.js', import.meta.url), 'utf8');

test('h5/index.html exists and exposes the mobile game anchors', () => {
  const pagePath = new URL('../h5/index.html', import.meta.url);

  assert.equal(existsSync(pagePath), true);

  const html = readFileSync(pagePath, 'utf8');

  assert.match(html, /id="h5-game-board"/);
  assert.match(html, /id="h5-game-keypad"/);
  assert.match(html, /id="h5-difficulty-buttons"/);
  assert.match(html, /id="h5-game-message"/);
  assert.match(html, /id="h5-new-game-dialog"/);
  assert.match(html, /id="h5-solver-link"/);
  assert.match(html, /class="mobile-hero compact-hero game-hero"/);
  assert.match(html, /id="h5-timer"/);
  assert.doesNotMatch(html, /href="\.\.\/index\.html"/);
  assert.doesNotMatch(html, /class="stats-grid"/);
  assert.doesNotMatch(html, /id="h5-best-time"/);
  assert.doesNotMatch(html, /id="h5-hint-count"/);
  assert.doesNotMatch(html, /复用原生小程序共享逻辑/);
  assert.match(html, /src="\.\.\/src\/h5\/game-page\.js\?v=[^"]+"/);
});

test('h5/solver.html exists and exposes the solver anchors', () => {
  const pagePath = new URL('../h5/solver.html', import.meta.url);

  assert.equal(existsSync(pagePath), true);

  const html = readFileSync(pagePath, 'utf8');

  assert.match(html, /id="h5-solver-board"/);
  assert.match(html, /id="h5-solver-primary-actions"/);
  assert.match(html, /id="h5-solver-solve"/);
  assert.match(html, /id="h5-solver-clear"/);
  assert.match(html, /id="h5-solver-steps"/);
  assert.match(html, /class="solver-workspace"/);
  assert.match(html, /class="mobile-hero compact-hero solver-hero"/);
  assert.match(html, /class="panel-card solver-board-panel"/);
  assert.match(html, /class="panel-card guide-panel solver-guide-panel"/);
  assert.doesNotMatch(html, /id="h5-solver-message"/);
  assert.doesNotMatch(html, /id="h5-solver-guide-title"/);
  assert.doesNotMatch(html, /id="h5-solver-guide-description"/);
  assert.doesNotMatch(html, /id="h5-solver-keypad"/);
  assert.doesNotMatch(html, /id="h5-solver-input"/);
  assert.doesNotMatch(html, /id="h5-solver-import"/);
  assert.doesNotMatch(html, /id="h5-solver-sample"/);
  assert.doesNotMatch(html, /文本导入/);
  assert.doesNotMatch(html, /载入示例/);
  assert.doesNotMatch(html, /href="\.\.\/solver\.html"/);
  assert.match(html, /id="h5-solver-primary-actions"[\s\S]*id="h5-solver-solve"/);
  assert.match(html, /src="\.\.\/src\/h5\/solver-page\.js\?v=[^"]+"/);
});

test('desktop entry page links to the H5 experience, while the desktop solver page stays focused', () => {
  assert.match(desktopIndexHtml, /href="\.\/h5\/index\.html"/);
  assert.doesNotMatch(desktopSolverHtml, /href="\.\/h5\/solver\.html"/);
});

test('h5 board uses explicit square tracks without clipping the last row', () => {
  assert.match(h5Styles, /\.board\s*\{[\s\S]*grid-template-rows:\s*repeat\(9,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(h5Styles, /\.cell\s*\{[\s\S]*min-height:\s*0;/);
  assert.doesNotMatch(h5Styles, /\.cell\s*\{[\s\S]*min-height:\s*clamp\(/);
});

test('h5 solver layout keeps the board compact and limits the step list to a three-item scroll area', () => {
  assert.doesNotMatch(h5Styles, /\.solver-shell\s*\{[^}]*overflow:\s*hidden;/);
  assert.match(h5Styles, /\.solver-workspace\s*\{[\s\S]*display:\s*flex;/);
  assert.match(h5Styles, /\.solver-workspace\s*\{[\s\S]*flex-direction:\s*column;/);
  assert.match(h5Styles, /\.solver-hero\s*\{[\s\S]*padding:\s*0\.7rem;/);
  assert.match(h5Styles, /\.solver-hero\s+\.hero-topline\s*\{[\s\S]*flex-direction:\s*row;/);
  assert.match(h5Styles, /\.solver-hero\s+\.hero-topline\s*\{[\s\S]*justify-content:\s*space-between;/);
  assert.match(h5Styles, /\.solver-hero\s+\.hero-topline\s+h1\s*\{[\s\S]*font-size:\s*clamp\(1\.45rem,\s*5\.4vw,\s*2rem\);/);
  assert.match(h5Styles, /\.solver-board-panel\s+\.board-shell\s*\{[\s\S]*max-width:\s*min\(100%,\s*clamp\(/);
  assert.match(h5Styles, /--solver-step-preview-height:\s*3\.2rem;/);
  assert.match(h5Styles, /\.solver-steps\s*\{[\s\S]*max-height:\s*calc\(/);
  assert.match(h5Styles, /\.solver-steps\s*\{[\s\S]*overflow-y:\s*auto;/);
});

test('h5 solver page removes the digit keypad and scrolls the active guide step into view after navigation', () => {
  assert.doesNotMatch(h5SolverPageSource, /#h5-solver-keypad/);
  assert.doesNotMatch(h5SolverPageSource, /#h5-solver-message/);
  assert.doesNotMatch(h5SolverPageSource, /#h5-solver-guide-title/);
  assert.doesNotMatch(h5SolverPageSource, /#h5-solver-guide-description/);
  assert.doesNotMatch(h5SolverPageSource, /renderStatusMessage/);
  assert.doesNotMatch(h5SolverPageSource, /renderDigitKeypad\(/);
  assert.match(h5SolverPageSource, /querySelector\('\.solver-step\.active'\)/);
  assert.match(h5SolverPageSource, /scrollIntoView\(\{[\s\S]*behavior:\s*'smooth'[\s\S]*block:\s*'nearest'[\s\S]*\}\)/);
});

test('h5 game page uses a compact hero without legacy stats cards', () => {
  assert.doesNotMatch(h5GamePageSource, /#h5-best-time/);
  assert.doesNotMatch(h5GamePageSource, /#h5-hint-count/);
  assert.match(h5GamePageSource, /#h5-timer/);
  assert.match(h5Styles, /\.game-hero\s*\{[\s\S]*padding:\s*0\.7rem;/);
  assert.match(h5Styles, /\.game-hero\s+\.hero-topline\s*\{[\s\S]*flex-direction:\s*row;/);
  assert.match(h5Styles, /\.game-hero\s+\.hero-topline\s+h1\s*\{[\s\S]*font-size:\s*clamp\(1\.45rem,\s*5\.4vw,\s*2rem\);/);
  assert.match(h5Styles, /\.board-meta\s*\{[\s\S]*display:\s*flex;/);
  assert.doesNotMatch(h5Styles, /\.stats-grid\s*\{/);
  assert.doesNotMatch(h5Styles, /\.stat-card\s*\{/);
});

test('h5 same-value cells keep a distinct visual emphasis beyond the shared background tint', () => {
  assert.match(h5Styles, /\.cell\.same-value\s*\{[^}]*background:/);
  assert.match(h5Styles, /\.cell\.same-value\s*\{[^}]*box-shadow:/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('index.html links to the dedicated solver page', () => {
  assert.match(indexHtml, /href="\.\/solver\.html"/);
});

test('solver.html exists and provides the required solver UI anchors', () => {
  const solverPath = new URL('../solver.html', import.meta.url);

  assert.equal(existsSync(solverPath), true);

  const solverHtml = readFileSync(solverPath, 'utf8');

  assert.match(solverHtml, /id="solver-board"/);
  assert.match(solverHtml, /id="solver-solve"/);
  assert.match(solverHtml, /id="solver-clear"/);
  assert.match(solverHtml, /id="solver-sample"/);
  assert.match(solverHtml, /id="solver-message"/);
  assert.match(solverHtml, /id="solver-steps"/);
  assert.match(solverHtml, /id="solver-step-count"/);
  assert.match(solverHtml, /id="solver-guide-prev"/);
  assert.match(solverHtml, /id="solver-guide-next"/);
  assert.doesNotMatch(solverHtml, /id="solver-input"/);
  assert.doesNotMatch(solverHtml, /id="solver-import"/);
  assert.doesNotMatch(solverHtml, /id="solver-result-board"/);
  assert.doesNotMatch(solverHtml, /粘贴导入/);
  assert.doesNotMatch(solverHtml, /<details/);
  assert.doesNotMatch(solverHtml, /class="hero-card"/);
  assert.doesNotMatch(solverHtml, /SUKDO SOLVER/);
  assert.doesNotMatch(solverHtml, /返回游戏/);
  assert.doesNotMatch(solverHtml, /打开 H5 解题页/);
  assert.doesNotMatch(solverHtml, /hero-stats/);
  assert.doesNotMatch(solverHtml, /panel-note/);
});

test('desktop solver step list is always expanded but constrained to an internal scroll area', () => {
  assert.match(styles, /\.solver-steps\s*\{[\s\S]*max-height:\s*calc\(/);
  assert.match(styles, /\.solver-steps\s*\{[\s\S]*overflow-y:\s*auto;/);
});

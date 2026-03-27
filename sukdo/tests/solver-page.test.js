import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('index.html links to the dedicated solver page', () => {
  assert.match(indexHtml, /href="\.\/solver\.html"/);
});

test('solver.html exists and provides the required solver UI anchors', () => {
  const solverPath = new URL('../solver.html', import.meta.url);

  assert.equal(existsSync(solverPath), true);

  const solverHtml = readFileSync(solverPath, 'utf8');

  assert.match(solverHtml, /id="solver-board"/);
  assert.match(solverHtml, /id="solver-input"/);
  assert.match(solverHtml, /id="solver-import"/);
  assert.match(solverHtml, /id="solver-solve"/);
  assert.match(solverHtml, /id="solver-result-board"/);
  assert.match(solverHtml, /id="solver-steps"/);
});

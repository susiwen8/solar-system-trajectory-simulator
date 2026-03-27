import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('board interaction highlights use non-error colors', () => {
  assert.match(styles, /\.cell\.selected\s*\{\s*background:\s*rgba\(47,\s*124,\s*125,\s*0\.18\);\s*\}/);
  assert.match(styles, /\.cell\.same-value\s*\{\s*background:\s*rgba\(23,\s*49,\s*58,\s*0\.1\);\s*\}/);
  assert.doesNotMatch(styles, /\.cell\.selected\s*\{\s*background:\s*rgba\(224,\s*105,\s*66,\s*0\.18\);\s*\}/);
});

test('board styles visually separate given digits from player-entered digits', () => {
  assert.match(styles, /\.cell\.fixed\s*\{[\s\S]*background:\s*rgba\(23,\s*49,\s*58,\s*0\.06\);/);
  assert.match(styles, /\.cell\.player-entry\s*\{[\s\S]*color:\s*var\(--teal\);/);
});

test('prefill cells and traced origin have dedicated visual treatments', () => {
  assert.match(styles, /\.cell\.prefill-entry\s*\{[\s\S]*box-shadow:/);
  assert.match(styles, /\.cell\.trace-origin\s*\{[\s\S]*outline:/);
});

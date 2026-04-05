import test from 'node:test';
import assert from 'node:assert/strict';

const commonJsRuntimeModule = import(`../src/h5/commonjs-runtime.js?test=${Date.now()}-runtime`);
const platformModule = import(`../src/h5/platform.js?test=${Date.now()}-platform`);

test('createCommonJsRuntime caches loaded modules', async () => {
  const { createCommonJsRuntime } = await commonJsRuntimeModule;
  let reads = 0;
  const moduleUrl = 'https://example.test/shared/value.js';

  const runtime = createCommonJsRuntime({
    async readText(url) {
      reads += 1;
      assert.equal(url, moduleUrl);
      return 'module.exports = { value: 42 };';
    }
  });

  const first = await runtime.loadModule(moduleUrl);
  const second = await runtime.loadModule(moduleUrl);

  assert.equal(first.value, 42);
  assert.equal(second, first);
  assert.equal(reads, 1);
});

test('createCommonJsRuntime resolves relative requires', async () => {
  const { createCommonJsRuntime } = await commonJsRuntimeModule;
  const sources = new Map([
    [
      'https://example.test/miniapps/shared/game-controller.js',
      "const dep = require('./dep.js'); module.exports = { label: dep.label + ' controller' };"
    ],
    [
      'https://example.test/miniapps/shared/dep.js',
      "exports.label = 'shared';"
    ]
  ]);

  const runtime = createCommonJsRuntime({
    async readText(url) {
      const source = sources.get(url);

      if (!source) {
        throw new Error(`Missing module: ${url}`);
      }

      return source;
    }
  });

  const loaded = await runtime.loadModule('https://example.test/miniapps/shared/game-controller.js');

  assert.deepEqual(loaded, { label: 'shared controller' });
});

test('loadCommonJsModule exposes module exports from executed source', async () => {
  const { loadCommonJsModule } = await commonJsRuntimeModule;

  const loaded = await loadCommonJsModule('https://example.test/entry.js', {
    async readText(url) {
      assert.equal(url, 'https://example.test/entry.js');
      return 'exports.answer = 81;';
    }
  });

  assert.equal(loaded.answer, 81);
});

test('createJsonStorage reads and writes JSON safely', async () => {
  const { createJsonStorage } = await platformModule;
  const data = new Map([
    ['valid', JSON.stringify({ puzzle: '53.' })],
    ['broken', '{']
  ]);
  const storage = createJsonStorage({
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    }
  });

  assert.deepEqual(storage.read('valid'), { puzzle: '53.' });
  assert.equal(storage.read('broken'), null);

  storage.write('session', { elapsedSeconds: 12 });

  assert.deepEqual(JSON.parse(data.get('session')), { elapsedSeconds: 12 });
});

test('createJsonStorage swallows storage exceptions', async () => {
  const { createJsonStorage } = await platformModule;
  const storage = createJsonStorage({
    getItem() {
      throw new Error('read denied');
    },
    setItem() {
      throw new Error('write denied');
    }
  });

  assert.equal(storage.read('anything'), null);
  assert.doesNotThrow(() => {
    storage.write('anything', { ok: true });
  });
});

test('buildSolverHref encodes the shared puzzle string for H5 navigation', async () => {
  const { buildSolverHref } = await platformModule;

  assert.equal(
    buildSolverHref('./solver.html', '53.0'),
    './solver.html?puzzle=53.0'
  );
  assert.equal(
    buildSolverHref('./solver.html', '53+ 0'),
    './solver.html?puzzle=53%2B%200'
  );
});

test('getQueryPuzzle extracts the incoming puzzle string from location search', async () => {
  const { getQueryPuzzle } = await platformModule;

  assert.equal(getQueryPuzzle('?puzzle=53.0'), '53.0');
  assert.equal(getQueryPuzzle('?foo=1'), '');
  assert.equal(getQueryPuzzle(''), '');
});

import test from 'node:test';
import assert from 'node:assert/strict';

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  toggle(name, force) {
    if (force === undefined) {
      if (this.values.has(name)) {
        this.values.delete(name);
      } else {
        this.values.add(name);
      }

      return this.values.has(name);
    }

    if (force) {
      this.values.add(name);
      return true;
    }

    this.values.delete(name);
    return false;
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.listeners = {};
    this.classList = new FakeClassList();
  }

  addEventListener(type, handler) {
    this.listeners[type] ??= [];
    this.listeners[type].push(handler);
  }
}

function countCells(markup) {
  return (markup.match(/data-row="/g) ?? []).length;
}

function createHarness() {
  const windowListeners = {};
  const selectors = {
    '#solver-board': new FakeElement(),
    '#solver-input': new FakeElement(),
    '#solver-import': new FakeElement(),
    '#solver-solve': new FakeElement(),
    '#solver-clear': new FakeElement(),
    '#solver-sample': new FakeElement(),
    '#solver-message': new FakeElement(),
    '#solver-result-board': new FakeElement(),
    '#solver-steps': new FakeElement(),
    '#solver-step-count': new FakeElement()
  };

  global.document = {
    querySelector(selector) {
      return selectors[selector] ?? null;
    }
  };

  global.window = {
    location: {
      search: ''
    },
    addEventListener(type, handler) {
      windowListeners[type] = handler;
    }
  };

  global.location = global.window.location;

  return {
    selectors,
    windowListeners
  };
}

test('solver-main bootstraps and solves the sample puzzle', async () => {
  const { selectors } = createHarness();

  await import(`../src/solver-main.js?test=${Date.now()}`);

  assert.equal(countCells(selectors['#solver-board'].innerHTML), 81);

  selectors['#solver-sample'].listeners.click[0]();
  selectors['#solver-solve'].listeners.click[0]();

  assert.match(selectors['#solver-message'].textContent, /已找到唯一解/);
  assert.equal(countCells(selectors['#solver-result-board'].innerHTML), 81);
  assert.match(selectors['#solver-steps'].innerHTML, /<li>/);
  assert.match(selectors['#solver-step-count'].textContent, /\d+/);
});

test('solver-main flags conflicts immediately after importing an invalid puzzle', async () => {
  const { selectors } = createHarness();

  await import(`../src/solver-main.js?test=${Date.now()}-invalid`);

  selectors['#solver-input'].value =
    '550000000' +
    '000000000' +
    '000000000' +
    '000000000' +
    '000000000' +
    '000000000' +
    '000000000' +
    '000000000' +
    '000000000';

  selectors['#solver-import'].listeners.click[0]();

  assert.match(selectors['#solver-board'].innerHTML, /conflict/);
  assert.equal(
    selectors['#solver-message'].textContent,
    '当前题目有冲突，请先修正高亮格子。'
  );
});

test('solver-main ignores board hotkeys while the textarea is focused', async () => {
  const { selectors, windowListeners } = createHarness();

  await import(`../src/solver-main.js?test=${Date.now()}-textarea-focus`);

  windowListeners.keydown({
    key: '5',
    target: { tagName: 'TEXTAREA' }
  });

  assert.doesNotMatch(selectors['#solver-board'].innerHTML, />5</);
});

test('solver-main preloads a valid puzzle from the URL without auto-solving it', async () => {
  const { selectors } = createHarness();
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

  global.window.location.search = `?puzzle=${puzzle}`;

  await import(`../src/solver-main.js?test=${Date.now()}-query-preload`);

  assert.equal(selectors['#solver-input'].value, puzzle);
  assert.match(selectors['#solver-board'].innerHTML, />5</);
  assert.equal(selectors['#solver-step-count'].textContent, '0');
  assert.match(selectors['#solver-result-board'].innerHTML, /求解后会在这里显示完整答案/);
  assert.equal(selectors['#solver-steps'].innerHTML, '');
});

test('solver-main falls back gracefully when the URL puzzle is invalid', async () => {
  const { selectors } = createHarness();
  global.window.location.search = '?puzzle=123';

  await import(`../src/solver-main.js?test=${Date.now()}-query-invalid`);

  assert.equal(selectors['#solver-input'].value, '');
  assert.equal(
    selectors['#solver-message'].textContent,
    '带入题目失败，请重新导入或手动填写。'
  );
  assert.equal(selectors['#solver-step-count'].textContent, '0');
});

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
    addEventListener(type, handler) {
      windowListeners[type] = handler;
    }
  };

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

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
    this.disabled = false;
    this.listeners = {};
    this.classList = new FakeClassList();
  }

  addEventListener(type, handler) {
    this.listeners[type] ??= [];
    this.listeners[type].push(handler);
  }

  querySelector() {
    return null;
  }
}

function countCells(markup) {
  return (markup.match(/data-row="/g) ?? []).length;
}

function getButtonMarkup(markup, label) {
  const buttons = markup.match(/<button[\s\S]*?<\/button>/g) ?? [];
  return buttons.find((button) => button.includes(`aria-label="${label}"`)) ?? '';
}

function getButtonClassNames(markup, label) {
  const match = getButtonMarkup(markup, label).match(/class="([^"]+)"/);
  return match?.[1] ?? '';
}

function getStepClassNames(markup, index) {
  const items = markup.match(/<li[\s\S]*?<\/li>/g) ?? [];
  const target = items.find((item) => item.includes(`data-step-index="${index}"`)) ?? '';
  const match = target.match(/class="([^"]+)"/);
  return match?.[1] ?? '';
}

function createHarness() {
  const windowListeners = {};
  const selectors = {
    '#solver-board': new FakeElement(),
    '#solver-solve': new FakeElement(),
    '#solver-clear': new FakeElement(),
    '#solver-sample': new FakeElement(),
    '#solver-guide-prev': new FakeElement(),
    '#solver-guide-next': new FakeElement(),
    '#solver-message': new FakeElement(),
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
  assert.equal(selectors['#solver-guide-prev'].disabled, true);
  assert.equal(selectors['#solver-guide-next'].disabled, true);

  selectors['#solver-sample'].listeners.click[0]();
  selectors['#solver-solve'].listeners.click[0]();

  assert.match(selectors['#solver-message'].textContent, /已找到唯一解/);
  assert.equal(countCells(selectors['#solver-board'].innerHTML), 81);
  assert.match(selectors['#solver-board'].innerHTML, /result-cell/);
  assert.match(selectors['#solver-steps'].innerHTML, /data-step-index="0"/);
  assert.match(getStepClassNames(selectors['#solver-steps'].innerHTML, 50), /\bactive\b/);
  assert.match(selectors['#solver-step-count'].textContent, /\d+/);
  assert.equal(selectors['#solver-guide-prev'].disabled, false);
  assert.equal(selectors['#solver-guide-next'].disabled, true);
});

test('solver-main lets the user click a solve step to replay that moment on the board', async () => {
  const { selectors } = createHarness();

  await import(`../src/solver-main.js?test=${Date.now()}-guide-step-click`);

  selectors['#solver-sample'].listeners.click[0]();
  selectors['#solver-solve'].listeners.click[0]();
  selectors['#solver-steps'].listeners.click[0]({
    target: {
      closest() {
        return {
          dataset: {
            stepIndex: '3'
          }
        };
      }
    }
  });

  assert.match(getStepClassNames(selectors['#solver-steps'].innerHTML, 0), /\bdone\b/);
  assert.match(getStepClassNames(selectors['#solver-steps'].innerHTML, 3), /\bactive\b/);
  assert.match(
    getButtonClassNames(selectors['#solver-board'].innerHTML, '输入第 5 行第 3 列'),
    /\bguide-focus\b/
  );
  assert.match(
    getButtonMarkup(selectors['#solver-board'].innerHTML, '输入第 5 行第 3 列'),
    />6</
  );
  assert.doesNotMatch(
    getButtonMarkup(selectors['#solver-board'].innerHTML, '输入第 9 行第 7 列'),
    />1</
  );
});

test('solver-main lets previous and next buttons move through guide steps', async () => {
  const { selectors } = createHarness();

  await import(`../src/solver-main.js?test=${Date.now()}-guide-buttons`);

  selectors['#solver-sample'].listeners.click[0]();
  selectors['#solver-solve'].listeners.click[0]();

  selectors['#solver-guide-prev'].listeners.click[0]();

  assert.match(getStepClassNames(selectors['#solver-steps'].innerHTML, 49), /\bactive\b/);
  assert.equal(selectors['#solver-guide-prev'].disabled, false);
  assert.equal(selectors['#solver-guide-next'].disabled, false);
  assert.doesNotMatch(
    getButtonMarkup(selectors['#solver-board'].innerHTML, '输入第 9 行第 7 列'),
    />1</
  );

  selectors['#solver-guide-next'].listeners.click[0]();

  assert.match(getStepClassNames(selectors['#solver-steps'].innerHTML, 50), /\bactive\b/);
  assert.equal(selectors['#solver-guide-next'].disabled, true);
  assert.match(
    getButtonMarkup(selectors['#solver-board'].innerHTML, '输入第 9 行第 7 列'),
    />1</
  );
});

test('solver-main flags conflicts immediately while entering an invalid puzzle on the board', async () => {
  const { selectors, windowListeners } = createHarness();

  await import(`../src/solver-main.js?test=${Date.now()}-invalid`);

  selectors['#solver-board'].listeners.click[0]({
    target: {
      closest() {
        return {
          dataset: {
            row: '0',
            col: '0'
          }
        };
      }
    }
  });
  windowListeners.keydown({ key: '5', target: { tagName: 'BODY' } });

  selectors['#solver-board'].listeners.click[0]({
    target: {
      closest() {
        return {
          dataset: {
            row: '0',
            col: '1'
          }
        };
      }
    }
  });
  windowListeners.keydown({ key: '5', target: { tagName: 'BODY' } });

  assert.match(selectors['#solver-board'].innerHTML, /conflict/);
  assert.equal(
    selectors['#solver-message'].textContent,
    '当前题目有冲突，请先修正高亮格子。'
  );
});

test('solver-main lets keyboard input edit the selected board cell directly', async () => {
  const { selectors, windowListeners } = createHarness();

  await import(`../src/solver-main.js?test=${Date.now()}-board-hotkeys`);

  selectors['#solver-board'].listeners.click[0]({
    target: {
      closest() {
        return {
          dataset: {
            row: '0',
            col: '0'
          }
        };
      }
    }
  });
  windowListeners.keydown({ key: '5', target: { tagName: 'BODY' } });

  assert.match(selectors['#solver-board'].innerHTML, />5</);
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

  assert.match(selectors['#solver-board'].innerHTML, />5</);
  assert.equal(selectors['#solver-step-count'].textContent, '0');
  assert.doesNotMatch(selectors['#solver-board'].innerHTML, /result-cell/);
  assert.equal(selectors['#solver-steps'].innerHTML, '');
});

test('solver-main falls back gracefully when the URL puzzle is invalid', async () => {
  const { selectors } = createHarness();
  global.window.location.search = '?puzzle=123';

  await import(`../src/solver-main.js?test=${Date.now()}-query-invalid`);

  assert.equal(
    selectors['#solver-message'].textContent,
    '带入题目失败，请重新刷新或手动填写。'
  );
  assert.equal(selectors['#solver-step-count'].textContent, '0');
});
